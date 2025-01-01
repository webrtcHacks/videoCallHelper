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


// Applets
import "../../applets/trackData/scripts/background.mjs";
import "../../applets/presence/scripts/background.mjs";
import "../../applets/imageCapture/scripts/background.mjs";
import "../../applets/deviceManager/scripts/background.mjs";
import "../../applets/selfView/scripts/background.mjs";
import "../../applets/badConnection/scripts/background.mjs";
// import "../../videoPlayer/scripts/background.mjs";

debug(`Environment: ${process.env.NODE_ENV}`);

const DASH_OPEN_NEXT_WAIT = 1000; // time to wait before opening the dash on the next tab reload
let dashOpenNext; // flag to open the dash on the next tab reload

/**
 * Checks if the tabs stored in chrome.storage are still available with a debug statement on status
 * @returns {Promise<void>}
 */
async function checkAllTabs() {
    const currentTabs = await chrome.tabs.query({});
    const activeTabs = [], inactiveTabs = [];

    for (const tab of currentTabs) {
        (await checkTabCommunication(tab) ? activeTabs : inactiveTabs).push(tab.id);
    }

    debug(`Tab check: \n  - Active tabs: ${activeTabs.join(", ")}\n  - Inactive tabs: ${inactiveTabs.join(", ")}`);
}

/**
 * Checks if the content script can communicate with the background script
 * @param {chrome.tabs.Tab} tab - the tab to check
 * @returns {Promise<boolean>} - true if the content script is loaded, false otherwise
 */
async function checkTabCommunication(tab) {
    if (!tab.url.match(/^http/i)) {
        await chrome.action.disable(tab.id);
        return false;
    }

    try {
        await mh.ping(tab.id);
        // debug(`Content script loaded on tab ${tab.id}`);
        return true
    } catch (error) {
        const iconPath = "../media/v_error.png";
        await chrome.action.setIcon({ tabId: tab.id, path: iconPath });
        const url = chrome.runtime.getURL("../pages/popup-error.html");
        await chrome.action.setPopup({ tabId: tab.id, popup: url });
        // debug(`Content script not loaded on tab ${tab.id}`);
        return false
    }
}

/**
 * Respond to a hello from content to pass the tab id
 */
mh.addListener(m.REQUEST_TAB_ID, message => {
    debug(`tab ${message.tabId} is online`);
    try{
        mh.sendMessage(c.CONTENT, m.TAB_ID, {tabId: message.tabId});
    }
    catch (err){
        debug(`error sending TAB_ID to ${message.tabId}`, err);
    }
});


/**
 * Handles tab removal and refresh - removes any tracks associated with that tab, updates presence
 * @param {number}tabId - the tab that was removed
 * @returns {Promise<void>}
 */
async function handleTabRemoved(tabId) {
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
    // only run on http tabs
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
 * Set the dash open next flag
 */
mh.addListener(m.DASH_OPEN_NEXT, async data => {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    dashOpenNext = currentTab.id;
});

/**
 * Reload the current tab
 */
mh.addListener(m.RELOAD, async data => {
    await chrome.tabs.reload(data.tabId);
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
        const iconPath = "../media/v_error.png";
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


/**
 * Content Security Overrides
 *  - needed for Teams
 */

    // ToDo: figure out how to actually modify or append the CSP header
        /** CSP notes:
         * might be possible to do this dynamically if there is an error using the code below:
         * but would need to fully catch the CSP error as a CSP error
         * 'set' might work if I use the entire csp, instead of just the trusted-types
         * I am not sure why 'remove' doesn't work - that seems to be ignored
        // add
        /*
        await   fetch(window.location.href)
            .then(response => {
              const csp = response.headers.get('content-security-policy');
              if (csp) {
                console.log('Content-Security-Policy Header:');
                console.log(csp);
              } else {
                console.log('Content-Security-Policy header not found.');
              }
            })
                .catch(error => console.error('Error fetching current page:', error));
         */
    // ToDo: static rulesets get faster approval
    //  -- attempt to do this failed; it looks like the rule was matched statically and dynamically somehow
    const rules = [
        {
            "id": 1,
            "priority": 1,
            "action": {
                "type": "modifyHeaders",
                "responseHeaders": [
                    {
                        "header": "Content-Security-Policy",
                        "operation": "append",                  // "set" does not work, does not work if I don't include all the existing CSP values
                        "value": "trusted-types vch-policy dompurify @msteams/components-calling-ppt-sharing#components-calling-ppt-sharing @msteams/core-services-telemetry-worker#TelemetryWorker @msteams/frameworks-loader#telemetry-sender @msteams/frameworks-loader#load-build-chunk @msteams/frameworks-loader#dompurify @msteams/react-web-client @msteams/services-io-browser-web-client-update#register-service-worker @msteams/services-utilities-common#ChunkLoader @msteams/core-cdl-worker-common#create-cdl-worker @msteams/frameworks-loader#create-cdl-worker @msteams/services-io-calling-service-adapters#cmdb-calling-bundle-loader-service-adapter html2canvas @fluidx/loop highcharts shaka-player#xml @msstream/one-player#noop-create-html @msstream/one-player#sanitize-html @msstream/azuremediaplayer#worker-noop @msstream/azuremediaplayer#noop @msstream/one-player-loader#webpack @msstream/one-player-loader-preview#webpack adaptivecards#markdownPassthroughPolicy adaptivecards#restoreContentsPolicy adaptivecards#deprecatedExportedFunctionPolicy @fluidx/loop#catalog-container @fluidx/loop#loop-page-container @fluidx/loop#odsp-driver @fluidx/loop#office-fluid-container @fluidx/loop#sourceless-iframe @1js/lpc-common-web#webpack @1js/midgard-bootstrapper#webpack @1js/lpc-teams-bootstrapper#webpack @1js/midgard-trusted-types @azure/ms-rest-js#xml.browser gapi#gapi goog#html @msteams/services-utilities-google-authentication#google-client-library-loader"
                    }
                ]
            },
            "condition": {
                "urlFilter": "https://teams.live.com/*",
                "resourceTypes": ["main_frame", "sub_frame"]
            }
        },
    ];




    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: rules
    });

    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
        debug('Rule matched:', info);
    });

debug("background.js loaded");
