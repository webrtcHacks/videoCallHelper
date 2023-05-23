// bad connection simulator
// one worker per track for processing and altering

import impairmentWorkerScript from "./impairment.worker.js";
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";

// import impairmentWorkerScript from '../../badConnection/scripts/impairment.worker.js';
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️😈`);

// import {StorageHandler} from "../../modules/storageHandler.mjs";
// let storage = await new StorageHandler("local", debug);

/************ START get settings ************/

const mh = new MessageHandler('inject', debug);
const sendMessage = mh.sendMessage;
const addListener = mh.addListener;
const removeListener = mh.removeListener;

// for reference
let settings = {
    enabled: true,
    active: false,
    level: "passthrough"
}
/*
const storage = {
    contents: {
        badConnection: {
            enabled: true,
            active: false,
            level: "passthrough"
        }
    }
}
 */

mh.addListener(m.UPDATE_BAD_CONNECTION_SETTINGS, (data) => {
    debug("got new settings", data)
    settings = data;
});
mh.sendMessage('content', m.GET_BAD_CONNECTION_SETTINGS);

/************ END get settings  ************/

window.newStreams = [];

// For debugging - can be removed
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


class cloneMediaStreamTrackGenerator extends MediaStreamTrackGenerator {
    constructor(options, source) {
        super(options);
        this._writer = source.writer;

        debug("cloneMediaStreamTrackGenerator cloning track: ", source);
    }

    get writer() {
        return this._writer;
    }

    get id() {
        return "vchclone-d5d3-4bd8-9e26-be45e07de236"
    }
}

// Learning: I was not able to transfer a modified writer to the worker
// My goal is to wait until something is written to the track before returning the new stream
// it seems there is some typechecking and Chrome doesn't allow an extended object
// I always get the error:
//  DOMException: Failed to execute 'postMessage' on 'Worker': Value at index 1 does not have a transferable type
// ToDo: see if I can extend the writer in the worker and have that message back here

class alteredMediaStreamTrackGenerator extends MediaStreamTrackGenerator {

    /*
    // MediaStreamTrack
    contentHint: ""
    enabled: true
    id: "74f2ebf6-1018-4e3e-8c3e-b6fa1c073e03"
    kind: "video"
    label: "FaceTime HD Camera (3A71:F4B5)"
    muted: false
    oncapturehandlechange: null
    onended: null
    onmute: null
    onunmute: null
    readyState: "live"
     */

    constructor(options, sourceTrack) {
        const track = super(options);

        this.options = options;
        this._label = sourceTrack.label;
        this._contentHint = sourceTrack.contentHint;
        this._enabled = sourceTrack.enabled || true;
        this._muted = sourceTrack.muted;

        this._settings = sourceTrack.getSettings();
        this._constraints = sourceTrack.getConstraints();
        this._capabilities = sourceTrack.getCapabilities();

        this.sourceTrack = sourceTrack;
        this.track = track;
    }

    // Getters
    get label() {
        return this._label;
    }

    get contentHint() {
        return this._contentHint;
    }

    get enabled() {
        return this._enabled;
    }

    get writable() {
        // debug("get writable", this._writable, super.writable)
        if (this._writable === undefined)
            return super.writable
        else
            return this._writable
    }

    // Setters
    set writable(writable) {
        this._writable = writable;
        debug("set writable", this._writable);
    }


    set enabled(enabled) {
        this._enabled = enabled;
        this._muted = enabled;  // ToDo: check the spec for function here
        return this._enabled;
    }


    // Methods
    async applyConstraints(constraints) {
        // ToDo:
        debug(`applyConstraints on ${this.kind} track ${this.id}`, constraints)
        this.sourceTrack.applyConstraints(constraints)
            .then(() => {
                this._settings = this.sourceTrack.getSettings();
                this._constraints = this.sourceTrack.getConstraints();
                debug(`new settings on ${this.kind} track ${this.id}`, this._settings)

            })
            .catch((err) => err);

    }

    clone() {

        // Failed tests and learnings
        /*
        // clone is stripped of all its properties - might need to live with that unless I start a new generator
        // const clone =  this.sourceTrack.clone();

        // Doesn't work - needs to return something other than a promise
        // const cloneTrack = await alterTrack(this.track);

        // This works, but doesn't include capabilities or constraints
        // const cloneTrack = super.clone();

        // Uncaught TypeError: Converting circular structure to JSON

        // const cloneTrack = JSON.parse(JSON.stringify(this));
        // cloneTrack.writer = this.writer;
        // cloneTrack.id = "vch-someRandomId";
        // cloneTrack.track = this.track;

        // uncaught DOMException: Failed to execute 'structuredClone' on 'Window': MediaStreamTrackGenerator object could not be cloned.
        // const cloneTrack = structuredClone(this);

        // alterStream.mjs:202 Uncaught DOMException: Failed to execute 'structuredClone' on 'Window': Value at index 0 does not have a transferable type.
        // const cloneTrack = structuredClone(this, {transfer: [this.track, this.writable]});

        // These don't write
        // const cloneTrack = super.clone();
        // cloneTrack.capabilities = this.capabilities;
        // cloneTrack.constraints = this.constraints;

         */

        // const cloneTrack = new alteredMediaStreamTrackGenerator(this.options, this.sourceTrack.clone());
        // cloneTrack.writable = this.writable;
        // alterTrack(cloneTrack.track).catch((err) => debug("alterTrack error", err));

        /*
        const clonedSourceTrack = this.sourceTrack.clone();
        const processor = new MediaStreamTrackProcessor(clonedSourceTrack);
        const reader = processor.readable;

        const generator = new alteredMediaStreamTrackGenerator({kind: clonedSourceTrack.kind}, clonedSourceTrack);
        const writer = generator.writable;

        new Promise(async (resolve, reject) => {
            let frameCounter = 0;
            await reader
                .pipeThrough(new TransformStream({
                    start: controller => {
                        debug("transform stream started", controller);
                    },
                    transform: async (frame, controller) => {
                        frameCounter++;
                        if (frameCounter % 100 === 0)
                            debug(`transforming frame ${frameCounter}`);
                        controller.enqueue(frame);
                    },
                }))
                .pipeTo(writer)
                .catch(async err => {
                    debug(`Insertable stream error`, err);
                });
        }).catch((err) => debug("clone error", err));

         */

        const generator = alterTrack(this.track);

        debug("clone track", generator);
        return generator;
    }

    getCapabilities() {
        debug(`getCapabilities on ${this.kind} track ${this.id}`, this._capabilities);
        return this._capabilities;
    }

    getConstraints() {
        debug(`getConstraints on ${this.kind} track ${this.id}`, this._constraints);
        return this._constraints;
    }

    getSettings() {
        // debug(`getSettings on ${this.kind} track ${this.id}`, this._settings);
        return this._settings;
    }

    stop() {
        debug(`stopping track source track ${this.label}`);
        this.sourceTrack.stop();
    }

    // From chatGPT:
    // To make the ModifiedMediaStreamTrack object itself usable as a srcObject for a video element,
    // we've implemented the Symbol.toPrimitive method. This method allows the object to be converted to a
    // primitive value when needed, such as when setting a video element's srcObject property. In this case,
    // we've implemented the method to return the original MediaStreamTrack object by default or as a string,
    // and to return null for any other hint. With this implementation, you can use the ModifiedMediaStreamTrack
    // object itself as the srcObject for a video element, like so: videoElement.srcObject = modifiedTrack;.
    [Symbol.toPrimitive](hint) {
        if (hint === 'default' || hint === 'string') {
            return this.target;
        }
        return null;
    }

}

function alterTrack(track) {

    // wait for the streams pipeline to be setup -
    //  this is a hack to wait for the first frame to be written to the track
    //  this caused problems in some services

    const generator = new alteredMediaStreamTrackGenerator({kind: track.kind}, track);


    new Promise((resolve, reject) => {

        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable;

        const writer = generator.writable;

        // debug("alteredMediaStreamTrackGenerator video track: ", generator);
        // debug("alteredMediaStreamTrackGenerator video track settings: ", generator.getSettings());
        // debug("alteredMediaStreamTrackGenerator video track constraints: ", generator.getConstraints());
        // debug("alteredMediaStreamTrackGenerator video track capabilities: ", generator.getCapabilities());

        // debug(`generator track state before worker ${generator.readyState}`, generator);

        const workerBlobURL = URL.createObjectURL(new Blob([impairmentWorkerScript], {type: 'application/javascript'}));
        const workerName = `vch-bcs-${track.kind}-${track.id.substr(0, 5)}`;
        const worker = new Worker(workerBlobURL, {name: workerName});
        worker.name = workerName;

        function trackDone() {
            worker.postMessage({command: "stop"});  // clean-up resources?
            generator.stop();
            worker.terminate();
            track.stop();
        }

        track.addEventListener('mute', () => {
            debug(`track ${track.id} muted, pausing worker ${worker.name}`)
            generator.enabled = false;
            worker.postMessage({command: "pause"});
        });

        track.addEventListener('unmute', () => {
            debug(`track ${track.id} unmuted, unpausing worker ${worker.name}`)
            // ToDo: state management
            worker.postMessage({command: "unpause"});
            generator.enabled = true;
        });

        // Remember this only works when the track is ended not by the user
        track.addEventListener('ended', () => {
            debug(`track ${track.id} ended event, stopping worker ${worker.name}`);
            trackDone();
        });

        // do I really need a 2nd listener to communicate with the worker?
        mh.addListener(m.UPDATE_BAD_CONNECTION_SETTINGS, async (newSettings) => {
            debug("badConnection changed to: ", newSettings);
            if (newSettings.enabled === false) {
                worker.postMessage({command: "passthrough"});
            }
            if (newSettings.level)
                worker.postMessage({command: newSettings.level});
        });


        worker.onmessage = async (e) => {
            // debug("worker message: ", e.data);
            if (e.data?.response === "started") {
                resolve(generator);
            } else if (e.data?.response === "error") {
                if (track.muted && track.readyState === "live")
                    debug(`track ${track.id} is muted, ignoring worker ${worker.name} error: `, e.data.error)
                else {
                    debug(`terminating worker ${worker.name}. worker error: `, e.data.error);
                    trackDone();

                    // see if there are other tracks still running and update the gUI
                    await checkGeneratorStreams();

                    reject(e.data.error);
                }
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
            impairmentState: settings.level,
        }, [reader, writer]);

    }).catch((err) => {
        debug("Error in alterTrack: ", err);
    });

    return generator;

}

// Sets the GUI to active=false if there are no generated streams
async function checkGeneratorStreams() {
    // ToDo: do better than use window below
    const active = window.newStreams.find(stream => stream.active);
    if (active === undefined)
        // await storage.update('badConnection', {active: false});
        settings.active = false;
}

// returns a promise that resolves to a MediaStreamTrackGenerator
export async function alterStream(stream) {

    if (!settings.enabled) {
        return new Error("Bad connection is not enabled");
    }

    const tracks = stream.getTracks();

    // ToDo: need to close the worker when the stream is closed

    const alteredTracks = tracks.map((track) => {
        const alteredTrack = alterTrack(track);

        debug("alteredTrack: ", alteredTrack);
        // debug("alteredTrack settings: ", alteredTrack.getSettings());
        // debug("alteredTrack constraints: ", alteredTrack.getConstraints());
        // debug("alteredTrack capabilities: ", alteredTrack.getCapabilities());
        return alteredTrack;
    });

    const newStream = new MediaStream(alteredTracks);

    // Do I need to make sure these work?
    if (newStream.getTracks().filter(track => track.readyState === 'live').length > 0) {
        window.newStreams.push(newStream);      // ToDo: for debugging
        // await storage.update('badConnection', {active: true});
        settings.active = true;
        mh.sendMessage("content", m.UPDATE_BAD_CONNECTION_SETTINGS, settings);
        return newStream;
    } else {
        debug("alterStream error, returning original stream. No active tracks", newStream, newStream.getTracks());
        return stream;
    }

}
