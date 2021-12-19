// ToDo: load dynamically only when needed
// import {processStream} from "../modules/processStream.mjs";
// addScript('/node_modules/@mediapipe/face_mesh/face_mesh.js');

const streams = [];
window.vchStreams = streams;
const DEFAULT_SEND_IMAGES_INTERVAL = 30*1000;
let faceMeshLoaded = false;


function debug(...messages) {
    console.debug(`vch 🕵️‍ `, ...messages);
}
debug(`content.js loaded on ${window.location.href}`);

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

function sendMessage(to = 'all', from = 'tab', message, data = {}, responseCallBack = null) {
    if (from === 'tab' && to === 'tab')
        return;

    try {
        // ToDo: response callback
        const messageToSend = {
            from: from,
            to: to,
            message: message,
            data: data
        };
        chrome.runtime.sendMessage(messageToSend, responseCallBack);
        // debug(`sent "${message}" from "tab" to ${to} with data ${JSON.stringify(data)}`);
    } catch (err) {
        debug("ERROR", err);
    }
}

// Main message handler
chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        if (to === 'tab' || to === 'all') {
            // debug(`receiving "${message}" from ${from} to ${to}. Forwarding to inject`);

            const sendTrainingImage = image => sendMessage('tab', 'training', 'training_image', image);

            if (message === 'train_start') {
                sendImagesInterval = data.sendImagesInterval || DEFAULT_SEND_IMAGES_INTERVAL;
                if (faceMeshLoaded) {
                    debug(`Resumed sending images. Sending every ${sendImagesInterval} sec`);
                } else {
                    debug(`sending images every ${sendImagesInterval} sec`);
                    streams.forEach(stream=> processStream(stream, sendTrainingImage));
                }
            } else if (message === 'train_stop') {
                sendImagesInterval = Infinity;
                debug(`Pausing sending images`);
            } else if (message === 'update_train_interval') {
                sendImagesInterval = data.sendImagesInterval || DEFAULT_SEND_IMAGES_INTERVAL;
                debug(`Resumed sending images. Sending every ${sendImagesInterval} ms`);
                streams.forEach( stream=> {
                    if (!faceMeshLoaded && stream.active)
                        processStream(stream, sendTrainingImage)
                });
            } else {
                debug("DEBUG: Unhandled event", request)
            }

            /*
            // No more need to forward anything to inject?
            const forwardedMessage = {
                from: from,
                to: to,
                message: request.message,
                data: data
            };
            sendToInject(forwardedMessage);
             */

        } else if (to === 'content') {
            // Nothing to do here yet
            debug("message for content.js", request)
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
    debug("message from inject to send", e.detail);

    if (!e.detail) {
        return
    }

    const {to, message, data} = e.detail;

    if (message === 'gum_stream_start') {
        const id = data.id;
        const video = document.querySelector(`video#${id}`);
        const stream = video.srcObject;
        // ToDo: remove stream from streams if no tracks
        stream.onremovetrack = ()=> log("track removed")
        streams.push(stream);
        debug(`stream video settings: `, stream.getVideoTracks()[0].getSettings());
        // send a message to tell inject to remove thd element
        const message = {
            to: 'tab',
            from: 'content',
            message: 'stream_transfer_complete',
            data: {id}
        }
        sendToInject(message);

        // await loadFaceMesh();
        // debug("faceMesh loaded");
    }

    sendMessage(to, 'tab', message, data);
});

// Tell background to remove unneeded tabs
window.addEventListener('beforeunload', () => {
    sendMessage('all', 'unload')
});

sendMessage('background', 'content', 'tab_loaded', {url: window.location.href});
