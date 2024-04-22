import {debug, storage, mh, m, c} from "../../dash/dashCommon.mjs";
import {arrayBufferToBase64, base64ToBuffer} from "./videoPlayer.mjs";

const cameraDiv = document.querySelector('div#cameraPreview');
const playerDiv = document.querySelector('div#playerPreview');
const localVideoPreview = document.querySelector('img#localVideo');
const playerPreview = document.querySelector('video#recordedVideo');

const playButton = document.querySelector('button#playButton');
const recordButton = document.querySelector('#recordButton');
const openButton = document.querySelector('button#openButton');
const injectButton = document.querySelector('button#injectButton');

let arrayBuffer = null;
let previewAspectRatio = 16/9;
let lastRecordingTime = 0;

// local video preview
mh.addListener(m.FRAME_STREAM, (data) => {
    // debug("frame capture data received", data);
    localVideoPreview.src = data.blobUrl;
    previewAspectRatio = localVideoPreview.naturalWidth / localVideoPreview.naturalHeight;     // needed for recording window
});
// Todo: width value is off above


// see if there is any video in storage already
if(storage.contents['player']?.buffer) {

    // Play the buffer in the video element
    const buffer = storage.contents['player'].buffer;
    const mimeType = storage.contents['player'].mimeType;

    arrayBuffer = base64ToBuffer(buffer);
    const blob = new Blob([arrayBuffer], { type: mimeType }); // Ensure the MIME type matches the video format
    playerPreview.src = URL.createObjectURL(blob);
    playerPreview.load();
}

/*
// Need a UI interaction in the dash before the video will play
document.addEventListener('click', async (e) => {
    if(playerPreview.src || playerPreview.srcObject) {
        playerPreview.play();
    }
});
 */

//
cameraDiv.addEventListener('click',  async () => {
    debug("cameraDiv clicked");
    playerDiv.classList.remove('selected');
    cameraDiv.classList.add('selected');
    // this is not working
    mh.sendMessage(c.INJECT, m.PLAYER_STOP, {});
});

storage.addListener('player', (newValue) => {
    debug("player new data received", newValue);
    if(newValue.buffer && newValue.currentTime > lastRecordingTime) {
        arrayBuffer = base64ToBuffer(newValue.buffer);
        const blob = new Blob([arrayBuffer], { type: newValue.mimeType }); // Ensure the MIME type matches the video format
        playerPreview.src = URL.createObjectURL(blob);
        lastRecordingTime = newValue.currentTime;
    }
});


openButton.onclick = async () => {
    try {
        // use the fileInput to open a file
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
        fileInput.click();
        const [file] = await new Promise((resolve, reject) => {
            fileInput.onchange = () => resolve(fileInput.files);
        });

        arrayBuffer = await file.arrayBuffer();

        playerPreview.src = URL.createObjectURL(file);
        playerPreview.currentTime = 1; // Optional: Reset time to start
        playerPreview.load(); // Load the new source
        // playerPreview.play(); // Play the new source

        window.vch.player.lastFile = file;

    } catch (err) {
        // ToDo: Handle errors or cancellation
        debug(err);
    }
};

// change the icon to a stop icon and make it blink
playerPreview.onplaying = () => {
    playButton.innerHTML = '<i class="bi bi-stop-fill blinking"></i>';
}

// change the icon to a play icon and stop blinking
playerPreview.onpause = () => {
    playButton.innerHTML = '<i class="bi bi-play-fill"></i>';
}

// recordedVideo.src = chrome.runtime.getURL('bbb_360p_30s.webm');
playButton.onclick = async () => {
    // if video is playing then pause it
    if(playerPreview.paused) {
        await playerPreview.play();
        debug("playing video");
    } else {
        playerPreview.pause();
        debug("pausing video");
    }
}

injectButton.onclick = async () => {
    if(!storage.contents['player']?.buffer) {
        debug("no blob to send");
        return;
    }

    const data = {
        mimeType: storage.contents['player'].mimeType,
        // status: 'inject',
        loop: true,
        buffer: arrayBufferToBase64(arrayBuffer),
        videoTimeOffsetMs: playerPreview.currentTime * 1000,
        currentTime: new Date().getTime()
    }

    // mh.sendMessage('inject', m.PLAYER_URL, {buffer: arrayBuffer })
    await storage.update('player', data);
    // playerPreview.play();
    debug("saved video arrayBuffer:", storage.contents['player'].buffer.length);

    // switch "selected"
    cameraDiv.classList.remove('selected');
    playerDiv.classList.add('selected');

}

let mediaRecorder;
let recordedChunks = [];
async function startRecording() {
    // get settings for constraints

    // ToDo: get the best current gUM stream
    // const lastStream = window.vch.streams.slice(-1)[0];
    // const videoConstraints = lastStream.getVideoTracks()[0].getConstraints() || false;
    // const audioConstraints = lastStream.getAudioTracks()[0].getConstraints() || false;
    // debug("videoConstraints", videoConstraints, "audioConstraints", audioConstraints);
    let stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true});
    mediaRecorder = new MediaRecorder(stream);
    playerPreview.srcObject = stream;

    mediaRecorder.ondataavailable = (event) =>{
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async ()=> {
        stream.getTracks().forEach(track => track.stop());
        playerPreview.srcObject = null;

        // Reset the record button
        recordButton.innerHTML = '<i class="bi bi-record-circle"></i>'; // Reset to record icon
        recordButton.classList.remove('recording'); // Remove animation class

        // preview the recording
        const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(recordedBlob);
        debug("recording:", recordedBlob, url);
        playerPreview.src = url;
        playerPreview.loop = true;
        playerPreview.load(); // Load the new source

        // Save the recording
        arrayBuffer = await recordedBlob.arrayBuffer();

    };

    mediaRecorder.start();

    // Update the record button to indicate recording
    recordButton.innerHTML = '<i class="bi bi-stop-fill blinking"></i>'; // Change to stop icon
    // recordButton.classList.add('recording'); // Add class to handle animation
}
function stopRecording() {
    mediaRecorder.stop();
    recordButton.innerHTML = '<i class="bi bi-record-circle"></i>';
    // recordButton.classList.remove('blinking');
}

recordButton.onclick = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
}

/*
document.querySelector('button#expandButton').onclick = async () => {
    debug("expand button clicked");
    mh.sendMessage('inject', 'hello_there', {});
}
 */

/*
// Toggle recording on button click
recordButton.onclick = async () => {
    // mh.sendMessage('background', 'player_record', {aspectRatio: previewAspectRatio});

    // set the pop-out window size to be roughly 1/4 of the screen but not larger than 1280x720 while keeping the aspect ratio
    const popoutWidth = Math.min(window.screen.width / 2, 1280);
    const popoutHeight = Math.min(popoutWidth / previewAspectRatio, 720);

    const recorderUrl = chrome.runtime.getURL('pages/recorder.html') + `?aspectRatio=${previewAspectRatio}`;
    const chromeUrlBarHeight = 66;

    debug("preview aspect ratio:", previewAspectRatio, "popout size:", popoutWidth, popoutHeight);
    const popOutWindow = window.open(recorderUrl, '_blank', `
        popup=yes,
        location=no,
        menubar=no,
        status=no,
        scrollbars=no,
        width=${popoutWidth},
        height=${popoutHeight}
        `);

}
 */
