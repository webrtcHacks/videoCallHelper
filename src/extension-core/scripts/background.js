import {trainingMessages as train} from "../../modules/messages.mjs";
import {get, set, update} from "idb-keyval";
// import '../../modules/lovefield';

let streamTabs;
let trainingState = {
    state: "not started",
    sendImagesInterval: Infinity,
    storageName: "trainingState"
}

const log = function() {
    return Function.prototype.bind.call(console.log, console, `👷`);
}();


// ToDo: testing
/*
const timeString = (new Date).toLocaleString()
await set('time', timeString );
// const time = await get('time');
await chrome.storage.local.set({time: timeString})
log(timeString);
const url = chrome.runtime.getURL("pages/storage.html"); // + `?source=${tabId}`;
await chrome.tabs.create({url});
 */


// Keep state on tabs; uses a Set to only store unique items
async function addTab(tabId) {
    try {
        // const {streamTabs} = await chrome.storage.local.get('streamTabs');
        chrome.storage.local.get(['streamTabs'], data=>{streamTabs = data.streamTabs});
        const activeTabs = new Set(streamTabs);
        activeTabs.add(tabId);
        await chrome.storage.local.set({streamTabs: [...activeTabs]});
        log(`Added tab: ${tabId}; streamTabs: ${[...activeTabs]}`);
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
        log(`activeTabs: ${[...activeTabs]}`);

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

async function getVideoTabId(){
    // ToDo: there is also a chrome extension method to get all extension pages
    const url = chrome.runtime.getURL("pages/video.html"); // + `?source=${tabId}`;
    //const [videoTab] = await chrome.tabs.query({url: url});
    const videoTab = await chrome.tabs.query({url: url});
         // ToDo: this isn't working - opens twice
        const videoTabId = videoTab[0]?.id;
        log(`getVideoTabId:: videoTabId: ${videoTabId}`);
        return videoTabId
    // log("videoTab", videoTab);
}

// let gumActive = false;
chrome.runtime.onStartup.addListener(async () => {
    // trainingState = await chrome.storage.local.get(trainingState.storageName);
    // trainingState = chrome.local.storage.get(['trainingState'], data=>trainingState=data.trainingState);
    // await getVideoTabId();
})

/*
 * Inter-script messaging
 */

chrome.runtime.onInstalled.addListener(async () => {

    await chrome.storage.local.clear();     // ToDo: Reconsider this for some data

    await chrome.storage.local.set({streamTabs: []});
    await chrome.storage.local.set({trainingState});

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

    // ToDo: make user accept gUM permissions

    // Do this to load a help page
    /*
    let url = chrome.runtime.getURL("onInstallPage.html");
    let inputTab = await chrome.tabs.create({url});
    console.log(`inputTab ${inputTab.id}`)
     */

    // chrome.runtime.openOptionsPage();

});

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {

        // ToDo: debugging
        if(sendResponse){
            // log("sending a response");
            sendResponse(true);
        } else log("no response requested");

        const tabId = sender?.tab?.id || "not specified";
        // log(`DEBUG: from ${sender.tab ? sender.tab.id : "unknown"}`, request, sender);
        const {to, from, message, data} = request;

        // forward "tab" messages to all tabs
        // This was for eye level training
        if (to === 'tab' && from === 'training') {
            // keep state on training
            if ([train.start, train.stop, train.updateInterval].includes(message)) {
                trainingState.state = message === train.updateInterval ? train.start : message;
                if (data?.sendImagesInterval)
                    trainingState.sendImagesInterval = data.sendImagesInterval;
                await chrome.storage.local.set({trainingState});
            }

            // const {streamTabs} = await chrome.storage.local.get("streamTabs");
            chrome.storage.local.get(['streamTabs'], data=>{streamTabs = data.streamTabs});
            log(`sending ${message} from ${from} to tabs: ${streamTabs}`);
            streamTabs.forEach(tabId => chrome.tabs.sendMessage(tabId, request, {}, null));
        }

        if(to==='video'){
            const videoTabId = await getVideoTabId();
            if(videoTabId){
                log(`sending ${message} from ${from} to video`, request);
                await chrome.tabs.sendMessage(videoTabId, request, {}, null);
            }
            else log(`could not send ${message} from ${from} to videoTab. videoTab not open`, request)
        }

        if(from === 'tab' && to ==='all' && message){
            // Don't store audio-levels
            if(message === 'local_audio_level' || message === 'remote_audio_level')
                return;

            const storageObj = {
                source: sender.tab.url,
                sourceId: sender.tab.id,
                message: message,
                timeStamp: Date.now(),
                data: data,
            }

            log(`receiving "${message}" from ${from} to ${to}`, request);

            // storage.push(storageObj);
            chrome.storage.local.get(['tabData'], async data=>{
                const arr = [];
                if(data.tabData)
                    arr.push(...data.tabData);
                arr.push(storageObj);
                await chrome.storage.local.set({tabData: arr});
                // log("tabData: ", arr);
            });
        }

        // ['background', 'all', 'training'].includes(to)
        if (to === 'all' || to === 'background' || to === 'training') {
            log(`message from ${from} ${sender.tab ? sender.tab.id : ""} : ${message}, data:`, data);
        }
        else {
            /*
            if(sender.tab)
                log(`unrecognized format from tab ${sender.tab.id} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);
            else
                log(`unrecognized format : `, sender, request);

            return
             */
        }

        if(from==='dash' && message === 'dash_init'){
            let tabEventData;
            chrome.storage.local.get(['tabData'], async messageObj => {
                if(!messageObj.tabData){
                    log("no tabData in storage");
                    return;
                }

                log("loaded data", messageObj.tabData);

                const data = messageObj.tabData.filter(data=>data.sourceId===tabId);

                const messageToSend = {
                    from: 'background',
                    to: 'dash',
                    message: 'dash_init_data',
                    data: data
                }
                await chrome.tabs.sendMessage(tabId, {...messageToSend})
                log("sent data", data);
            });
        }

        if( from === 'video' && to !== 'background'){
            request.data = {sourceTabId: tabId};

            // const {streamTabs} = await chrome.storage.local.get("streamTabs");
            chrome.storage.local.get(['streamTabs'], data=>{
                streamTabs = data.streamTabs
                log(`sending ${message} from ${from} to tabs: ${streamTabs}`);
                streamTabs.forEach(tabId => chrome.tabs.sendMessage(tabId, request, {}));
            });
        }

        // Relay messages to training
        if (from === 'training' && message === train.id) {
            log(`training tab open on ${data.id}`);
        }

        if (message === 'frame_cap'){
            const imageBlob = await fetch(data.blobUrl).then(response => response.blob());
            // data.image = imageBlob;
            // log(imageBlob);

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
            // await chrome.storage.local.set(dataToSave);

            await set(id, imgData);
        }

        if (message === 'gum_stream_start') {

            await addTab(tabId);

            // ToDo: better to query all tabs for the video tab url than use local storage so I don't need to worry
            //  about keeping localStorage synced
            // let {videoTabId} = await chrome.storage.local.get("videoTabId");
            // log("videoTabId from storage: ", videoTabId);

            // open the video tab
            async function openVideoTab(){
                const url = chrome.runtime.getURL("pages/video.html"); // + `?source=${tabId}`;
                const videoTab = await chrome.tabs.create({url});
                const videoTabId = videoTab.id
                log(`new video tab ${videoTab.id}`)
                // sendResponse({message: 'videoTabId', data: videoTabId});
                const messageToSend = {
                    from: 'background',
                    to: 'tab',
                    message: 'video_tab_id',
                    data: { videoTabId: videoTabId }
                }
                chrome.tabs.sendMessage(tabId, {...messageToSend});
            }

            const videoTabId = await getVideoTabId();
            log(`"gum_stream_start" videoTabId: ${videoTabId}`);

            if(!videoTabId){
                // ToDo: testing
                // await openVideoTab();
                log("there is where I would have opened the video tab");
            }

            // ToDo: handle training later
            /*
            const {trainingState} = await chrome.storage.local.get("trainingState");

            if (trainingState.state === train.start) {
                const messageToSend = {
                    from: 'background',
                    to: 'tab',
                    message: trainingState.state,
                    data: { sendImagesInterval: trainingState.sendImagesInterval }
                }
                chrome.tabs.sendMessage(tabId, {...messageToSend});
            }
            else{
                log("trainingState", trainingState);

            }
             */

        }
        else if (message === "gum_stream_stop") {
            await removeTab(tabId)
        } else if (message === train.image) {
            log('training_image: ', data);
        } else if (from === "popup" && message === "open") {
            // ToDo: check to see if tabs are still open
            // const {streamTabs} = await chrome.storage.local.get('streamTabs');
            chrome.storage.local.get(['streamTabs'], data=>{streamTabs = data.streamTabs});
            sendResponse({message: streamTabs.length > 0 ? "active" : "inactive"})
        }

        // Open the video page
        else if (message === 'peerconnection_open'){

            /*
            // Right now only adding new tabs on pc_open
            await addTab(tabId);

            // see if there is already a video tab id
            if(!videoTabId) {
                // make sure it is still valid
                videoTabId = await getVideoTabId();

                // ToDo: When 2 PC's open in succession this opens 2 video tabs
                // the below didn't work
                // open a new one if it is not
                if(!videoTabId){
                    videoTabId = "temp";    // don't do this twice if there is concurrnecy
                    const url = chrome.runtime.getURL("pages/video.html");
                    const videoTab = await chrome.tabs.create({url});
                    log(`video tab ${videoTab.id} created: ${url} `)
                }
            }
            sendResponse({message: 'videoTabId', data: videoTabId});

             */

        } else if (message === 'unload') {
            log("tab unloading");
            await removeTab(tabId);
        }
    });


/*
 *  Extension icon control
 */

// ToDo: change to pageAction?
chrome.action.onClicked.addListener(async (tab)=>{
    const messageToSend = {
        to: 'tab',
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

/*
 * Add our injection script new tabs
 */

// Learning: needed vs. file method to give scripts access to window
function inject(...files) {
    files.forEach(file => {
        let script = document.createElement('script');
        script.src = chrome.runtime.getURL(file);
        script.onload = function () {
            document.head.removeChild(this)
        };
        (document.head || document.documentElement).appendChild(script); //prepend
    });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // log(`tab ${tabId} updated`, changeInfo, tab);

    if (tab.url.match(/^chrome-extension:\/\//) && changeInfo.status === 'complete') {
        log(`extension tab opened: ${tab.url}`)
    } else if (changeInfo.status === 'loading' && /^http/.test(tab.url)) { // complete

        // ToDo: find a better way
        // This didn't work on Hangouts
        // Finding: this was too slow; didn't always load prior to target page loading gUM (like jitsi)
        /*
        await chrome.scripting.executeScript({
            args: ['/node_modules/@mediapipe/face_mesh/face_mesh.js'],
            // args: ['/scripts/inject.js', '/node_modules/@mediapipe/face_mesh/face_mesh.js'],
            // learning: file method doesn't add to page context
            // files: ['/scripts/inject.js', '/node_modules/@mediapipe/face_mesh/face_mesh.js']
            function: inject,
            target: {tabId: tabId}
        })
            .catch(err => log(err));

        log(`faceMesh into tab ${tabId}`);
        // log(`inject.js into tab ${tabId}`);
         */


    }
    //else log(`tab ${tabId} updated to ${changeInfo.status}`, tab);

});

log("background.js loaded");

