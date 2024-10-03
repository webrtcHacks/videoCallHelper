import {debug, storage, mh, m, c} from "../../dash/dashCommon.mjs";
import {arrayBufferToBase64, base64ToBuffer} from "./base64.mjs";
import {IndexedDBHandler} from "./indexedDB.mjs";

// used indexedDB to store the video buffer
const db = new IndexedDBHandler('videoPlayer');

// Selectors for the new elements
const injectButton = document.querySelector("#inject-button");
const recordButton = document.querySelector("#record-button");
const addMediaButton = document.querySelector("#add-media-button");
/** @type {HTMLVideoElement} */
const playerPreview = document.querySelector('video#player-preview');
const previewButton = document.querySelector("#preview-button");
const stopButton = document.querySelector("#inject-stop-button");

const loadingVideo = chrome.runtime.getURL('media/loading_spinner.mp4');
let arrayBuffer = null;
let mediaRecorder;
let recordedChunks = [];
let previewBlobUrl = null;
let readyToPlay = false;
const MAX_FILE_SIZE_MB = 250; // 250MB
const MAX_RECORDING_TIME_SEC = 120; // 60 seconds


// Handle file input for adding media
addMediaButton.addEventListener('click', async () => {

    playerPreview.src = loadingVideo; // "../media/loading_spinner.mp4";

    try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
        fileInput.click();
        const [file] = await new Promise((resolve) => {
            fileInput.onchange = () => resolve(fileInput.files);
        });

        if(!file){
            debug("no file selected");
            return;
        }

        // Read only the first 250MB of the file
        const maxSize = MAX_FILE_SIZE_MB * 1024 * 1024; // 250MB in bytes
        if (file.size > maxSize) {
            debug(`file size exceeds the ${MAX_FILE_SIZE_MB}MB limit`);
            alert(`File size exceeds the ${MAX_FILE_SIZE_MB}MB limit. Please select a smaller file.`);
            // return;
        }

        arrayBuffer = await file.arrayBuffer();

        // Play the buffer in the video element
        playerPreview.src = URL.createObjectURL(file);
        if(playerPreview.duration > 1)
            playerPreview.currentTime = 1;
        playerPreview.load();
        playerPreview.pause();

        // Load this into storage
        const data = {
            mimeType: file.type,
            // loop: true,
            // buffer: arrayBufferToBase64(arrayBuffer),
            // objectUrl: playerPreview.src,
            // videoTimeOffsetMs: playerPreview.currentTime * 1000,
            currentTime: new Date().getTime()
        };

        previewBlobUrl = playerPreview.src;
        readyToPlay = false;
        const buffer = await arrayBufferToBase64(arrayBuffer);
        if(buffer?.length === 0){
            debug("error converting arrayBuffer to base64");
            return;
        }

        await db.set('buffer',  buffer);
        await storage.set('temp', {buffer});  // temp transfer
        debug(`loaded selected ${fileInput.files[0].name}:`, arrayBuffer.byteLength);
        // ToDo: do I need to keep this in memory?
        // arrayBuffer = null;
        // Trigger the transfer
        await storage.update('player', data);

    } catch (err) {
        debug(err);
        // return;
    }

    //injectButton.classList.toggle('disabled', false);
});


// Handle recording
recordButton.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    } else {
        await startRecording();
    }
});

// Start recording function
async function startRecording() {

    /*
     * Get media based on the last used device
     */
    // try to reuse the last device
    const trackData = storage.contents.trackData;

    const latestAudioTrack = trackData
        .filter(track => track.kind === 'audio')
        .reduce((latest, current) => new Date(current.time) > new Date(latest.time) ? current : latest, {});
    const latestVideoTrack = trackData
        .filter(track => track.kind === 'video')
        .reduce((latest, current) => new Date(current.time) > new Date(latest.time) ? current : latest, {});


    const devices = await navigator.mediaDevices.enumerateDevices();

    let audioDeviceId = null;
    let videoDeviceId = null;

    // Match device IDs to labels in track data
    devices.forEach(device => {
        if (latestAudioTrack && device.kind === 'audioinput'  && device.label === latestAudioTrack.label) {
            audioDeviceId = device.deviceId;
        }
        if (latestVideoTrack && device.kind === 'videoinput' && device.label === latestVideoTrack.label) {
            videoDeviceId = device.deviceId;
        }
    });

    // Update getUserMedia constraints
    const constraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true
    };

    // Get user media with updated constraints
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaRecorder = new MediaRecorder(stream);
    playerPreview.src = null;
    playerPreview.srcObject = stream;

    /*
     * Recording setup
     */

    /**type {Timeout} */
    let maxDurationTimer;
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }

    };

    mediaRecorder.onstop = async () => {
        debug("mediaRecorder.onstop");
        clearTimeout(maxDurationTimer);
        stream.getTracks().forEach(track => track.stop());

        playerPreview.srcObject = null;
        // playerPreview.src = loadingVideo; // "../media/loading_spinner.mp4";

        recordButton.innerHTML = '<i class="bi bi-record-circle"></i><span>Re-record</span>';
        recordButton.classList.remove('recording');


        const recordedBlob = new Blob(recordedChunks, {type: mediaRecorder.mimeType});
        previewBlobUrl = URL.createObjectURL(recordedBlob);
        playerPreview.src = previewBlobUrl;
        playerPreview.loop = true;
        playerPreview.load();
        playerPreview.pause();
        debug("set preview recording:", recordedBlob, previewBlobUrl);


        // Load this into storage
        const data = {
            mimeType: mediaRecorder.mimeType,
            loop: true,
            // buffer: arrayBufferToBase64(arrayBuffer),
            // objectUrl: url,
            videoTimeOffsetMs: 0,
            currentTime: new Date().getTime()
        };

        try{
            // const recordedBlob = new Blob(recordedChunks, {type: mediaRecorder.mimeType});
            arrayBuffer = await recordedBlob.arrayBuffer();
            const buffer = await arrayBufferToBase64(arrayBuffer);
            if(buffer?.length === 0){
                debug("error converting arrayBuffer to base64");
                return;
            }
            await db.set('buffer',  buffer);
            await storage.set('temp', {buffer});  // temp transfer
            debug("saved recording to db", buffer.length);
            await storage.update('player', data); // other player settings
            debug("saved video size: ", arrayBuffer?.byteLength);
        }
        catch(err){
            debug("error saving recording to storage", err);
            return
        }

        arrayBuffer = null;
        recordedChunks = [];

    };

    mediaRecorder.start();
    recordButton.innerHTML = '<i class="bi bi-stop-fill blinking"></i><span>Recording</span>';

    maxDurationTimer = setTimeout(() => {
        mediaRecorder.stop();
    }, MAX_RECORDING_TIME_SEC * 1000);
}


// Handle injection of media
injectButton.onclick = async () => {
    /*if (!arrayBuffer) {
        debug("no media content to send");
        return;
    }*/

    // if the preview still has the loading video, then the video is not ready
    if(playerPreview.src === loadingVideo){
        debug("video not ready to inject", playerPreview.src);
        return;
    }

    debug("injecting media content");
    mh.sendMessage(c.INJECT, m.PLAYER_START, {});

    // show the player in sync with the injection
    playerPreview.currentTime = 0;
    await playerPreview.play()
        .catch((err) => debug("error playing video ", err));

    // hide the inject button and show the stop button
    injectButton.classList.add('d-none');
    stopButton.classList.remove('d-none');

}

// Handle stopping the injection
stopButton.onclick = async () => {
    debug("stopping injection playback");
    mh.sendMessage(c.INJECT, m.PLAYER_PAUSE, {});
    playerPreview.pause();
    playerPreview.currentTime = 1;
    stopButton.classList.add('d-none');
    injectButton.classList.remove('d-none');
}

// Play video on hover
previewButton.addEventListener('mouseover', async () => {
    if (playerPreview.src) {
        playerPreview.currentTime = 0;
        await playerPreview.play()
            .catch((err) => debug("error playing video ", err));
    }
});

// Pause video when not hovering
previewButton.addEventListener('mouseout', () => {
    if (playerPreview.src) {
        playerPreview.pause();
        playerPreview.currentTime = 1;
    }
});

/**
 * Load the video buffer from storage
 * - set the preview video source
 * - enable the inject button if there is a buffer
 *  - put the buffer in the temp storage for content to use
 * @param {string} [buffer] - optional base64 encoded video buffer. If not provided it will be fetched from indexDb
 * @param {string} [playerPreviewSrc] - optional source for the player preview video
 * @returns {Promise<void>}
 */
async function handleBuffer(buffer = "", playerPreviewSrc = loadingVideo){
    if(!buffer)
        buffer = await db.get('buffer');
    if (buffer?.length > 0) {

        playerPreview.src = loadingVideo;

        arrayBuffer = base64ToBuffer(buffer);

        const mimeType = storage.contents['player'].mimeType;
        const blob = new Blob([arrayBuffer], {type: mimeType});
        previewBlobUrl = URL.createObjectURL(blob);

        // Need this to trigger player load
        const data = storage.contents['player'];
        data.currentTime = new Date().getTime();

        await storage.update('temp', {buffer});  // temp transfer
        debug("loaded video arrayBuffer:", arrayBuffer.byteLength);

    }
    else {
        debug("no media content in db to load");
        injectButton.classList.add('disabled');
    }
}

// Initial setup - load the preview video from storage, send the video to inject
db.onOpened().then(async()=>{
    if(storage.contents['player']?.enabled)
        await handleBuffer();
});

// ToDo:check enabled changed to true
// load on not enabled to enabled
// add a storage listener for player. if enabled changed to true then load the buffer
storage.addListener('player', async (newValue, changedValue) => {
    debug("player storage changed (new, whatChanged)", newValue, changedValue);
    if (changedValue.enabled && newValue.enabled) {
        debug("player now enabled");
        await handleBuffer();

    }
});

// remove the disabled class from the inject button when the player can play
mh.addListener(m.PLAYER_CANPLAY, async () => {
    readyToPlay = true;
    // show the preview
    playerPreview.src = previewBlobUrl;
    playerPreview.currentTime = 1;
    playerPreview.load();
    playerPreview.pause();

    // ToDo: need to check active tracks
    if(storage.contents.trackData.some(track => track.readyState === 'live'))
        injectButton.classList.remove('disabled');
});

storage.addListener('trackData', async (newValue) => {

    if(storage.contents.trackData.some(track => track.readyState === 'live') && readyToPlay){
        readyToPlay = true;
        injectButton.classList.remove('disabled');
    }
    else{
        readyToPlay = false;
        playerPreview.pause();
        playerPreview.currentTime = 1;
        stopButton.classList.add('d-none');
        injectButton.classList.remove('d-none');
        injectButton.classList.add('disabled');
    }

});

