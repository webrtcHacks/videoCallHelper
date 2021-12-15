let trainingTabId = false;
let trainingState = "not started";
let sendImagesInterval = Infinity;
let activeTabs = new Set();

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
    // gumActive = await chrome.storage.local.get("gumActive");
    const tabs = await chrome.storage.local.get("activeTabs");
    activeTabs = new Set(tabs.activeTabs);
})

/*
 * Inter-script messaging
 */

chrome.runtime.onInstalled.addListener(async () => {


    //const activeTabs = new Set();
    //activeTabs.add("foo");
    //console.log(activeTabs);
    // await chrome.storage.local.remove('activeTabs');
    await chrome.storage.local.set({activeTabs: []});
    // await chrome.storage.local.set({gumActive: false});

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
        tabId = sender.tab?.id;
        // log(`DEBUG: from ${sender.tab ?  sender.tab.id : "unknown"}`, request, sender);
        const {to, from, message, data} = request;

        // forward "tab" messages to all tabs
        if (to === 'tab' && from === 'training') {
            // keep state on training
            if (['train_start', 'train_stop', 'update_train_interval'].includes(message)) {
                trainingState = message;
                if (data?.sendImagesInterval)
                    sendImagesInterval = data.sendImagesInterval;
            }

            const tabs = await chrome.storage.local.get({activeTabs});
            log(`sending ${message} from ${from} to tabs: ${[...tabs.activeTabs]}`);
            tabs.activeTabs.forEach(tabId => chrome.tabs.sendMessage(tabId, request, {}));
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

        // Relay messages to training
        // ToDo: make this a function that opens the tab
        if (from === 'training' && message === 'training_tab_id') {
            trainingTabId = data.id;
            // ToDo: might need to store this
            log(`training tab id set to ${trainingTabId}`);
        }

        if (message === 'gum_stream_start') {
            //gumActive = true;
            // await chrome.storage.local.set({gumActive});
            if (trainingState === 'train_start' || trainingState === 'update_train_interval')
                sendMessage('tab', trainingState, sendImagesInterval)

            const tabs = await chrome.storage.local.get('activeTabs');
            activeTabs = new Set(tabs.activeTabs);
            activeTabs.add(tabId);
            log(activeTabs);
            await chrome.storage.local.set({activeTabs: [...activeTabs]});

        } else if (message === "gum_stream_stop") {
            // gumActive = false;
            // await chrome.storage.local.set({gumActive});
        } else if (message === 'training_image') {
            log('training_image: ', data);
        } else if (from === "popup" && message === "open") {
            // gumActive = await chrome.storage.local.get({gumActive});
            // ToDo: check to see if tabs are still open
            const {activeTabs} =  await chrome.storage.local.get('activeTabs');
            sendResponse({message: activeTabs.length > 0 ? "active" : "inactive"})
            return
        } else if (message === 'unload') {
            log("tab unloading");
            // gumActive = false;
            // await chrome.storage.local.set({gumActive});
            const tabs = await chrome.storage.local.get({activeTabs});
            activeTabs = new Set(tabs.activeTabs);
            activeTabs.delete(tabId);
            await chrome.storage.local.set({activeTabs: [...activeTabs]});

            // sendMessage('all', 'gum_stream_stop');
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
    log(`tab ${tabId} updated`, changeInfo, tab);

    if (tab.url.match(/^chrome-extension:\/\//) && changeInfo.status === 'complete') {
        log(`extension tab opened: ${tab.url}`)
    } else if (changeInfo.status === 'loading' && /^http/.test(tab.url)) { // complete

    /*
        // Finding: this was too slow; didn't always load prior to target page loading gUM (like jitsi)
        await chrome.scripting.executeScript({
            args: ['/scripts/inject.js', '/node_modules/@mediapipe/face_mesh/face_mesh.js'],
            // learning: file method doesn't add to page context
            // files: ['/scripts/inject.js', '/node_modules/@mediapipe/face_mesh/face_mesh.js']
            function: inject,
            target: {tabId: tabId}
        })
            .catch(err => log(err));

        log(`inject.js into tab ${tabId}`);

     */

    }
    //else log(`tab ${tabId} updated to ${changeInfo.status}`, tab);

});

log("background.js loaded");

