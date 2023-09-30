import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {selfViewElementModifier} from "../../selfView/scripts/content-selfView.mjs";
import {grabFrames} from "../../imageCapture/scripts/content-grabFrames.mjs";

const streams = [];
let trackInfos = [];

window.vchStreams = streams;

const debug = Function.prototype.bind.call(console.debug, console, `vch 🕵`);


debug(`content.js loaded on ${window.location.href}`);
// debug('content.js URL: ', chrome.runtime.getURL('content.js'));

const mh = new MessageHandler('content', debug);
const sendMessage = mh.sendMessage;

import {StorageHandler} from "../../modules/storageHandler.mjs";
let storage = await new StorageHandler("local", debug);
// ToDo: trying to pass initial storage settings direct to inject so messageHandler isn't needed for initialization
const settings = storage.contents;
debug("storage contents: ", settings);

mh.addListener(m.GET_ALL_SETTINGS, async() => {
    await mh.sendMessage('inject', m.ALL_SETTINGS, storage.contents);
});

/************ START deviceManager ************/

// Set initial device manager values
const deviceSettings = {
    enabled: storage.contents['deviceManager']?.enabled ?? false,   // UI switch
    /*permission: {                           // browser permission
        audio: null, // await navigator.permissions.query({name: 'microphone'}) ?? null,
        video: null // await navigator.permissions.query({name: 'camera'}) ?? null
    },*/
    currentDevices: [],
    selectedDeviceLabels: {            // UI selections
        audio: storage.contents['deviceManager']?.selectedDeviceLabels?.audio ?? "",
        video: storage.contents['deviceManager']?.selectedDeviceLabels?.video ?? ""
    }
}


// Dash UI enabled change should be propagated to inject
await storage.addListener('deviceManager', (newValue) => {
    debug("deviceManager settings changed", newValue);
    sendMessage('inject', m.UPDATE_DEVICE_SETTINGS, newValue);
});

// Inject (fakeDeviceManager) should ask for these settings when it loads
mh.addListener(m.GET_DEVICE_SETTINGS, () => {
    sendMessage('inject', m.UPDATE_DEVICE_SETTINGS, storage.contents['deviceManager']);
});

// Inject should send content UPDATE_DEVICE_SETTINGS on any deviceChange or permission change
mh.addListener(m.UPDATE_DEVICE_SETTINGS, async (data) => {
    let settings = storage.contents['deviceManager'];
    debug("deviceManager settings updated", data);
    settings.currentDevices = data.devices;
    settings.permission = {
        audio:  null, //(await navigator.permissions.query({name: 'microphone'}))?.state,
        video: null //(await navigator.permissions.query({name: 'camera'    }))?.state,
    }
    await storage.update('deviceManager', settings);
});


// reset storage values on start
await storage.update('deviceManager', deviceSettings);


/************ END deviceManager ************/


/************ START bad connection ************/
// ToDo - possibly move this into a module
// Need to relay badConnection updates between inject and dash

const bcsInitSettings = {
    enabled: storage.contents['badConnection']?.enabled ?? false,
    active: false,
    level: "passthrough",
    noPeerOnStart: null
}

await storage.update('badConnection', bcsInitSettings);
await storage.addListener('badConnection', (newValue) => {
    debug("badConnection settings changed", newValue);
    sendMessage('inject', m.UPDATE_BAD_CONNECTION_SETTINGS, newValue);
});

mh.addListener(m.GET_BAD_CONNECTION_SETTINGS, () => {
    sendMessage('inject', m.UPDATE_BAD_CONNECTION_SETTINGS, bcsInitSettings);
});

// if a peerConnection is open and badConnection is not enabled then permanently disable it
//  - no longer needed with device manager
/*
mh.addListener(m.PEER_CONNECTION_OPEN,  () => {
    if (!bcsInitSettings.enabled) {
        storage.update('badConnection', {noPeerOnStart: true})
            .catch(err => debug("Error updating badConnection settings", err));
    }
    else{
        storage.update('badConnection', {noPeerOnStart: false})
            .catch(err => debug("Error updating badConnection settings", err));
    }
});
 */

/************ END bad connection ************/

const dashHeight = 150;
// ToDo: inline CSS with webpack
const dashStyle = `position:fixed;top:0;left:0;width:100%;max-height:${dashHeight}px;z-index:2147483647;transition:{height:500, ease: 0}; opacity:97%; border-color: black`;

// const dashStyle = `position:fixed;top:0;left:0;width:100%;z-index:1000;transition:{height:500, ease: 0}; opacity:97%; border-color: black`;


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
        await sendMessage('background', m.NEW_TRACK, trackData);

    // Note: this only fires if the browser forces the track to stop; not for most user actions
    track.addEventListener('ended', async () => {
        trackData.readyState = 'ended';
        await sendMessage('background', m.TRACK_ENDED, trackData);
        await checkActiveStreams();
    });

    // ToDo: should I use this monitor function?
    // use an interval to check if the track has ended
    const monitor = setInterval(async () => {
        if (track.readyState === 'ended') {
            trackData.readyState = 'ended';
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


async function checkActiveStreams() {
    for (const stream of streams) {
        if (stream.getTracks().length === 0
            || stream.getTracks().every(track => track.readyState === 'ended')) {
            await sendMessage('all', m.GUM_STREAM_STOP);
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

    // ToDo: handle this
    // debug("Transferred video track settings: ", origStream.getVideoTracks()[0].getSettings());
    // debug("Transferred video track constraints: ", origStream.getVideoTracks()[0].getConstraints());
    // debug("Transferred video track capabilities: ", origStream.getVideoTracks()[0].getCapabilities());

    if (video.srcObject.getTracks().length === 0) {
        debug("no tracks found in stream", video.srcObject);
        // ToDo: handle this
        await sendMessage('inject', m.STREAM_TRANSFER_FAILED, {id, error: "no tracks found in stream"});
        return;
    }

    // Added for presence
    origStream.getTracks().forEach(track => monitorTrack(track, origStream.id));

    // ToDo: should really ignore streams and just monitor tracks
    origStream.addEventListener('removetrack', async (event) => {
        debug(`${event.track.kind} track removed`);
        await checkActiveStreams();
    });


    // BadConnection simulator
    // the stream used by inject.js is a different object due to context switch; this messed up some services
   /*
    try{
        const modifiedStream = await alterStream(origStream);
        // video.srcObject = new VCHMediaStreamTrack(modifiedStream, origStream);
        debug("Modified video track: ", modifiedStream.getVideoTracks()[0]);
        debug("Modified video track settings: ", modifiedStream.getVideoTracks()[0].getSettings());
        debug("Modified video track constraints: ", modifiedStream.getVideoTracks()[0].getConstraints());
        debug("Modified video track capabilities: ", modifiedStream.getVideoTracks()[0].getCapabilities());


        debug(`new modifiedStream: `, modifiedStream);
        debug(`new modifiedStream tracks: `, modifiedStream.getTracks());
        video.srcObject = modifiedStream;
        debug("added modified stream to video element", video);

        debug("Attached video track: ", video.srcObject.getVideoTracks()[0]);
        debug("Attached video track settings: ", video.srcObject.getVideoTracks()[0].getSettings());
        debug("Attached video track constraints: ", video.srcObject.getVideoTracks()[0].getConstraints());
        debug("Attached video track capabilities: ", video.srcObject.getVideoTracks()[0].getCapabilities());

    }
    catch (err) {
        debug("alterStream error: ", err);
    }
    */

    // instead of the above
    // video.srcObject = origStream;


    // send a message back to inject to remove the temp video element
    await sendMessage('inject', m.STREAM_TRANSFER_COMPLETE, {id});

    // Clean-up the DOM since I don't use this anymore
    document.body.removeChild(video);

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

async function bcsSelfie(data){
    const id = data.id;
    const video = document.querySelector(`video#${id}`);
    const origStream = video.srcObject;

    // ToDo: need to modify the below?
    // await new selfViewElementModifier(origStream);

}

mh.addListener(m.GUM_STREAM_START, gumStreamStart);


mh.addListener(m.PEER_CONNECTION_LOCAL_ADD_TRACK, bcsSelfie);
mh.addListener(m.PEER_CONNECTION_LOCAL_REPLACE_TRACK, bcsSelfie)


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
