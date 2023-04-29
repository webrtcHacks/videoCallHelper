// ToDo: running multiple intervals at once
// ToDo: refactor this to grab images out of the worker?

import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

// Image capture module for content.js
const debug = function () {
    return Function.prototype.bind.call(console.debug, console, `vch 🕵️ imageCapture: `);
}();

const sendMessage = new MessageHandler('content', debug, false).sendMessage;
let storage = await new StorageHandler("local", debug);

let captureInterval;
let currentStream = null;
let running = false;

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


// Generator that uses Media stream processor to get images
async function* getImages(stream) {
    // Insertable stream image capture
    const [track] = stream?.getVideoTracks();
    if(!track){
        debug("No video track to grab frames from");
        return
    }
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    const {width, height, deviceId, groupId} = stream.getVideoTracks()[0].getSettings()
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("bitmaprenderer");

    let stopGenerator = false;
    let running = true;

    async function readFrame() {
        const {value: frame, done} = await reader.read();
        if (frame && !done) {

            const bitmap = await createImageBitmap(frame, 0, 0, frame.codedWidth, frame.codedHeight);
            ctx.transferFromImageBitmap(bitmap);
            const blob = await canvas.convertToBlob({type: "image/jpeg", quality: 1});
            const blobUrl = window.URL.createObjectURL(blob);

            frame.close();
            bitmap.close();

            return blobUrl
        }
    }

    while (!stopGenerator) {
        const blobUrl = await readFrame();

        if (blobUrl) {
            const imgData = {
                url: window?.location.href || "",
                date: (new Date()).toLocaleString(),
                deviceId: deviceId,
                blobUrl: blobUrl,
                width: width,
                height: height
            }
            yield imgData
        } else {
            stopGenerator = true;
            running = false;
            return false
        }
    }
}


// Check the stream before getting images
export async function grabFrames(newStream) {

    // Check globals

    if(!storage.contents['imageCapture'].enabled){
        debug("Image capture is not enabled");
        return
    }

    if(running){
        debug("Image capture is already running");
        return
    }

    if(!newStream?.active && !currentStream?.active){
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
    }
    else{
        // if it is not supplied, use the current stream
        newStream = currentStream;
    }


    // Now start capturing images and send them
    const getImg = getImages(newStream);

    // clear the current interval if it is running
    clearInterval(captureInterval);
    captureInterval = setInterval(async () => {
        const imgData = await getImg.next();

        if (imgData.value)
            await sendMessage('all', m.FRAME_CAPTURE, imgData.value);

        if (imgData.done) {
            clearInterval(captureInterval);
            await storage.update('imageCapture', {active: false});
            debug("No more image data", imgData);
        }
    }, storage.contents['imageCapture'].captureIntervalMs);

    await storage.update('imageCapture', {active: true});

}


// check for settings changes
storage.addListener('imageCapture', async (newValue) => {
    debug(`imageCapture storage changes: `, newValue);

    // Stop sampling
    if (storage.contents['imageCapture'].active === true && newValue?.active === false) {
        debug("Stopping image capture");
        clearInterval(captureInterval);
        await storage.update('imageCapture', {active: false});
    }
    // Start sampling
    else if (storage.contents['imageCapture'].enabled && newValue?.active && !running){ //} && currentStream?.active) {
        debug("Starting image capture");
        await grabFrames();
    }
    // Change the sampling interval
    else if (newValue.captureIntervalMs) {
        debug(`Changing image capture interval to ${newValue.captureIntervalMs}`);
        clearInterval(captureInterval);
        if(storage.contents['imageCapture'].active)
            await grabFrames();
    }

});
