import {debug, storage} from "../../dash/dashCommon.mjs";
import {webRequest} from "./webRequest.mjs";

/************ START presenceControl************/

// Reference to the presence-enable button
const presenceEnableButton = document.getElementById('presence-enable');
const togglePresenceConfigTabsButton = document.getElementById('toggle-presence-config-tabs');
const presenceConfigTabsContainer = document.getElementById('presence-config-tabs-container');

const isEnabled = storage.contents?.presence?.enabled || false;
const isForced = storage.contents?.presence?.active || false;

// Initial state setup for presence-enable button
if (isEnabled) {
    presenceEnableButton.classList.add('btn-secondary');
    presenceEnableButton.classList.remove('btn-outline-secondary');
    presenceEnableButton.querySelector('span').innerHTML = 'Auto-update <br>ON';
} else {
    presenceEnableButton.classList.add('btn-outline-secondary');
    presenceEnableButton.classList.remove('btn-secondary');
    presenceEnableButton.querySelector('span').innerHTML = 'Auto-update <br>OFF';
}


// Event listener for presence-enable button
presenceEnableButton.addEventListener('click', async () => {
    const newEnabledState = !isEnabled;
    await storage.update('presence', {enabled: newEnabledState});

    // Update button appearance and text
    if (newEnabledState) {
        presenceEnableButton.classList.remove('btn-outline-secondary');
        presenceEnableButton.classList.add('btn-secondary');
        presenceEnableButton.querySelector('span').innerHTML = 'Auto-update <br>ON';
    } else {
        presenceEnableButton.classList.remove('btn-secondary');
        presenceEnableButton.classList.add('btn-outline-secondary');
        presenceEnableButton.querySelector('span').innerHTML = 'Auto-update <br>OFF';
    }

    debug(`Presence status set to ${newEnabledState ? 'enabled' : 'disabled'}`);
});


// Event listener for toggle-presence-config-tabs button
togglePresenceConfigTabsButton.addEventListener('click', () => {
    presenceConfigTabsContainer.classList.toggle('show'); // Toggle the "show" class

    // Optionally update the button text or icon
    const isExpanded = !presenceConfigTabsContainer.classList.contains('d-none');
    // togglePresenceConfigTabsButton.setAttribute('aria-expanded', `${isExpanded}`);
    debug(`Presence Config Tabs ${isExpanded ? 'opened' : 'closed'}`);
});
/************ END presenceControl ************/

/************ START presenceStatus ************/

const camInUse = document.getElementById('camera-in-use');
const micInUse = document.getElementById('microphone-in-use');
const camStreamsCountDisplay  = document.getElementById('camera-stream-count');
const micStreamsCountDisplay  = document.getElementById('microphone-stream-count');

function updatePresenceStatus() {
    const trackData = storage.contents.trackData || {};

    const camStreamsCount = trackData.reduce((acc, track) =>
        track.kind === 'video' && track.readyState === 'live' ? acc + 1 : acc, 0);
    const micStreamsCount = trackData.reduce((acc, track) =>
        track.kind === 'audio' && track.readyState === 'live' ? acc + 1 : acc, 0);

    camStreamsCountDisplay.innerText = camStreamsCount;
    micStreamsCountDisplay.innerText = micStreamsCount;

    camInUse.classList.toggle('text-white', camStreamsCount > 0);
    micInUse.classList.toggle('text-white', micStreamsCount > 0);

    camInUse.classList.toggle('text-secondary-emphasis' );
    micInUse.classList.toggle('text-secondary-emphasis');

    // camInUse.classList.toggle('btn-outline-secondary', camStreamsCount === 0);
    // camInUse.classList.toggle('btn-secondary', camStreamsCount !== 0);

    // micInUse.classList.toggle('btn-outline-secondary', micStreamsCount === 0);
    // micInUse.classList.toggle('btn-secondary', micStreamsCount !== 0);

    debug(`Presence status updated: ${camStreamsCount} camera streams, ${micStreamsCount} microphone streams`);
}

storage.addListener('trackData', updatePresenceStatus);
updatePresenceStatus();


/************ END presenceStatus ************/


/************ START presenceConfig ************/

// References to form fields and the save button
const manualOverrideOnButton = document.getElementById('manual-override-on');
const manualOverrideOffButton = document.getElementById('manual-override-off');
const formOn = document.getElementById('on-settings-form');
const formOff = document.getElementById('off-settings-form');
const presenceSaveButton = document.getElementById('presence-save');

// Event listener for manual-override button
manualOverrideOnButton.onclick = ()=> {
    webRequest("on", storage.contents['presence']);
    debug(`Force Status set to  'ON' `);
}

manualOverrideOffButton.onclick = ()=>{
    webRequest("off", storage.contents['presence']);
    debug(`Force Status set to  'OFF' `);
}


// Function to save settings without form submission
async function saveSettings() {
    let settings = storage.contents['presence'] || {};

    if (formOn) {
        const onSettings = new FormData(formOn);
        settings.on = Object.fromEntries(onSettings.entries());
    }

    if (formOff) {
        const offSettings = new FormData(formOff);
        settings.off = Object.fromEntries(offSettings.entries());
    }

    storage.update('presence', settings).catch(err => debug(err));
    debug('Settings saved:', settings);

    // Reset the save button color after saving
    presenceSaveButton.classList.remove('btn-danger');
    presenceSaveButton.classList.add('btn-outline-secondary');
}

// Function to handle changes to the forms
function handleFormChange() {
    presenceSaveButton.classList.remove('btn-outline-secondary');
    presenceSaveButton.classList.add('btn-danger');
}

// Attach event listeners to the forms
if (formOn) {
    formOn.addEventListener('input', handleFormChange);
}

if (formOff) {
    formOff.addEventListener('input', handleFormChange);
}

// Attach event listener to the save button
if (presenceSaveButton) {
    presenceSaveButton.addEventListener('click', saveSettings);
}

// Function to refresh settings in the UI
function displaySettings() {
    const settings = storage.contents['presence'] || {};

    if (formOn) {
        formOn.querySelector("#presence-url").value = settings?.on?.onUrl || "";
        formOn.querySelector("#presence-method").value = settings?.on?.onMethod || "GET";
        formOn.querySelector("#presence-headers").value = settings?.on?.onHeaders || "";
        formOn.querySelector("#presence-body").value = settings?.on?.onPostBody || "";
    }

    if (formOff) {
        formOff.querySelector("#presence-url-off").value = settings?.off?.offUrl || "";
        formOff.querySelector("#presence-method-off").value = settings?.off?.offMethod || "GET";
        formOff.querySelector("#presence-headers-off").value = settings?.off?.offHeaders || "";
        formOff.querySelector("#presence-body-off").value = settings?.off?.offPostBody || "";
    }
}

// Initial call to display settings
displaySettings();

/************ END presenceConfig ************/
