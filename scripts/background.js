// let openTabs = [];
// let capturedHandle = false;

function log(...messages) {
    console.log(`👷: `, ...messages);
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

        console.log(`DEBUG: from ${sender.tab ?  sender.tab.id : "unknown"}`, request);
        const {to, from, message, data} = request;

        if(to === 'background' || request.to === 'all'){
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

        if(message === 'gum_stream_start'){
            gumActive = true;
            await chrome.storage.local.set({ gumActive: true });

        }
        else if(message === "gum_stream_stop"){
            gumActive = false;
            await chrome.storage.local.set({ gumActive: false });
        }
        else if(message === 'training_image'){
            log(data);
        }

        else if(request.from === "popup" && request.message === "open"){
            sendResponse({message: gumActive ? "active": "inactive"})
            return
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

