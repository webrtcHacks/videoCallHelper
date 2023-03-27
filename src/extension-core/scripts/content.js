import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {grabFrames} from "../../imageCapture/scripts/content-grabFrames.mjs";
// import {obscureSelfViewFunc, selfViewObscureSet} from "../../selfView/scripts/content-selfView.mjs";
import {selfViewModifier} from "../../selfView/scripts/content-selfView.mjs";


const streams = [];
let trackInfos = [];

window.vchStreams = streams;

const debug = function() {
    return Function.prototype.bind.call(console.debug, console, `vch 🕵️‍ `);
}();

debug(`content.js loaded on ${window.location.href}`);

const mh = new MessageHandler('content', debug);
const sendMessage = mh.sendMessage;
// await sendMessage('all', 'hello there', {foo: 'bar'});

const storage = await chrome.storage.local.get();
await debug("storage contents:", storage);

const dashHeight = 100;
const dashStyle = `position:fixed;top:0;left:0;width:100%;height:${dashHeight}px;z-index:1000;transition:{height:500, ease: 0}`;

async function toggleDash() {

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
            iframe.style.height = "0px";
            iframe.height = 0;
            iframe.classList.remove('dashOpen');
            // debug("closed dash");

        }
        // open if closed
        else {
            // document.body.style.marginTop = `${dashHeight}px`;
            iframe.style.height = `${dashHeight}px`;
            iframe.height = dashHeight;
            iframe.classList.add('dashOpen');
            // debug("opened dash");
        }
    }
}
mh.addListener(m.TOGGLE_DASH, toggleDash);

// Monitor and share track changes
// useful for replicating the stream in another tab
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

// function showDebug(d) {console.debug(JSON.stringify(arguments))}
// mh.addListener("toggle_dash", showDebug);

// Added for presence
async function monitorTrack(track, streamId){
    debug(`new track ${streamId} video settings: `, track);
    const {id, kind, label, readyState} = track;
    const trackData = {
        id,
        kind,
        label,
        state: readyState,
        streamId
    }

    if(track.readyState === 'live') // remove !track.muted &&  since no mute state handing yet
        await sendMessage('background', m.NEW_TRACK, trackData);

    // Note: this only fires if the browser forces the track to stop; not for most user actions
    track.addEventListener('ended', async (e) => {
        trackData.state = 'ended';
        await sendMessage('background', m.TRACK_ENDED, trackData);
    });

    // use an interval to check if the track has ended
    const monitor = setInterval(async () => {
        if(track.readyState === 'ended'){
            trackData.state = 'ended';
            await sendMessage('background', m.TRACK_ENDED, trackData);
            clearInterval(monitor);
        }
    }, 2000);


    // OBS making this go on and off
    /*
    track.addEventListener('mute', async (e) => {
        trackData.state = 'muted';
        await sendMessage('background', m.TRACK_MUTE, trackData);
    });

    track.addEventListener('unmute', async (e) => {
        trackData.state = 'unmuted';
        await sendMessage('background', m.TRACK_UNMUTE, trackData);
    });
     */
}


async function gumStreamStart(data){
    const id = data.id;
    const video = document.querySelector(`video#${id}`);
    const stream = video.srcObject;
    streams.push(stream);
    debug("current streams", streams);

    // Added for presence
    stream.getTracks().forEach(track => monitorTrack(track, stream.id));

    // ToDo: should really ignore streams and just monitor tracks
    stream.addEventListener('removetrack', async (event) => {
        debug(`${event.track.kind} track removed`);
        if(stream.getTracks().length === 0){
            await sendMessage('all', m.GUM_STREAM_STOP);
        }
    });

    // send a message back to inject to remove the temp video element
    await sendMessage('inject', m.TRACK_TRANSFER_COMPLETE, {id});

    // Todo: do I need a registry of applet functions to run here?
    grabFrames(stream);

    // self-view
    await new selfViewModifier(stream);

}

mh.addListener(m.GUM_STREAM_START, gumStreamStart);

// For timing testing
/*
document.addEventListener('readystatechange', async (event) => {
    if (document.readyState === 'complete') {
        debug("readyState complete");
    }
});
 */

// inject inject script
function addScript(path) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(path);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

addScript('/scripts/inject.js');
debug("inject injected");
