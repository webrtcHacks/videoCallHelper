import {debug, storage} from "../../dash/dashCommon.mjs";

/************ START presence ************/
// backend functions
import {webRequest} from "./webRequest.mjs";

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
