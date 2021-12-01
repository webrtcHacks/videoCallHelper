let openTabs = [];
let capturedHandle = false;

function log(...messages) {
    console.log(`👷 ️`, ...messages);
}


chrome.runtime.onInstalled.addListener(async () => {


    // Do this to load a help page
    /*
    let url = chrome.runtime.getURL("onInstallPage.html");
    let inputTab = await chrome.tabs.create({url});
    console.log(`inputTab ${inputTab.id}`)
     */

    chrome.runtime.openOptionsPage();

});

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        // ToDo: Edge doesn't have a sender.tab object

        let tabId = sender.tab ? sender.tab.id : "undefined id";
        log(`message from tab ${tabId} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);

        /*
        // Relay key events
        if (request.keyEventInfo) {
            log(`incoming event: `, request.keyEventInfo.keyCode);

            const targetTab = openTabs.find(tab => tab.handle === capturedHandle);
            if (targetTab)
                chrome.tabs.sendMessage(targetTab.tabId, request); //response callback removed
            else {
                log(`No captured tab to relay keys to`);
            }
        // set the last getDisplayMedia call
        } else if (request.gotDisplayMediaHandle) {
            capturedHandle = request.gotDisplayMediaHandle;
            log(`getDisplayMedia with Tab active:  ${sender.tab.url}`);
        } else if (request.lostDisplayMediaHandle) {
            capturedHandle = false;
            log(`getDisplayMedia with Tab removed:  ${sender.tab.url}`);
        } else if (request.unload) {
            openTabs = openTabs.filter(tab => tab.tabId !== tabId);
            // ToDo: check if this is capturedHandle?
        } else if (request.captureHandle && !openTabs.find(tab => tab.handle === request.captureHandle)) {
            openTabs.push({tabId: sender.tab.id, handle: request.captureHandle});
            log(`New tab opened: ${sender.tab.url}`)
        } else {
            log("ERROR: unprocessed message")
        }
         */

        if (sendResponse) {
            sendResponse({wssh: "ACK"});
        } else {
            log("response not requested");
        }
    });


/*
 * Add our injection script new tabs
 */

function inject() {
    let script = document.createElement('script');
    script.src = chrome.runtime.getURL('/scripts/inject.js');
    script.onload = function () {
        // console.debug("wssh 💉 inject script loaded");
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

