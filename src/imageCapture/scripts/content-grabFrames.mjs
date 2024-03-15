// Image capture module for content.js

// ToDo: running multiple intervals at once
// refactor this to grab images out of the worker? Already have a reader there, but then would need to
//  send the images back to the content script

import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch️ 🕵📸️`);

const mh = new MessageHandler('content');
let storage = await new StorageHandler("local", debug);

let captureInterval;
let currentStream = null;
let running = false;
let lastImageUrl = URL.createObjectURL(new Blob());

let settings = storage.contents['imageCapture'];
debug("Image Capture settings:", settings);

// Set default values if storage is blank
const initSettings = {
    startOnPc: storage.contents['imageCapture']?.startOnPc || false,
    captureIntervalMs: storage.contents['imageCapture']?.captureIntervalMs || (60 * 1000),
    active: storage.contents['imageCapture']?.active || false,
    enabled: storage.contents['imageCapture']?.enabled || false
};

// ToDo: change this to update
await storage.set('imageCapture', initSettings);


/**
 * Generator that uses Media stream processor to get images
 * @param {MediaStream} stream - the stream to process
 * @param {boolean} thumbnail - whether to resize to thumbnail size (for preview)
 * @returns {Promise<AsyncGenerator>} - the generator
 */
async function* getImages(stream, thumbnail = false) {
    const [track] = stream?.getVideoTracks();
    if (!track) {
        debug("No video track to grab frames from");
        return null
    }

    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    let {width, height, deviceId} = track.getSettings();
    if (thumbnail) {
        height = 90;
        width = 90 * (width / height);
    }
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("bitmaprenderer");

    try {
        while (true) {
            running = true;
            const {value: frame, done} = await reader.read();
            if (done) break;

            const bitmap = await createImageBitmap(frame, 0, 0, frame.codedWidth, frame.codedHeight, {resizeHeight: height});
            ctx.transferFromImageBitmap(bitmap);
            const blob = await canvas.convertToBlob({type: "image/jpeg", quality: 1});
            const blobUrl = URL.createObjectURL(blob);


            yield {
                url: window?.location.href || "",
                date: new Date().toLocaleString(),
                deviceId,
                blobUrl,
                width,
                height
            };

            frame.close();
            bitmap.close();

            URL.revokeObjectURL(lastImageUrl);
            lastImageUrl = blobUrl;
        }
    } catch (error) {
        debug("Error processing stream:", error);
    } finally {
        reader.releaseLock();
        running = false;
    }
}


//

/**
 * Sets up an interval timer for getImages and handles messaging
 * Checks the stream before getting images
 * Sends the image
 * @param {MediaStream} newStream - the stream to process
 * @returns {Promise<void>} - waits for storage updates
 * */
export async function grabFrames(newStream = currentStream) {

    // Check globals

    if (!storage.contents['imageCapture'].enabled) {
        debug("Image capture is not enabled");
        return
    }

    if (running) {
        debug("Image capture is already running");
        return
    }

    if (!newStream?.active && !currentStream?.active) {
        debug("No active stream to grab frames from");
        return
    }


    // Check the newStream if it is supplied
    if (newStream) {

        // is the newStream is active?
        if (!newStream?.active) {
            debug("supplied stream is not active", newStream);
            return
        }
        const newStreamSettings = newStream.getVideoTracks()[0].getSettings();

        // Is the newStream a screen share (Google Meet capture method)
        if (newStreamSettings.displaySurface) {
            debug("New stream looks like a screen share", newStream, settings);
            return
        }

        // If there is no existing stream, then use the new one
        if (!currentStream?.active) {
            currentStream = newStream;
        }
        // Is the current stream bigger than the new stream?
        else {
            const currentStreamSettings = currentStream.getVideoTracks()[0].getSettings();
            const currentStreamPixels = currentStreamSettings.height * currentStreamSettings.width;
            const newStreamPixels = newStreamSettings.height * newStreamSettings.width;

            if (currentStreamPixels >= newStreamPixels) {
                debug(`New stream ${currentStreamPixels} pixels are fewer than current stream ${currentStreamPixels}`);
                return
            }
        }
    } else {
        // if it is not supplied, use the current stream
        newStream = currentStream;
    }


    // Now start capturing images and send them
    const getImg = getImages(newStream);

    // clear the current interval if it is running
    clearInterval(captureInterval);
    captureInterval = setInterval(async () => {
        const imgData = await getImg.next();

        if (imgData.value) {
            const {deviceId, width, height} = imgData.value;
            debug(`New image ${width}x${height} from ${deviceId}`);
            await mh.sendMessage('all', m.FRAME_CAPTURE, imgData.value);
        }

        if (imgData.done) {
            clearInterval(captureInterval);
            await storage.update('imageCapture', {active: false});
            debug("No more image data", imgData);
        }
    }, storage.contents['imageCapture'].captureIntervalMs);

    await storage.update('imageCapture', {active: true});

}

/** Class that regularly generates images from a stream
 * @param {MediaStream} stream - defaults to currentStream global
 * @param {number} captureIntervalMs - how often to send the image, defaults to 1000ms
 * @param {string} destination- where to send the image, defaults to dash
 * @param {boolean}thumbnail -  to resize the image to thumbnail size, defaults to false
 * */
export class ImageStream {
     constructor(stream = currentStream, captureIntervalMs = 250, destination = 'dash', thumbnail = false) {
        this.stream = stream;
        this.captureIntervalMs = captureIntervalMs;
        this.destination = destination;
        this.thumbnail = thumbnail;
        this.running = false;
        this.captureInterval = null;
    }

    /**
     * Periodically stream of images - intended for preview function in dash
     * @returns {Promise<void>} -
     */
    async start() {

        const getImg = await getImages(this.stream, this.thumbnail);
        return new Promise(async (resolve, reject) => {

            if (!this.stream?.getVideoTracks()[0]) {
                reject("No video tracks to capture from", this.stream);
                return
            }

            this.captureInterval = setInterval(async () => {

                if (!this.stream?.active) {
                    clearInterval(this.captureInterval);
                    resolve("imageStream stream is no longer active", this.stream)
                }

                const {value, done} = await getImg.next();

                if (value) {
                    // debug("Preview image", value);
                    await sendMessage(this.destination, m.FRAME_CAPTURE, value);
                }

                if (done) {
                    clearInterval(this.captureInterval);
                    resolve("No more image data")
                }
            }, this.captureIntervalMs);
        });
    }

    /**
     * Stops the image stream
     * @returns {Promise<void>} -
     */
    async stop() {
        clearInterval(this.captureInterval);
    }


}


// check for settings changes
storage.addListener('imageCapture', async (newValue) => {
    debug(`imageCapture storage changes: `, newValue);

    // Stop sampling
    if (storage.contents['imageCapture']?.active === true && newValue?.active === false) {
        debug("Stopping image capture");
        clearInterval(captureInterval);
        await storage.update('imageCapture', {active: false});
    }
    // Start sampling
    else if (storage.contents['imageCapture']?.enabled && newValue?.active && !running) { //} && currentStream?.active) {
        debug("Starting image capture");
        await grabFrames();
    }
    // Change the sampling interval
    else if (newValue.captureIntervalMs) {
        debug(`Changing image capture interval to ${newValue.captureIntervalMs}`);
        clearInterval(captureInterval);
        if (storage.contents['imageCapture']?.active)
            await grabFrames();
    }

});
