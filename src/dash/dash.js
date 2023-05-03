import './style.scss';

const debug = Function.prototype.bind.call(console.debug, console, `vch 📈️‍ `);

import {StorageHandler} from '../modules/storageHandler.mjs';
const storage = await new StorageHandler("local", debug);
window.storage = storage; // for debugging

/*
// Remnants from post experiments

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
document.querySelector("button#open_sampling").onclick = async ()=> {
    const url = chrome.runtime.getURL("pages/imageCapture.html");
    await chrome.tabs.create({url});
}
/************ END imageCapture ************/


/************ START presence ************/
// backend functions
import {settingsPrototype, webhook} from "../presence/scripts/presence.mjs";

if(!storage.contents['presence']){
    await storage.set('presence', settingsPrototype);
}

const statusSpanElem = document.querySelector('span#presence_status');
const enabledCheck = document.querySelector('input#enable_presence_check');
const btnBusy = document.querySelector('button#busy');
const btnNotBusy = document.querySelector('button#not_busy');

// initial state
statusSpanElem.innerText = storage.contents?.presence?.active ? "active" : "inactive";
enabledCheck.checked = storage.contents?.presence?.enabled;

document.querySelector("button#presence_setup").onclick = async ()=> {
    const url = chrome.runtime.getURL("pages/presence.html");
    await chrome.tabs.create({url});
}

enabledCheck.onclick = async ()=> {
    const enabled = enabledCheck.checked;
    debug(`presence enabled set to ${enabled}`);
    await storage.update('presence', {enabled: enabled});
}


btnBusy.onclick = async ()=> {
    await storage.update('presence', {active: true});
    webhook("on", storage.contents['presence']);
    // ToDo: handle embrava
};

btnNotBusy.onclick = async ()=> {
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

// Hide self view
const selfViewCheckbox = document.querySelector("input#hide_self_view_check");
const selfViewStatus = document.querySelector("span#self_view_status");

function updateSelfViewUI() {

    const enabled = storage.contents['selfView'].enabled;
    const active = storage.contents['selfView'].active;

    if(enabled && active)
        selfViewStatus.innerText = "Obscuring self-view";
    else if(enabled && !active)
        selfViewStatus.innerText = "Looking for self-view";
    else
        selfViewStatus.innerText = "Click above to enable";
}

// debug("self-view settings:", storage.contents['selfView']);
selfViewCheckbox.checked = storage.contents['selfView']?.enabled || false;
updateSelfViewUI();


selfViewCheckbox.onclick = async ()=> {
    const enabled = selfViewCheckbox.checked;
    // debug(`set self-view enabled to ${enabled}`);
    await storage.update('selfView', {enabled: enabled});
}

storage.addListener('selfView', () => {
    updateSelfViewUI();
});

/************ END selfView  ************/


/************ START badConnection ************/

const bcsSelect = document.querySelector("input#bcs_level");

function updateBcsSlider(){
    let bcsSliderVal = 3;

    switch(storage.contents['badConnection'].level){
        case "none": bcsSliderVal = 0; break;
        case "moderate": bcsSliderVal = 1; break;
        case "severe": bcsSliderVal = 2; break;
        default: bcsSliderVal = 0;
    }

    bcsSelect.value = bcsSliderVal;

    if(storage.contents['badConnection'].active)
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
    updateSelfViewUI();
});

/************ END badConnection ************/
