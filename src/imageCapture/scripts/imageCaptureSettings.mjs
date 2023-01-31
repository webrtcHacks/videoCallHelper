// Update Chrome Local Storage image sampling settings from UI elements
// Used for UI pages - pop-up dash, dedicated page, maybe options

const settingsBtn = document.querySelector('button#apply_settings');
const samplingStartBtn = document.querySelector('button#sampling_start');
const samplingStopBtn = document.querySelector('button#sampling_stop');

const startOnPcCheck = document.querySelector('input#start_on_pc_check');
const captureIntervalInput  = document.querySelector('input#interval');

const debug = function () {
    return Function.prototype.bind.call(console.debug, console, `vch 🕵️ imageCaptureSettings: `);
}();

export let settings = (await chrome.storage.local.get('imageCapture'))?.imageCapture;
debug("starting settings:", settings);
let ignoreStorageChange = true;

// Save to chrome storage local
async function saveSettings() {
    settings.startOnPc = startOnPcCheck.checked;
    settings.captureIntervalMs = captureIntervalInput.value * 1000;
    settings.samplingActive = samplingStartBtn.disabled;

    ignoreStorageChange = true;
    await chrome.storage.local.set({imageCapture: settings});
    debug("Settings updated:", settings);
    ignoreStorageChange = false;

}

// Sync the UI with the settings values and set starting values if needed
async function initSettings(){
    // default values
    let {startOnPc, captureIntervalMs, samplingActive} = settings;
    settings.startOnPc = startOnPc || false;
    settings.captureIntervalMs = captureIntervalMs || (30 * 1000);
    settings.samplingActive = samplingActive || false;
    debug("initial settings:",  settings);

    startOnPcCheck.checked = settings.startOnPc;
    captureIntervalInput.value = settings.captureIntervalMs / 1000;
    samplingStartBtn.disabled = settings.samplingActive;
    samplingStopBtn.disabled = !settings.samplingActive;

}

// Sync changes from other tabs
chrome.storage.onChanged.addListener( async (changes, area)=>{
    if(changes['imageCapture'] && !ignoreStorageChange){
        debug(`storage area "${area}" changes: `, changes['imageCapture']);
        settings = changes['imageCapture'].newValue;
        await initSettings();
    }
});


[settingsBtn, startOnPcCheck]
    .forEach(btn=>btn.onclick = () => saveSettings());

// start / stop button enabled & save
[samplingStartBtn, samplingStopBtn].forEach(btn=>btn.onclick = async ()=>{
    samplingStartBtn.disabled = !samplingStartBtn.disabled;
    samplingStopBtn.disabled = !samplingStopBtn.disabled;
    await saveSettings()
});

// set and save if storage object is blank
if(settings === undefined){
    settings = {};
    await initSettings();
    await saveSettings();
} else
    await initSettings();
