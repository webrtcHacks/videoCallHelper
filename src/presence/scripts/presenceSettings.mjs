// ToDo: break this into 2 modules - 1 without the DOM for background and 1 with the DOM for dash

import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {glow, disconnect} from "./embrava.mjs"
import {settingsPrototype, webhook} from "./presence.mjs";

const mh = new MessageHandler('dash', console.log);

const statusSpanElem = document.querySelector('span#status');
const btnBusy = document.querySelector('button#busy');
const btnNotBusy = document.querySelector('button#not_busy');

const formOn = document.querySelector('form#on');
const formOff = document.querySelector('form#off');

const embravaCheck = document.querySelector('input#embrava') || document.createElement('input');
let busy = false;

// ToDo: clean up these object names to not start with off/on - left over when I did not have an on/off structure


// let settings = JSON.parse(localStorage.getItem("presence")) || settingsPrototype;
const storage = await chrome.storage.local.get('presence');
let settings = storage?.presence || settingsPrototype;

console.log("Settings:", settings);
// ToDo: initial state
/*
if (settings.busy)
    ledStatus = settings.busy;
else {
    settings.busy = false;
    ledStatus = "off";
}
 */

function displaySettings() {

    embravaCheck.checked = settings.hid;

    // ToDo: should these values be initialized for the initial install?

    formOn["onUrl"].value = settings?.on["onUrl"] || "";
    formOn["onHeaders"].value = settings?.on["onHeaders"] || "";
    formOn["onPostBody"].value = settings?.on["onPostBody"] || "";
    formOn["onGetSwitch"].checked = settings?.on["onMethod"] === "GET";
    if(formOn["onGetSwitch"].checked)
        document.querySelector("textarea#onPostBody").style.display = "none";

    formOff["offUrl"].value = settings?.off["offUrl"] || "";
    formOff["offHeaders"].value = settings?.off["offHeaders"] || "";
    formOff["offPostBody"].value = settings?.off["offPostBody"] || "";
    formOff["offGetSwitch"].checked = settings?.off["offMethod"] === "GET";
    if(formOff["offGetSwitch"].checked)
        document.querySelector("textarea#offPostBody").style.display = "none";

}
displaySettings();

formOn["onGetSwitch"].onchange = function (e) {
    if (e.target.checked) {
        document.querySelector("textarea#onPostBody").style.display = "none";
        settings.on["onMethod"] = "GET";
    } else {
        document.querySelector("textarea#onPostBody").style.display = "block";
        settings.on["onMethod"] = "POST";
    }
}

formOff["offGetSwitch"].onchange = function (e) {
    if (e.target.checked) {
        document.querySelector("textarea#offPostBody").style.display = "none";
        settings.off["offMethod"] = "GET";
    } else {
        document.querySelector("textarea#offPostBody").style.display = "block";
        settings.off["offMethod"] = "POST";
    }
}

displaySettings();

async function busyHandler() {
    busy = true;
    statusSpanElem.textContent = "Busy";
    webhook("on", settings);
    if(embravaCheck.checked)
        await glow([255, 0, 0]);
}

async function notBusyHandler() {
    busy = false;
    statusSpanElem.textContent = "Not Busy";
    webhook("off", settings);
    if(embravaCheck.checked)
        await glow([0, 0, 0]);
}

// mh.addListener(m.GUM_STREAM_START, busyHandler);
// mh.addListener(m.GUM_STREAM_STOP, notBusyHandler);
// mh.addListener(m.UNLOAD, notBusyHandler);

// manual buttons
btnBusy.onclick = busyHandler;
btnNotBusy.onclick = notBusyHandler;

// ToDo: single submit
[formOn, formOff].forEach(form => form.addEventListener('submit', async function (e) {
        const form = e.target.id;
        e.preventDefault();
        console.log(`${form} form submit`);
        const formData = new FormData(e.target);

        const formDataObj = Object.fromEntries(formData.entries());
        console.log(formDataObj);

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
    })
);

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

    console.log(`Embrava busy light is ${embravaCheck.checked ? "set" : "unset"}`);
    // save to settings
    settings.hid = embravaCheck.checked;
    // localStorage.setItem("presence", JSON.stringify(settings));
    await chrome.storage.local.set({presence: settings});

}

