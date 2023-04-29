// UI handler for standalone settings page

import {glow, disconnect} from "./embrava.mjs"
import {settingsPrototype, webhook} from "./presence.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch presenceSettings: `);

// const mh = new MessageHandler('dash', console.log);
const storage = await new StorageHandler("local", debug);

const statusSpanElem = document.querySelector('span#presence_status');
const btnBusy = document.querySelector('button#busy');
const btnNotBusy = document.querySelector('button#not_busy');
const formOn = document.querySelector('form#on');
const formOff = document.querySelector('form#off');

const embravaCheck = document.querySelector('input#embrava') || document.createElement('input');
const enabledCheck = document.querySelector('input#enable_presence_check');


// ToDo: clean up these object names to not start with off/on - left over when I did not have an on/off structure


// let settings = JSON.parse(localStorage.getItem("presence")) || settingsPrototype;
// const storage = await chrome.storage.local.get('presence');
// const storage = await s.get('presence');
let settings = storage.contents['presence'];
if(!settings){
    settings = await storage.set('presence', settingsPrototype);
}

debug("presence settings:", settings);

// only trigger on a change from no gUM stream to a gUM stream for now
/*
if (settings.busy)
    ledStatus = settings.busy;
else {
    settings.busy = false;
    ledStatus = "off";
}
 */

function displaySettings() {
    settings = storage.contents['presence'];
    enabledCheck.checked = settings.enabled;
    embravaCheck.checked = settings.hid;

    // ToDo: should these values be initialized for the initial install?
    if(formOn) {
        formOn["onUrl"].value = settings?.on["onUrl"] || "";
        formOn["onHeaders"].value = settings?.on["onHeaders"] || "";
        formOn["onPostBody"].value = settings?.on["onPostBody"] || "";
        formOn["onGetSwitch"].checked = settings?.on["onMethod"] === "GET";
        if (formOn["onGetSwitch"].checked)
            document.querySelector("textarea#onPostBody").style.display = "none";
    }

    if(formOff){
        formOff["offUrl"].value = settings?.off["offUrl"] || "";
        formOff["offHeaders"].value = settings?.off["offHeaders"] || "";
        formOff["offPostBody"].value = settings?.off["offPostBody"] || "";
        formOff["offGetSwitch"].checked = settings?.off["offMethod"] === "GET";
        if(formOff["offGetSwitch"].checked)
            document.querySelector("textarea#offPostBody").style.display = "none";
    }

}

displaySettings();


enabledCheck.onchange = async ()=> {
    const enabled = enabledCheck.checked;
    debug(`presence enabled to ${enabled}`);
    await storage.update('presence', {enabled: enabled});
}

// ToDo: single submit - this requires 2 submits for each form right now
async function formSubmitHandler(e){
    const form = e.target.id;
    e.preventDefault();
    debug(`${form} form submit`);
    const formData = new FormData(e.target);

    const formDataObj = Object.fromEntries(formData.entries());
    debug(formDataObj);

    if (form === "on"){
        settings.on = formDataObj;
        formOff.submit(); // didn't work

    }
    else if (form === "off"){
        settings.off = formDataObj;
        formOn.submit();  // didn't work
    }

    // localStorage.setItem("presence", JSON.stringify(settings));
    await chrome.storage.local.set({presence: settings});

    displaySettings();
}

if(formOn){
    // Handle the on and off form submissions
    formOn["onGetSwitch"].onchange = function (e) {
        if (e.target.checked) {
            document.querySelector("textarea#onPostBody").style.display = "none";
            settings.on["onMethod"] = "GET";
        } else {
            document.querySelector("textarea#onPostBody").style.display = "block";
            settings.on["onMethod"] = "POST";
        }
    }
    formOn.addEventListener('submit', formSubmitHandler);
}


if(formOff){
    formOff["offGetSwitch"].onchange = function (e) {
        if (e.target.checked) {
            document.querySelector("textarea#offPostBody").style.display = "none";
            settings.off["offMethod"] = "GET";
        } else {
            document.querySelector("textarea#offPostBody").style.display = "block";
            settings.off["offMethod"] = "POST";
        }
    }
    formOff.addEventListener('submit', formSubmitHandler);
}



// embrava HID device
// if(embravaCheck.checked)
//     await openDevice()

embravaCheck.onchange = async () => {
    // Update the light

    // let embraja.mjs handle this from storage change
    /*
    if(embravaCheck.checked){
        if(busy)
            await glow([255, 0, 0]);
        else
            await glow([0, 0, 0]);
    }
    else
        await disconnect();

     */

    debug(`Embrava busy light is ${embravaCheck.checked ? "set" : "unset"}`);
    await storage.update("presence", {hid: embravaCheck.checked});

}

// Manual button handlers
// ToDo: think through how manual `active` impacts the automatic state changes
async function busyHandler() {
    await storage.update('presence', {active: true});
    webhook("on", settings);
    if(embravaCheck.checked)
        await glow([255, 0, 0]);
    displaySettings();
}

async function notBusyHandler() {
    await storage.update('presence', {active: false});
    webhook("off", settings);
    if(embravaCheck.checked)
        await glow([0, 0, 0]);
    displaySettings();
}

// mh.addListener(m.GUM_STREAM_START, busyHandler);
// mh.addListener(m.GUM_STREAM_STOP, notBusyHandler);
// mh.addListener(m.UNLOAD, notBusyHandler);

storage.addListener('presence', ()=>{

    debug("storage listener for presence", storage.contents['presence']);

    const enabled = storage.contents['presence'].enabled;
    const active = storage.contents['presence'].active;

    if(enabled && active)
        statusSpanElem.innerText = "Busy";
    else if(enabled && !active)
        statusSpanElem.innerText = "Not busy";
    else
        statusSpanElem.innerText = "Click above to enable";
});

// manual buttons
btnBusy.onclick = busyHandler;
btnNotBusy.onclick = notBusyHandler;
