/**
 * Main pop-up dash script
 * Used to load other applet scripts
 */

import './style.scss';
import {settings as dashSettingsProto} from "./settings.mjs";
import {storage, mh, m, c, debug} from "./dashCommon.mjs";
import {Tooltip, Toast} from "bootstrap";

// To help with debugging
window.vch = {
    storage: storage,
    mh: mh,
    // player: {}
}

await StorageHandler.initStorage('dash', dashSettingsProto);


/**
 * Dash tab switching
 */
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', async function () {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.content').forEach(content => content.classList.remove('active'));
        this.classList.add('active');

        const thisTarget = this.getAttribute('data-target');
        document.querySelector(thisTarget).classList.add('active');
        await storage.update("dash", {lastMenuItem: thisTarget});
    });
});

/**
 * Open the stored dash tab from storage
 * @returns {void}
 */
function activateStoredTab() {
    const lastTab = storage.contents['dash']?.lastMenuItem || "self-view";

    document.querySelectorAll('.tab').forEach(tab => {
        const thisTarget = tab.getAttribute('data-target');
        if (thisTarget === lastTab) {
            tab.classList.add('active');
            document.querySelector(thisTarget).classList.add('active');
        } else {
            tab.classList.remove('active');
            document.querySelector(thisTarget).classList.remove('active');
        }
    });
}
activateStoredTab();

/**
 * Applet script imports
 */

// ToDo: add these back one-by-one
import '../applets/deviceManager/scripts/dash.mjs';
import '../applets/selfView/scripts/dash.mjs';
import '../applets/badConnection/scripts/dash.mjs';
import '../applets/videoPlayer/scripts/dash.mjs';
import '../applets/presence/scripts/dash.mjs';
import {StorageHandler} from "../modules/storageHandler.mjs";

/*
import '../imageCapture/scripts/dash.mjs';
*/


/** Home tab */

// document.querySelector('button#device-manager-enabled');
const deviceManagerButtons = document.querySelectorAll('button.deviceManagerButton');
const streamModificationButtons = document.querySelectorAll('button.streamModificationButton');
const reloadWarning = document.querySelector('#reloadWarning');
const reloadButton = document.querySelector('button.reload-button');

function toggleButton(buttonClass, state) {

    buttonClass.forEach(button => {
        const span = button.querySelector('span');
        button.classList.remove('btn-outline-secondary', 'btn-outline-danger', 'btn-secondary');

        if (state === 'on') {
            button.classList.add('btn-secondary');
            span.textContent = span.textContent.replace('Enable', 'Disable');
            reloadWarning.style.display = 'none';
        } else if (state === 'reload-required') {
            button.classList.add('btn-outline-danger');
            span.textContent = span.textContent.replace('Enable', 'Disable');
            reloadWarning.style.display = 'block';
        } else {
            button.classList.add('btn-outline-secondary');
            span.textContent = span.textContent.replace('Disable', 'Enable');
            reloadWarning.style.display = 'none';
        }
    });
}

// Update event listeners to use the ToastHandler instance
deviceManagerButtons.forEach(button => button.addEventListener('click', async function () {
    const currentState = button.classList.contains('btn-outline-secondary') ? 'off' :
        button.classList.contains('btn-outline-danger') ? 'reload-required' : 'on';

    toastHandler.showReloadPrompt(button, currentState, deviceManagerButtons, 'deviceManager');
    toggleButton(deviceManagerButtons, 'reload-required');
    deviceManagerButtons.forEach(button => button.classList.add('disabled'));

    if (currentState === 'off') {
        await storage.update('deviceManager', {enabled: true});
    } else {
        await storage.update('deviceManager', {enabled: false});
    }
}));

streamModificationButtons.forEach(button => button.addEventListener('click', async function () {


    /* Logic
    * off -> on
    *  if modified tracks -> reload-required
    *  else -> on & enable
    *
    * reload-required -> cancel
    *
    * on -> off
    *  if modified tracks -> kill any workers with warning?
    *  if not modified tracks -> disable
     */

    // check if any track in trackData has altered and readyState === 'live'
    const trackDataArray = await storage.contents.trackData || [];
    // const isModified = trackDataArray.some(td => td.altered && td.readyState === 'live');
    const isActiveTracks = trackDataArray.some(td => td.readyState === 'live');

    // get current button state - on, off, or reload-required
    const currentState = button.classList.contains('btn-outline-secondary') ? 'off' :
        button.classList.contains('btn-outline-danger') ? 'reload-required' : 'on';

    // There are tracks, so warn the user this won't work without a refresh
    // To think about
    //  1. modify the warning to be more specific
    //  2. allow modification only on new tracks
    //  3. force a stop on existing tracks
    if(isActiveTracks) {
        // debug("altered tracks: ", trackDataArray.filter(td => td.altered && td.readyState === 'live') );

        toastHandler.showReloadPrompt(button, currentState, streamModificationButtons, ['badConnection', 'player']);
        toggleButton(streamModificationButtons, 'reload-required');
        streamModificationButtons.forEach(button => {
            button.classList.add('disabled');
        });

        if(currentState === 'off') {
            await storage.update('badConnection', {enabled: true});
            await storage.update('player', {enabled: true});
        }
        else if(currentState === 'on' || currentState === 'reload-required') {
            await storage.update('badConnection', {enabled: false});
            await storage.update('player', {enabled: false});
        }
        else{
            debug(`Error: unexpected state in streamModificationButtons. isActiveTracks ${isActiveTracks}`, trackDataArray);
        }
    }
    // No live tracks, so it is safe to switch
    else {
        if(currentState === 'off') {
            await storage.update('badConnection', {enabled: true});
            await storage.update('player', {enabled: true});
            toggleButton(streamModificationButtons, 'on');
        }
        else if(currentState === 'on') {
            await storage.update('badConnection', {enabled: false});
            await storage.update('player', {enabled: false});
            toggleButton(streamModificationButtons, 'off');
        }
        else{
            debug(`Error: unexpected state in streamModificationButtons.`, trackDataArray);
        }
    }

}));

reloadButton.addEventListener('click', function () {
    //location.reload();
});

document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
    new Tooltip(element);
});


if(storage.contents['badConnection']?.enabled) {
        toggleButton(streamModificationButtons, 'on')
}

if(storage.contents['deviceManager']?.enabled) {
        toggleButton(deviceManagerButtons, 'on')
}

/**
 * Class to handle toast notifications for button interactions.
 */
class ToastHandler {
    /**
     * Creates an instance of ToastHandler.
     * @param {HTMLElement} reloadToast - The toast element for reload notifications.
     * @param {HTMLElement} cancelToastButton - The button element to cancel the toast.
     * @param {HTMLElement} refreshToastButton - The button element to refresh the page.
     */
    constructor(reloadToast, cancelToastButton, refreshToastButton) {
        this.reloadToast = new Toast(reloadToast);
        this.cancelToastButton = cancelToastButton;
        this.refreshToastButton = refreshToastButton;
        this.previousButtonState = null;
        this.previousState = null;
        this.relevantButtons = null;
        this.relevantStateKeys = null;

        this.cancelToastButton.addEventListener('click', this.handleCancelToast.bind(this));
        this.refreshToastButton.addEventListener('click', this.handleRefreshToast.bind(this));
    }

    /**
     * Shows the reload prompt toast.
     * @param {HTMLElement} button - The button element that triggered the toast.
     * @param {string} state - The current state of the button ('on', 'off', or 'reload-required').
     * @param {NodeListOf<HTMLElement>} buttons - The list of buttons to be toggled.
     * @param {string[]} stateKeys - The array of state keys to be updated in storage.
     */
    showReloadPrompt(button, state, buttons, stateKeys) {
        this.previousButtonState = button;
        this.previousState = state;
        this.relevantButtons = buttons;
        this.relevantStateKeys = stateKeys;
        this.reloadToast.show();
    }

    /**
     * Handles the cancel action for the toast.
     * Reverts the button states and updates the storage.
     * @returns {Promise<void>}
     */
    async handleCancelToast() {
        this.reloadToast.hide();
        if (this.previousButtonState && this.previousState !== null) {
            toggleButton(this.relevantButtons, this.previousState);
            for (const stateKey of this.relevantStateKeys) {
                await storage.update(stateKey, {enabled: this.previousState === 'on'});
            }
            this.relevantButtons.forEach(button => button.classList.remove('disabled'));
        }
    }

    /**
     * Handles the refresh action for the toast.
     * Reloads the page.
     * @returns {Promise<void>}
     */
    async handleRefreshToast() {
        await mh.sendMessage(c.BACKGROUND, m.RELOAD);
    }
}

// Initialize the ToastHandler
const toastHandler = new ToastHandler(
    document.getElementById('reload-toast'),
    document.getElementById('cancel-toast'),
    document.getElementById('refresh-toast')
);
