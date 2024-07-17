/**
 * Main pop-up dash script
 * Used to load other applet scripts
 */

import './style.scss';
import {storage, mh} from "./dashCommon.mjs";
import {Tooltip} from "bootstrap";

// To help with debugging
window.vch = {
    storage: storage,
    mh: mh,
    // player: {}
}

/**
 * Tab switching
 */
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.content').forEach(content => content.classList.remove('active'));
        this.classList.add('active');
        document.querySelector(this.getAttribute('data-target')).classList.add('active');
    });
});

/**
 * Applet script imports
 */

// ToDo: add these back one-by-one
import '../deviceManager/scripts/dash.mjs';

/*
import '../presence/scripts/dash.mjs';
import '../imageCapture/scripts/dash.mjs';
import '../badConnection/scripts/dash.mjs';
import '../selfView/scripts/dash.mjs';
import '../videoPlayer/scripts/dash.mjs';
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

streamModificationButtons.forEach(button => button.addEventListener('click', function () {
    if (button.classList.contains('btn-outline-secondary')) {
        toggleButton(streamModificationButtons, 'reload-required');
        showReloadPrompt();
    } else if (button.classList.contains('btn-outline-danger')) {
        toggleButton(streamModificationButtons, 'on');
    } else {
        toggleButton(streamModificationButtons, 'off');
    }
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
