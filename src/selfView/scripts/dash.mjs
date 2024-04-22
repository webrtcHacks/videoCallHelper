import {debug, storage} from "../../dash/dashCommon.mjs";


const selfViewDiv = document.querySelector("div#hide_self_view_div");
const selfViewCheckbox = document.querySelector("input#hide_self_view_check");
const selfViewStatus = document.querySelector("span#hide_self_view_status");

const showFramingDiv = document.querySelector("div#show_framing_div");
const showFramingCheck = document.querySelector("input#show_framing_check");
const showFramingStatus = document.querySelector("span#show_framing_status");

/**
 * Updates Self-view UI based on the current settings - blurs, framing guide
 */
function updateSelfViewUI() {

    // Hide/Obscure Self-View
    try {
        const hideViewEnabled = storage.contents['selfView']?.['hideView']?.enabled;
        const hideViewActive = storage.contents['selfView']?.['hideView']?.active;

        if (hideViewEnabled && hideViewActive)
            selfViewStatus.innerText = "Obscuring self-view";
        else if (hideViewEnabled && !hideViewActive)
            selfViewStatus.innerText = "Looking for self-view";
        else
            selfViewStatus.innerText = "Click to enable";
    } catch (e) {
        debug("error updating self-view UI", e);
        for (let child of selfViewDiv.children) {
            child.disabled = true;
            child.classList.add('text-muted');
            child.classList.add('fw-lighter');
        }
    }

    try {
        // Show Framing
        const showFramingEnabled = storage.contents['selfView']?.['showFraming']?.enabled;
        const showFramingActive = storage.contents['selfView']?.['showFraming']?.active;

        if (showFramingEnabled && showFramingActive)
            showFramingStatus.innerText = "Showing framing";
        else if (showFramingEnabled && !showFramingActive)
            showFramingStatus.innerText = "Looking for self-view";
        else
            showFramingStatus.innerText = "Click to enable";
    } catch (e) {
        debug("error updating show framing UI", e);
        for (let child of showFramingDiv.children) {
            child.disabled = true;
            child.classList.add('text-muted');
        }
    }
}

// debug("self-view settings:", storage.contents['selfView']);
selfViewCheckbox.checked = storage.contents['selfView']?.hideView?.enabled || false;
showFramingCheck.checked = storage.contents['selfView']?.showFraming?.enabled || false;
updateSelfViewUI();


selfViewCheckbox.onclick = async () => {
    const enabled = selfViewCheckbox.checked;
    // debug(`set self-view enabled to ${enabled}`);
    const newContents = storage.contents['selfView'];
    newContents['hideView'] = {enabled: enabled, active: newContents['hideView']?.active || false};
    await storage.update('selfView', newContents);
    updateSelfViewUI();
}

showFramingCheck.onclick = async () => {
    const enabled = showFramingCheck.checked;
    // debug(`set self-view enabled to ${enabled}`);
    const newContents = storage.contents['selfView'];
    newContents['showFraming'] = {enabled: enabled, active: newContents['showFraming']?.active || false};
    await storage.update('selfView', newContents);
    updateSelfViewUI();
}

storage.addListener('selfView', () => {
    updateSelfViewUI();
});
