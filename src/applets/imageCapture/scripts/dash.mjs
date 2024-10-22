// ToDo: stop button not working
import {debug, storage} from "../../../dash/dashCommon.mjs";

/**
 * Common elements and functions between dash and the image capture page
 */

// Update Chrome Local Storage image sampling settings from UI elements
// Used for UI pages - pop-up dash, dedicated page, maybe options

const settingsBtn = document.querySelector('button#apply_settings');
const samplingStartBtn = document.querySelector('button#sampling_start');
const samplingStopBtn = document.querySelector('button#sampling_stop');

const startOnPcCheck = document.querySelector('input#start_on_pc_check');
const enabledCheck = document.querySelector('input#enable_img_cap_check');
const captureIntervalInput  = document.querySelector('input#interval');


// export let settings = (await chrome.storage.local.get('imageCapture'))?.imageCapture;
debug("starting settings:", storage.contents['imageCapture']);

// Save to chrome storage local
async function saveSettings() {
    const settings = storage.contents['imageCapture'] || {};
    settings.startOnPc = startOnPcCheck.checked;
    settings.captureIntervalMs = captureIntervalInput.value * 1000;
    settings.active = samplingStartBtn.disabled;
    settings.enabled = enabledCheck.checked;

    await storage.update('imageCapture', settings);
    debug("Settings updated:", settings);

}

[settingsBtn, startOnPcCheck]
    .forEach(btn=>btn.onclick = () => saveSettings());

// ToDo: these should only be enabled if there is a stream
// start / stop button enabled & save
[samplingStartBtn, samplingStopBtn].forEach(btn=>btn.onclick = async ()=>{
    samplingStartBtn.disabled = !samplingStartBtn.disabled;
    samplingStopBtn.disabled = !samplingStopBtn.disabled;
    await saveSettings()
});

enabledCheck.onchange = async ()=> {
    const enabled = enabledCheck.checked;
    debug(`presence enabled to ${enabled}`);
    await storage.update('imageCapture', {enabled: enabled});
}

// Initial settings
const initSettings = {
    startOnPc: storage.contents['imageCapture']?.startOnPc || false,
    captureIntervalMs: storage.contents['imageCapture']?.captureIntervalMs || (60 * 1000),
    active: storage.contents['imageCapture']?.active || false,
    enabled: storage.contents['imageCapture']?.enabled || false,
};

startOnPcCheck.checked = initSettings.startOnPc;
captureIntervalInput.value = initSettings.captureIntervalMs / 1000;
samplingStartBtn.disabled = initSettings.active || !initSettings.enabled;
samplingStopBtn.disabled = !initSettings.active || !initSettings.enabled;
enabledCheck.checked = initSettings.enabled;


function updateUI(){
    const settings = storage.contents['imageCapture'];  //|| {};
    debug("new dash imageCapture settings:", settings);
    startOnPcCheck.checked = settings.startOnPc;
    captureIntervalInput.value = settings.captureIntervalMs / 1000;
    samplingStartBtn.disabled = settings.active || !settings.enabled;
    samplingStopBtn.disabled = !settings.active || !settings.enabled;
    enabledCheck.checked = settings.enabled;
}

storage.addListener('imageCapture', updateUI);

/**
 *  Button to open dedicated image capture page
 */
// Image capture button
const openSamplingButton = document.querySelector("button#open_sampling");
if(openSamplingButton){
    openSamplingButton.onclick = async () => {
        const url = chrome.runtime.getURL("pages/imageCapture.html");
        await chrome.tabs.create({url});
    }

}

