function debug(...messages){
    console.debug(`vch 🕵️‍ `,  ...messages);
}

debug(`content.js loaded on ${window.location.href}`);

let script = document.createElement('script');
script.src = chrome.runtime.getURL('/scripts/inject.js');
// script.onload = () => this.remove;
(document.head || document.documentElement).appendChild(script);
debug("script injected");

/*
 * Communicate with the background worker context
 */

function sendMessage(to = 'all', message, data = {}, responseCallBack = null) {
    try{
        // ToDo: response callback
        const messageToSend = {
            from: 'tab',
            to: to,
            message: message,
            data: data
        };
        chrome.runtime.sendMessage(messageToSend, responseCallBack);
        // debug(`sent "${message}" from "tab" to ${to} with data ${JSON.stringify(data)}`);
    }
    catch (err){
        debug("ERROR", err);
    }
}

sendMessage('background', 'tab_loaded');

// Relay messages to inject.js
chrome.runtime.onMessage.addListener(
    (request, sender) => {
        const {to, from, message } = request;
        if(to === 'tab' || to === 'all'){
            // debug(`receiving "${message}" from ${from} to ${to}. Forwarding to inject`);
            const forwardedMessage = {
                from: from,
                to: to,
                message: request.message,
                data: request.data
            };
            sendToInject(forwardedMessage);
        }
        else if(to === 'content'){
            // Nothing to do here yet
            debug("message for content.js", request)
        }
        else {
            if(sender.tab)
                debug(`unrecognized format from tab ${sender.tab.id} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);
            else
                debug(`unrecognized format : `, sender, request);
        }
    }
);


/*
 * Communicate with the injected content
 */

const sendToInject = message => {
    debug("sending this to inject.js", message);
    const toInjectEvent = new CustomEvent('vch', {detail: message});
    document.dispatchEvent(toInjectEvent);
};

document.addEventListener('vch', e => {
    debug("message from inject to send", e.detail);

    if (!e.detail){
        return
    }

    const {to, message, data} = e.detail;
    sendMessage(to, message, data);
});

// ToDo: remove the URL before release - it shouldn't matter
sendMessage('background', window.location.href);

// Tell background to remove unneeded tabs
window.addEventListener('beforeunload', () => {
    sendMessage('all', 'unload')});
