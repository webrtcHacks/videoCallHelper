/*
 * Presence module for background.js
 * Monitors trackData for live tracks; storage for presence settings (enabled) and status (active)
 * Updates the Extension Icon
 * Calls the webRequest function when for on and off
 * Sets HID light
 */

import {settings as presenceSettingsProto} from "../../presence/scripts/settings.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";
import {glow} from "./embrava.mjs";                                 // HID light
import {webRequest} from "./webRequest.mjs";                        // web request function

const PRESENCE_OFF_DELAY = 2000; // time to wait before turning off presence after all tracks are done

const debug = Function.prototype.bind.call(console.log, console, `🫥🟢`);
const storage = await new StorageHandler("local", debug);

// helpers for brevity
const isTrackLive = () => storage.contents.trackData.some(td => td.readyState === 'live');
const isPresenceEnabled = () => storage.contents?.presence?.enabled;
const isPresenceActive = () => storage.contents?.presence?.active;


// initialize presence settings
if (!storage.contents['presence']) {
    await storage.set('presence', presenceSettingsProto);
}


/**
 * Turns the presence indicator on and off based on the presence settings
 * Includes setting the icon, HID indicator, and calling the webRequest function
 * @returns {Promise<void>}
 */
async function presenceOn() {
    if (isTrackLive() && isPresenceEnabled() && !isPresenceActive()) {
        debug("turn presence on here");
        const color = [255, 0, 0];
        const iconPath = "../icons/v_rec.png";

        await chrome.action.setIcon({path: iconPath});

        if (storage.contents?.presence?.hid === true)
            await glow(color);

        webRequest('on', storage.contents.presence);
        await storage.update('presence', {active: true});
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
    async function off() {
        debug("turn presence off here");
        const color = [0, 0, 0];
        const iconPath = "../icons/v_128.png";

        await chrome.action.setIcon({path: iconPath});

        if (storage.contents?.presence?.hid === true)
            await glow(color);

        webRequest('off', storage.contents.presence);
        await storage.update('presence', {active: false});
    }

    if (!isPresenceEnabled() && isPresenceActive())
        await off();
    else if (isTrackLive())
        debug("presenceOff check: some tracks still live", storage.contents.trackData);
    else {
        await new Promise(resolve => setTimeout(async () => {
            if (isPresenceActive() && !isTrackLive()) {
                await off();
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
    } else if (changedValue.enabled === false) {
        await presenceOff();
    }
});

export {
    presenceOn,
    presenceOff
}
// debug("presence background script loaded");