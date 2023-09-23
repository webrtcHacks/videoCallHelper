import {get, set as idbSet, update} from "idb-keyval";
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";
import {settingsPrototype, webhook} from "../../presence/scripts/presence.mjs";
import {glow} from "../../presence/scripts/embrava.mjs";
// import {trainingMessages as train} from "../../modules/trainingMessages.mjs";
// import '../../modules/lovefield';

const debug = Function.prototype.bind.call(console.log, console, `👷`);


let streamTabs; // Not currently used
//let storage = await chrome.storage.local.get();
let storage = await new StorageHandler("local", debug);
self.storage = storage; // for debugging

// added for presence
let trackData = [];

const mh = new MessageHandler('background', debug);

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

// let gumActive = false;
chrome.runtime.onStartup.addListener(async () => {
    // await getVideoTabId();
})

/*
 * Inter-script messaging
 */

chrome.runtime.onInstalled.addListener(async () => {

    debug("onInstalled starting local storage: ", storage.contents);

    //await storage.set("streamTabs", []);

    // presence settings
    if(!storage.contents.presence)
        await storage.set('presence', settingsPrototype);
    else{
        await storage.update('presence', {active:false});
    }

    // ToDo: rename
    if(!storage.contents['imageCapture']){
        // Image capture
        const imageCaptureSettings = {
            startOnPc: false,
            captureIntervalMs: (30 * 1000),
            samplingActive: false,
        }
        await storage.update('imageCapture', imageCaptureSettings);
    }

    // device manager settings
    if(!storage.contents['deviceManager']) {
        const deviceManagerSettings = {
            enabled: false,
        }
        await storage.set('deviceManager', deviceManagerSettings);
    }

    // self-view settings
    const selfViewSettings = {
        active: false,
        enabled: storage.contents['selfView']?.enabled || false,
        hideView: false,
        showFraming: false,
    }
    await storage.set('selfView', selfViewSettings);

    // bad connection settings
    const badConnectionSettings = {
        enabled: true,
        active: false,
        level: "passthrough"
    }
    await storage.set('badConnection', badConnectionSettings);


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

    }
    const window = await chrome.windows.create(windowOpts);
    log(window);
     */

    // Testing if webgazer works in an extension
    /*
    const url = chrome.runtime.getURL("pages/webgazer.html");
    const videoTab = await chrome.tabs.create({url});
    log(`webgazer tab ${videoTab.id}`)
     */

    // Do this to load a help page
    /*
    let url = chrome.runtime.getURL("onInstallPage.html");
    let inputTab = await chrome.tabs.create({url});
    console.log(`inputTab ${inputTab.id}`)
     */

    // chrome.runtime.openOptionsPage();

});


async function frameCap(data){
    const imageBlob = await fetch(data.blobUrl).then(response => response.blob());

    const imgData = {
        url: data.url,
        date: data.date,
        deviceId: data.deviceId,
        image: imageBlob,
        width: data.width,
        height: data.height
    }

    const id = `image_${(Math.random() + 1).toString(36).substring(2)}`;
    const dataToSave = {};
    dataToSave[id] = imgData;

    await idbSet(id, imgData);
}


// Q: is it better to use storage for this?
mh.addListener(m.FRAME_CAPTURE, frameCap);

// Presence handling
// Note: switched from tracking streams to tracks

async function presenceOff(){

    if(trackData.some(td => td.readyState === 'live')){
        debug("presenceOff check: some tracks still live", trackData);
    }
    else {
        // Wait to see if another track is enabled within 2 seconds as can happen with device changes
        debug("presenceOff: waiting 2 seconds for changes");

        await new Promise(resolve => setTimeout(async () => {
            if (!trackData.some(td => td.readyState === 'live')) {
                debug("turn presence off here");
                chrome.action.setIcon({path: "../icons/v_128.png"});

                if(storage.contents?.presence?.active)
                    webhook('off', storage.contents.presence);

                // ToDo: check HID permissions
                if(storage.contents?.presence?.hid === true)
                    await glow([0,0,0]);

                await storage.update('presence', {active: false});
            }
            else
                debug("presenceOff: some tracks are still live");
            resolve();
        }, 2000));
    }

}

// Attempt to debounce didn't have any impact
/*
let lastPresenceOnCallTime = 0;
const debounceDelay = 1000;  // delay in milliseconds


async function presenceOn(){
    const currentTime = Date.now();
    const shouldCallWebhook = currentTime - lastPresenceOnCallTime > debounceDelay;

    debug("turn presence on here");

    await storage.update("presence", {active: true});

    if(shouldCallWebhook){
        lastPresenceOnCallTime = currentTime;
        webhook('on', storage.contents.presence, debug);
    }

    if(storage.contents.presence?.hid === true)
        await glow([255,0,0]);
    await chrome.action.setIcon({path: "../icons/v_rec.png"});
}
 */




async function presenceOn(){
    debug("turn presence on here");

    await storage.update("presence", {active: true});

    webhook('on', storage.contents.presence);
    if(storage.contents.presence?.hid === true)
        await glow([255,0,0]);
    await chrome.action.setIcon({path: "../icons/v_rec.png"});

}



storage.addListener('presence', async (newValue) => {

    debug(`presence storage changes: `, newValue);
    if (trackData.some(td => td.readyState === 'live') && newValue.enabled === true) {
        await presenceOn();
    } else if (storage.contents.active === true && newValue.enabled === false) {
        await presenceOff();
    }
});


// Note: https://developer.chrome.com/blog/page-lifecycle-api/ says don't do `beforeunload`

async function handleTabRemoved(tabId){
    trackData = trackData.filter(td => td.tabId !== tabId);

    // something is switching storage.contents.presence.active to false before this point
    /*
    if(storage.contents.presence && storage.contents.presence.active){
        await presenceOff();
    }
     */

    // just call presence off everytime - it won't do anything if there is an active track
    await presenceOff();

    // await removeTab(tabId);  // if addTab is used again
}
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

mh.addListener(m.NEW_TRACK, async data=>{
    debug("new track", data);
    const {id, kind, label, state, streamId, tabId} = data;
    // check if track is already in memory
    if(trackData.some(td => td.id === id)){
        debug(`track ${id} already in trackData array`);
    } else {
        // Presence handling
        if(!trackData.some(td => td.readyState === 'live')){
            if(storage.contents.presence && storage.contents.presence.enabled){
                await presenceOn();
            } else debug("presence already active");
        }
        trackData.push(data);
        debug(`added ${id} to trackData array`, trackData);
    }
});

mh.addListener(m.TRACK_ENDED, async data=>{
    trackData = trackData.filter(td => td.id !== data.id);
    // wait 2 seconds to see if another track is started
    // these are in presence off
        // await new Promise(resolve => setTimeout(resolve, 2000));
        // if(!trackData.some(td => td.readyState === 'live'))
    if(storage.contents.presence && storage.contents.presence.active)
        await presenceOff();
});

// ToDo: remove
/* Bad connection experiments */
mh.addListener('alter_stream', async data=>{
    debug('alter_stream', data);
    // This didn't work - never responds
    debug("alter_stream video read: ", await data.streams.videoReader.getReader().read());
});


/*
 *  Extension icon control
 */

// ToDo: change to pageAction?
chrome.action.onClicked.addListener(async (tab)=>{
    debug(`icon clicked on tab ${tab.id}`);
    const messageToSend = {
        to: 'content',
        from: 'background',
        message: 'toggle_dash',
        data: {tabId: tab.id}
    }
    chrome.tabs.sendMessage(tab.id, {...messageToSend})

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

debug("background.js loaded");
