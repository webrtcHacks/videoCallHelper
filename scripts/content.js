function debug(...messages){
    console.debug(`vch 🕵️‍ `,  ...messages);
}

debug(`content.js loaded on ${window.location.href}`);

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
        chrome.runtime.sendMessage(messageToSend, responseCallBack)
    }
    catch (err){
        debug("ERROR", err);
    }
}

// Relay messages to inject.js
chrome.runtime.onMessage.addListener(
    (request, sender) => {
        const {to, from, message } = request;
        if(to === 'tab' || to === 'all'){
            debug(`sending "${message}" from ${from} to ${to}`);
            const forwardedMessage = {message: request.message, data: request.data}
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
    debug("message to send", e.detail);

    if (!e.detail){
        return
    }

    const {to, message, data} = e.detail;

    sendMessage(to, message, data);
});



/*
 * Capture Handle ID setup
 */
// Make a short pseudo-random id: https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
/*
let handleId = (Math.random() + 1).toString(36).substring(2);
navigator.mediaDevices.setCaptureHandleConfig(
    { handle: handleId, permittedOrigins: ["*"] }
);
debug(`captureHandle: ${handleId}`);
*/
// ToDo: remove the URL before release - it shouldn't matter
//sendToBackground({url: window.location.href, captureHandle: handleId});
sendMessage('background', window.location.href);


// Tell background to remove unneeded tabs
window.addEventListener('beforeunload', () => {
    sendMessage('background', 'unload')});
