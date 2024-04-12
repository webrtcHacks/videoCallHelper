import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";
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

// ToDo: see if I need these tab tacking functions - test with multiple webrtc tabs
/*
// Keep state on tabs; uses a Set to only store unique items
async function addTab(tabId) {
    try {
        // const {streamTabs} = await chrome.storage.local.get('streamTabs');
        chrome.storage.local.get(['streamTabs'], data=>{streamTabs = data.streamTabs});
        const activeTabs = new Set(streamTabs);
        activeTabs.add(tabId);
        await chrome.storage.local.set({streamTabs: [...activeTabs]});
        debug(`Added tab: ${tabId}; streamTabs: ${[...activeTabs]}`);
    } catch (err) {
        console.error(`Issue adding ${tabId}`, err)
    }
}

// Keep state on tabs; uses a Set to only store unique items
async function removeTab(tabId) {
    try {
        //const {streamTabs} = await chrome.storage.local.get('streamTabs');
        chrome.storage.local.get(['streamTabs'], data=>{streamTabs = data.streamTabs});
        const activeTabs = new Set(streamTabs);
        activeTabs.delete(tabId);
        await chrome.storage.local.set({activeTabs: [...activeTabs]});
        debug(`activeTabs: ${[...activeTabs]}`);

        // now clear storage
        chrome.storage.local.get(['tabData'], async data=>{
            if(!data.tabData)
                return;

            const arr = data.tabData.filter(data=>data.sourceId !== tabId);
            await chrome.storage.local.set({tabData: arr});
            // log("tabData: ", arr);
        });

    } catch (err) {
        console.error(`Issue removing ${tabId}`, err)
    }
}

// for video processing in an extension tab
async function getVideoTabId(){
    // ToDo: there is also a chrome extension method to get all extension pages
    const url = chrome.runtime.getURL("pages/video.html"); // + `?source=${tabId}`;
    //const [videoTab] = await chrome.tabs.query({url: url});
    const videoTab = await chrome.tabs.query({url: url});
         // ToDo: this isn't working - opens twice
        const videoTabId = videoTab[0]?.id;
        debug(`getVideoTabId:: videoTabId: ${videoTabId}`);
        return videoTabId
    // log("videoTab", videoTab);
}
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

// let gumActive = false;
chrome.runtime.onStartup.addListener(async () => {

    // fired when a profile that has this extension installed first starts up.
    // This event is not fired when the installed extension is disabled and re-enabled.
    // moved to initializing storage whenever background.js is loaded
    // debug("onStartup local storage before init: ", storage.contents);
    // await initStorage();
    // debug("onStartup local storage after init: ", storage.contents);


    // await getVideoTabId();
})

/*
 * Inter-script messaging
 */

chrome.runtime.onInstalled.addListener(async () => {

    // fired when the extension is first installed, when the extension is updated to a new version,
    // moved to initializing storage whenever background.js is loaded
    // debug("onInstalled starting local storage before init: ", storage.contents);
    // await initStorage();
    // debug("onInstalled starting local storage after init: ", storage.contents);


    // Testing

    /*
    // Make a new window.
    // No way to make it stay on top
    const windowOpts = {
        focused: true,
        top: 0,
        left: 0,
        type: "popup",
        url: chrome.runtime.getURL("pages/video.html"),

    };
    const window = await chrome.windows.create(windowOpts);
    log(window);
     */

    // Testing if webgazer works in an extension
    /*
    const url = chrome.runtime.getURL("pages/webgazer.html");
    const videoTab = await chrome.tabs.create({url});
    log(`webgazer tab ${videoTab.id}`);
     */

    // Do this to load a help page
    /*
    let url = chrome.runtime.getURL("onInstallPage.html");
    let inputTab = await chrome.tabs.create({url});
    console.log(`inputTab ${inputTab.id}`);
     */

    // chrome.runtime.openOptionsPage();

});

// Note: https://developer.chrome.com/blog/page-lifecycle-api/ says don't do `beforeunload`

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
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo)=>{
    if (changeInfo.status === 'complete') {
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


/*
 *  Extension icon control
 */

// ToDo: change to pageAction?
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

    // const url = chrome.runtime.getURL("pages/video.html");
    // const videoTab = await chrome.tabs.create({url});
    // log(videoTab);  // undefined
    // log(`video tab ${videoTab.id}`)

});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // log(`tab ${tabId} updated`, changeInfo, tab);

    if (tab.url.match(/^chrome-extension:\/\//) && changeInfo.status === 'complete') {
        debug(`extension tab opened: ${tab.url}`)
    }
    // else if (changeInfo.status === 'loading' && /^http/.test(tab.url)) { });
});


await initStorage();

debug("background.js loaded");
