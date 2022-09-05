import {sendMessage} from "./messageHandler.mjs";

// Image capture module for content.js
const debug = function() {
    return Function.prototype.bind.call(console.debug, console, `vch 🕵️:imageCapture:: `);
}();

let captureInterval;
let currentStream = null;

let {settings} = await chrome.storage.local.get('settings');
console.log("Image Capture settings:", settings);

// Set default values if storage is blank
if (!settings) {
    settings = {};
    settings.startOnPc = false;
    settings.captureIntervalMs = (30 * 1000);
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
        else if(changes.settings.oldValue.captureIntervalMs !== changes.settings.newValue.captureIntervalMs){
            clearInterval(captureInterval);
            grabFrames();
        }
    }
});



export function grabFrames(stream){
    // ToDo: more error checking? see if there are tracks?
    if(!stream?.active && currentStream?.active){
        stream = currentStream;
    }
    else if (!stream?.active && !currentStream?.active){
        debug("No stream active");
        return
    } else
        currentStream = stream;


    if(settings.samplingActive){
        const getImg = getImages(stream);

        captureInterval = setInterval(async ()=>{
            const imgData = await getImg.next();

            if(imgData.value)
                await sendMessage('all', 'content', 'frame_cap', imgData.value);
            if(imgData.done){
                clearInterval(captureInterval);
                debug("No more image data", imgData);
            }
        }, settings.captureIntervalMs);
    }
}

// Generator that uses Media stream processor to get images
async function* getImages(stream){
    // Insertable stream image capture
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    const {width, height, deviceId, groupId} = stream.getVideoTracks()[0].getSettings()
    const canvas = new OffscreenCanvas(width,height);
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

    while (!stopGenerator){
        const blobUrl = await readFrame();

        if(blobUrl){
            const imgData = {
                url: window?.location.href || "",
                date: (new Date()).toLocaleString(),
                deviceId: deviceId,
                blobUrl: blobUrl,
                width: width,
                height: height
            }
            yield imgData
        }
        else{
            stopGenerator = true;
            return false
        }
    }
}
/*
export async function __capImgToDb(stream, afterImageFunction) {
    // Insertable stream image capture
    // This guarantees every frame is unique
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    let captureInterval;

    const {width, height, deviceId, groupId} = stream.getVideoTracks()[0].getSettings()
    const canvas = new OffscreenCanvas(width,height);
    const ctx = canvas.getContext("bitmaprenderer");

    async function readFrame() {
        const {value: frame, done} = await reader.read();
        if (frame) {

            const bitmap = await createImageBitmap(frame, 0, 0, frame.codedHeight, frame.codedWidth);
            ctx.transferFromImageBitmap(bitmap);
            const blob = await canvas.convertToBlob({type: "image/jpeg"});
            const blobUrl = window.URL.createObjectURL(blob);

            const imgData = {
                url: window?.location.href || "",
                date: (new Date()).toLocaleString(),
                deviceId: deviceId,
                blobUrl: blobUrl,
                width: frame.codedWidth,
                height: frame.codedHeight
            }
            // await set(`image_${Date.now()}`, imgData);
            // ToDo: put sendMessage into a module
            afterImageFunction('all', 'content', 'frame_cap', imgData);
            frame.close();
            bitmap.close();
        }
        if (done)
            clearInterval(captureInterval);
    }

    // ToDo: set this from a message
    let interval = 5*1000;

    captureInterval = setInterval(async () => await readFrame(), interval);
    return captureInterval
}
*/
