/*
 * Presence module for background.js
 * Monitors trackData for live tracks; storage for presence settings (enabled) and status (active)
 * Updates the Extension Icon
 * Calls the webRequest function when for on and off
 * Sets HID light
 */

import {StorageHandler} from "../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";
import {settings as presenceSettingsProto} from "../../presence/scripts/settings.mjs";
import {glow} from "./embrava.mjs";                                                 // HID light
import {webRequest} from "./webRequest.mjs";                                        // web request function

const PRESENCE_OFF_DELAY = 2000; // time to wait before turning off presence after all tracks are done

const debug = Function.prototype.bind.call(console.log, console, `🫥🟢`);
const storage = await new StorageHandler();
const mh = new MessageHandler(c.BACKGROUND);

// initialize presence settings
await StorageHandler.initStorage('presence', presenceSettingsProto);

// helpers for brevity
const isTrackLive = () => storage.contents.trackData.some(td => td.readyState === 'live');
const isPresenceEnabled = () => storage.contents?.presence?.enabled;
const isPresenceActive = () => storage.contents?.presence?.active;

/**
 * Sets the presence state based on the isOn parameter
 * @param isOn
 * @returns {Promise<void>}
 */
async function setPresenceState(isOn) {
    const color = isOn ? [255, 0, 0] : [0, 0, 0];
    const iconPath = isOn ? "../images/v_rec.png" : "../images/v_128.png";

    await chrome.action.setIcon({path: iconPath});

    if (storage.contents?.presence?.hid === true)
        await glow(color);

    webRequest(isOn ? 'on' : 'off', storage.contents.presence, debug);
    await storage.update('presence', {active: isOn});
}

/**
 * Turns the presence indicator on and off based on the presence settings
 * Includes setting the icon, HID indicator, and calling the webRequest function
 * @returns {Promise<void>}
 */
async function presenceOn() {
    if (isTrackLive() && isPresenceEnabled() && !isPresenceActive()) {
        debug("turn presence on here");
        await setPresenceState(true);
    } else {
        debug("presence already active or not enabled");
    }
}

/**
 * Turns the presence indicator off based on the presence settings
 * Includes setting the icon, HID indicator, and calling the webRequest function
 * @returns {Promise<void>}
 */

async function presenceOff() {
    if (!isPresenceEnabled() && isPresenceActive()) {
        debug("turn presence off here");
        await setPresenceState(false);
    } else {
        await new Promise(resolve => setTimeout(async () => {
            if (isTrackLive())
                debug("presenceOff check: some tracks still live", storage.contents.trackData);
            else if (isPresenceActive() && !isTrackLive()) {
                debug("turn presence off here");
                await setPresenceState(false);
            }
            resolve();
        }, PRESENCE_OFF_DELAY));
    }
}

// Listens for changes to the presence settings and calls the presenceOn and presenceOff functions
storage.addListener('presence', async (newValue, changedValue) => {
    debug(`presence storage changes - new, changed: `, newValue, changedValue);

    // ToDo: handle changes in webhook settings
    if (changedValue.enabled === true) {
        await presenceOn();
    } else if (changedValue.enabled === false || changedValue.active === false) {
        await presenceOff();
    }
});

// Check if a track was still live on tab close
chrome.tabs.onRemoved.addListener(async ()=> await presenceOff());

/**
 * Listeners for track changes and calls the presenceOn and presenceOff functions
 */
mh.addListener(m.NEW_TRACK, async () => {await presenceOn()} );
mh.addListener(m.TRACK_ENDED, async()=> {await presenceOff()} );

// debug("presence background script loaded");
