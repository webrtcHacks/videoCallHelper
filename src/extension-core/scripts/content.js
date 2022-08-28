import {capImgToDb, getImages} from "../../modules/capImgToDb";

const streams = [];
let trackInfos = [];
// const trackIds = new Set();

window.vchStreams = streams;
const DEFAULT_SEND_IMAGES_INTERVAL = 30 * 1000;
let sendImagesInterval = Infinity;
let faceMeshLoaded = false;
let videoTabId;
let thisTabId;

const debug = function() {
    return Function.prototype.bind.call(console.debug, console, `vch 🕵️‍ `);
}();

debug(`content.js loaded on ${window.location.href}`);


// Testing visualization options
/*
 * DOMContentLoaded - doesn't work with Meet
 */

/*
function addDisplay(){
    const display = document.createElement("div");
    display.id = "vch";
    display.offsetHeight = 50;
    display.style.cssText = "position: fixed; top: 0px; left: 0px; height: 0px; width: 100%; z-index: 1000; transition: height 500ms ease 0s;";
    display.style.color = 'red';
    display.style.backgroundColor = "aqua";
    display.style.textAlign = "center";
    display.innerText = "This is some text"
    document.body.prepend(display);
}
 */

const dashHeight = 100;

/*
const dashStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 100,
    zIndex: 10000,
    transition: {
        height: 500,
        ease: 0
    },
    backgroundColor: 'aqua',
    color: 'red'
}
const dashOpenStyle = {
    height: 100
}

const dashClosedStyle = {
    height: 0
}
 */

const dashStyle = `position:fixed;top:0;left:0;width:100%;height:${dashHeight}px;z-index:1000;transition:{height:500, ease: 0}`;

async function toggleDash() {
    // keep stateless for v3 transition

    // see if the iframe has already been loaded
    let iframe = document.querySelector('iframe#vch_dash');
    // add the iframe
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.style.cssText = dashStyle;
        iframe.src = chrome.runtime.getURL("/pages/dash.html");
        iframe.id = "vch_dash";
        // iframe.sandbox;      // ToDo: turn this on with the right settings for prod
        iframe.classList.add('dashOpen');
        document.body.appendChild(iframe);
        iframe.style.visibility = "visible";
        // document.body.style.marginTop = `${dashHeight}px`;

        debug("created dash");

        // iframe.blur();   // didn't work; neither did visibility

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
            // document.body.style.marginTop = `${dashHeight}px`;
            iframe.style.height = `${dashHeight}px`;
            iframe.height = dashHeight;
            iframe.classList.add('dashOpen');
            debug("opened dash");

        }
    }
}

// inject inject script
function addScript(path) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(path);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

addScript('/scripts/inject.js');
debug("inject injected");

async function syncTrackInfo() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    debug("getting current video devices:", videoDevices);

    // video.js can ask for syncTrackInfo at any time, so see if there are still streams
    if(streams.length === 0){
        debug("No streams to syncTrackInfo");
        return
    }

    // just use the last stream for now
    // ToDo: get the highest res stream
    const stream = streams.at(-1);
    // ToDo: stream event handlers
    debug("syncTrackInfo:: selected stream", stream)
    stream.onremovetrack = async (track) => {
        debug("track removed", track);
        await sendMessage('video', 'tab', 'remove_track', track.id);
        trackInfos = trackInfos.filter(info => info.id !== track.id);
        debug("updated trackInfos", trackInfos);
    };

    const [videoTrack] = stream.getVideoTracks();
    videoTrack.onended = (e) => {
        debug("track stopped: ", e.srcElement);
        const {id} = e.srcElement;
        trackInfos = trackInfos.filter(info => info.id !== id);
        debug("updated trackInfos", trackInfos);
    };
    videoTrack.onmute = async e => {
        await sendMessage('video', 'tab', 'mute', e.srcElement.id)
        debug("track muted: ", e.srcElement)
    };
    videoTrack.onunmute = async e => {
        await sendMessage('video', 'tab', 'unmute', e.srcElement.id)
        debug("track unmuted: ", e.srcElement)
    };


    // ToDo: find out if a gUM stream can ever have more than 1 video track
    const settings = videoTrack.getSettings();
    debug("syncTrackInfo:: settings: ", settings);

    const {label} = videoDevices.find(device => settings.deviceId === device.deviceId);
    debug("syncTrackInfo:: device label: ", label);
    if (label !== "")
        settings.label = label;

    // ToDo: make sure to only push unique tracks
    settings.id = videoTrack.id;
    trackInfos = trackInfos.filter(info => info.id !== videoTrack.id);
    debug("syncTrackInfo:: updated trackInfos", trackInfos);

    trackInfos.push(settings);
    await sendMessage('video', 'tab', 'track_info', {trackInfo: settings});
    // Keep for debugging
    /*
    streams.forEach( stream => {

        // ToDo: stream event handlers
        stream.onremovetrack = async (track) => {
            debug("track removed", track);
            await sendMessage('video', 'tab', 'remove_track', track.id)
            // ToDo: take it out of the list
        };

        const [videoTrack] = stream.getVideoTracks();
        videoTrack.onended = (e) => {
            debug("track stopped: ", e.srcElement);
            const {id} = e.srcElement;
            trackInfos = trackInfos.filter(info => info.id !== id);
            debug()
        };
        videoTrack.onmute = async e => {
            await sendMessage('video', 'tab', 'mute', e.srcElement.id)
            debug("track muted: ", e.srcElement)
        };
        videoTrack.onunmute = async e => {
            await sendMessage('video', 'tab', 'unmute', e.srcElement.id)
            debug("track unmuted: ", e.srcElement)
        };


        // ToDo: find out if a gUM stream can ever have more than 1 video track
        const settings = videoTrack.getSettings();
        debug("settings: ", settings);

        const {label} = videoDevices.find(device => settings.deviceId === device.deviceId);
        debug("device label: ", label);
        if (label !== "")
            settings.label = label;

        // trackIds.add(settings.id);
        // ToDo: make sure to only push unique tracks
        trackInfos.push(settings);
        sendMessage('video', 'tab', 'track_info', {trackInfos})
            .catch(err=>debug("sendMessage error: ", err));

    });

     */
}

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
            timestamp: (new Date).toLocaleString(),
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

        } else if(message === 'video_tab'){
            debug("send syncTrackInfo here");
            await syncTrackInfo();
        }
        else if (to === 'content') {
            // Nothing to do here yet
            debug("message for content.js", request)
        } else if (to === 'dash'){
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
    // ToDo: never get this event
    if (message === 'gum_stream_start') {
        const id = data.id;
        const video = document.querySelector(`video#${id}`);
        const stream = video.srcObject;
        streams.push(stream);
        debug(`stream video settings: `, stream.getVideoTracks()[0].getSettings());
        debug("current streams", streams);
        // await sendMessage(to, 'tab', message, data);

        // check if videoTab is already open
        // ToDo: query this
        //  const url = chrome.runtime.getURL("pages/video.html"); // + `?source=${tabId}`;
        // Learning: not allowed in content
        // const videoTab = await chrome.tabs.query({url: url});
        //  debug("videoTab", videoTab);

        // if (videoTabId)
        // await syncTrackInfo();

        // send a message back to inject to remove the temp video element
        const responseMessage = {
            to: 'tab',
            from: 'content',
            message: 'stream_transfer_complete',
            data: {id}
        }
        sendToInject(responseMessage);

        // ToDo: save frames here
        //let captureInterval = capImgToDb(stream, sendMessage)

        // ToDo: set this from a message
        let intervalTime = 5*1000;

        const getImg = getImages(stream);

        let captureInterval = setInterval(async ()=>{
            const imgData = await getImg.next();
            if(imgData.value) //&& imgData.done !== false)
                // debug(imgData.value);
                await sendMessage('all', 'content', 'frame_cap', imgData.value);
            if(imgData.done){
                clearInterval(captureInterval);
                debug("No more image data", imgData);
            }

        }, intervalTime);

    }
});

document.addEventListener('readystatechange', async (event) => {
    if (document.readyState === 'complete') {
        debug("readyState complete");
    }
});

// Tell background to remove unneeded tabs
window.addEventListener('beforeunload', async () => {
    // ToDo: handle unload

    await sendMessage('all', 'tab', 'unload')
});

// sendMessage('background', 'content', 'tab_loaded', {url: window.location.href});
