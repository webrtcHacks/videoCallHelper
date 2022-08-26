// ToDo: refactor webgazer.mjs code and import
import {get, set} from '../modules/idb-keyval.js';

const videoElem = document.querySelector('video');
const imageDiv = document.querySelector('div#images');

// const imgElem = document.querySelector('img');
// const canvasElem = document.querySelector('canvas');
// const spanElem = document.querySelector('span');

let captureInterval;

let stream;
stream = window.stream;

let imageDirectoryHandle, imageDataFileHandle;

// ToDo: console.log override: https://ourcodeworld.com/articles/read/104/how-to-override-the-console-methods-in-javascript
function log(...messages) {
    console.debug(`🎞‍ `, ...messages);
}

/*
// get URL params
// let sourceTabUrl = "";
// const urlParams = new URLSearchParams(window.location.search);
// const sourceTab = parseInt(urlParams.get('source'));

if(!urlParams.get('source')){
    spanElem.innerText = "no source tab identified";
}

// log(sourceTab);
*/

// let videoDevices = []
/*
navigator.mediaDevices.enumerateDevices()
    .then(devices=>videoDevices = devices.filter(device=>device.kind==='videoinput'))
    .catch(err=>console.error(err));
 */


window.onload = () => {
    log("video page loaded");
    const messageToSend = {
        from: 'video',
        to: 'all',
        message: 'video_tab',
    }
    chrome.runtime.sendMessage(messageToSend, {});
}

videoElem.onclick = async () => {
    let pip = await videoElem.requestPictureInPicture();
    log(`Picture-in-Picture size: ${pip.width}x${pip.height}`);
}

async function openDirectory() {
    /*
    imageDirectoryHandle = await chrome.storage.local.get(['imageDir']);
    console.log("imageDirectoryHandle", JSON.stringify(imageDirectoryHandle));

    if(!imageDirectoryHandle.name){
        const directoryHandle = await window.showDirectoryPicker();
        console.log(`directory handle for "${directoryHandle.name}"`);

        // In an existing directory, create a new directory named "test".
        imageDirectoryHandle = await directoryHandle.getDirectoryHandle('test', {
            create: true,
        });
        console.log("imageDirectoryHandle", imageDirectoryHandle);
        // ToDo: doesn't seem to be serializable - its always empty
        // try example here: https://web.dev/file-system-access/#storing-file-handles-or-directory-handles-in-indexeddb
        await chrome.storage.local.set({imageDirectoryHandle});
    }

    imageDataFileHandle = await chrome.storage.local.get(['dataFile']);
    console.log(imageDataFileHandle);

    if(!imageDataFileHandle.name) {

        const imageDatafileHandle = await imageDirectoryHandle.getFileHandle(`imageData.csv`, {create: true});
        console.log(`file handle for "${imageDatafileHandle.name}"`);
        const writable = await imageDatafileHandle.createWritable();


        // ToDo: check if the file exists
        await chrome.storage.local.set({dataFile: imageDatafileHandle});

        // Write the contents of the file to the stream.
        const contents = `file, url, time, height, width`;
        await writable.write(contents);
        // Close the file and write the contents to disk.
        await writable.close();


    }
*/
    let directoryHandle = await get('directory');
    let parentDirectoryHandle;

    console.log(directoryHandle, parentDirectoryHandle);

    if (!directoryHandle) {
        try {
            if (!parentDirectoryHandle) {
                parentDirectoryHandle = await window.showDirectoryPicker();
                console.log(`directory handle for "${parentDirectoryHandle.name}"`);
                // await set('parentDirectory', parentDirectoryHandle);
            }

            // In an existing directory, create a new directory named "test".
            directoryHandle = await parentDirectoryHandle.getDirectoryHandle('test', {
                create: true,
            });
            await set('directory', directoryHandle);
            //await writeFiles(directoryHandle, parentDirectoryHandle);
        } catch (error) {
            console.error(error);
            // alert(error.name, error.message);
        }
    }

    let dataFileHandle = await get('dataFile');
    console.log(dataFileHandle);

    if(!dataFileHandle) {

        dataFileHandle = await directoryHandle.getFileHandle(`imageData.csv`, {create: true});
        console.log(`file handle for "${dataFileHandle.name}"`);
        const writable = await dataFileHandle.createWritable();


        // ToDo: check if the file exists
        await set('dataFle', dataFileHandle);

        // Write the contents of the file to the stream.
        const contents = `file, url, time, height, width`;
        await writable.write(contents);
        // Close the file and write the contents to disk.
        await writable.close();
    }


    return directoryHandle
}

// Image capture and save to canvas
async function captureShowSaveImage(stream, directoryHandle) {
    // Insertable stream image capture
    // This guarantees every frame is unique
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    async function readFrame() {
        const {value: frame, done} = await reader.read();
        if (frame) {
            // I'll show the images
            const bitmap = await createImageBitmap(frame);
            // console.log(bitmap);

            const canvas = document.createElement('Canvas');
            canvas.height = bitmap.height;
            canvas.width = bitmap.width;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            imageDiv.appendChild(canvas);
            const br = document.createElement("br");
            imageDiv.appendChild(br);

            const fileHandle = await directoryHandle.getFileHandle(`image_${Date.now()}.bmp`, {create: true});
            const writable = await fileHandle.createWritable();
            // ToDo: check if the file exists
            // Write the contents of the file to the stream.
            canvas.toBlob(async blob => {
                await writable.write(blob)
                await writable.close();
                bitmap.close();
                frame.close();
            });
        }
        if (done)
            clearInterval(captureInterval);
    }

    // const interval = (parseInt(intervalSec) >= 1 ? intervalSec.value * 1 : 1) * 1000;
    const interval = 5 * 1000;
    captureInterval = setInterval(async () => await readFrame(), interval);
    return captureInterval
}


async function getCamera(constraints) {

    if (stream && stream.active) {
        stream.getTracks().forEach(track => track.stop());
    }
    stream = await navigator.mediaDevices.getUserMedia({video: constraints});
    log("got new stream", stream);

    videoElem.srcObject = stream;
    const directoryHandle = await openDirectory();
    await captureShowSaveImage(stream, directoryHandle);

    /*
    // Insertable streams
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor({track});

    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    videoElem.srcObject  = new MediaStream([generator]);

    await processor.readable.pipeThrough(new TransformStream({
        transform: (frame, controller) => mesh(frame, controller)
    })).pipeTo(generator.writable);

     */

}

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {

        // ToDo: not sure why sendResponse isn't null
        if (sendResponse) {
            sendResponse(true);
        }

        const {to, from, message, data} = request;
        log(`incoming "${message}" message from ${from} to ${to} with data: `, data);

        if (to !== 'video') // && sender.tab.id !== sourceTab)
            return;

        /*
        if(sourceTabUrl === ""){
            sourceTabUrl = sender.url;
            spanElem.innerText = `Source tab: ${sourceTabUrl}`;
        }
        */


        let currentVideoTrack;
        if (stream && stream.active)
            [currentVideoTrack] = stream.getVideoTracks();

        if (message === 'track_info') {
            // log("incoming data: ", data.trackInfo);
            // log(`number of tracks: ${data.trackInfo.length}`);
            // const settings = data.trackInfos.at(-1);
            const settings = data.trackInfo;

            if (settings.label) {
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
                log("video tab devices: ", videoDevices);
                log("settings", settings);
                const {deviceId} = videoDevices.find(device => settings.label === device.label);
                log("deviceId", deviceId);
                settings.deviceId = deviceId;
            }

            log("constraints: ", settings);
            await getCamera(settings);

        } else if (message === 'mute') {
            log("muting track");
            currentVideoTrack.enabled = false;
        } else if (message === 'unmute') {
            log("unmuting track");
            currentVideoTrack.enabled = true;
        } else if (message === 'remove_track') {
            const trackId = data.track.id;
            if (trackId === currentVideoTrack.id) {
                log(`remove track: ${trackId} - removed`);
                stream.removetrack(currentVideoTrack);
            } else {
                log(`remove track: ${trackId} - ${currentVideoTrack.id} doesn't match`);
            }
        } else if (message === 'unload') {
            // need something to check the id
            // videoElem.srcObject.getTracks().forEach(track=>track.stop);
        }
    }
);
