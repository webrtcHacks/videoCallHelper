import './style.scss';

const debug = Function.prototype.bind.call(console.debug, console, `vch 📈️‍ `);

import {StorageHandler} from '../modules/storageHandler.mjs';
const storage = await new StorageHandler("local", debug);

import {MessageHandler, MESSAGE as m} from '../modules/messageHandler.mjs';
const mh = new MessageHandler('dash');

// To help with debugging
window.vch = {
    storage: storage,
    mh: mh,
    player: {}
}

/*
// Remnants from past experiments

let currentTabId;
const remoteAudioLevels = [];
const localAudioLevel = [];
let audioLevelInterval = false;

const eventSpanElem = document.querySelector('span#events');

// Remote Audio
const remoteAudioLevelSpan = document.querySelector('span.remote_audio_level');
const localAudioLevelSpan = document.querySelector('span.local_audio_level');


// for chart testing
window.events = [];

 */


/************ START imageCapture ************/
// ToDo: refactor this for storageHandler
// frontend UI handlers
import '../imageCapture/scripts/imageCaptureSettings.mjs';

// Image capture button
document.querySelector("button#open_sampling").onclick = async () => {
    const url = chrome.runtime.getURL("pages/imageCapture.html");
    await chrome.tabs.create({url});
}
/************ END imageCapture ************/


/************ START presence ************/
// backend functions
import {webRequest} from "../presence/scripts/webRequest.mjs";

const statusSpanElem = document.querySelector('span#presence_status');
const enabledCheck = document.querySelector('input#enable_presence_check');
const btnBusy = document.querySelector('button#busy');
const btnNotBusy = document.querySelector('button#not_busy');

// initial state
statusSpanElem.innerText = storage.contents?.presence?.active ? "active" : "inactive";
enabledCheck.checked = storage.contents?.presence?.enabled;

document.querySelector("button#presence_setup").onclick = async () => {
    const url = chrome.runtime.getURL("pages/presence.html");
    await chrome.tabs.create({url});
}

enabledCheck.onclick = async () => {
    const enabled = enabledCheck.checked;
    debug(`presence enabled set to ${enabled}`);
    await storage.update('presence', {enabled: enabled});
}


btnBusy.onclick = async () => {
    await storage.update('presence', {active: true});
    webRequest("on", storage.contents['presence']);
    // ToDo: handle embrava
};

btnNotBusy.onclick = async () => {
    await storage.update('presence', {active: false});
    webRequest("off", storage.contents['presence']);
    // ToDo: handle embrava
}

storage.addListener('presence', (newValue) => {
    debug("presence changed", newValue);
    statusSpanElem.innerText = newValue.active ? "active" : "inactive";

    enabledCheck.checked = newValue.enabled;

});
/************ END presence ************/


/************ START selfView  ************/

const selfViewDiv = document.querySelector("div#hide_self_view_div");
const selfViewCheckbox = document.querySelector("input#hide_self_view_check");
const selfViewStatus = document.querySelector("span#hide_self_view_status");

const showFramingDiv = document.querySelector("div#show_framing_div");
const showFramingCheck = document.querySelector("input#show_framing_check");
const showFramingStatus = document.querySelector("span#show_framing_status");

function updateSelfViewUI() {

    // Hide/Obscure Self-View
    try {
        const hideViewEnabled = storage.contents['selfView']?.['hideView']?.enabled;
        const hideViewActive = storage.contents['selfView']?.['hideView']?.active;

        if (hideViewEnabled && hideViewActive)
            selfViewStatus.innerText = "Obscuring self-view";
        else if (hideViewEnabled && !hideViewActive)
            selfViewStatus.innerText = "Looking for self-view";
        else
            selfViewStatus.innerText = "Click to enable";
    } catch (e) {
        debug("error updating self-view UI", e);
        for (let child of selfViewDiv.children) {
            child.disabled = true;
            child.classList.add('text-muted');
            child.classList.add('fw-lighter');
        }
    }

    try {
        // Show Framing
        const showFramingEnabled = storage.contents['selfView']?.['showFraming']?.enabled;
        const showFramingActive = storage.contents['selfView']?.['showFraming']?.active;

        if (showFramingEnabled && showFramingActive)
            showFramingStatus.innerText = "Showing framing";
        else if (showFramingEnabled && !showFramingActive)
            showFramingStatus.innerText = "Looking for self-view";
        else
            showFramingStatus.innerText = "Click to enable";
    } catch (e) {
        debug("error updating show framing UI", e);
        for (let child of showFramingDiv.children) {
            child.disabled = true;
            child.classList.add('text-muted');
        }
    }
}

// debug("self-view settings:", storage.contents['selfView']);
selfViewCheckbox.checked = storage.contents['selfView']?.hideView?.enabled || false;
showFramingCheck.checked = storage.contents['selfView']?.showFraming?.enabled || false;
updateSelfViewUI();


selfViewCheckbox.onclick = async () => {
    const enabled = selfViewCheckbox.checked;
    // debug(`set self-view enabled to ${enabled}`);
    const newContents = storage.contents['selfView'];
    newContents['hideView'] = {enabled: enabled, active: newContents['hideView']?.active || false};
    await storage.update('selfView', newContents);
    updateSelfViewUI();
}

showFramingCheck.onclick = async () => {
    const enabled = showFramingCheck.checked;
    // debug(`set self-view enabled to ${enabled}`);
    const newContents = storage.contents['selfView'];
    newContents['showFraming'] = {enabled: enabled, active: newContents['showFraming']?.active || false};
    await storage.update('selfView', newContents);
    updateSelfViewUI();
}

storage.addListener('selfView', () => {
    updateSelfViewUI();
});

/************ END selfView  ************/

/************ START deviceManager ************/

// UI elements
const dmEnabledCheck = document.querySelector("input#dm_enabled_check");
const audioMenu = document.getElementById('audio_devices_list');
const videoMenu = document.getElementById('video_devices_list');
const excludeMenu = document.getElementById('all_devices_list');
const excludeDropdown = document.getElementById('excludeDropdown');

// ToDo: guidance text

dmEnabledCheck.checked = storage.contents['deviceManager']?.enabled || false;

dmEnabledCheck.onclick = async () => {
    const enabled = dmEnabledCheck.checked;
    debug(`set deviceManager enabled to ${enabled}`);
    await storage.update('deviceManager', {enabled: enabled});
}

// import {deviceManager} from "../deviceManager/scripts/_deviceManager.mjs";
// const dm = new deviceManager();

// Finding: device enumeration permissions are not shared with the extension context
//  only default devices are returned

async function populateDeviceDropdowns() {

    // Clear previous options
    audioMenu.innerHTML = '';
    videoMenu.innerHTML = '';
    excludeMenu.innerHTML = '';

    const devices = storage.contents['deviceManager']?.currentDevices || [];

    // Sort devices - needed for exclude menu
    // ToDo: check spec - is this needed? Does enumerateDevices always sort?
    devices.sort((a, b) => {
        const order = ['videoinput', 'audioinput', 'audiooutput'];
        return order.indexOf(a.kind) - order.indexOf(b.kind);
    });
    debug("sorted devices: ", devices);

    // Reconstruct static items for excludeMenu

    // Guide Note
    const note = document.createElement('li');
    note.className = 'dropdown-header fw-bold';
    note.innerText = 'Unselect items to exclude';
    excludeMenu.appendChild(note);

    // Divider
    const divider2 = document.createElement('li');
    divider2.innerHTML = '<hr class="dropdown-divider">';
    excludeMenu.appendChild(divider2);

    // Utility function to add segment label and divider for exclude menu
    function addSegmentLabelAndDivider(kind) {
        let label;
        switch (kind) {
            case 'videoinput':
                label = 'Video Inputs';
                break;
            case 'audioinput':
                label = 'Audio Inputs';
                break;
            case 'audiooutput':
                label = 'Audio Outputs';
                break;
        }

        const flexContainer = document.createElement('li');
        flexContainer.className = 'd-flex justify-content-between align-items-center px-3 pt-2';

        const header = document.createElement('span');
        header.className = 'dropdown-header';
        header.innerText = label;
        flexContainer.appendChild(header);

        const applyButton = document.createElement('button');
        applyButton.className = 'applyExclusions btn btn-primary btn-sm';
        applyButton.innerText = 'Apply All';
        flexContainer.appendChild(applyButton);
        applyButton.onclick = handleExcludeMenuClose;

        excludeMenu.appendChild(flexContainer);

        const divider = document.createElement('li');
        divider.className = 'dropdown-divider';
        excludeMenu.appendChild(divider);
    }

    let lastKind = null;

    // populate the dropdowns
    devices.forEach((device) => {

        /*** START common menu item processing ***/

            // ToDo: display a message if "default" device is the only option

            // improve the label text in the case where permissions don't provide labels
        let betterLabel = device.label;
        if (device.label === "") {
            let betterKind = device.kind
                .replace('videoinput', 'camera')
                .replace('audioinput', 'microphone')
                .replace('audiooutput', 'speaker');
            betterLabel = `default ${betterKind}`;
        }

        const option = document.createElement('li');
        option.className = 'dropdown-item device-dropdown';

        let textNode = document.createTextNode(betterLabel);
        option.appendChild(textNode);

        option.dataset.deviceId = device.deviceId;
        option.dataset.kind = device.kind;
        option.dataset.label = betterLabel;

        /*** END common menu item processing ***/

            // make a copy for the exclude Menu
        const excludeMenuOption = option.cloneNode(true)

        /**** START audio & video menus ****/
            // Create the span for the checkmark & prepend it
        let checkmarkSpan = document.createElement('span');
        checkmarkSpan.className = 'bi bi-check';
        option.prepend(checkmarkSpan);  // Add the checkmark to the option

        if (device.kind === 'audioinput') {
            const selectedAudioDevice = storage.contents?.deviceManager?.selectedDeviceLabels?.audio;
            if (device.label === selectedAudioDevice || device.label === selectedAudioDevice)
                option.classList.add('selected');
            audioMenu.appendChild(option);
        } else if (device.kind === 'videoinput') {
            const selectedVideoDevice = storage.contents?.deviceManager?.selectedDeviceLabels?.video;
            if (device.label === selectedVideoDevice || device.label === selectedVideoDevice)
                option.classList.add('selected');
            videoMenu.appendChild(option);
        }
        /**** END audio & video menus ****/

        /**** START exclude menu ****/

        // ToDo: exclude "default audio" and "default video"

        if (device.label !== '') {

            // Check if device kind changed
            if (lastKind !== device.kind) {
                addSegmentLabelAndDivider(device.kind);
                lastKind = device.kind;
            }

            // Add checkmark
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'me-2'; // Bootstrap's margin-end
            // ToDo: logic to tell if it should be checked
            checkbox.checked = !storage.contents?.deviceManager?.excludedDevices?.some(d => d.label === device.label);
            excludeMenuOption.prepend(checkbox);

            // Does this need to be cloned?
            excludeMenu.appendChild(excludeMenuOption);
        }
        /**** END exclude menu ****/

    });

}

// Initial population
await populateDeviceDropdowns()
    .catch(err => {
        console.error('Error populating  device dropdowns:', err);
    });

// ToDo: handle permissions changes
// ToDo: handle if devices array is empty
storage.addListener('deviceManager', async (newValue) => {
    dmEnabledCheck.checked = storage.contents['deviceManager']['enabled'] || false;

    if (newValue.currentDevices)
        await populateDeviceDropdowns(newValue.currentDevices);

});

// ToDo: Make the selected item visible if the scroll hides it - only useful for long lists
function scrollToElement(container, element) {
    // Check if the element is out of view
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elemTop = element.offsetTop;
    const elemBottom = elemTop + element.clientHeight;

    if (elemTop < containerTop) {
        // If the element is above the current view
        container.scrollTop = elemTop;
    } else if (elemBottom > containerBottom) {
        // If the element is below the current view
        container.scrollTop = elemBottom - container.clientHeight;
    }
}


audioMenu.addEventListener('click', async (e) => {

    // if(storage.contents?.deviceManager?.selectedDeviceLabels?.audio)

    // Check if a dropdown item was clicked
    if (e.target.classList.contains('device-dropdown')) {
        // Remove the 'selected' class from all items in this dropdown
        audioMenu.querySelectorAll('.device-dropdown').forEach(item => {
            item.classList.remove('selected');
        });

        const label = e.target.textContent;
        // Add the 'selected' class to the clicked item
        e.target.classList.add('selected');
        const selectedDeviceLabels = {
            audio: label,
            video: storage.contents?.deviceManager?.selectedDeviceLabels?.video
        }
        await storage.update("deviceManager", {selectedDeviceLabels});

        // Log the selected device
        debug(`Selected audio device: ${label}`);
    }
});

videoMenu.addEventListener('click', async (e) => {

    // Check if a dropdown item was clicked
    if (e.target.classList.contains('device-dropdown')) {
        // Remove the 'selected' class from all items in this dropdown
        videoMenu.querySelectorAll('.device-dropdown').forEach(item => {
            item.classList.remove('selected');
        });

        const label = e.target.textContent;
        // Add the 'selected' class to the clicked item
        e.target.classList.add('selected');
        const selectedDeviceLabels = {
            audio: storage.contents?.deviceManager?.selectedDeviceLabels?.audio,
            video: label
        }
        await storage.update("deviceManager", {selectedDeviceLabels});

        // Log the selected device
        debug(`Selected video device: ${e.target.textContent}`);
    }
});

// Exclude Devices dropdown UI listeners
excludeDropdown.addEventListener('click', () => {
    // Always scroll to the top to see the note
    excludeMenu.scrollTop = 0;
});

// apply exclude menu changes
async function handleExcludeMenuClose() {
    const allItems = document.querySelectorAll('#all_devices_list .device-dropdown');

    const excludedDevices = [];

    allItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (!checkbox.checked) {
            excludedDevices.push({
                deviceId: item.dataset.deviceId,
                kind: item.dataset.kind,
                label: item.dataset.label
            });
        }
    });

    // debug('Excluded devices:', excludedDevices);
    await storage.update('deviceManager', {excludedDevices});
}

// document.querySelector('.dropup').addEventListener('hide.bs.dropdown'
// document.addEventListener('click', function(event) {
document.querySelector('div#device_manager_div').addEventListener('click', async function (event) {
    let excludeMenu = document.getElementById('exclude_devices_menu');

    let isClickInsideMenu = excludeMenu.contains(event.target);
    let isClickOnDropdownBtn = excludeDropdown.contains(event.target);

    // ToDo: do something better than this
    // If the click was neither inside the menu nor the dropdown button, handle it
    if (!isClickInsideMenu && !isClickOnDropdownBtn) {
        await handleExcludeMenuClose();
    }
});

document.querySelectorAll('.applyExclusions').forEach(
    async btn => btn.addEventListener('click', await handleExcludeMenuClose)
);

// Optionally, update when devices are added/removed
navigator.mediaDevices.ondevicechange = () => async () => {
    debug("device change detected - should I populate dropdowns here?");
    // await populateDeviceDropdowns();

    // rely on the target page monitoring this event and doing a enumerateDevices update for now
    //  otherwise I would need to ask inject to call enumerateDevices manually
};


/************ END deviceManager ************/


/************ START badConnection ************/

const bcsEnabledCheck = document.querySelector("input#bcs_enabled_check");

bcsEnabledCheck.checked = storage.contents['badConnection'].enabled;

bcsEnabledCheck.onclick = async () => {
    const enabled = bcsEnabledCheck.checked;
    debug(`set badConnection enabled to ${enabled}`);
    await storage.update('badConnection', {enabled: enabled});
}

const bcsSelect = document.querySelector("input#bcs_level");

// Permanently disable the bad connection simulator if there is no peer connection
// -- no longer needed with fake device approach
function disableBcs() {
    debug("peerConnection not open in time - disabling bad connection simulator");
    const bcsDiv = document.querySelector("div#bcs");
    let childElements = bcsDiv.getElementsByTagName('*');

    for (let i = 0; i < childElements.length; i++) {
        childElements[i].setAttribute('disabled', "true");
        // childElements[i].classList.add('text-muted');
        childElements[i].classList.add('fw-lighter');
    }

    bcsDiv.querySelector("h5").innerText += " (DISABLED UNTIL REFRESH)"
    // bcsDiv.querySelector("#active").innerText = "enable before connecting";
}


/*
if(storage.contents['badConnection'].noPeerOnStart) {
    disableBcs();
}
 */


function updateBcsSlider() {
    let bcsSliderVal = 3;

    switch (storage.contents['badConnection'].level) {
        case "none":
            bcsSliderVal = 0;
            break;
        case "moderate":
            bcsSliderVal = 1;
            break;
        case "severe":
            bcsSliderVal = 2;
            break;
        default:
            bcsSliderVal = 0;
    }

    bcsSelect.value = bcsSliderVal;

    if (storage.contents['badConnection'].active)
        bcsSelect.classList.add("form-range");
    else
        bcsSelect.classList.remove("form-range");
}

bcsSelect.onclick = async (e) => {
    let command;
    switch (Number(e.target.value)) {
        case 0:
            command = 'passthrough';
            break;
        case 1:
            command = 'moderate';
            break;
        case 2:
            command = 'severe';
            break;
        default:
            console.log("invalid selection");
    }
    debug(`Bad Connection Simulator: ${command} selected`);
    await storage.update('badConnection', {level: command});
}

// initial settings
updateBcsSlider();

storage.addListener('badConnection', () => {
    // no longer needed with fake device approach
    /*if (storage.contents['badConnection']?.noPeerOnStart) {
        disableBcs();
    } else {
        updateSelfViewUI();
    }
     */
    updateSelfViewUI();

});


/************ END badConnection ************/


/************ START InsertPlayer ************/
import {arrayBufferToBase64, base64ToBuffer} from "../videoPlayer/scripts/videoPlayer.mjs";

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
    mh.sendMessage('inject', m.PLAYER_STOP, {});
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
/*

/************ END InsertPlayer ************/
