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
