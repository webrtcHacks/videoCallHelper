function debug(...messages) {
    console.debug(`vch 📈️‍ `, ...messages);
}

let currentTabId;
// Messages from inject

// This doesn't work
/*
document.addEventListener('vch', async e => {
    const {to, from, message, data} = e.detail;
    debug("message from inject", e.detail);


    if (from === 'tab') {
        span.innerText += `${message} at ${Date.now().toLocaleString()}\n`;
    }

});
 */

const spanElem = document.querySelector('span.vch');

async function sendMessage(to = 'all', from = 'dash', message, data = {}, responseCallBack = null) {

    if (from === 'dash' && to === 'dash')
        return;

    try {
        // ToDo: response callback
        const messageToSend = {
            from: from,
            to: to,
            message: message,
            data: data
        };

        // ToDo: this is expecting a response
        await chrome.runtime.sendMessage(messageToSend, {});
        debug(`sent "${message}" from "tab" to ${to} with data ${JSON.stringify(data)}`);
    } catch (err) {
        debug("ERROR", err);
    }
}

function outputEvents(messageObj){

}

chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        debug(`receiving "${message}" from ${from} to ${to}`, request);

        if(message === 'toggle_dash'){
            currentTabId = data.tabId;
        }

        if (from === 'tab') {
            // if (message === 'dash_init') debug('dash_init', data);
            const ts = data.timestamp || Date.now();
            spanElem.innerText += `${new Date(ts).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
        }
    }
);


// Initial data load
chrome.storage.local.get(['tabData'], messageObj => {
    if(!messageObj.tabData)
        return;

    debug(messageObj.tabData);
    messageObj.tabData.forEach(event => {
        const {message, timeStamp, data} = event;
        spanElem.innerText += `${new Date(timeStamp).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
    });
});
