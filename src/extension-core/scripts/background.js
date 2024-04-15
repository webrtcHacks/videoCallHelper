import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

// Applets
import "../../presence/scripts/background.mjs";
import "../../imageCapture/scripts/background.mjs";

// storage prototypes for each applet used for initialization
import {settings as deviceManagerSettingsProto} from "../../deviceManager/scripts/settings.mjs";
import {settings as selfViewSettingsProto} from "../../selfView/scripts/settings.mjs";
import {settings as badConnectionSettingsProto} from "../../badConnection/scripts/settings.mjs";

const  debug = Function.prototype.bind.call(console.log, console, `🫥`);
debug(`Environment: ${process.env.NODE_ENV}`);

let storage = await new StorageHandler("local", debug);
self.storage = storage; // for debugging

// added for presence, here in case it is useful elsewhere
await storage.set('trackData', []);

const mh = new MessageHandler('background');

self.debug = debug;
self.mh = mh;

const DASH_OPEN_NEXT_WAIT = 1000;   // time to wait before opening the dash on the next tab reload
let dashOpenNext;                            // flag to open the dash on the next tab reload


/**
 * Initializes storage with the applet settings
 * ToDo: move these to the applet modules
 * @returns {Promise<void>}
 */
async function initStorage(){

    // Presence settings moved to module

    // Image capture settings moved to module

    // device manager settings
    if(!storage.contents['deviceManager']) {
        await storage.set('deviceManager', deviceManagerSettingsProto);
        //else
        // await storage.update('deviceManager', {active:false});
        // await storage.set('deviceManager', deviceManagerSettings);
    }

    // self-view settings
    if(!storage.contents['selfView'])
        await storage.set('selfView', selfViewSettingsProto);
    // else await storage.update('selfView', {hideView: {active:false}, showFraming: {active:false}});

    // bad connection settings
    if(!storage.contents['badConnection'])
        await storage.set('badConnection', badConnectionSettingsProto);
    // else await storage.update('badConnection', {active:false});

    // ToDo: setup videoPlayer proto
    // videoPlayer
    if(!storage.contents['videoPlayer'])
        await storage.set('videoPlayer', {buffer: null});

    await storage.set('tabs', new Set());

}
await initStorage();


chrome.runtime.onStartup.addListener(async () => {

    // fired when a profile that has this extension installed first starts up.
    // This event is not fired when the installed extension is disabled and re-enabled.
    // moved to initializing storage whenever background.js is loaded
    // await initStorage();

    debug("onStartup");
})

chrome.runtime.onInstalled.addListener( (details) => {

    // fired when the extension is first installed, when the extension is updated to a new version,
    // moved to initializing storage whenever background.js is loaded
    // await initStorage();

    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        debug("onInstalled uninstalled?", details);
        }
    else
        debug("onInstalled?", details);
});

/**
 * Handles tab removal and refresh - removes any tracks associated with that tab, updates presence
 * @param tabId
 * @returns {Promise<void>}
 */
async function handleTabRemoved(tabId){

    // remove any tracks for that tab
    const trackData = await storage.contents.trackData;
    const newTrackData = trackData.filter(td => td.tabId !== tabId);
    await storage.set('trackData', newTrackData);

    // Check if we should open the dash on this reload
    if(dashOpenNext===tabId){
        setTimeout(async ()=>{
            await mh.sendMessage('content', m.TOGGLE_DASH, {tabId: tabId});
        }, DASH_OPEN_NEXT_WAIT);
        dashOpenNext = null;
    }
}


/**
 * Tab event listeners
 */

chrome.tabs.onCreated.addListener(async (tab)=>{
    if(tab.url.match(/^http/)){
        const tabs = await storage.contents.tabs;
        tabs.add(tab.id);
        await storage.update('tabs', tabs);
    }
    else
        await chrome.action.disable(tab.id);
});
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo)=>{
    debug(`tab ${tabId} removed`);
    const tabs = await storage.contents.tabs;
    tabs.delete(tabId);
    await storage.update('tabs', tabs);

    await handleTabRemoved(tabId);
});

chrome.tabs.onReplaced.addListener(async (tabId, removeInfo)=>{
    debug(`tab ${tabId} replaced`);
    await handleTabRemoved(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab)=>{

    // ignore extension tabs
    if (!tab.url.match(/^http:\/\//)) { // && changeInfo.status === 'complete'
        debug(`non-http tab opened: ${tab.url}`)
    }
    else if (changeInfo.status === 'complete') {
        debug(`tab ${tabId} refreshed`);
        const tabs = await storage.contents.tabs;
        tabs.add(tabId);
        await handleTabRemoved(tabId);
    }
});


/**
 * listens for new track messages and adds the track to trackData, sets presence
 */
mh.addListener(m.NEW_TRACK, async data=>{
    debug("new track", data);
    const {id, kind, label, state, streamId, tabId} = data;
    // check if track is already in storage
    const trackData = storage.contents.trackData;
    if(storage.contents.trackData.some(td => td.id === id)){
        debug(`track ${id} already in trackData array`);
    } else {
        trackData.push(data);
        await storage.set('trackData', trackData);
        debug(`added ${id} to trackData array`, trackData);
    }
});

/**
 * Listens for track ended messages and removes the track from trackData
 */
mh.addListener(m.TRACK_ENDED, async data=>{
    debug("track ended", data);
    // Remove the track from trackData
    const trackData = storage.contents.trackData;
    await storage.set('trackData', trackData.filter(td => td.id !== data.id));
});

/**
 * Set the dash open next flag
 */
mh.addListener(m.DASH_OPEN_NEXT, async data=>{
    const [currentTab] = await chrome.tabs.query({active: true, currentWindow: true});
    dashOpenNext = currentTab.id;
})


/**
 *  Extension icon control - toggles the dash on the current tab
 *  Note: change to pageAction if Extension should work across multiple tabs independently
 */
chrome.action.onClicked.addListener(async (tab)=>{
    debug(`icon clicked on tab ${tab.id}`);

    // chrome.tabs.query({active: true, currentWindow: true}, async (tabs)=> {
    //        console.log(tabs);});

    const tabs = await storage.contents.tabs;
    if(tabs.has(tab.id))
        mh.sendMessage('content', m.TOGGLE_DASH, {tabId: tab.id});
    else
        debug(`tab ${tab.id} not in tabs`, tabs);
});

/**
 * Extension icon control on start and refresh
 *  - extension needs to be loaded before the page loads to override WebRTC APIs
 *  - on a new install or reload it won't work if a tab is already open without a refresh
 *  - Sets existing tabs to the warning icon and sets a popup on icon click to a special error page
 *  - Sets any non-http tab to disabled
 */
chrome.tabs.query({}, async (tabs)=> {
    // debug("all tabs", tabs);
    const iconPath = "../icons/v_error.png";
    for (const tab of tabs) {
        if(!tab.url.match(/^http/)) {
            await chrome.action.disable(tab.id);
            continue;
        }
        // debug(`tab ${tab.id}`, tab);
        await chrome.action.setIcon({tabId: tab.id, path: iconPath});
        // set the extension url to the popup-error page
        const url = chrome.runtime.getURL("../pages/popup-error.html");

        await chrome.action.setPopup({tabId: tab.id, popup: url})
    }
});

debug("background.js loaded");
