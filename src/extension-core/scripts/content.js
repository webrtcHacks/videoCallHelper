import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {grabFrames} from "../../imageCapture/scripts/content-grabFrames.mjs";
import {selfViewElementModifier} from "../../selfView/scripts/content-selfView.mjs";
// import { CorsWorker as Worker } from '../../modules/cors-worker';
import workerScript from '../../badConnection/scripts/impairment.worker.js';

const streams = [];
let trackInfos = [];


window.vchStreams = streams;

const debug = function() {
    return Function.prototype.bind.call(console.debug, console, `vch 🕵️‍ `);
}();

debug(`content.js loaded on ${window.location.href}`);
// debug('content.js URL: ', chrome.runtime.getURL('content.js'));

const mh = new MessageHandler('content', debug);
const sendMessage = mh.sendMessage;
// await sendMessage('all', 'hello there', {foo: 'bar'});

const storage = await chrome.storage.local.get();
await debug("storage contents:", storage);

const dashHeight = 180;
const dashStyle = `position:fixed;top:0;left:0;width:100%;height:${dashHeight}px;z-index:1000;transition:{height:500, ease: 0}; opacity:97%; border-color: black`;

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

// Won't load - origin policy issues
// background.js needs to be the worker????
// const workerJsPath = chrome.runtime.getURL('/scripts/impairment.worker.js');
// const worker = new Worker(workerJsPath, {name: 'Stream worker'});

// Webpack 5 method didn't work
//const worker = new Worker(new URL('impairment.worker.js', import.meta.url));

// Either getting publicPath issues or is trying to load the file from the host server
// aliasing CorsWorker to Worker makes it statically analyzable
// const corsWorker = new Worker(new URL('src_extension-core_scripts_content-impairmentWorker_js.js', import.meta.url));
// const worker = corsWorker.getWorker();

// Define the worker code as a string
const workerCode = `
    self.onmessage = function(e) {
        // Do something with the data received from the main thread
        const data = e.data;
        console.debug('Worker received data:', data);

        // Send a message back to the main thread
        self.postMessage('Hello from worker!');
    }
`;

// This works
/*
// Create a blob from the worker code string
const blob = new Blob([workerCode], { type: 'application/javascript' });
// Create a URL for the blob
const blobURL = URL.createObjectURL(blob);
const worker = new Worker(blobURL);
worker.postMessage('Hello from main thread!');
 */

const workerBlobURL = URL.createObjectURL(new Blob([workerScript], { type: 'application/javascript' }));
const worker = new Worker(workerBlobURL);
// worker.postMessage('hello');
// workerBlobURL.revokeObjectURL();

async function alterStream(stream){

    let videoGenerator, audioGenerator;
    // let videoTrackProcessor, audioTrackProcessor;
    // let videoReader, audioReader;
    let streams = {};

    // Insertable Stream
    const [videoTrack] = stream.getVideoTracks();
    const [audioTrack] = stream.getAudioTracks();   // ToDo: handle multiple audio tracks?

    // Tracks for modified audio and video
    if(videoTrack){
        videoGenerator = new MediaStreamTrackGenerator({kind: 'video'});
        const videoWriter = videoGenerator.writable;
        const videoTrackProcessor = new MediaStreamTrackProcessor(videoTrack);
        const videoReader = videoTrackProcessor.readable;

        // streams.videoWriter = videoWriter;
        // streams.videoReader = videoReader;


        worker.postMessage({
            operation: 'video',
            videoReader,
            videoWriter,
        }, [videoReader, videoWriter]);
    }

    if(audioTrack){
        audioGenerator = new MediaStreamTrackGenerator({kind: 'audio'});
        const audioWriter = audioGenerator.writable;
        const audioTrackProcessor = new MediaStreamTrackProcessor(audioTrack);
        const audioReader = audioTrackProcessor.readable;

        // streams.audioWriter = audioWriter;
        // streams.audioReader = audioReader;

        // Audio
        worker.postMessage({
            operation: 'audio',
            audioReader,
            audioWriter,
        }, [audioReader, audioWriter]);
    }

    /*
    debug("alterStream data: ", streams);
    mh.sendMessage('background', 'alter_stream', {streams} );
    debug("alterStream video read: ", await streams.videoReader.getReader().read());
     */

    if(videoTrack && audioTrack){
        return new MediaStream([videoGenerator, audioGenerator]);
    }
    else if(videoTrack){
        return new MediaStream([videoGenerator]);
    }
    else if(audioTrack){
        return new MediaStream([audioGenerator]);
    }

    // const moddedStream = new MediaStream([videoGenerator, audioGenerator]);

}
// bad connection simulator
async function gumStreamStart(data){
    const id = data.id;
    const video = document.querySelector(`video#${id}`);
    const origStream = video.srcObject;
    streams.push(origStream);
    debug("current streams", streams);

    // Added for presence
    origStream.getTracks().forEach(track => monitorTrack(track, origStream.id));

    // ToDo: should really ignore streams and just monitor tracks
    origStream.addEventListener('removetrack', async (event) => {
        debug(`${event.track.kind} track removed`);
        if(origStream.getTracks().length === 0){
            await sendMessage('all', m.GUM_STREAM_STOP);
        }
    });

    // swap in a new stream for testing
    // const moddedStream = await alterStream(stream);
    // window.moddedStream = moddedStream;
    const modifiedStream = new MediaStream(video.srcObject.getTracks());
    if(video.srcObject.getVideoTracks().length > 0)
        video.srcObject = modifiedStream;
    else
        debug("modifiedStream has no video tracks", video.srcObject, modifiedStream);

    // send a message back to inject to remove the temp video element
    await sendMessage('inject', m.STREAM_TRANSFER_COMPLETE, {id});

    // Todo: do I need a registry of applet functions to run here?
    // image capture
    grabFrames(origStream);

    // self-view
    await new selfViewElementModifier(origStream);


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
