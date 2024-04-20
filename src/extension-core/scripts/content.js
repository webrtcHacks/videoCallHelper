import {MESSAGE as m, MessageHandler} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

import {selfViewElementModifier} from "../../selfView/scripts/content.mjs";
import {grabFrames, ImageStream} from "../../imageCapture/scripts/content.mjs";
import {base64ToBuffer} from "../../videoPlayer/scripts/videoPlayer.mjs";

import "../../deviceManager/scripts/content.mjs";
import "../../badConnection/scripts/content.mjs";

const streams = [];
let trackInfos = [];

// if(process.env.NODE_ENV)
const debug = Function.prototype.bind.call(console.debug, console, `vch 🕵`);

debug(`content.js loaded on ${window.location.href}`);
// debug('content.js URL: ', chrome.runtime.getURL('content.js'));

let storage = await new StorageHandler("local", debug);
const settings = storage.contents;
debug("storage contents: ", settings);

const mh = new MessageHandler('content');

window.vch = {
    streams: streams,
    trackInfos: trackInfos,
    mh: mh,
    storage: storage
};

mh.addListener(m.GET_ALL_SETTINGS, async() => {
    await mh.sendMessage('inject', m.ALL_SETTINGS, storage.contents);
});



/************ START video player ************/


let imagePreview = null; // used to hold the gUM preview image generator
/*
   Not easy to send a stream to dash:
     * can't access the iframe content - CORS issues
     * can't send the stream over postMessage - it's not serializable
     * can't pass a resource URL - treated as different domains
   ideas:
     1. open a new stream - could cause gUM conflicts, more encoding
     2. send snapshots - this is what did
*/
/**
 * Grabs the last stream and generates preview thumbnails
 * @returns {Promise<void>}
 */
async function showPreview(){
    const stream = streams.at(-1);  // get the last stream  // ToDo: get the highest res gUM stream
    // debug("showPreview:: stream", stream);
    if(stream){
        imagePreview = new ImageStream(stream, 200, 'dash', true);
        await imagePreview.start();
    }
    else
        imagePreview = null;
}

storage.addListener('player', async (newValue) => {
    debug("player storage changed", newValue);

    if(newValue.buffer){
        // const buffer = base64ToBuffer(newValue.buffer);
        // debug("buffer", buffer);
        // newValue.buffer  = buffer;

        const {buffer, mimeType, loop, videoTimeOffsetMs, currentTime} = newValue;

        const videoPlayer = document.createElement('video');
        videoPlayer.autoplay = true;
        videoPlayer.loop = loop;
        videoPlayer.id = `vch-player-${Math.random().toString().substring(2, 6)}`;
        videoPlayer.preload = "auto";
        videoPlayer.hidden = true;
        videoPlayer.muted = true;
        // set the style to fit to cover
        // videoPlayer.style.cssText = "object-fit:cover;";

        // captureStream takes the source video size so this doesn't matter
        // const {width, height} = streams.at(-1)?.getVideoTracks()[0]?.getSettings();
        // videoPlayer.height = height;
        // videoPlayer.width = width;

        document.body.appendChild(videoPlayer);
        debug("added video element", videoPlayer);

        videoPlayer.oncanplay = () => {
            videoPlayer.oncanplay = null;
            const transmissionDelay = new Date().getTime() - currentTime;
            const playbackOffset = (videoTimeOffsetMs + transmissionDelay) / 1000;
            videoPlayer.currentTime = playbackOffset;
            debug("Adjusted playback to match sync", playbackOffset);
            mh.sendMessage('inject', m.PLAYER_START, {id: videoPlayer.id});
        };

        const arrayBuffer = base64ToBuffer(buffer);
        const blob = new Blob([arrayBuffer], { type: mimeType }); // Ensure the MIME type matches the video format
        videoPlayer.src = URL.createObjectURL(blob);


        // ToDo: revoke the blobURL when it is no longer needed
        // URL.revokeObjectURL(blobUrl);

        // ToDo: player controls

    }
});

/*
mh.addListener('hello_there', async (data) => {
    debug("hello_there", data);
});

 */

/************ END video player ************/

/************ START dash manager ************/

const dashHeight = 150;
// ToDo: inline CSS with webpack
const dashStyle = `position:fixed;top:0;left:0;width:100%;max-height:${dashHeight}px;z-index:2147483647;transition:{height:500, ease: 0}; opacity:97%; border-color: black`;
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

        await showPreview();
        debug("created dash");

        // iframe.blur();   // didn't work; neither did visibility

    } else {
        // Close if open
        if (iframe.classList.contains('dashOpen')) {
            // document.body.style.marginTop = "0px";
            iframe.style.height = "0px";
            iframe.height = 0;
            iframe.classList.remove('dashOpen');
            imagePreview?.stop();
        }
        // open if closed
        else {
            // document.body.style.marginTop = `${dashHeight}px`;
            iframe.style.height = `${dashHeight}px`;
            iframe.height = dashHeight;
            iframe.classList.add('dashOpen');
            // debug("opened dash");
            await showPreview();
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
        await mh.sendMessage('video', 'tab', 'remove_track');
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
        await mh.sendMessage('video', 'tab', 'mute')
        debug("track muted: ", e.srcElement)
    };
    videoTrack.onunmute = async e => {
        await mh.sendMessage('video', 'tab', 'unmute')
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
    await mh.sendMessage('video', 'tab', 'track_info');
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
    debug(`new track ${streamId} video settings: `, track);
    const {id, kind, label, readyState} = track;
    const trackData = {
        id,
        kind,
        label,
        readyState: readyState,
        streamId
    }

    if (track.readyState === 'live') // remove !track.muted &&  since no mute state handing yet
        await mh.sendMessage('background', m.NEW_TRACK, trackData);

    // Note: this only fires if the browser forces the track to stop; not for most user actions
    track.addEventListener('ended', async () => {
        trackData.readyState = 'ended';
        await mh.sendMessage('background', m.TRACK_ENDED, trackData);
        await checkActiveStreams();
    });

    // ToDo: should I use this monitor function?
    // use an interval to check if the track has ended
    const monitor = setInterval(async () => {
        if (track.readyState === 'ended') {
            trackData.readyState = 'ended';
            await mh.sendMessage('background', m.TRACK_ENDED, trackData);
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
            // await mh.sendMessage('inject', m.GUM_STREAM_STOP, {});
            await mh.sendMessage('dash', m.GUM_STREAM_STOP, {});
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
        await mh.sendMessage('inject', m.STREAM_TRANSFER_FAILED, {id, error: "no tracks found in stream"});
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
    await mh.sendMessage('inject', m.STREAM_TRANSFER_COMPLETE, {id});

    // for video player
    /*
    const audioTrack = origStream.getAudioTracks();
    const videoTrack = origStream.getVideoTracks();
    const audioConstraints = audioTrack[0]?.getConstraints() || false;
    const videoConstraints = videoTrack[0]?.getConstraints() || false;
    const constraints = {audio: audioConstraints, video: videoConstraints};
    debug("gumStreamStart:: constraints", constraints);
    await sendMessage('dash', m.GUM_STREAM_START, {id: origStream.id, constraints});
     */

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



/************ START inject script injection ************/

// For timing testing
/*
document.addEventListener('readystatechange', async (event) => {
    if (document.readyState === 'complete') {
        debug("readyState complete");
    }
});
 */

// learning: can't inject variables due to unsafe inline policy restrictions
//  I tried this:
/*
    let code = await fetch(chrome.runtime.getURL(path)).then(r => r.text());
    code +=`\nlet initSettings = ${JSON.stringify(settings)};`;
    script.textContent = code;
 */

// ToDo: scenarios like webcam-framing mediaaquisition.html where the page JS loads before inject is injected
// inject inject script
async function addScript(path) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(path);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

await addScript('/scripts/inject.js');
// debug("inject injected");

/************ END inject script injection ************/
