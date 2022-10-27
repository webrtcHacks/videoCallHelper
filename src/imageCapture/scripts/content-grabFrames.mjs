import {MessageHandler} from "../../modules/messageHandler.mjs";

// Image capture module for content.js
const debug = function () {
    return Function.prototype.bind.call(console.debug, console, `vch 🕵️ imageCapture: `);
}();

const sendMessage = new MessageHandler('content', debug, false).sendMessage;


let captureInterval;
let currentStream = null;

let {settings} = await chrome.storage.local.get('settings');
debug("Image Capture settings:", settings);

// Set default values if storage is blank
if (!settings) {
    settings = {};
    settings.startOnPc = false;
    settings.captureIntervalMs = (60 * 1000);
    settings.samplingActive = false;
}


// check for settings changes
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (changes.settings) {
        console.log(`storage area "${area}" changes: `, changes.settings);
        settings = changes.settings.newValue;

        // Stop sampling
        if (changes.settings.oldValue.samplingActive === true && changes.settings.newValue.samplingActive === false) {
            clearInterval(captureInterval);

        }
        // Start sampling
        else if (!changes.settings.oldValue.samplingActive && changes.settings.newValue.samplingActive) {
            grabFrames();
        }
        // Change the sampling interval
        else if (changes.settings.oldValue.captureIntervalMs !== changes.settings.newValue.captureIntervalMs) {
            clearInterval(captureInterval);
            grabFrames();
        }
    }
});


// Generator that uses Media stream processor to get images
async function* getImages(stream) {
    // Insertable stream image capture
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    const {width, height, deviceId, groupId} = stream.getVideoTracks()[0].getSettings()
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("bitmaprenderer");

    let stopGenerator = false;

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
            return false
        }
    }
}


// Check the stream before getting images
export function grabFrames(newStream) {

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
                debug(`New stream ${currentStreamPixels} pixles are fewer than current stream ${currentStreamPixels}`);
                return
            }
        }

        // clear the current interval if it is running
        clearInterval(captureInterval);
    }
    else{
        // if it is not supplied, use the current stream
        newStream = currentStream;
    }


    // Now start capturing images and send them
    if (settings.samplingActive) {
        const getImg = getImages(newStream);

        captureInterval = setInterval(async () => {
            const imgData = await getImg.next();

            if (imgData.value)
                await sendMessage('all', 'frame_cap', imgData.value);
            if (imgData.done) {
                clearInterval(captureInterval);
                debug("No more image data", imgData);
            }
        }, settings.captureIntervalMs);
    }
}
