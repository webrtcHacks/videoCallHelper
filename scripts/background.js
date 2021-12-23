import {trainingMessages as train}  from "../modules/messages.mjs";

let trainingState = {
    state: "not started",
    sendImagesInterval: Infinity,
    storageName: "trainingState"
}

// Keep state on tabs; uses a Set to only store unique items
async function addTab(tabId) {
    try {
        const {streamTabs} = await chrome.storage.local.get('streamTabs');
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
        const {streamTabs} = await chrome.storage.local.get('streamTabs');
        const activeTabs = new Set(streamTabs);
        activeTabs.delete(tabId);
        await chrome.storage.local.set({activeTabs: [...activeTabs]});
        log(`activeTabs: ${[...activeTabs]}`);
    } catch (err) {
        console.error(`Issue removing ${tabId}`, err)
    }
}

function log(...messages) {
    console.log(`👷 `, ...messages);
    /*
    if(messages.length > 1 || typeof messages[0]==='object')
        console.log(`👷 ️${JSON.stringify(...messages)}`);
    else
        console.log(`👷 ️${messages}`);

     */
}

// let gumActive = false;
chrome.runtime.onStartup.addListener(async () => {
    trainingState = await chrome.storage.local.get(trainingState.storageName);
})

/*
 * Inter-script messaging
 */

chrome.runtime.onInstalled.addListener(async () => {

    await chrome.storage.local.set({streamTabs: []});
    await chrome.storage.local.set({trainingState});

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
        const tabId = sender?.tab?.id || "not specified";
        log(`DEBUG: from ${sender.tab ? sender.tab.id : "unknown"}`, request, sender);
        const {to, from, message, data} = request;

        // forward "tab" messages to all tabs
        if (to === 'tab' && from === 'training') {
            // keep state on training
            if ([train.start, train.stop, train.updateInterval].includes(message)) {
                trainingState.state = message === train.updateInterval ? train.start : message;
                if (data?.sendImagesInterval)
                    trainingState.sendImagesInterval = data.sendImagesInterval;
                await chrome.storage.local.set({trainingState});
            }

            const {streamTabs} = await chrome.storage.local.get("streamTabs");
            log(`sending ${message} from ${from} to tabs: ${streamTabs}`);
            streamTabs.forEach(tabId => chrome.tabs.sendMessage(tabId, request, {}));
        }

        // ['background', 'all', 'training'].includes(to)
        if (to === 'all' || to === 'background' || to === 'training') {
            log(`message from ${from} ${sender.tab ? sender.tab.id : ""} : ${message}, data:`, data);
        } else {
            /*
            if(sender.tab)
                log(`unrecognized format from tab ${sender.tab.id} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);
            else
                log(`unrecognized format : `, sender, request);

            return
             */
        }

        if( from === 'video' && to !== 'background'){
            request.data = {sourceTabId: tabId};

            const {streamTabs} = await chrome.storage.local.get("streamTabs");
            log(`sending ${message} from ${from} to tabs: ${streamTabs}`);
            streamTabs.forEach(tabId => chrome.tabs.sendMessage(tabId, request, {}));
        }

        // Relay messages to training
        if (from === 'training' && message === train.id) {
            log(`training tab open on ${data.id}`);
        }

        if (message === 'gum_stream_start') {
            await addTab(tabId);

            // open the video tab
            const url = chrome.runtime.getURL("pages/video.html");
            const videoTab = await chrome.tabs.create({url});
            console.log(`video tab ${videoTab.id}`)

            /*
            const messageToSend = {
                from: 'background',
                to: 'tab',
                message: 'video_tab_id',
                data: { videoTabId: videoTab.id }
            }
            chrome.tabs.sendMessage(tabId, {...messageToSend});

             */


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


        } else if (message === "gum_stream_stop") {
            await removeTab(tabId)
        } else if (message === train.image) {
            log('training_image: ', data);
        } else if (from === "popup" && message === "open") {
            // ToDo: check to see if tabs are still open
            const {streamTabs} = await chrome.storage.local.get('streamTabs');
            sendResponse({message: streamTabs.length > 0 ? "active" : "inactive"})
            return
        } else if (message === 'unload') {
            log("tab unloading");
            await removeTab(tabId);
        }
        if (sendResponse) {
            sendResponse({vch: "ACK"});
        } else {
            // log("response not requested");
        }
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

