import './style.scss';

const debug = Function.prototype.bind.call(console.debug, console, `vch 📈️‍ `);

import {StorageHandler} from '../modules/storageHandler.mjs';

const storage = await new StorageHandler("local", debug);
window.storage = storage; // for debugging

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
import {settingsPrototype, webhook} from "../presence/scripts/presence.mjs";

if (!storage.contents['presence']) {
    await storage.set('presence', settingsPrototype);
}

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
    webhook("on", storage.contents['presence']);
    // ToDo: handle embrava
};

btnNotBusy.onclick = async () => {
    await storage.update('presence', {active: false});
    webhook("off", storage.contents['presence']);
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

const showBadConnectionDiv = document.querySelector("div#show_bad_connection_div");
const showBadConnectionCheck = document.querySelector("input#show_bad_connection_check");
const showBadConnectionStatus = document.querySelector("span#show_bad_connection_status");

function updateSelfViewUI() {

    // Hide/Obscure Self-View
    try {
        const hideViewEnabled = storage.contents['selfView']['hideView'].enabled;
        const hideViewActive = storage.contents['selfView']['hideView'].active;

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
        const showFramingEnabled = storage.contents['selfView']['showFraming'].enabled;
        const showFramingActive = storage.contents['selfView']['showFraming'].active;

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

    for (let child of showBadConnectionDiv.children) {
        child.disabled = true;
        child.classList.add('text-muted');
    }


    /*
    // Show Bad Connection
    const showBadConnectionEnabled = storage.contents['selfView']['showBadConnection'].enabled;
    const showBadConnectionActive = storage.contents['selfView']['showBadConnection'].active;

    if (showBadConnectionEnabled && showBadConnectionActive)
        showBadConnectionStatus.innerText = "Showing bad connection";
    else if (showBadConnectionEnabled && !showBadConnectionActive)
        showBadConnectionStatus.innerText = "Enable Bad Connection Simulator";
    else
        showBadConnectionStatus.innerText = "Click to enable";

     */
}

// debug("self-view settings:", storage.contents['selfView']);
selfViewCheckbox.checked = storage.contents['selfView']['hideView']?.enabled || false;
showFramingCheck.checked = storage.contents['selfView']['showFraming']?.enabled || false;
// showBadConnectionCheck.checked = storage.contents['selfView']['showBadConnection']?.enabled || false;
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
// take from bacConnection until I made a new panel for this
const bcsEnabledCheck = document.querySelector("input#bcs_enabled_check");

bcsEnabledCheck.checked = storage.contents['badConnection'].enabled;

bcsEnabledCheck.onclick = async () => {
    const enabled = bcsEnabledCheck.checked;
    // debug(`set badConnection enabled to ${enabled}`);

    // No longer relevant? - old ToDo: ok to slide this on and before a peerConnection, but after a peerConnection,
    //  this needs to be fixed to off OR need to do a replaceTrack with a new alterTrack - that could cause issues
    await storage.update('badConnection', {enabled: enabled});

}

/************ END deviceManager ************/



/************ START badConnection ************/

const bcsSelect = document.querySelector("input#bcs_level");

function disableBcs(){
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

// Permanently disable the bad connection simulator if there is no peer connection
if(storage.contents['badConnection'].noPeerOnStart) {
    disableBcs();
}


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
    if (storage.contents['badConnection']?.noPeerOnStart) {
        disableBcs();
    } else {
        updateSelfViewUI();
    }
});


/************ END badConnection ************/
