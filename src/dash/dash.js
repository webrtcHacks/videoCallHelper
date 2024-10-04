/**
 * Main pop-up dash script
 * Used to load other applet scripts
 */

import './style.scss';
import {settings as dashSettingsProto} from "./settings.mjs";
import {storage, mh, debug} from "./dashCommon.mjs";
import {Tooltip} from "bootstrap";

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
import '../deviceManager/scripts/dash.mjs';
import '../selfView/scripts/dash.mjs';
import '../badConnection/scripts/dash.mjs';
import '../videoPlayer/scripts/dash.mjs';
import '../presence/scripts/dash.mjs';
import {StorageHandler} from "../modules/storageHandler.mjs";

/*
import '../imageCapture/scripts/dash.mjs';
*/


/** Home tab */


const deviceManagerButtons = document.querySelectorAll('button.deviceManagerButton');
const streamModificationButtons = document.querySelectorAll('button.streamModificationButton');
const reloadWarning = document.querySelector('#reloadWarning');
const reloadButton = document.querySelector('button.reload-button');

function showReloadPrompt() {
    reloadWarning.style.display = 'block';
}

// ToDo: move to home.mjs?
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


deviceManagerButtons.forEach(button => button.addEventListener('click', function () {
    if (button.classList.contains('btn-outline-secondary')) {
        toggleButton(deviceManagerButtons, 'reload-required');
        showReloadPrompt();
    } else if (button.classList.contains('btn-outline-danger')) {
        toggleButton(deviceManagerButtons, 'on');
    } else {
        toggleButton(deviceManagerButtons, 'off');
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
    const isModified = trackDataArray.some(td => td.altered && td.readyState === 'live');


    // get current button state - on, off, or reload-required
    const currentState = button.classList.contains('btn-outline-secondary') ? 'off' :
        button.classList.contains('btn-outline-danger') ? 'reload-required' : 'on';

    if(currentState === 'off') {
        if(isModified) {
            toggleButton(streamModificationButtons, 'reload-required');
            showReloadPrompt();
        }
        else {
            toggleButton(streamModificationButtons, 'on');
            await storage.update('badConnection', {enabled: true});
            await storage.update('player', {enabled: true});
        }
    }
    else if(currentState === 'reload-required') {
        toggleButton(streamModificationButtons, 'off');
        await storage.update('badConnection', {enabled: false});
        await storage.update('player', {enabled: false});
    }
    else if(currentState === 'on') {
        if(isModified) {
            // kill any workers with warning?
            debug('Warning: disabling stream modification while there are modified tracks');
            toggleButton(streamModificationButtons, 'off');
            await storage.update('badConnection', {enabled: false});
            await storage.update('player', {enabled: false});
        }
        else {
            toggleButton(streamModificationButtons, 'off');
            await storage.update('badConnection', {enabled: false});
            await storage.update('player', {enabled: false});
        }
    }
    else {
        debug('Error: unknown streamModifiationButton state');
    }

    /*
    if (button.classList.contains('btn-outline-secondary')) {
        toggleButton(streamModificationButtons, 'reload-required');
        showReloadPrompt();
    } else if (button.classList.contains('btn-outline-danger')) {
        toggleButton(streamModificationButtons, 'on');
        await storage.update('badConnection', {enabled: true});
        await storage.update('player', {enabled: true});
    } else {
        toggleButton(streamModificationButtons, 'off');
        await storage.update('badConnection', {enabled: false});
        await storage.update('player', {enabled: false});
    }

     */
}));

reloadButton.addEventListener('click', function () {
    //location.reload();
});

document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(element => {
    new Tooltip(element);
});

// horizontal accordion logic
document.querySelectorAll('.accordion-header button').forEach(button => {
    button.addEventListener('click', function () {
        const accordionItem = this.closest('.accordion-item');
        const accordionBody = accordionItem.querySelector('.accordion-body');

        // Toggle the active state of the clicked accordion item
        if (accordionItem.classList.contains('active')) {
            // It's active, so we'll hide it
            accordionItem.classList.remove('active');
            accordionBody.style.display = 'none'; // Hide the accordion body
        } else {
            // It's not active, close all others and show this one
            document.querySelectorAll('.accordion-item').forEach(item => {
                item.classList.remove('active');
                const body = item.querySelector('.accordion-body');
                body.style.display = 'none'; // Hide other accordion bodies
            });

            // Now, show the clicked accordion
            accordionItem.classList.add('active');
            accordionBody.style.display = ''; // Show the accordion body, remove the inline style to revert to default
        }
    });
});

if(storage.contents['badConnection']?.enabled) {
    streamModificationButtons.forEach(button =>
        toggleButton(streamModificationButtons, 'on'));
}

if(storage.contents['deviceManager']?.enabled) {
    deviceManagerButtons.forEach(button =>
        toggleButton(deviceManagerButtons, 'on'));
}

