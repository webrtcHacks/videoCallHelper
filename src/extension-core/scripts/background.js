import {get, set, update} from "idb-keyval";
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {settingsPrototype, webhook} from "../../presence/scripts/presence.mjs";
import {glow} from "../../presence/scripts/embrava.mjs";
// import {trainingMessages as train} from "../../modules/trainingMessages.mjs";
// import '../../modules/lovefield';

let streamTabs; // Not currently used
let storage = await chrome.storage.local.get();

// added for presence
let trackData = [];
let presenceActive = false;

const debug = function() {
    return Function.prototype.bind.call(console.log, console, `👷`);
}();

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

    // await chrome.storage.local.clear();     // ToDo: Reconsider this for some data

    storage = await chrome.storage.local.get(null);
    await chrome.storage.local.set({streamTabs: []});
    if(!storage['presence'])
        await chrome.storage.local.set({presence: settingsPrototype});

    // ToDo: rename
    if(!storage['imageCapture']){
        // Image capture
        const imageCapture = {
            startOnPc: false,
            captureIntervalMs: (30 * 1000),
            samplingActive: false,
        }
        await chrome.storage.local.set({imageCapture});
    }

    debug("onInstalled local storage: ", await chrome.storage.local.get(null));

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

async function dashInit(data){

    // not sure what this was all about. Maybe tab specific settings?

    const tabId = data.tabId;
    const tabDataObj = await chrome.storage.local.get(['tabData']);
        if(!tabDataObj.tabData){
            debug("no tabData in storage");
            return;
        }

        debug("loaded data", tabDataObj.tabData);

        let responseData = tabDataObj.tabData.filter(data=>data?.sourceId===tabId);
        responseData.tabId = tabId;


        const messageToSend = {
            from: 'background',
            to: 'dash', // was content
            message: 'dash_init_data',
            data: responseData
        }


        // ToDo: populate this
        mh.sendMessage('dash', m.DASH_INIT_DATA, messageToSend);
        // await chrome.tabs.sendMessage(tabId, {...messageToSend})

        debug("sent dash init data", data);
}

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

    await set(id, imgData);
}


mh.addListener(m.DASH_INIT, dashInit);
mh.addListener(m.FRAME_CAPTURE, frameCap);

// Presence handling
// Note: switched from tracking streams to tracks

async function presenceOff(){

    if(trackData.some(td => td.state === 'live')){
        debug("presenceOff check: some tracks still live", trackData);
    }
    else {
        // Wait to see if another track is enabled within 2 seconds as can happen with device changes
        debug("presenceOff: waiting 2 seconds for changes");
        setTimeout(async ()=>{
            if(!trackData.some(td => td.state === 'live')){
                chrome.action.setIcon({path: "../icons/v_128.png"});
                webhook('off', storage['presence'], debug);

                // ToDo: check HID permissions
                if(storage['presence'].hid === true)
                    await glow([0,0,0]);
                presenceActive = false;
                debug("turn presence off here");
            }
        }, 2000);
    }
}

// Note: https://developer.chrome.com/blog/page-lifecycle-api/ says don't do `beforeunload`

async function handleTabRemoved(tabId){
    debug(`tab ${tabId} closed`);
    trackData = trackData.filter(td => td.tabId !== tabId);
    await presenceOff();
    // await removeTab(tabId);  // if addTab is used again
}
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo)=>{
    await handleTabRemoved(tabId);
});
chrome.tabs.onReplaced.addListener(async (tabId, removeInfo)=>{
    await handleTabRemoved(tabId);
});

mh.addListener(m.NEW_TRACK, async data=>{
    debug("new track", data);
    const {id, kind, label, state, streamId, tabId} = data;
    // check if track is already in memory
    if(trackData.some(td => td.id === id)){
        debug(`track ${id} already in trackData array`);
    } else {
        if(!trackData.some(td => td.state === 'live')){
            if(!presenceActive){
                presenceActive = true;
                debug("turn presence on here");
                webhook('on', storage['presence'], debug);
                if(storage['presence'].hid === true)
                    await glow([255,0,0]);
                await chrome.action.setIcon({path: "../icons/v_rec.png"});
            } else debug("presence already active");
        }
        trackData.push(data);
        debug(`added ${id} to trackData array`, trackData);
    }
});

mh.addListener(m.TRACK_ENDED, async data=>{
    trackData = trackData.filter(td => td.id !== data.id);

    // wait 2 seconds to see if another track is started
    await new Promise(resolve => setTimeout(resolve, 2000));
    await presenceOff();
});


/*
 *  Extension icon control
 */

// ToDo: change to pageAction?
chrome.action.onClicked.addListener(async (tab)=>{
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

// ToDo: set this up; put in a storage module?
chrome.storage.onChanged.addListener(async function(changes, namespace) {
    if(namespace !== 'local')
        return;

    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        storage[key] = newValue;
        debug(
            `Storage key "${key}" in namespace "${namespace}" changed.`,
            `\n> Old value was`, oldValue, `\n> New value is`,  newValue);
    }

    // storage = await chrome.storage.local.get(null);
});
