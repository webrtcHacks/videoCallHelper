import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

// if(process.env.NODE_ENV)
const debug = Function.prototype.bind.call(console.debug, console, `vch 🕵`);
const storage = await new StorageHandler(debug);
const mh = new MessageHandler(c.CONTENT);

debug(`content.js loaded on ${window.location.href}`);
const settings = storage.contents;
debug("storage contents: ", settings);

const streams = [];
let trackInfos = [];

window.vch = {
    streams: streams,
    trackInfos: trackInfos,
    mh: mh,
    storage: storage
};

/*
mh.addListener(m.GET_ALL_SETTINGS, async() => {
    await mh.sendMessage(c.INJECT, m.ALL_SETTINGS, storage.contents);
});
 */

/************ START inject script injection ************/

// For timing testing
/*
document.addEventListener('readystatechange', async (event) => {
    if (document.readyState === 'complete') {
        debug("readyState complete");
    }
});
 */

/*
    learning: can't inject variables due to unsafe inline policy restrictions
    I tried this:

    let code = await fetch(chrome.runtime.getURL(path)).then(r => r.text());
    code +=`\nlet initSettings = ${JSON.stringify(settings)};`;
    script.textContent = code;
 */

// ToDo: scenarios like webcam-framing mediaaquisition.html where the page JS loads before inject is injected (https://webcameyecontact.com/)
// inject inject script
function addScript(path) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = 'vch-inject';

    // set starting settings via data tag - player has a video file which is too big, so only pass what is needed
    script.dataset.settings = JSON.stringify({
        badConnection: settings.badConnection,
        debug: settings.debug,
        deviceManager: settings.deviceManager
    });
    script.src = chrome.runtime.getURL(path);
    // script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    debug("inject injected");
}

addScript('/scripts/inject.js');

/************ END inject script injection ************/

// Applets
// ToDo: make these self-contained
import {selfViewElementModifier} from "../../selfView/scripts/content.mjs";
import {grabFrames} from "../../imageCapture/scripts/content.mjs";

import "../../deviceManager/scripts/content.mjs";
import "../../badConnection/scripts/content.mjs";
import "../../videoPlayer/scripts/content.mjs";



/************ START dash manager ************/

const dashHeight = 150;
// ToDo: inline CSS with webpack
const dashStyle = `position:fixed;top:0;left:0;width:100%;max-height:${dashHeight}px;z-index:2147483647;transition:{height:500, ease: 0}; opacity:97%; border-color: black; border-width: 0`;
// const dashStyle = `position:fixed;top:0;left:0;width:100%;z-index:1000;transition:{height:500, ease: 0}; opacity:97%; border-color: black`;

let iframe;
Object.defineProperty(window.vch, 'dashOpen', {
    get: function() {
        return iframe?.classList.contains('dashOpen') || false;
    }
});

async function toggleDash() {

    // see if the iframe has already been loaded
    iframe = document.querySelector('iframe#vch_dash');
    // add the iframe
    if (!iframe) {
        iframe = document.createElement('iframe');
        vch.dash = iframe;   // for debugging
        iframe.style.cssText = dashStyle;
        iframe.src = chrome.runtime.getURL("/pages/dash.html");
        iframe.id = "vch_dash";
        // iframe.sandbox;      // ToDo: turn iframe.sandbox on with the right settings for prod
        iframe.allow = "camera; microphone";                    // add camera and mic permissions
        iframe.classList.add('dashOpen');
        document.body.appendChild(iframe);
        iframe.style.visibility = "visible";
        // document.body.style.marginTop = `${dashHeight}px`;

        // await showPreview();
        debug("created dash");

        // iframe.blur();   // didn't work; neither did visibility

    } else {
        // Close if open
        if (iframe.classList.contains('dashOpen')) {
            // document.body.style.marginTop = "0px";
            iframe.style.height = "0px";
            iframe.height = 0;
            iframe.classList.remove('dashOpen');
            // imagePreview?.stop();
        }
        // open if closed
        else {
            // document.body.style.marginTop = `${dashHeight}px`;
            iframe.style.height = `${dashHeight}px`;
            iframe.height = dashHeight;
            iframe.classList.add('dashOpen');
            // debug("opened dash");
            // await showPreview();
        }
    }
}

mh.addListener(m.TOGGLE_DASH, toggleDash);
mh.onDisconnectedHandler('remove_dash', () => {
    iframe?.remove();
    iframe = null;
    mh.removeDisconnectHandler('remove_dash');  // only do this once
});

/************ END dash manager ************/


/************ START gUM stream management ************/

// Monitor and share track changes
// useful for replicating the stream in another tab
async function syncTrackInfo() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    debug("getting current video devices:", videoDevices);

    // video.js can ask for syncTrackInfo at any time, so see if there are still streams
    if (streams.length === 0) {
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
        await mh.sendMessage(c.BACKGROUND, 'tab', 'remove_track');
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
        await mh.sendMessage(c.BACKGROUND, 'tab', 'mute')
        debug("track muted: ", e.srcElement)
    };
    videoTrack.onunmute = async e => {
        await mh.sendMessage(c.BACKGROUND, 'tab', 'unmute')
        debug("track unmuted: ", e.srcElement)
    };


    // ToDo: spec check: find out if a gUM stream can ever have more than 1 video track
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
    await mh.sendMessage(c.BACKGROUND, 'tab', 'track_info');
    // Keep for debugging
    /*
    streams.forEach( stream => {

        stream.onremovetrack = async (track) => {
            debug("track removed", track);
            await sendMessage('video', 'tab', 'remove_track', track.id)
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

// Added for presence
async function monitorTrack(track, streamId) {
    debug(`new ${track.kind} track on stream ${streamId} with settings: `, track);
    const {id, kind, label, readyState} = track;
    const trackData = {
        id,
        kind,
        label,
        readyState: readyState,
        streamId
    }

    if (track.readyState === 'live') // remove !track.muted &&  since no mute state handing yet
        await mh.sendMessage(c.BACKGROUND, m.NEW_TRACK, trackData);

    // Note: this only fires if the browser forces the track to stop; not for most user actions
    track.addEventListener('ended', async () => {
        trackData.readyState = 'ended';
        await mh.sendMessage(c.BACKGROUND, m.TRACK_ENDED, trackData);
        await checkActiveStreams();
    });

    // ToDo: should I use this monitor function?
    // use an interval to check if the track has ended
    const monitor = setInterval(async () => {
        if (track.readyState === 'ended') {
            trackData.readyState = 'ended';
            await mh.sendMessage(c.BACKGROUND, m.TRACK_ENDED, trackData);
            clearInterval(monitor);
        }
    }, 2000);

    // OBS making this go on and off
    /*
    track.addEventListener('mute', async (e) => {
        trackData.state = 'muted';
        await mh.sendMessage('background', m.TRACK_MUTE, trackData);
    });

    track.addEventListener('unmute', async (e) => {
        trackData.state = 'unmuted';
        await mh.sendMessage('background', m.TRACK_UNMUTE, trackData);
    });
     */
}


async function checkActiveStreams() {
    for (const stream of streams) {
        if (stream.getTracks().length === 0
            || stream.getTracks().every(track => track.readyState === 'ended')) {
            await mh.sendMessage(c.DASH, m.GUM_STREAM_STOP, {});
            // remove the stream
            const index = streams.findIndex(stream => stream.id === stream.id);
            if (index !== -1) {
                streams.splice(index, 1);
            }
        }
    }
}

// ToDo: count errors back from the worker - cancel modification attempts if too many

async function gumStreamStart(data) {
    const id = data.id;
    const video = document.querySelector(`video#${id}`);
    const origStream = video.srcObject;
    streams.push(origStream);
    debug("current streams", streams);

    // debug("Transferred video track settings: ", origStream.getVideoTracks()[0].getSettings());
    // debug("Transferred video track constraints: ", origStream.getVideoTracks()[0].getConstraints());
    // debug("Transferred video track capabilities: ", origStream.getVideoTracks()[0].getCapabilities());

    if (video.srcObject.getTracks().length === 0) {
        debug("no tracks found in stream", video.srcObject);
        await mh.sendMessage(c.INJECT, m.STREAM_TRANSFER_FAILED, {id, error: "no tracks found in stream"});
        return;
    }

    // Added for presence
    origStream.getTracks().forEach(track => monitorTrack(track, origStream.id));

    // ToDo: should really ignore streams and just monitor tracks
    origStream.addEventListener('removetrack', async (event) => {
        debug(`${event.track.kind} track removed`);
        await checkActiveStreams();
    });

    // send a message back to inject to remove the temp video element
    await mh.sendMessage(c.INJECT, m.STREAM_TRANSFER_COMPLETE, {id});

    // Clean-up the DOM since I don't use this anymore
    document.body.removeChild(video);

    // updateVideoPreview(origStream);

    // Video-only processing
    if(origStream.getVideoTracks().length > 0) {

        // image capture
        // ToDo: consider passing data to grabFrames so I can filter out bcs
        await grabFrames(origStream);

        // self-view
        // this works as long as I reuse the streamID?
        // await new selfViewElementModifier(origStream);
        new selfViewElementModifier(origStream, storage);
    }

}

mh.addListener(m.GUM_STREAM_START, gumStreamStart);

/************ END gUM stream management ************/



