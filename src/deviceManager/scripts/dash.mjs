import {debug, storage} from "../../dash/dashCommon.mjs";

const enabledButton = document.querySelector('button#device-manager-enabled');
const reloadWarning = document.querySelector('div#device-manager-reload-warning');
const deviceManagerSelections = document.querySelector('div#device-manager-selections');

// Initialize state
let enabledButtonCurrentState = storage.contents['deviceManager']?.enabled ? 'on' : 'off';

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

// moved to dash.js
/*
function showReloadPrompt() {
    reloadWarning.style.display = 'block';
}

function toggleButton(button, state) {
    debug('starting enable button state: ', state);
    const span = button.querySelector('span');
    button.classList.remove('btn-outline-secondary', 'btn-outline-danger', 'btn-secondary');

    if (state === 'on') {
        button.classList.add('btn-secondary');
        span.textContent = span.textContent.replace('Enable', 'Disable');
        //reloadWarning.style.display = 'none';
    } else if (state === 'reload-required') {
        button.classList.add('btn-outline-danger');
        span.textContent = span.textContent.replace('Enable', 'Disable');
        showReloadPrompt();
    } else {
        button.classList.add('btn-outline-secondary');
        span.textContent = span.textContent.replace('Disable', 'Enable');
        //reloadWarning.style.display = 'none';
    }
}

enabledButton.addEventListener('click', function () {
    debug('enabledButton clicked');
    if (enabledButton.classList.contains('btn-outline-secondary')) {
        toggleButton(enabledButton, 'reload-required');
        reloadWarning.style.display = 'block';
    } else if (enabledButton.classList.contains('btn-outline-danger')) {
        toggleButton(enabledButton, 'on');
    } else {
        toggleButton(enabledButton, 'off');
    }
});
 */

// toggleButton(enabledButton, enabledButtonCurrentState);

// New functionality to handle device listings as buttons
async function populateDeviceButtons() {
    // Clear previous options
    deviceManagerSelections.innerHTML = '';

    const devices = storage.contents['deviceManager']?.currentDevices || [];

    devices.forEach(device => {
        let button = document.createElement('button');
        button.classList.add('btn', 'btn-outline-secondary', 'device-button', 'btn-sm');
        button.dataset.deviceId = device.deviceId;
        button.dataset.kind = device.kind;
        button.textContent = device.label || `Unknown ${device.kind}`;

        let checkmark = document.createElement('span');
        checkmark.classList.add('checkmark', 'd-none'); // Initially hidden
        checkmark.innerHTML = ' <i class="bi bi-check-circle-fill"></i>'; // Bootstrap icon for the checkmark

        button.appendChild(checkmark);
        deviceManagerSelections.appendChild(button);
    });

    addButtonEventListeners();
}

// Add event listeners to device buttons
function addButtonEventListeners() {
    document.querySelectorAll('.device-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            let selectedKind = button.dataset.kind;
            let selectedLabel = button.textContent;

            // Deselect all buttons of the same kind and hide their checkmarks

            /*
            document.querySelectorAll(`.device-button[data-kind="${selectedKind}"]`).forEach(btn => {
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-outline-secondary');
                btn.querySelector('.checkmark').classList.add('d-none'); // Hide checkmark
            });
             */

            // Toggle the clicked button
            if (button.classList.contains('btn-outline-secondary')) {
                button.classList.remove('btn-outline-secondary');
                button.classList.add('btn-secondary');
                button.querySelector('.checkmark').classList.remove('d-none'); // Show checkmark
            } else {
                button.classList.remove('btn-secondary');
                button.classList.add('btn-outline-secondary');
                button.querySelector('.checkmark').classList.add('d-none'); // Hide checkmark
            }

            // ToDo: Update storage with selected device
            /*
            if (selectedKind === 'audioinput') {
                await storage.update("deviceManager", {selectedAudioDevice: selectedLabel});
            } else if (selectedKind === 'videoinput') {
                await storage.update("deviceManager", {selectedVideoDevice: selectedLabel});
            } else if (selectedKind === 'audiooutput') {
                await storage.update("deviceManager", {selectedSpeakerDevice: selectedLabel});
            }
             */

            debug(`Selected ${selectedKind}: ${selectedLabel}`);
        });
    });
}

/**
 * Update the labels in the targetDiv with checkboxes for each device of the specified kind
 * @param targetDiv - the horizontal accordion-body div to populate with checkboxes
 * @returns {Promise<void>}
 */
async function updateLabels(targetDiv, kind){
    // Clear previous options
    targetDiv.innerHTML = '';

    const currentDevices = storage.contents['deviceManager']?.currentDevices || [];
    const excludedDevices = storage.contents['deviceManager']?.excludedDevices || [];

    // Get labels for this kind of device
    const currentDeviceLabels = currentDevices
        .filter(device => device.kind === kind)
        .map(device => device.label);
    const excludedDeviceLabels = excludedDevices
        .filter(device => device.kind === kind)
        .map(device => device.label);
    const uniqueLabels = new Set([...currentDeviceLabels, ...excludedDeviceLabels]);   // temp store for unique labels

    uniqueLabels.forEach(label => {
        let checkboxContainer = document.createElement('div');
        checkboxContainer.classList.add('form-check');

        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('form-check-input');
        checkbox.id = `device-${label}`;

        let labelElement = document.createElement('label');
        labelElement.classList.add('form-check-label');
        labelElement.setAttribute('for', `device-${label}`);
        labelElement.textContent = label || `Unknown ${kind}`;

        // Apply strikethrough and checkmark for excluded devices
        if (excludedDeviceLabels.includes(label)) {
            checkbox.checked = true;
            labelElement.classList.add('text-decoration-line-through');
            if (!currentDeviceLabels.includes(label)) {
                let checkmark = document.createElement('span');
                checkmark.classList.add('missing-device-checkmark');
                checkmark.innerHTML = '<i class="bi bi-x-circle text-decoration-none" ' +
                    'data-bs-toggle="tooltip" title="Missing from current devices"></i>';
                labelElement.insertBefore(checkmark, labelElement.firstChild);

                // Add click event to remove labelElement
                checkmark.addEventListener('click', (e) => {
                    // ToDo: should we warn the user that the device might automatically be activated if they plug it in again?
                    e.stopPropagation(); // Prevent checkbox toggle
                    checkboxContainer.remove();
                    excludedDevices.splice(excludedDevices.indexOf(label), 1);
                });
            }
        } else {
            labelElement.classList.add('text-decoration-none');
        }

        // Add event listener to toggle text-decoration-line-through
        checkbox.addEventListener('change', async () => {
            if (checkbox.checked) {
                labelElement.classList.add('text-decoration-line-through');
                // match the label to the item in the currentDevices list, then add it to excludedDevices
                const device = currentDevices.find(device => device.label === label);
                excludedDevices.push(device);
            } else {
                labelElement.classList.remove('text-decoration-line-through');
                excludedDevices.splice(excludedDevices.indexOf(label), 1);
            }
            // ToDo: Error checking if nothing is left in the list
            await storage.update('deviceManager', {excludedDevices});
        });

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(labelElement);
        targetDiv.appendChild(checkboxContainer);
    });

}

async function showDevices(buttonId, kind, targetId) {
    const targetDiv = document.querySelector(`#${targetId} div.accordion-body`);
    document.querySelectorAll('.device-button').forEach(button => {
        const isActive = button.id === buttonId;
        button.classList.toggle('btn-secondary', isActive);
        button.classList.toggle('btn-outline-secondary', !isActive);
    });
    await updateLabels(targetDiv, kind);
}

const deviceButtonConfigs = {
    'microphone-devices-button': ['audioinput', 'microphone-devices'],
    'camera-devices-button': ['videoinput', 'camera-devices'],
    'speaker-devices-button': ['audiooutput', 'speaker-devices']
};

Object.entries(deviceButtonConfigs).forEach(([buttonId, [kind, targetId]]) => {
    document.querySelector(`#${buttonId}`)
        .addEventListener('click', () => showDevices(buttonId, kind, targetId));
});

storage.addListener('deviceManager', async () => {
    for (const [buttonId, [kind, targetId]] of Object.entries(deviceButtonConfigs)) {
        if (document.querySelector(`#${buttonId}`).classList.contains('btn-secondary')) {
            await updateLabels(document.querySelector(`#${targetId} div.accordion-body`), kind);
        }
    }
});

