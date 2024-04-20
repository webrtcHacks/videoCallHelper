import {debug, storage} from "../../dash/dashCommon.mjs";

const bcsEnabledCheck = document.querySelector("input#bcs_enabled_check");
const bcsSelect = document.querySelector("input#bcs_level");

/*
 * Enabled handler
 */
bcsEnabledCheck.checked = storage.contents['badConnection'].enabled;

bcsEnabledCheck.onclick = async () => {
    const enabled = bcsEnabledCheck.checked;
    debug(`set badConnection enabled to ${enabled}`);
    await storage.update('badConnection', {enabled: enabled});
}

/**
 * Updates the slider value based on the current settings
 */
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


/*
 * Slider logic
 */

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


// ToDo: figure out why I needed this
/*
storage.addListener('badConnection', () => {
    updateSelfViewUI();

});
 */
