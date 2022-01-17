let streamTabs;     // ToDo: remove this?

// Keep state on tabs; uses a Set to only store unique items
async function addTab(tabId) {
    try {
        // const {streamTabs} = await chrome.storage.local.get('streamTabs');
        chrome.storage.local.get(['streamTabs'], data=>{streamTabs = data.streamTabs});
        const activeTabs = new Set(streamTabs);
        activeTabs.add(tabId );
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

function log(...messages) {
    console.log(`👷 `, ...messages);
    /*
    if(messages.length > 1 || typeof messages[0]==='object')
        console.log(`👷 ️${JSON.stringify(...messages)}`);
    else
        console.log(`👷 ️${messages}`);

     */
}

chrome.runtime.onStartup.addListener(async () => {
})

/*
 * Inter-script messaging
 */

chrome.runtime.onInstalled.addListener(async () => {

    await chrome.storage.local.clear();     // ToDo: Reconsider this for some data
    await chrome.storage.local.set({streamTabs: []});

    // chrome.runtime.openOptionsPage();

});

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

            chrome.storage.local.get(['tabData'], async data=>{
                const arr = [];
                if(data.tabData)
                    arr.push(...data.tabData);
                arr.push(storageObj);
                await chrome.storage.local.set({tabData: arr});
                // log("tabData: ", arr);
            });
        }

        else if(from==='dash' && message === 'dash_init'){
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

        if (message === 'gum_stream_start') {

            // log("DEBUG: gum_stream_start - stopping here");
            // return;

            await addTab(tabId);
        } else if (message === "gum_stream_stop") {
            await removeTab(tabId)
        } else if (from === "popup" && message === "open") {
            // ToDo: check to see if tabs are still open
            // const {streamTabs} = await chrome.storage.local.get('streamTabs');
            chrome.storage.local.get(['streamTabs'], data=>{streamTabs = data.streamTabs});
            sendResponse({message: streamTabs.length > 0 ? "active" : "inactive"})
        } else if (message === 'unload') {
            log("tab unloading");
            await removeTab(tabId);
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // log(`tab ${tabId} updated`, changeInfo, tab);

    if (tab.url.match(/^chrome-extension:\/\//) && changeInfo.status === 'complete') {
        log(`extension tab opened: ${tab.url}`)
    }

});

log("background.js loaded");

