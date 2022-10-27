import {get, set, update} from "idb-keyval";
import {MessageHandler} from "../../modules/messageHandler.mjs";
// import {trainingMessages as train} from "../../modules/trainingMessages.mjs";
// import '../../modules/lovefield';

let streamTabs;

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

    await chrome.storage.local.clear();     // ToDo: Reconsider this for some data

    await chrome.storage.local.set({streamTabs: []});

    const settings = {
        startOnPc: false,
        captureIntervalMs: (30 * 1000),
        samplingActive: false,
    }
    await chrome.storage.local.set({settings});

    const allSettings = await chrome.storage.local.get(null);
    debug("onInstalled local storage: ", allSettings);

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
    const tabId = data.tabId;
    const tabDataObj = await chrome.storage.local.get(['tabData']);
        if(!tabDataObj.tabData){
            debug("no tabData in storage");
            return;
        }

        debug("loaded data", tabDataObj.tabData);

        let responseData = tabDataObj.tabData.filter(data=>data.sourceId===tabId);
        responseData.tabId = tabId;

        const messageToSend = {
            from: 'background',
            to: 'context',
            message: 'dash_init_data',
            data: responseData
        }
        mh.sendMessage('to', messageToSend, data);
        // await chrome.tabs.sendMessage(tabId, {...messageToSend})

        debug("sent data", data);
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


mh.addListener('dash_init', dashInit);
mh.addListener('frame_cap', frameCap);

// Keep sync with tabs that have a gUM stream
mh.addListener('gum_stream_start', data=>
    data?.tabId ? addTab(data.tabId): debug("gum_stream_start missing tabId", data));

mh.addListener('gum_stream_stop', data=>
    data?.tabId ? removeTab(data.tabId): debug("gum_stream_stop missing tabId", data));

mh.addListener('unload', async data=>{
    debug(`tab ${data.tabId} unloaded`);
    await removeTab(data.tabId);
});


/*
// testing
function testTabResponse(data){
    const tabId = data.tabId;     // ToDo - see if I can get mh to do this
    const responseData = {tabId: tabId, statement: "hello there"};
    mh.sendMessage('context', 'background_response', responseData);
    log("testTabResponse data", responseData);
}

mh.addListener('new_tab', testTabResponse);
 */

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

