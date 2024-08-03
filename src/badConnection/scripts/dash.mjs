import {debug, storage} from "../../dash/dashCommon.mjs";

// Selectors for the new elements
const badQualityOffButton = document.querySelector("#bad-quality-off");
const badQualityModerateButton = document.querySelector("#bad-quality-moderate");
const badQualitySevereButton = document.querySelector("#bad-quality-severe");

// Update the bad quality simulation status based on the stored settings
function updateQualitySimulation() {
    const level = storage.contents['badConnection'].level;
    switch (level) {
        case "none":
            setQualityOff();
            break;
        case "moderate":
            setQualityModerate();
            break;
        case "severe":
            setQualitySevere();
            break;
        default:
            setQualityOff();
    }
}

// Functions to set the quality simulation
function setQualityOff() {
    badQualityOffButton.classList.add("active");
    badQualityModerateButton.classList.remove("active");
    badQualitySevereButton.classList.remove("active");
    debug(`Bad Connection Simulator: passthrough selected`);
    storage.update('badConnection', {level: "passthrough"});
}

function setQualityModerate() {
    badQualityOffButton.classList.remove("active");
    badQualityModerateButton.classList.add("active");
    badQualitySevereButton.classList.remove("active");
    debug(`Bad Connection Simulator: moderate selected`);
    storage.update('badConnection', {level: "moderate"});
}

function setQualitySevere() {
    badQualityOffButton.classList.remove("active");
    badQualityModerateButton.classList.remove("active");
    badQualitySevereButton.classList.add("active");
    debug(`Bad Connection Simulator: severe selected`);
    storage.update('badConnection', {level: "severe"});
}

// Event listeners for the buttons
badQualityOffButton.addEventListener("click", setQualityOff);
badQualityModerateButton.addEventListener("click", setQualityModerate);
badQualitySevereButton.addEventListener("click", setQualitySevere);

// Initialize the settings on page load
updateQualitySimulation();

/****** OLD CODE ******/
/*
import {debug, storage} from "../../dash/dashCommon.mjs";

const bcsEnabledCheck = document.querySelector("input#bcs_enabled_check");
const bcsSelect = document.querySelector("input#bcs_level");


// Enabled handler
bcsEnabledCheck.checked = storage.contents['badConnection'].enabled;

bcsEnabledCheck.onclick = async () => {
    const enabled = bcsEnabledCheck.checked;
    debug(`set badConnection enabled to ${enabled}`);
    await storage.update('badConnection', {enabled: enabled});
}


// Updates the slider value based on the current settings
function updateBcsSlider() {
    let bcsSliderVal = 3;

    switch (storage.contents['badConnection'].level) {
        case "none":
            bcsSliderVal = 0;
            break;
        case "moderate":
            bcsSliderVal = 1;
            break;
        case "severe":
            bcsSliderVal = 2;
            break;
        default:
            bcsSliderVal = 0;
    }

    bcsSelect.value = bcsSliderVal;

    if (storage.contents['badConnection'].active)
        bcsSelect.classList.add("form-range");
    else
        bcsSelect.classList.remove("form-range");
}



 // Slider logic
bcsSelect.onclick = async (e) => {
    let command;
    switch (Number(e.target.value)) {
        case 0:
            command = 'passthrough';
            break;
        case 1:
            command = 'moderate';
            break;
        case 2:
            command = 'severe';
            break;
        default:
            console.log("invalid selection");
    }
    debug(`Bad Connection Simulator: ${command} selected`);
    await storage.update('badConnection', {level: command});
}

// initial settings
updateBcsSlider();

*/
