import {debug, storage} from "../../dash/dashCommon.mjs";

const enabledButton = document.querySelector('button#device-manager-enabled');
const reloadWarning = document.querySelector('div#device-manager-reload-warning');
const deviceManagerSelections = document.querySelector('div#device-manager-selections');

// Initialize state
let enabledButtonCurrentState = storage.contents['deviceManager']?.enabled ? 'on' : 'off';

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
        reloadWarning.style.display = 'none';
    } else if (state === 'reload-required') {
        button.classList.add('btn-outline-danger');
        span.textContent = span.textContent.replace('Enable', 'Disable');
        showReloadPrompt();
    } else {
        button.classList.add('btn-outline-secondary');
        span.textContent = span.textContent.replace('Disable', 'Enable');
        reloadWarning.style.display = 'none';
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

toggleButton(enabledButton, enabledButtonCurrentState);

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

const microphoneDevicesButton = document.querySelector('#microphone-devices-button');
const cameraDevicesButton = document.querySelector('#camera-devices-button');
const speakerDevicesButton = document.querySelector('#speaker-devices-button');

async function showDevices(id, kind, label) {

    [microphoneDevicesButton, cameraDevicesButton, speakerDevicesButton].forEach(button => {
        button.classList.remove('btn-secondary');
        button.classList.add('btn-outline-secondary');
    });

    // set the clicked button to be btn-secondary
    document.querySelector(`#${id}`).classList.remove('btn-outline-secondary');
    document.querySelector(`#${id}`).classList.add('btn-secondary');

    // Clear previous options
    deviceManagerSelections.innerHTML = `<h5>${label}</h5>`;

    const devices = storage.contents['deviceManager']?.currentDevices || [];

    devices.filter(device => device.kind === kind).forEach(device => {
        let button = document.createElement('button');
        button.classList.add('btn', 'btn-outline-secondary', 'device-button');
        button.dataset.deviceId = device.deviceId;
        button.dataset.kind = device.kind;
        button.textContent = device.label || `Unknown ${device.kind}`;

        deviceManagerSelections.appendChild(button);
    });

    addButtonEventListeners();
}

// Event listeners for showing device buttons
microphoneDevicesButton.addEventListener('click', async () => {
    await showDevices('microphone-devices-button', 'audioinput', 'Microphone Devices');
});

cameraDevicesButton.addEventListener('click', async() => {
    await showDevices('camera-devices-button', 'videoinput', 'Camera Devices');
});

speakerDevicesButton.addEventListener('click', async() => {
    await showDevices('speaker-devices-button', 'audiooutput', 'Speaker Devices');
});



// Initialize device lists
populateDeviceButtons().catch(err => console.error('Error populating device buttons:', err));
