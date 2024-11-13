import {debug, storage, mh, m, c} from "../../../dash/dashCommon.mjs";
import {arrayBufferToBase64, base64ToBuffer} from "./base64.mjs";
import {IndexedDBHandler} from "./indexedDB.mjs";

// Use IndexedDB to store the video buffer
const db = new IndexedDBHandler('videoPlayer');

// Selectors for the new elements
const injectButton = document.querySelector("#inject-button");
const recordButton = document.querySelector("#record-button");
const addMediaButton = document.querySelector("#add-media-button");
/** @type {HTMLVideoElement} */
const playerPreview = document.querySelector('video#player-preview');
const previewButton = document.querySelector("#preview-button");
const stopButton = document.querySelector("#inject-stop-button");

/* ================== Constants and State Variables ================== */
const loadingVideo = chrome.runtime.getURL('media/loading_spinner.mp4');
const rickrollURL = "https://rickroll.it/rickroll.mp4";

let arrayBuffer = null;
let mediaRecorder = null;
let recordedChunks = [];
let previewBlobUrl = null;
let readyToPlay = false;
const MAX_FILE_SIZE_MB = 250; // 250MB
const MAX_RECORDING_TIME_SEC = 120; // 120 seconds


/* ===================== Helper Functions ===================== */


/**
 * Check if the file size exceeds the maximum limit.
 * @param {number} fileSize - The size of the file in bytes.
 * @returns {boolean} True if size is acceptable, false otherwise.
 */
function checkFileSize(fileSize) {
    const maxSize = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (fileSize > maxSize) {
        debug(`File size exceeds the ${MAX_FILE_SIZE_MB}MB limit`);
        alert(`File size exceeds the ${MAX_FILE_SIZE_MB}MB limit. Please select a smaller file.`);
        return false;
    }
    return true;
}

/**
 * Process a video Blob or File.
 * - Converts it to ArrayBuffer and base64.
 * - Updates the player preview.
 * - Stores data in IndexedDB and storage.
 * @param {Blob} blob - The video Blob or File to process.
 * @param {string} mimeType - The MIME type of the video.
 * @param {boolean} [isRecording=false] - Indicates if the blob is from a recording.
 */
async function processVideoBlob(blob, mimeType, isRecording = false) {
    try {
        arrayBuffer = await blob.arrayBuffer();

        const buffer = await arrayBufferToBase64(arrayBuffer);
        if (!buffer || buffer.length === 0) {
            debug("Error converting ArrayBuffer to base64");
            return;
        }

        // Save buffer to IndexedDB and temporary storage
        await db.set('buffer', buffer);
        // ToDo: try using session storage so local storage doesn't hang on large files
        await storage.set('temp', {buffer});
        debug("Saved video to db", buffer.length);

        // Prepare data for storage
        const data = {
            mimeType: mimeType,
            currentTime: Date.now(),
        };

        if (isRecording) {
            data.loop = true;
            data.videoTimeOffsetMs = 0;
        }

        // Update player data in storage
        await storage.update('player', data);
        debug("Saved video size:", arrayBuffer.byteLength);

        // Update the player preview
        previewBlobUrl = URL.createObjectURL(blob);
        playerPreview.src = previewBlobUrl;
        if (!isRecording && playerPreview.duration > 1) {
            playerPreview.currentTime = 1;
        }
        playerPreview.load();
        playerPreview.pause();

        readyToPlay = true;
    } catch (err) {
        debug("Error processing video blob:", err);
    }
}

/**
 * Load the video buffer from storage.
 * - Sets the preview video source.
 * - Puts the buffer in the temp storage for content to use.
 * @param {string} [buffer] - Optional base64 encoded video buffer. If not provided, it will be fetched from IndexedDB.
 * @returns {Promise<void>}
 */
async function handleBuffer(buffer = "") {
    if (!buffer) buffer = await db.get('buffer');
    if (buffer && buffer.length > 0) {
        playerPreview.src = loadingVideo;
        await playerPreview.play();

        arrayBuffer = base64ToBuffer(buffer);

        const mimeType = storage.contents['player'].mimeType;
        const blob = new Blob([arrayBuffer], {type: mimeType});
        previewBlobUrl = URL.createObjectURL(blob);

        await storage.update('temp', {buffer, currentTime: Date.now()});
        debug("Loaded video ArrayBuffer:", arrayBuffer.byteLength);
    } else {
        // Load Rickroll video by default here
        playerPreview.src = loadingVideo;
        await playerPreview.play();

        const response = await fetch(playerPreview.src);
        if(!response.ok) {
            debug(`Failed to fetch rickroll video from ${rickrollURL}`);
            return;
        }
        debug("No media content in DB; defaulting to rickroll");

        const buffer = await response.arrayBuffer();
        const base64 = await arrayBufferToBase64(buffer);
        await db.set('buffer', base64);

        await storage.update('temp', {buffer: base64, currentTime: Date.now()});
        previewBlobUrl = loadingVideo;
    }

}


/**
 * Get media constraints based on the last used devices.
 * @returns {Promise<MediaStreamConstraints>} The media constraints.
 */
async function getMediaConstraints() {
    const trackData = storage.contents.trackData || [];

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
        if (latestAudioTrack && device.kind === 'audioinput' && device.label === latestAudioTrack.label) {
            audioDeviceId = device.deviceId;
        }
        if (latestVideoTrack && device.kind === 'videoinput' && device.label === latestVideoTrack.label) {
            videoDeviceId = device.deviceId;
        }
    });

    // Update getUserMedia constraints
    return {
        audio: audioDeviceId ? {deviceId: {exact: audioDeviceId}} : true,
        video: videoDeviceId ? {deviceId: {exact: videoDeviceId}} : true,
    };
}


/* ===================== UI handling logic ===================== */


/**
 * Handle file input for adding media.
 */
addMediaButton.addEventListener('click', async () => {
    playerPreview.src = loadingVideo;
    await playerPreview.play();

    try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'video/*';
        fileInput.click();

        // wait for the file selection
        const [file] = await new Promise(resolve => fileInput.onchange = () => resolve(fileInput.files));

        if (!file) {
            debug("No file selected");
            return;
        }

        // Enforce maximum file size limit
        if (!checkFileSize(file.size)) {
            return;
        }

        await processVideoBlob(file, file.type);
    } catch (err) {
        debug("Error adding media:", err);
    }
});


/**
 * Start recording using MediaRecorder.
 */
async function startRecording() {
    // Get media based on the last used devices
    const constraints = await getMediaConstraints();

    // Get user media with updated constraints
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaRecorder = new MediaRecorder(stream);
    playerPreview.srcObject = stream;
    await playerPreview.play();

    // Recording setup
    let maxDurationTimer;
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        debug("MediaRecorder stopped");
        clearTimeout(maxDurationTimer);
        stream.getTracks().forEach(track => track.stop());
        playerPreview.srcObject = null;

        recordButton.innerHTML = '<i class="bi bi-record-circle"></i><span>Re-record</span>';
        recordButton.classList.remove('recording');

        const recordedBlob = new Blob(recordedChunks, {type: mediaRecorder.mimeType});
        await processVideoBlob(recordedBlob, mediaRecorder.mimeType, true);

        recordedChunks = [];
    };

    mediaRecorder.start();
    recordButton.innerHTML = '<i class="bi bi-stop-fill blinking"></i><span>Recording</span>';
    recordButton.classList.add('recording');

    maxDurationTimer = setTimeout(() => {
        mediaRecorder.stop();
    }, MAX_RECORDING_TIME_SEC * 1000);
}

/**
 * Handle recording button click.
 */
recordButton.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    } else {
        await startRecording();
    }
});

/**
 * Handle injection of media.
 */
injectButton.onclick = async () => {
    // this shouldn't happen
    if (playerPreview.src === loadingVideo) {
        debug("Video not ready to inject", playerPreview.src);
        return;
    }

    debug("Injecting media content");
    mh.sendMessage(c.INJECT, m.PLAYER_START, {});

    // Show the player in sync with the injection
    playerPreview.currentTime = 0;
    await playerPreview.play().catch(err => debug("Error playing video:", err));

    // Update UI buttons
    injectButton.classList.add('d-none');
    stopButton.classList.remove('d-none');
};

/**
 * Handle stopping the injection.
 */
stopButton.onclick = async () => {
    debug("Stopping injection playback");
    mh.sendMessage(c.INJECT, m.PLAYER_PAUSE, {});
    playerPreview.pause();
    playerPreview.currentTime = 1;

    // Update UI buttons
    stopButton.classList.add('d-none');
    injectButton.classList.remove('d-none');
};

/**
 * Play video on hover over the preview button.
 */
previewButton.addEventListener('mouseover', async () => {
    if (playerPreview.src) {
        playerPreview.currentTime = 0;
        await playerPreview.play().catch(err => debug("Error playing video:", err));
    }
});

/**
 * Pause video when not hovering over the preview button.
 */
previewButton.addEventListener('mouseout', () => {
    if (playerPreview.src) {
        playerPreview.pause();
        playerPreview.currentTime = 1;
    }
});


/**
 * Initial setup - load the preview video from storage and send the video to inject.
 */
db.onOpened().then(async () => {
    if (storage.contents['player']?.enabled) {
        await handleBuffer();
    }
});


/**
 * Listen for changes in player storage and handle enabling the player.
 */
storage.addListener('player', async (newValue, changedValue) => {
    debug("Player storage changed (new, whatChanged):", newValue, changedValue);
    if('enabled' in changedValue) {
        if (newValue.enabled) {
            debug("Player now enabled");
            await handleBuffer();
            [recordButton, addMediaButton, previewButton]
                .forEach(button => button.classList.remove('disabled'));
            // only enabled the inject button if there are active tracks
            if (storage.contents.trackData.some(track => track.readyState === 'live')) {
                injectButton.classList.remove('disabled');
            }
            playerPreview.currentTime = 1;
        } else {
            debug("Player now disabled");
            playerPreview.src = "";
            [injectButton, recordButton, addMediaButton, previewButton]
                .forEach(button => button.classList.add('disabled'));

        }
    }
/*
    if (changedValue.enabled && newValue.enabled) {
        debug("Player now enabled");
        await handleBuffer();
        [injectButton, recordButton, addMediaButton, previewButton]
            .forEach(button => button.classList.remove('disabled'));
    }*/
    else if ('enabled' in changedValue && newValue.enabled === false) {
        debug("Player now disabled");
        playerPreview.src = "";
        [injectButton, recordButton, addMediaButton, previewButton]
            .forEach(button => button.classList.add('disabled'));
    }
});

/**
 * Remove the disabled class from the inject button when the player can play.
 */
mh.addListener(m.PLAYER_CANPLAY, async () => {
    debug("Inject player can play");
    readyToPlay = true;

    // Show the preview
    playerPreview.src = previewBlobUrl;
    playerPreview.currentTime = 1;
    playerPreview.load();
    playerPreview.pause();

    // Enable the inject button if there are active tracks
    if (storage.contents.trackData.some(track => track.readyState === 'live')) {
        injectButton.classList.remove('disabled');
    }
});

/**
 * Listen for changes in track data and update the UI accordingly.
 */
storage.addListener('trackData', async () => {
    if (storage.contents.trackData.some(track => track.readyState === 'live') && readyToPlay) {
        injectButton.classList.remove('disabled');
    } else {
        readyToPlay = false;
        playerPreview.pause();
        playerPreview.currentTime = 1;
        stopButton.classList.add('d-none');
        injectButton.classList.remove('d-none');
        injectButton.classList.add('disabled');
    }
});

// Set initial UI state
if (storage.contents['player']?.enabled) {
    playerPreview.src = loadingVideo;
    await playerPreview.play();
    [recordButton, addMediaButton, previewButton]
        .forEach(button => button.classList.remove('disabled'));
}
else {
    playerPreview.src = "";
    [injectButton, recordButton, addMediaButton, previewButton]
        .forEach(button => button.classList.add('disabled'));
}
