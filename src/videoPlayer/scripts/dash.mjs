import {debug, storage, mh, m, c} from "../../dash/dashCommon.mjs";
import {arrayBufferToBase64, base64ToBuffer} from "./base64.mjs";

// Selectors for the new elements
const injectButton = document.querySelector("#inject-button");
const recordButton = document.querySelector("#record-button");
const addMediaButton = document.querySelector("#add-media-button");
const playerPreview = document.querySelector('video#player-preview');
const previewButton = document.querySelector("#preview-button");
const stopButton = document.querySelector("#inject-stop-button");

let arrayBuffer = null;
let mediaRecorder;
let recordedChunks = [];


// Handle file input for adding media
addMediaButton.addEventListener('click', async () => {

    playerPreview.src = "../media/loading_spinner.mp4";
    playerPreview.loop = true;
    playerPreview.play();

    try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
        fileInput.click();
        const [file] = await new Promise((resolve) => {
            fileInput.onchange = () => resolve(fileInput.files);
        });

        arrayBuffer = await file.arrayBuffer();

        // Play the buffer in the video element
        playerPreview.src = URL.createObjectURL(file);
        playerPreview.currentTime = 1;
        playerPreview.load();

        // Load this into storage
        const data = {
            mimeType: file.type,
            loop: true,
            buffer: arrayBufferToBase64(arrayBuffer),
            videoTimeOffsetMs: playerPreview.currentTime * 1000,
            currentTime: new Date().getTime()
        };

        await storage.update('player', data);
        debug("saved video arrayBuffer:", storage.contents['player'].buffer.length);

    } catch (err) {
        debug(err);
    }
});


// Handle recording
recordButton.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
});

// Start recording function
async function startRecording() {

    // try to reuse the last device
    const trackData = storage.contents.trackData;

    const latestAudioTrack = trackData
        .filter(track => track.kind === 'audio')
        .reduce((latest, current) => new Date(current.time) > new Date(latest.time) ? current : latest);

    const latestVideoTrack = trackData
        .filter(track => track.kind === 'video')
        .reduce((latest, current) => new Date(current.time) > new Date(latest.time) ? current : latest);


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

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        playerPreview.srcObject = null;

        recordButton.innerHTML = '<i class="bi bi-record-circle"></i><span>Re-record</span>';
        recordButton.classList.remove('recording');

        const recordedBlob = new Blob(recordedChunks, {type: 'video/webm'});
        const url = URL.createObjectURL(recordedBlob);
        debug("recording:", recordedBlob, url);
        playerPreview.src = url;
        playerPreview.loop = true;
        playerPreview.load();

        arrayBuffer = await recordedBlob.arrayBuffer();

        // Load this into storage
        const data = {
            mimeType: recordedBlob.type,
            loop: true,
            buffer: arrayBufferToBase64(arrayBuffer),
            videoTimeOffsetMs: 0,
            currentTime: new Date().getTime()
        };

        await storage.update('player', data);
        debug("saved video arrayBuffer:", storage.contents['player'].buffer.length);


    };

    mediaRecorder.start();
    recordButton.innerHTML = '<i class="bi bi-stop-fill blinking"></i><span>Recording</span>';
}

// Stop recording function
function stopRecording() {
    mediaRecorder.stop();
    recordButton.innerHTML = '<i class="bi bi-record-circle"></i><span>Record</span>';
}


// Handle injection of media
injectButton.onclick = async () => {
    if (!arrayBuffer) {
        debug("no media content to send");
        return;
    }

    debug("injecting media content");
    mh.sendMessage(c.INJECT, m.PLAYER_START, {});

    // show the player in sync with the injection
    playerPreview.currentTime = 0;
    playerPreview.play();

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


// Initial setup - load the preview video from storage
if (storage.contents['player']?.buffer) {
    const buffer = storage.contents['player'].buffer;
    const mimeType = storage.contents['player'].mimeType;

    arrayBuffer = base64ToBuffer(buffer);
    const blob = new Blob([arrayBuffer], {type: mimeType});
    playerPreview.src = URL.createObjectURL(blob);
    playerPreview.currentTime = 1;
    playerPreview.load();

    // remove the disabled class from the inject button
    injectButton.classList.remove('disabled');

}


// Play video on hover
previewButton.addEventListener('mouseover', () => {
    if (playerPreview.src) {
        playerPreview.currentTime = 0;
        playerPreview.play()
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

