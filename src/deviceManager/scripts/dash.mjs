import {debug, storage} from "../../dash/dashCommon.mjs";

// UI elements
const dmEnabledCheck = document.querySelector("input#dm_enabled_check");
const audioMenu = document.getElementById('audio_devices_list');
const videoMenu = document.getElementById('video_devices_list');
const excludeMenu = document.getElementById('all_devices_list');
const excludeDropdown = document.getElementById('excludeDropdown');

// ToDo: guidance text

dmEnabledCheck.checked = storage.contents['deviceManager']?.enabled || false;

dmEnabledCheck.onclick = async () => {
    const enabled = dmEnabledCheck.checked;
    debug(`set deviceManager enabled to ${enabled}`);
    await storage.update('deviceManager', {enabled: enabled});
}

// Finding: device enumeration permissions are not shared with the extension context
//  only default devices are returned

async function populateDeviceDropdowns() {

    // Clear previous options
    audioMenu.innerHTML = '';
    videoMenu.innerHTML = '';
    excludeMenu.innerHTML = '';

    const devices = storage.contents['deviceManager']?.currentDevices || [];

    // Sort devices - needed for exclude menu
    // ToDo: check spec - is this needed? Does enumerateDevices always sort?
    devices.sort((a, b) => {
        const order = ['videoinput', 'audioinput', 'audiooutput'];
        return order.indexOf(a.kind) - order.indexOf(b.kind);
    });
    debug("sorted devices: ", devices);

    // Reconstruct static items for excludeMenu

    // Guide Note
    const note = document.createElement('li');
    note.className = 'dropdown-header fw-bold';
    note.innerText = 'Unselect items to exclude';
    excludeMenu.appendChild(note);

    // Divider
    const divider2 = document.createElement('li');
    divider2.innerHTML = '<hr class="dropdown-divider">';
    excludeMenu.appendChild(divider2);

    // Utility function to add segment label and divider for exclude menu
    function addSegmentLabelAndDivider(kind) {
        let label;
        switch (kind) {
            case 'videoinput':
                label = 'Video Inputs';
                break;
            case 'audioinput':
                label = 'Audio Inputs';
                break;
            case 'audiooutput':
                label = 'Audio Outputs';
                break;
        }

        const flexContainer = document.createElement('li');
        flexContainer.className = 'd-flex justify-content-between align-items-center px-3 pt-2';

        const header = document.createElement('span');
        header.className = 'dropdown-header';
        header.innerText = label;
        flexContainer.appendChild(header);

        const applyButton = document.createElement('button');
        applyButton.className = 'applyExclusions btn btn-primary btn-sm';
        applyButton.innerText = 'Apply All';
        flexContainer.appendChild(applyButton);
        applyButton.onclick = handleExcludeMenuClose;

        excludeMenu.appendChild(flexContainer);

        const divider = document.createElement('li');
        divider.className = 'dropdown-divider';
        excludeMenu.appendChild(divider);
    }

    let lastKind = null;

    // populate the dropdowns
    devices.forEach((device) => {

        /*** START common menu item processing ***/

            // ToDo: display a message if "default" device is the only option

            // improve the label text in the case where permissions don't provide labels
        let betterLabel = device.label;
        if (device.label === "") {
            let betterKind = device.kind
                .replace('videoinput', 'camera')
                .replace('audioinput', 'microphone')
                .replace('audiooutput', 'speaker');
            betterLabel = `default ${betterKind}`;
        }

        const option = document.createElement('li');
        option.className = 'dropdown-item device-dropdown';

        let textNode = document.createTextNode(betterLabel);
        option.appendChild(textNode);

        option.dataset.deviceId = device.deviceId;
        option.dataset.kind = device.kind;
        option.dataset.label = betterLabel;

        /*** END common menu item processing ***/

            // make a copy for the exclude Menu
        const excludeMenuOption = option.cloneNode(true)

        /**** START audio & video menus ****/
            // Create the span for the checkmark & prepend it
        let checkmarkSpan = document.createElement('span');
        checkmarkSpan.className = 'bi bi-check';
        option.prepend(checkmarkSpan);  // Add the checkmark to the option

        if (device.kind === 'audioinput') {
            const selectedAudioDevice = storage.contents?.deviceManager?.selectedDeviceLabels?.audio;
            if (device.label === selectedAudioDevice || device.label === selectedAudioDevice)
                option.classList.add('selected');
            audioMenu.appendChild(option);
        } else if (device.kind === 'videoinput') {
            const selectedVideoDevice = storage.contents?.deviceManager?.selectedDeviceLabels?.video;
            if (device.label === selectedVideoDevice || device.label === selectedVideoDevice)
                option.classList.add('selected');
            videoMenu.appendChild(option);
        }
        /**** END audio & video menus ****/

        /**** START exclude menu ****/

        // ToDo: exclude "default audio" and "default video"

        if (device.label !== '') {

            // Check if device kind changed
            if (lastKind !== device.kind) {
                addSegmentLabelAndDivider(device.kind);
                lastKind = device.kind;
            }

            // Add checkmark
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'me-2'; // Bootstrap's margin-end
            // ToDo: logic to tell if it should be checked
            checkbox.checked = !storage.contents?.deviceManager?.excludedDevices?.some(d => d.label === device.label);
            excludeMenuOption.prepend(checkbox);

            // Does this need to be cloned?
            excludeMenu.appendChild(excludeMenuOption);
        }
        /**** END exclude menu ****/

    });

}

// Initial population
populateDeviceDropdowns()
    .catch(err => {
        console.error('Error populating  device dropdowns:', err);
    });

// ToDo: handle permissions changes
// ToDo: handle if devices array is empty
storage.addListener('deviceManager', async (newValue) => {
    dmEnabledCheck.checked = storage.contents['deviceManager']['enabled'] || false;

    if (newValue.currentDevices)
        await populateDeviceDropdowns(newValue.currentDevices);

});

// ToDo: Make the selected item visible if the scroll hides it - only useful for long lists
function scrollToElement(container, element) {
    // Check if the element is out of view
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elemTop = element.offsetTop;
    const elemBottom = elemTop + element.clientHeight;

    if (elemTop < containerTop) {
        // If the element is above the current view
        container.scrollTop = elemTop;
    } else if (elemBottom > containerBottom) {
        // If the element is below the current view
        container.scrollTop = elemBottom - container.clientHeight;
    }
}


audioMenu.addEventListener('click', async (e) => {

    // if(storage.contents?.deviceManager?.selectedDeviceLabels?.audio)

    // Check if a dropdown item was clicked
    if (e.target.classList.contains('device-dropdown')) {
        // Remove the 'selected' class from all items in this dropdown
        audioMenu.querySelectorAll('.device-dropdown').forEach(item => {
            item.classList.remove('selected');
        });

        const label = e.target.textContent;
        // Add the 'selected' class to the clicked item
        e.target.classList.add('selected');
        const selectedDeviceLabels = {
            audio: label,
            video: storage.contents?.deviceManager?.selectedDeviceLabels?.video
        }
        await storage.update("deviceManager", {selectedDeviceLabels});

        // Log the selected device
        debug(`Selected audio device: ${label}`);
    }
});

videoMenu.addEventListener('click', async (e) => {

    // Check if a dropdown item was clicked
    if (e.target.classList.contains('device-dropdown')) {
        // Remove the 'selected' class from all items in this dropdown
        videoMenu.querySelectorAll('.device-dropdown').forEach(item => {
            item.classList.remove('selected');
        });

        const label = e.target.textContent;
        // Add the 'selected' class to the clicked item
        e.target.classList.add('selected');
        const selectedDeviceLabels = {
            audio: storage.contents?.deviceManager?.selectedDeviceLabels?.audio,
            video: label
        }
        await storage.update("deviceManager", {selectedDeviceLabels});

        // Log the selected device
        debug(`Selected video device: ${e.target.textContent}`);
    }
});

// Exclude Devices dropdown UI listeners
excludeDropdown.addEventListener('click', () => {
    // Always scroll to the top to see the note
    excludeMenu.scrollTop = 0;
});

// apply exclude menu changes
async function handleExcludeMenuClose() {
    const allItems = document.querySelectorAll('#all_devices_list .device-dropdown');

    const excludedDevices = [];

    allItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (!checkbox.checked) {
            excludedDevices.push({
                deviceId: item.dataset.deviceId,
                kind: item.dataset.kind,
                label: item.dataset.label
            });
        }
    });

    // debug('Excluded devices:', excludedDevices);
    await storage.update('deviceManager', {excludedDevices});
}

// document.querySelector('.dropup').addEventListener('hide.bs.dropdown'
// document.addEventListener('click', function(event) {
document.querySelector('div#device_manager_div').addEventListener('click', async function (event) {
    let excludeMenu = document.getElementById('exclude_devices_menu');

    let isClickInsideMenu = excludeMenu.contains(event.target);
    let isClickOnDropdownBtn = excludeDropdown.contains(event.target);

    // ToDo: do something better than this
    // If the click was neither inside the menu nor the dropdown button, handle it
    if (!isClickInsideMenu && !isClickOnDropdownBtn) {
        await handleExcludeMenuClose();
    }
});

document.querySelectorAll('.applyExclusions').forEach(
    async btn => btn.addEventListener('click', await handleExcludeMenuClose)
);

// Optionally, update when devices are added/removed
navigator.mediaDevices.ondevicechange = () => async () => {
    debug("device change detected - should I populate dropdowns here?");
    // await populateDeviceDropdowns();

    // rely on the target page monitoring this event and doing a enumerateDevices update for now
    //  otherwise I would need to ask inject to call enumerateDevices manually
};
