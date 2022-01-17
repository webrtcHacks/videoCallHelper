// Keep state on tabs; uses a Set to only store unique items

const tabs = new Set();
const tabData = new Set();

function log(...messages) {
    console.log(`👷 `, ...messages);
    /*
    if(messages.length > 1 || typeof messages[0]==='object')
        console.log(`👷 ️${JSON.stringify(...messages)}`);
    else
        console.log(`👷 ️${messages}`);

     */
}

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {

        // ToDo: debugging
        if(sendResponse){
            // log("sending a response");
            sendResponse(true);
        } else {
            // log("no response requested");
        }

        const tabId = sender?.tab?.id || "not specified";
        // log(`DEBUG: from ${sender.tab ? sender.tab.id : "unknown"}`, request, sender);
        const {to, from, message, data} = request;

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

            tabData.add(storageObj);
        }

        else if(from==='dash' && message === 'dash_init'){

            const messageHistory = [];
            [...tabData].filter(data=>data.sourceId===tabId);
            const messageToSend = {
                from: 'background',
                to: 'dash',
                message: 'dash_init_data',
                data: data
            }
            await chrome.tabs.sendMessage(tabId, {...messageToSend})
            log("sent data", data);

            /*
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

             */
        }

        if (message === 'gum_stream_start') {
            tabs.add(tabId);
        } else if (message === "gum_stream_stop") {
            tabs.remove(tabId);
        } else if (from === "popup" && message === "open") {
            // ToDo: check to see if tabs are still open
            // const {streamTabs} = await chrome.storage.local.get('streamTabs');
            // chrome.storage.local.get(['streamTabs'], data=>{tabs = data.streamTabs});

            sendResponse({message: tabs.length > 0 ? "active" : "inactive"})
        } else if (message === 'unload') {
            log("tab unloading");
            tabs.remove(tabId);
        }
    });


/*
 *  Extension icon control
 */

// ToDo: change to pageAction?
chrome.browserAction.onClicked.addListener(async (tab)=>{
    const messageToSend = {
        to: 'tab',
        from: 'background',
        message: 'toggle_dash',
        data: {tabId: tab.id}
    }
    chrome.tabs.sendMessage(tab.id, {...messageToSend})
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

log("background.js loaded");

