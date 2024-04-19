import '../styles/style.scss';
import {arrayBufferToBase64} from './videoPlayer.mjs';

const debug = Function.prototype.bind.call(console.debug, console, `vch 🎥‍ `)
import {StorageHandler} from '../../modules/storageHandler.mjs';
const storage = await new StorageHandler();

// import '../../dash/style.scss';
const videoElement = document.getElementById('recordedVideo');
const toggleAudioBtn = document.getElementById('toggleAudio');
const toggleVideoBtn = document.getElementById('toggleVideo');
const audioIcon = document.getElementById('audioIcon');
const videoIcon = document.getElementById('videoIcon');

const recordButton = document.getElementById('recordButton');
const playButton = document.getElementById('playButton');
const loopButton = document.getElementById('loopButton');
const fileButton = document.getElementById('fileButton');

let audioEnabled = true;
let videoEnabled = true;

// get data from URL params
const params = new URLSearchParams(window.location.search);
const previewAspectRatio = params.get('aspectRatio') || 16 / 9;

let arrayBuffer = null;
let mediaRecorder;
let recordedChunks = [];

console.debug('recorder.mjs loaded');

async function startRecording() {
    const stream = videoElement.srcObject;
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;

        // Reset the record button
        recordButton.innerHTML = '<i class="bi bi-record-circle"></i>'; // Reset to record icon
        recordButton.classList.remove('blinking'); // Remove animation class

        // preview the recording
        const recordedBlob = new Blob(recordedChunks, {type: 'video/webm'});
        const url = URL.createObjectURL(recordedBlob);
        debug("recording:", recordedBlob, url);
        videoElement.src = url;
        videoElement.load(); // Load the new source
        videoElement.play(); // Play the new source

        loopButton.classList.remove('disabled');

        // Save the recording
        arrayBuffer = await recordedBlob.arrayBuffer();
        const data = {
            mimeType: 'video/mp4',
            status: storage.contents['player']?.status || 'stop',
            loop: true,
            buffer: arrayBufferToBase64(arrayBuffer),
            videoTimeOffsetMs: videoElement.currentTime * 1000,
            currentTime: new Date().getTime()
        }

        debug("saving video arrayBuffer:", arrayBuffer);
        // mh.sendMessage('inject', m.PLAYER_URL, {buffer: arrayBuffer })
        await storage.update('player', data);


    };

    mediaRecorder.start();

    // Update the record button to indicate recording
    recordButton.innerHTML = '<i class="bi bi-stop-fill">Recording</i>'; // Change to stop icon
    recordButton.classList.add('blinking'); // Add class to handle animation
}

function stopRecording() {
    mediaRecorder.stop();
}

recordButton.onclick = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
}

playButton.onclick = async () => {
        videoElement.play();

        playButton.innerHTML = '<i class="bi bi-stop-fill"></i>';
        playButton.classList.add('blinking'); // Add class to handle animation

        videoElement.onended = () => {
            playButton.innerHTML = '<i class="bi bi-play-fill"></i>';
            playButton.classList.remove('blinking'); // Add class to handle animation
        }
}

loopButton.onclick = async () => {
    videoElement.loop = !videoElement.loop;
    loopButton.innerHTML = videoElement.loop ? '<i class="bi bi-arrow-repeat"></i>' : '<i class="bi bi-arrow-repeat disabled"></i>';
}

// Function to populate device selection dropdowns
async function populateDeviceList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioList = document.getElementById('audio_devices_list');
    const videoList = document.getElementById('video_devices_list');

    // Reset the current list
    audioList.innerHTML = '';
    videoList.innerHTML = '';

    devices.forEach(device => {
        const item = document.createElement('li');

        const link = document.createElement('a');
        link.className = 'dropdown-item';
        link.href = '#';
        link.textContent = device.label || `Device ${device.deviceId}`;
        link.onclick = (ev) => changeDevice(device.kind, device.deviceId, ev.target);

        // Create the span for the checkmark & prepend it
        let checkmarkSpan = document.createElement('span');
        checkmarkSpan.className = 'bi bi-check';
        link.prepend(checkmarkSpan);  // Add the checkmark to the option

        item.appendChild(link);

        if (device.kind === 'audioinput') {
            audioList.appendChild(item);
        } else if (device.kind === 'videoinput') {
            videoList.appendChild(item);
        }
    });
}

// Change the device based on user selection
function changeDevice(kind, deviceId, target) {
    console.debug('Changing device:', kind, deviceId, target);
    target.classList.toggle('selected');

    if (kind === 'audioinput') {
        console.log('Changing audio device to:', deviceId);
        // Implement the logic to change the audio device
    } else if (kind === 'videoinput') {
        console.log('Changing video device to:', deviceId);
        // Implement the logic to change the video device
    }
}

// Populate the device lists initially
await populateDeviceList();

// Add a listener for device change events
navigator.mediaDevices.ondevicechange = async () => {
    await populateDeviceList();
};

const constraints = {
    audio: true,
    video: {
        aspectRatio: previewAspectRatio,
        width: {max: 1280},
        height: {max: 720}
    }
};

async function getMedia() {
    const constraints = {
        audio: audioEnabled,
        video: videoEnabled ? {
            aspectRatio: previewAspectRatio,
            width: {max: 1280},
            height: {max: 720}
        } : false
    };

    try {
        videoElement.srcObject = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
        debug('Error accessing media devices:', error);
    }
}

toggleAudioBtn.addEventListener('click', async () => {
    audioEnabled = !audioEnabled;
    audioIcon.className = audioEnabled ? 'bi bi-mic-fill' : 'bi bi-mic-mute-fill';
    const currentTrack = videoElement.srcObject.getVideoTracks()[0];
    if (currentTrack?.enabled)
        currentTrack.stop();
    else
        await getMedia();
});

toggleVideoBtn.addEventListener('click', async () => {
    videoEnabled = !videoEnabled;
    videoIcon.className = videoEnabled ? 'bi bi-camera-video-fill' : 'bi bi-camera-video-off';
    const currentTrack = videoElement.srcObject.getAudioTracks()[0];
    if (currentTrack?.enabled)
        currentTrack.stop();
    else
        await getMedia();
});

await getMedia();


fileButton.addEventListener('click', () => {
    document.getElementById('videoFile').click(); // Trigger the hidden file input
});

// Optional: Add a change event listener to the file input to handle the file selection
document.getElementById('videoFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        // Implement logic to use the selected file, e.g., load it into a video player
        debug(`File selected: ${file.name}`);
    }
});
