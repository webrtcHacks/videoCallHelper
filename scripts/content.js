function debug(...messages){
    console.debug(`vch 🕵️‍ `,  ...messages);
}

debug(`content.js loaded on ${window.location.href}`);

/*
 * Communicate with the background worker context
 */

function sendMessage(to, message, responseHandler) {
    try{
            chrome.runtime.sendMessage({from: "tab", to: to, message: message}, responseHandler)
        /*
        // ToDo: do we need to handle sending to all tabs?
        //  Should the below be filtered?
        if (to === 'tabs' || to === 'all'){
            chrome.tabs.query({active: true, currentWindow: true}, tabs => {
                tabs.forEach(tab=>
                    chrome.tabs.sendMessage(tab.id, message, responseHandler))
            });
        }
*/
    }
    catch (err){
        console.debug(err);
    }
}

// Relay messages to inject.js
chrome.runtime.onMessage.addListener(
    (request, sender) => {
        if(request.to && ( request.to === 'tab' || request.to === 'all')){
            debug(`sending "${request.message}" from ${request.from} to ${request.to}`);
        }
        else if(request.to && request.to === 'content'){
            debug("message for content.js", request)
            return
        }
        else {
            if(sender.tab)
                debug(`unrecognized format from tab ${sender.tab.id} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);
            else
                debug(`unrecognized format : `, sender, request);
            return
        }

        sendToInject(request.message);
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
    if (!e.detail){
        return
    }

    const message = e.detail.message;
    const to = e.detail.to;

    sendMessage(to, message);
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
