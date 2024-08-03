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
let mimeType = null;
let mediaRecorder;
let recordedChunks = [];


// Handle file input for adding media
addMediaButton.addEventListener('click', async () => {
    try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
        fileInput.click();
        const [file] = await new Promise((resolve) => {
            fileInput.onchange = () => resolve(fileInput.files);
        });

        arrayBuffer = await file.arrayBuffer();
        mimeType = file.type;

        // Play the buffer in the video element
        playerPreview.src = URL.createObjectURL(file);
        playerPreview.currentTime = 1;
        playerPreview.load();


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
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    mediaRecorder = new MediaRecorder(stream);
    playerPreview.srcObject = stream;

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        playerPreview.srcObject = null;

        recordButton.innerHTML = '<i class="bi bi-record-circle"></i>';
        recordButton.classList.remove('recording');

        const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(recordedBlob);
        debug("recording:", recordedBlob, url);
        playerPreview.src = url;
        playerPreview.loop = true;
        playerPreview.load();

        arrayBuffer = await recordedBlob.arrayBuffer();
    };

    mediaRecorder.start();
    recordButton.innerHTML = '<i class="bi bi-stop-fill blinking"></i>';
}

// Stop recording function
function stopRecording() {
    mediaRecorder.stop();
    recordButton.innerHTML = '<i class="bi bi-record-circle"></i>';
}




// Handle injection of media
// content triggers injection based on a change to teh arrayBuffer
// Handle injection of media
injectButton.addEventListener('click', async () => {
    if (!arrayBuffer) {
        debug("no media content to send");
        return;
    }

    debug("injecting media content");

    // ToDo: refactor this
    const data = {
        mimeType: mimeType,
        loop: true,
        buffer: arrayBufferToBase64(arrayBuffer),
        videoTimeOffsetMs: playerPreview.currentTime * 1000,
        currentTime: new Date().getTime()
    };

    await storage.update('player', data);
    debug("saved video arrayBuffer:", storage.contents['player'].buffer.length);

    injectButton.classList.add('d-none');
    stopButton.classList.remove('d-none');

});

stopButton.addEventListener('click', async () => {
    debug("stopping injection");
    mh.sendMessage(c.INJECT, m.PLAYER_STOP, {});
    playerPreview.stop();
    stopButton.classList.add('d-none');
    injectButton.classList.remove('d-none');
});

// Initial setup - load the video from storage if it is there and preview it
if (storage.contents['player']?.buffer) {
    const buffer = storage.contents['player'].buffer;
    const mimeType = storage.contents['player'].mimeType;

    arrayBuffer = base64ToBuffer(buffer);
    const blob = new Blob([arrayBuffer], { type: mimeType });
    playerPreview.src = URL.createObjectURL(blob);
    playerPreview.currentTime = 1;
    playerPreview.load();

    // remove the disabled class from the inject button
    injectButton.classList.remove('disabled');
}


// Play video on hover
previewButton.addEventListener('mouseover', () => {
    if(playerPreview.src){
        playerPreview.currentTime = 0;
        playerPreview.play();
    }
});

// Pause video when not hovering
previewButton.addEventListener('mouseout', () => {
    if(playerPreview.src) {
        playerPreview.pause();
        playerPreview.currentTime = 1;
    }
});


/*
storage.addListener('player', (newValue) => {
    debug("new player data received", newValue);
    if (newValue.buffer && newValue.currentTime > lastRecordingTime) {
        arrayBuffer = base64ToBuffer(newValue.buffer);
        const blob = new Blob([arrayBuffer], { type: newValue.mimeType });
        playerPreview.src = URL.createObjectURL(blob);
        lastRecordingTime = newValue.currentTime;
    }
});
 */
