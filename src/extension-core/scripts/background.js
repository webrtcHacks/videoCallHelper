import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

// Applets
import {presenceOn, presenceOff} from "../../presence/scripts/background.mjs";
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

}

/*
chrome.runtime.onStartup.addListener(async () => {

    // fired when a profile that has this extension installed first starts up.
    // This event is not fired when the installed extension is disabled and re-enabled.
    // moved to initializing storage whenever background.js is loaded
    // await initStorage();
})

chrome.runtime.onInstalled.addListener(async () => {

    // fired when the extension is first installed, when the extension is updated to a new version,
    // moved to initializing storage whenever background.js is loaded
    // await initStorage();

});
*/

/**
 * Handles tab removal, removing any tracks associated with that tab, updates presence
 * @param tabId
 * @returns {Promise<void>}
 */
async function handleTabRemoved(tabId){

    // remove any tracks for that tab
    const trackData = await storage.contents.trackData;
    const newTrackData = trackData.filter(td => td.tabId !== tabId);
    await storage.set('trackData', newTrackData);

    if(newTrackData.length === 0)
        await presenceOff();
    // await removeTab(tabId);  // if addTab is used again
}


/**
 * Tab event listeners
 */

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo)=>{
    debug(`tab ${tabId} removed`);
    await handleTabRemoved(tabId);
});

chrome.tabs.onReplaced.addListener(async (tabId, removeInfo)=>{
    debug(`tab ${tabId} replaced`);
    await handleTabRemoved(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab)=>{

    // ignore extension tabs
    if (tab.url.match(/^chrome-extension:\/\//)) { // && changeInfo.status === 'complete'
        // debug(`extension tab opened: ${tab.url}`)
    }
    else if (changeInfo.status === 'complete') {
        debug(`tab ${tabId} refreshed`);
        await handleTabRemoved(tabId);
    }
});


/**
 * listens for new track messages and adds the track to trackData, sets presence
 */
mh.addListener(m.NEW_TRACK, async data=>{
    debug("new track", data);
    const {id, kind, label, state, streamId, tabId} = data;
    // check if track is already in memory
    const trackData = storage.contents.trackData;
    if(storage.contents.trackData.some(td => td.id === id)){
        debug(`track ${id} already in trackData array`);
    } else {
        trackData.push(data);
        await storage.set('trackData', trackData);
        debug(`added ${id} to trackData array`, trackData);
        await presenceOn();         // Presence handling
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

    await presenceOff();
});


/**
 *  Extension icon control - toggles the dash on the current tab
 *  Note: change to pageAction if Extension should work across multiple tabs independently
 */
chrome.action.onClicked.addListener(async (tab)=>{
    // debug(`icon clicked on tab ${tab.id}`);

    if(!tab?.id){
        debug("lost sync with tab", tab);
        return;
    }

    const messageToSend = {
        to: 'content',
        from: 'background',
        message: 'toggle_dash',
        data: {tabId: tab.id}
    }

    chrome.tabs.sendMessage(tab.id, {...messageToSend}, response => {
        // catch if the sendMessage failed, liked when the extension is reloaded
        if (chrome.runtime.lastError) {
            debug("Error sending message: ", chrome.runtime.lastError.message);
            // Additional error handling logic can go here
        }
    });

});

await initStorage();

debug("background.js loaded");
