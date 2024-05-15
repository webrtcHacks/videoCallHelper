import { MessageHandler, MESSAGE as m, CONTEXT as c } from "../../modules/messageHandler.mjs";
import { StorageHandler } from "../../modules/storageHandler.mjs";

const debug = Function.prototype.bind.call(console.log, console, `🫥`);
const storage = await new StorageHandler(debug);
const mh = new MessageHandler(c.BACKGROUND);

self.VERBOSE = process.env.NODE_ENV === 'development';

// for debugging
self.debug = debug;
self.storage = storage;
self.mh = mh;

// Initialize trackData if not already set
if (!storage.contents?.trackData) await storage.set('trackData', []);

// Applets
import "../../presence/scripts/background.mjs";
import "../../imageCapture/scripts/background.mjs";
import "../../deviceManager/scripts/background.mjs";
import "../../selfView/scripts/background.mjs";
import "../../badConnection/scripts/background.mjs";
import "../../videoPlayer/scripts/background.mjs";

debug(`Environment: ${process.env.NODE_ENV}`);

const DASH_OPEN_NEXT_WAIT = 1000; // time to wait before opening the dash on the next tab reload
let dashOpenNext; // flag to open the dash on the next tab reload

/**
 * Checks if the tabs stored in chrome.storage are still available
 */
async function checkAllTabs() {
    const currentTabs = await chrome.tabs.query({});
    for (const tab of currentTabs) {
        await checkTabCommunication(tab);
    }
}

/**
 * Checks if the content script can communicate with the background script
 */
async function checkTabCommunication(tab) {
    if (!tab.url.match(/^http/i)) {
        await chrome.action.disable(tab.id);
        return;
    }

    try {
        await mh.ping(tab.id);
        debug(`Content script loaded on tab ${tab.id}`);
    } catch (error) {
        const iconPath = "../images/v_error.png";
        await chrome.action.setIcon({ tabId: tab.id, path: iconPath });
        const url = chrome.runtime.getURL("../pages/popup-error.html");
        await chrome.action.setPopup({ tabId: tab.id, popup: url });
        debug(`Content script not loaded on tab ${tab.id}`);
    }
}

/**
 * Handles tab removal and refresh - removes any tracks associated with that tab, updates presence
 * @param tabId
 * @returns {Promise<void>}
 */
async function handleTabRemoved(tabId) {
    // remove any tracks for that tab
    const trackData = await storage.contents.trackData;
    const newTrackData = trackData.filter(td => td.tabId !== tabId);
    await storage.set('trackData', newTrackData);

    // Check if we should open the dash on this reload
    if (dashOpenNext === tabId) {
        setTimeout(async () => {
            await mh.sendMessage(c.CONTENT, m.TOGGLE_DASH, { tabId: tabId });
        }, DASH_OPEN_NEXT_WAIT);
        dashOpenNext = null;
    }
}

/**
 * Tab event listeners
 */
chrome.tabs.onCreated.addListener(async (tab) => {
    if (!tab.url.match(/^http/i)) {
        await chrome.action.disable(tab.id);
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    if (self.VERBOSE) debug(`tab ${tabId} removed`);
    await handleTabRemoved(tabId);
});

chrome.tabs.onReplaced.addListener(async (tabId, removeInfo) => {
    if (self.VERBOSE) debug(`tab ${tabId} replaced`);
    await handleTabRemoved(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tab.url.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
        if (self.VERBOSE) debug(`chrome-extension tab opened: ${tab.url}`);
    }
    if (!tab.url.match(/^http/i)) {
        if (self.VERBOSE) debug(`non-http tab opened: ${tab.url}`);
        await chrome.action.disable(tab.id);
    } else if (changeInfo.status === 'complete') {
        if (self.VERBOSE) debug(`tab ${tabId} refreshed`);
        // await checkTabCommunication(tab);
    }
});

/**
 * listens for new track messages and adds the track to trackData, sets presence
 */
mh.addListener(m.NEW_TRACK, async data => {
    debug("new track", data);
    const { id, kind, label, state, streamId, tabId } = data;
    const trackData = await storage.contents.trackData || [];
    if (trackData.some(td => td.id === id)) {
        if (self.VERBOSE) debug(`track ${id} already in trackData array`);
    } else {
        trackData.push(data);
        await storage.set('trackData', trackData);
        if (self.VERBOSE) debug(`added ${id} to trackData array`, trackData);
    }
});

/**
 * Listens for track ended messages and removes the track from trackData
 */
mh.addListener(m.TRACK_ENDED, async data => {
    debug("track ended", data);
    const trackData = await storage.contents.trackData || [];
    await storage.set('trackData', trackData.filter(td => td.id !== data.id));
});

/**
 * Set the dash open next flag
 */
mh.addListener(m.DASH_OPEN_NEXT, async data => {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    dashOpenNext = currentTab.id;
});

/**
 * Extension icon control - toggles the dash on the current tab
 */
chrome.action.onClicked.addListener(async (tab) => {
    debug(`icon clicked on tab ${tab.id}`);
    try {
        // await mh.ping(tab.id);
        await mh.sendMessage(c.CONTENT, m.TOGGLE_DASH, { tabId: tab.id });
    } catch (error) {
        const iconPath = "../images/v_error.png";
        await chrome.action.setIcon({ tabId: tab.id, path: iconPath });
        const url = chrome.runtime.getURL("../pages/popup-error.html");
        await chrome.action.setPopup({ tabId: tab.id, popup: url });
        debug(`ERROR: tab ${tab.id} not in tabs`);
    }
});

/**
 * Ensure checkAllTabs is run every time the background script runs
 */
await checkAllTabs();

debug("background.js loaded");
