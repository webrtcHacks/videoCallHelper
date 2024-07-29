// Import necessary modules
import { MessageHandler, CONTEXT as c, MESSAGE as m } from "../../modules/messageHandler.mjs";
import { StorageHandler } from "../../modules/storageHandler.mjs";
import { VideoFraming } from "./framing.js";

const debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️🙈`);
const mh = await new MessageHandler(c.CONTENT);
const storage = await new StorageHandler();

const SELF_VIEW_CHECK_INTERVAL_MS = 3 * 1000;

let selfViewElementsSet = new Set();
let currentIndex = 0;
let currentFramingElement = null;
let currentVideoElement = null;


// Monitor remote tracks
const remoteTrackIds = new Set();
window.remoteTrackIds = remoteTrackIds;

mh.addListener('remote_track_added', data => {
    debug("remote track added", data.trackData);
    if (data.trackData.kind === 'video')
        remoteTrackIds.add(data.trackData.id);
});
mh.addListener('remote_track_removed', data => {
    debug("remote track removed", data.trackData);
    if (data.trackData.kind === 'video')
        remoteTrackIds.delete(data.trackData.id);
});

/**
 * Scan the document for active video elements that are not remote tracks or a screenshare
 * @returns {boolean} - Returns true if there were changes, false otherwise
 */
function scanVideoElements() {
    const newVideoElements = new Set(Array.from(document.querySelectorAll('video:not([id^="vch-"])'))
        .filter(ve =>
            ve.paused === false && // check if the video is playing
            ve.srcObject && // not a src
            ve.srcObject.active === true && // still active
            ve.srcObject instanceof MediaStream && // webcam or virtual background
            ve.srcObject.getVideoTracks().length !== 0 && // not just audio
            !['screen:', 'window:', 'web-contents-media-stream://'] // not a screen share
                .some(prefix => ve.srcObject.getVideoTracks()[0].label.includes(prefix)) &&
            !remoteTrackIds.has(ve.srcObject.getVideoTracks()[0].id) // not a remote track
        )
    );

    let hasChanges = false;

    selfViewElementsSet.forEach(ve => {
        if (!newVideoElements.has(ve)) {
            debug(`Video element removed or ended: `, ve);
            unModifyElement(ve);
            selfViewElementsSet.delete(ve);
            hasChanges = true;
        }
    });

    newVideoElements.forEach(ve => {
        if (!selfViewElementsSet.has(ve)) {
            debug(`New video element found: `, ve);
            selfViewElementsSet.add(ve);
            hasChanges = true;
        }
    });

    return hasChanges;
}

// Function to get filters from a filter string
function getFilters(filterString) {
    return (filterString.match(/(\w+\([^\)]+\))/g) || []).reduce((filters, filter) => {
        const [filterName] = filter.split('(');
        filters[filterName] = filter;
        return filters;
    }, {});
}

// Function to obscure a video element
function obscure(videoElement) {
    const filters = getFilters(videoElement.style.filter);
    filters.blur = 'blur(10px)';
    filters.grayscale = 'grayscale(50%)';
    videoElement.style.filter = Object.values(filters).join(' ');
}

// Function to unobscure a video element
function unobscure(videoElement) {
    const filters = getFilters(videoElement.style.filter);
    delete filters.blur;
    delete filters.grayscale;
    videoElement.style.filter = Object.values(filters).join(' ');
}

// Function to modify the current video element based on settings
function modifyCurrentElement() {
    if(selfViewElementsSet.size > 0 && !currentVideoElement)
        currentVideoElement = Array.from(selfViewElementsSet)[0];

    if (currentVideoElement) {
        if (storage.contents['selfView']['hideView'].enabled) {
            obscure(currentVideoElement);
        } else {
            unobscure(currentVideoElement);
        }

        if (storage.contents['selfView']['showFraming'].enabled) {
            if (currentFramingElement) {
                currentFramingElement.clear();
            }
            currentFramingElement = new VideoFraming(currentVideoElement);
            currentFramingElement.showFraming();
        } else if (currentFramingElement) {
            currentFramingElement.clear();
            currentFramingElement = null;
        }
    }
}

// Function to unmodify a video element
function unModifyElement(element) {
    unobscure(element);
    if (currentFramingElement && currentFramingElement.videoElement === element) {
        currentFramingElement.clear();
        currentFramingElement = null;
    }
}

// Function to switch to the next video element
function switchToNextElement() {
    const elementsArray = Array.from(selfViewElementsSet);
    if (elementsArray.length === 0) return;

    if (currentIndex !== -1 && currentIndex < elementsArray.length) {
        unModifyElement(elementsArray[currentIndex]);
    }

    currentIndex = (currentIndex + 1) % elementsArray.length;
    currentVideoElement = elementsArray[currentIndex];
    debug(`Switching to element ${currentIndex}: ${currentVideoElement}`);
    modifyCurrentElement();
}

// Initial scan and modification
scanVideoElements();
switchToNextElement();

// Set an interval to scan and modify elements periodically
setInterval(() => {
    if (scanVideoElements()) {
        debug("Changes detected - modifying current element.");
        modifyCurrentElement();
    }
}, SELF_VIEW_CHECK_INTERVAL_MS);

// Respond to settings changes
storage.addListener('selfView', async (newValue, changedValues) => {
    debug(`selfView storage changes: `, changedValues);

    if (changedValues['hideView'] || changedValues['showFraming']) {
        modifyCurrentElement();
    }
});

// Listen for a message to switch the self-view element
mh.addListener(m.SELF_VIEW_SWITCH_ELEMENT, () => {
    switchToNextElement();
});
