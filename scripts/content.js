const streams = [];
let trackInfos = [];

window.vchStreams = streams;
const DEFAULT_SEND_IMAGES_INTERVAL = 30 * 1000;
let sendImagesInterval = Infinity;
let faceMeshLoaded = false;
let videoTabId;
let thisTabId;

function debug(...messages) {
    // console.debug(`vch 🕵️‍ `, ...messages);
}

debug(`content.js loaded on ${window.location.href}`);

const dashHeight = 100;
const dashStyle = `position:fixed;top:0;left:0;width:100%;height:${dashHeight}px;z-index:1000;transition:{height:500, ease: 0}`;

async function toggleDash() {
    // keep stateless for v3 transition

    // see if the iframe has already been loaded
    let iframe = document.querySelector('iframe#vch_dash');
    // add the iframe
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.style.cssText = dashStyle;
        iframe.src = chrome.runtime.getURL("/pages/dashboard.html");
        iframe.id = "vch_dash";
        // iframe.sandbox;      // ToDo: turn this on with the right settings for prod
        iframe.classList.add('dashOpen');
        document.body.appendChild(iframe);
        iframe.style.visibility = "visible";
        // document.body.style.marginTop = `${dashHeight}px`;

        debug("created dash");

    } else {
        // Close if open
        if (iframe.classList.contains('dashOpen')) {
            // document.body.style.marginTop = "0px";
            iframe.style.height = 0;
            iframe.height = 0;
            iframe.classList.remove('dashOpen');
            debug("closed dash");

        }
        // open if closed
        else {
            iframe.style.height = `${dashHeight}px`;
            iframe.height = dashHeight;
            iframe.classList.add('dashOpen');
            debug("opened dash");
        }
    }
}

document.addEventListener('readystatechange', (event) => {
    if (document.readyState === 'complete') {
        debug("readyState complete");
    }
});

// inject inject script
function addScript(path) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(path);
    script.onload = () => this.remove;
    (document.head || document.documentElement).appendChild(script);
}

addScript('/scripts/inject.js');
debug("inject injected");

/*
 * Communicate with the background worker context
 */

async function sendMessage(to = 'all', from = 'tab', message = "", data = {}, responseCallBack = null) {

    if (from === 'tab' && to === 'tab')
        return;

    try {
        // ToDo: response callback
        const messageToSend = {
            from: from,
            to: to,
            message: message,
            timestamp: Date.now(),
            data: data
        };

        // ToDo: this is expecting a response
        await chrome.runtime.sendMessage(messageToSend, {});

        // debug(`sent "${message}" from "tab" to ${to} with data ${JSON.stringify(data)}`);
    } catch (err) {
        debug("ERROR", err);
    }
}

// Main message handler
chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        debug(`receiving "${message}" from ${from} to ${to}`, request);

        // if (to === 'tab' || to === 'all') {
        if (message === 'toggle_dash') {
            await toggleDash();

        } else if (to === 'content') {
            // Nothing to do here yet
            debug("message for content.js", request)
        } else if (to === 'dash') {
            // Nothing to do here yet
        } else {
            if (sender.tab)
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

// Messages from inject
document.addEventListener('vch', async e => {
    const {to, from, message, data} = e.detail;
    // ToDo: stop inject for echoing back
    if (from === 'content')
        return;

    debug("message from inject", e.detail);

    if (!e.detail) {
        return
    }

    if (to === 'all' || to === 'background') {
        await sendMessage(to, from, message, data);
    }

    // Relay to extension contexts
    if (message === 'gum_stream_start') {
        const id = data.id;
        const video = document.querySelector(`video#${id}`);
        const stream = video.srcObject;
        streams.push(stream);
        debug(`stream video settings: `, stream.getVideoTracks()[0].getSettings());
        await sendMessage(to, 'tab', message, data);

        // send a message back to inject to remove the temp video element
        const responseMessage = {
            to: 'tab',
            from: 'content',
            message: 'stream_transfer_complete',
            data: {id}
        }
        sendToInject(responseMessage);
    }
});

// Tell background to remove unneeded tabs
window.addEventListener('beforeunload', async () => {
    // ToDo: handle unload
    await sendMessage('all', 'tab', 'unload')
});

// sendMessage('background', 'content', 'tab_loaded', {url: window.location.href});
