// let openTabs = [];
// let capturedHandle = false;
let trainingTabId = false;

function log(...messages) {
    console.log(`👷 `, ...messages);
    /*
    if(messages.length > 1 || typeof messages[0]==='object')
        console.log(`👷 ️${JSON.stringify(...messages)}`);
    else
        console.log(`👷 ️${messages}`);

     */
}
let gumActive = false;
chrome.runtime.onStartup.addListener(async () => {
    gumActive = await chrome.storage.local.get("gumActive");
})

/*
 * Inter-script messaging
 */

chrome.runtime.onInstalled.addListener(async () => {

    await chrome.storage.local.set({ gumActive: false });


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
        // ToDo: Edge doesn't have a sender.tab object

        // log(`DEBUG: from ${sender.tab ?  sender.tab.id : "unknown"}`, request);
        const {to, from, message, data} = request;

        // ['background', 'all', 'training'].includes(to)
        if(to === 'all' || to === 'background' || to === 'training'){
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

        // Relay messages to training
        // ToDo: make this a function that opens the tab
        if(from === 'training' && message==='training_tab_id'){
            trainingTabId = data.id;
            // ToDo: might need to store this
            log(`training tab id set to ${trainingTabId}`);
        }

        if(message === 'gum_stream_start'){
            gumActive = true;
            await chrome.storage.local.set({ gumActive });
        }
        else if(message === "gum_stream_stop"){
            gumActive = false;
            await chrome.storage.local.set({ gumActive });
        }
        else if(message === 'training_image'){
            log(data);
        }

        else if(from === "popup" && message === "open"){
            sendResponse({message: gumActive ? "active": "inactive"})
            return
        }

        else if(message === 'unload'){
            log("tab unloading");
            gumActive = false;
            await chrome.storage.local.set({ gumActive });
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

function inject() {
    let script = document.createElement('script');
    script.src = chrome.runtime.getURL('/scripts/inject.js');
    script.onload = function () {
        document.head.removeChild(this)
    };
    (document.head || document.documentElement).appendChild(script); //prepend
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // log(`tab ${tabId} updated to ${changeInfo.status}: ${tab.url}`);
    if (tab.url.match(/^chrome-extension:\/\//) && changeInfo.status === 'complete') {
        log(`extension tab opened: ${tab.url}`)
    } else if (changeInfo.status === 'loading' && /^http/.test(tab.url)) { // complete

        chrome.scripting.executeScript({
            target: {tabId: tabId},
            function: inject
        })
            .then(() => {
                log(`inject.js into tab ${tabId}`);
            })
            .catch(err => log(err));
    }
    //else log(`tab ${tabId} updated to ${changeInfo.status}`, tab);

});

log("background.js loaded");

