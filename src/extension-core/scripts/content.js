import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
import {grabFrames} from "../../imageCapture/scripts/content-grabFrames.mjs";
import {selfViewElementModifier} from "../../selfView/scripts/content-selfView.mjs";
// import { CorsWorker as Worker } from '../../modules/cors-worker';
import workerScript from '../../badConnection/scripts/impairment.worker.js';

const streams = [];
let trackInfos = [];


window.vchStreams = streams;

const debug = function () {
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
        state: readyState,
        streamId
    }

    if (track.readyState === 'live') // remove !track.muted &&  since no mute state handing yet
        await sendMessage('background', m.NEW_TRACK, trackData);

    // Note: this only fires if the browser forces the track to stop; not for most user actions
    track.addEventListener('ended', async (e) => {
        trackData.state = 'ended';
        await sendMessage('background', m.TRACK_ENDED, trackData);
    });

    // use an interval to check if the track has ended
    const monitor = setInterval(async () => {
        if (track.readyState === 'ended') {
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

window.newStreams = [];

// bad connection simulator
async function alterStream(stream) {

    class FrameCountWritableStream extends WritableStream {
        constructor(writer) {
            super({
                write: chunk => {
                    writer.frameCount++;
                    return writer.write(chunk);
                },
                abort: () => writer.abort(),
                close: () => writer.close(),
            });
            this._writer = writer;
            this._writer.frameCount = 0;
        }

        get frameCount() {
            return this._writer.frameCount;
        }
    }

    // Learning: I was not able to transfer a modified writer to the worker
    // My goal is to wait until something is written to the track before returning the new stream
    // it seems there is some typechecking and Chrome doesn't allow an extended object
    // I always get the error:
    //  DOMException: Failed to execute 'postMessage' on 'Worker': Value at index 1 does not have a transferable type
    // ToDo: see if I can extend the writer in the worker and have that message back here

    class alteredMediaStreamTrackGenerator extends MediaStreamTrackGenerator {
        constructor(options, track) {
            super(options);
            this._label = track.label;
            this._contentHint = track.contentHint;
            this._enabled = track.enabled || true;
        }

        get label() {
            return this._label;
        }

        get contentHint() {
            return this._contentHint;
        }

        get enabled() {
            return this._enabled;
        }

        /*
        get writable() {
            const writer = super.writable;
            const frameCount = { count: 0 };
            const writableStream = new WritableStream({
                write: (chunk) => {
                    frameCount.count++;
                    return writer.write(chunk);
                },
                abort: (reason) => writer.abort(reason),
                close: () => writer.close(),
            });
            const transferable = [writableStream];
            Object.defineProperty(transferable, 'frameCount', {
                get: () => frameCount.count,
                enumerable: true,
            });
            return transferable;
        }

        async waitForFrame() {
            if(this.frameCount > 0)
                return;

            while (this.frameCount === 0) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

         */
    }

    const newStream = new MediaStream();
    const tracks = stream.getTracks();

    // ToDo: need to close the worker when the stream is closed

    await Promise.all(tracks.map(async (track) => {

        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable;

        const generator = new alteredMediaStreamTrackGenerator({kind: track.kind}, track);
        const writer = generator.writable;

        track.addEventListener('mute', () => {
            generator.enabled = false;
        });

        track.addEventListener('unmute', () => {
            generator.enabled = true;
        });

        track.addEventListener('ended', () => {
            generator.stop()
        });

        newStream.addTrack(generator);

        debug(`generator track state before worker ${generator.readyState}`, generator);

        const workerBlobURL = URL.createObjectURL(new Blob([workerScript], {type: 'application/javascript'}));
        const worker = new Worker(workerBlobURL, {name: `vch-bcs-${track.kind}-${track.id.substr(0, 5)}`});

        // wait for the streams pipeline to be setup -
        //  this is a hack to wait for the first frame to be written to the track
        //  this caused problems in some services
        await new Promise((resolve, reject) => {

            worker.onmessage = (e) => {
                debug("worker message: ", e.data);
                if (e.data?.response === "started") {
                    resolve();
                } else if (e.data?.response === "error") {
                    worker.terminate()
                    reject(e.data.error);
                } else {
                    // reject("Unknown error");
                    debug("Unknown message", e.data)
                }
            };

            worker.postMessage({
                command: "setup",
                reader,
                writer,
                id: track.id,
                kind: track.kind,
                settings: track.getSettings(),
                impairmentState: "passthrough"
            }, [reader, writer]);


        });

        // ToDo: handlers for UI changes
        //  - Severe
        //  - Moderate
        //  - PassThrough

    }))
        .catch(err => {
            debug("alterStream error, returning original stream. Error: ", err);
            return stream;
        });

    window.newStreams.push(newStream);

    // Do I need to make sure these work?
    if (newStream.getTracks().filter(track => track.readyState === 'live').length > 0)
        return newStream;
    else {
        debug("alterStream error, returning original stream. No active tracks", newStream, newStream.getTracks());
        return stream;
    }

}

// ToDo: count errors back from the worker - cancel modification attempts if too many

async function gumStreamStart(data) {
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
        if (origStream.getTracks().length === 0) {
            await sendMessage('all', m.GUM_STREAM_STOP);
        }
    });

    // swap in a new stream for testing
    // const moddedStream = await alterStream(stream);
    // window.moddedStream = moddedStream;

    //const modifiedStream = new MediaStream(video.srcObject.getTracks());
    if (video.srcObject.getTracks().length > 0) {
        const modifiedStream = await alterStream(video.srcObject);
        debug(`new modifiedStream: `, modifiedStream);
        debug(`new modifiedStream tracks: `, modifiedStream.getTracks());
        video.srcObject = modifiedStream;
    } else
        debug("modifiedStream has no video tracks", video.srcObject);

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
// debug("inject injected");
