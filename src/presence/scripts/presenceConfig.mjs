// UI handler for standalone settings page

import {glow, disconnect} from "./embrava.mjs"
import {webRequest} from "./webRequest.mjs";
import {settings as presenceSettingsProto} from "./settings.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch presenceSettings: `);

const storage = await new StorageHandler();

const statusSpanElem = document.querySelector('span#presence_status');
const btnBusy = document.querySelector('button#busy');
const btnNotBusy = document.querySelector('button#not_busy');
const formOn = document.querySelector('form#on');
const formOff = document.querySelector('form#off');

const embravaCheck = document.querySelector('input#embrava') || document.createElement('input');
const enabledCheck = document.querySelector('input#enable_presence_check');

// ToDo: why was this here?
let settings = storage.contents['presence'];
/*
if(!settings){
    settings = await storage.set('presence', presenceSettingsProto);
}
 */

debug("presence settings:", settings);

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


enabledCheck.onclick = async ()=> {
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

embravaCheck.onclick = async () => {
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
    webRequest("on", settings);
    if(embravaCheck.checked)
        await glow([255, 0, 0]);
    displaySettings();
}

async function notBusyHandler() {
    await storage.update('presence', {active: false});
    webRequest("off", settings);
    if(embravaCheck.checked)
        await glow([0, 0, 0]);
    displaySettings();
}

// manual buttons
btnBusy.onclick = busyHandler;
btnNotBusy.onclick = notBusyHandler;

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
