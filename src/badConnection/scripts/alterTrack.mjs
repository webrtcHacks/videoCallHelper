// bad connection simulator
// one worker per track for processing and altering

import worker from "!!raw-loader!../../../temp/worker-bundle.js";
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";

// import impairmentWorkerScript from '../../badConnection/scripts/worker.js';
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️😈`);

const mh = new MessageHandler('inject'); //, debug);

export class AlterTrack { // extends MediaStreamTrack {  // Illegal constructor

    generator;
    processor;
    reader;
    writer;
    worker;

    static settings = {
        enabled: false,
        level: "passthrough",
        active: false,
    }

    constructor(track, settings) {
        // super();
        AlterTrack.settings = settings;
        /** @type {MediaStreamTrack} */
        this.sourceTrack = track;

        // I should only be processing gUM - check if the track id sa MediaStreamTrackGenerator
        if (track instanceof MediaStreamTrackGenerator) {
            debug("track is MediaStreamTrackGenerator");
            return track;
        }

        /** type {MediaStreamTrackGenerator} */
        const generator = new AlteredMediaStreamTrackGenerator({kind: track.kind}, track);

        this.#startWorker(generator).then((generator) => {
            debug(`generator started on worker ${this.worker.name}`, generator);
            this.generator = generator;
        });

        // the generator is not ready yet but that doesn't seem to matter
        return generator;

    }

    #startWorker(generator) {
        return new Promise((resolve, reject) => {

            this.processor = new MediaStreamTrackProcessor(this.sourceTrack);
            this.reader = this.processor.readable;

            this.writer = generator.writable;

            // debug("alteredMediaStreamTrackGenerator video track: ", generator);
            // debug("alteredMediaStreamTrackGenerator video track settings: ", generator.getSettings());
            // debug("alteredMediaStreamTrackGenerator video track constraints: ", generator.getConstraints());
            // debug("alteredMediaStreamTrackGenerator video track capabilities: ", generator.getCapabilities());


            const workerName = `vch-bcs-${this.sourceTrack.kind}-${this.sourceTrack.id.substr(0, 5)}`;

            if (window.trustedTypes && trustedTypes.createPolicy) {
                const policy = trustedTypes.createPolicy('my-policy', {
                    createScriptURL: (url) => url,
                });
                const workerBlobURL = URL.createObjectURL(
                    new Blob([worker], {type: 'application/javascript'})
                );
                this.worker = new Worker(policy.createScriptURL(workerBlobURL), {name: workerName});
            } else {
                const workerBlobURL = URL.createObjectURL(new Blob([worker], {type: 'application/javascript'}));
                this.worker = new Worker(workerBlobURL, {name: workerName});
            }

            if (!this.worker) {
                const error = new Error("Failed to create worker");
                debug(error);
                reject(error);
            }
            this.worker.name = workerName;


            const trackDone = () => {
                this.worker.postMessage({command: "stop"});  // clean-up resources?

                // terminate the worker after 500ms to give it time to clean-up resources (should this be a worker event listener?)
                setTimeout(() => {
                    this.worker.terminate();
                }, 500);

                generator.stop();
                this.sourceTrack.stop();
            }

            this.sourceTrack.addEventListener('mute', () => {
                debug(`track ${this.sourceTrack.id} muted, pausing worker ${this.worker.name}`)
                this.generator.enabled = false;
                this.worker.postMessage({command: "pause"});
            });

            this.sourceTrack.addEventListener('unmute', () => {
                debug(`track ${this.sourceTrack.id} unmuted, unpausing worker ${this.worker.name}`)
                // ToDo: state management
                this.worker.postMessage({command: "unpause"});
                this.generator.enabled = true;
            });

            // Remember this only works when the track is ended not by the user
            this.sourceTrack.addEventListener('ended', () => {
                debug(`track ${this.sourceTrack.id} ended event, stopping worker ${this.worker.name}`);
                trackDone();
            });

            generator.addEventListener('ended', () => {
                debug(`track ${this.sourceTrack.id} ended event, stopping worker ${this.worker.name}`);
                trackDone();
            });

            // do I really need a 2nd listener to communicate with the worker?
            mh.addListener(m.UPDATE_BAD_CONNECTION_SETTINGS, async (newSettings) => {
                debug("badConnection changed to: ", newSettings);
                this.worker.postMessage({command: newSettings.level});
                AlterTrack.settings = newSettings;

                /*
                if (newSettings.enabled === false) {
                    worker.postMessage({command: "passthrough"});
                }
                if (newSettings.level)
                    worker.postMessage({command: newSettings.level});
                 */
            });


            this.worker.onmessage = async (e) => {
                // debug("worker message: ", e.data);
                if (e.data?.response === "started") {
                    resolve(generator);
                } else if (e.data?.response === "error") {
                    if (this.sourceTrack.muted && this.sourceTrack.readyState === "live")
                        debug(`track ${this.sourceTrack.id} is muted, ignoring worker ${this.worker.name} error: `, e.data.error)
                    else {
                        debug(`terminating worker ${this.worker.name}. worker error: `, e.data.error);
                        trackDone();

                        // ToDo: better track status mechanism?
                        // see if there are other tracks still running and update the gUI
                        // await checkGeneratorStreams();

                        reject(e.data.error);
                    }
                } else {
                    // reject("Unknown error");
                    debug("Unknown message", e.data)
                }
            };

            this.worker.postMessage({
                command: "setup",
                reader: this.reader,
                writer: this.writer,
                id: this.sourceTrack.id,
                kind: this.sourceTrack.kind,
                settings: this.sourceTrack.getSettings(),
                impairmentState: AlterTrack.settings.level,
            }, [this.reader, this.writer]);

        }).catch((err) => {
            debug("Error in alterTrack: ", err);
        });
    }

    /*
    // ToDo: start a new worker and generator
    clone() {

        const newGenerator = new alteredMediaStreamTrackGenerator({kind: track.kind}, track);

        this.#startWorker(newGenerator).then((generator) => {
            debug(`generator started on worker ${this.worker.name}`, generator);
            this.clones.push(generator);
        });

        return newGenerator;

    }

     */

}

// Learning: I was not able to transfer a modified writer to the worker
// My goal is to wait until something is written to the track before returning the new stream
// it seems there is some typechecking and Chrome doesn't allow an extended object
// I always get the error:
//  DOMException: Failed to execute 'postMessage' on 'Worker': Value at index 1 does not have a transferable type

class AlteredMediaStreamTrackGenerator extends MediaStreamTrackGenerator {

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

        /*
        // Make sure all generated tracks have a see if AlterMediaStreamTrackGenerator.tracks has a track with the same id
        if (AlteredMediaStreamTrackGenerator.generators.length > 0) {
            const lastId = AlteredMediaStreamTrackGenerator.generators[AlteredMediaStreamTrackGenerator.generators.length - 1].id;
            const lastNum = lastId.match(/vch-.*-([0-9]{1,2})/)[0] || 0;
            this.deviceId = `vch-${this.kind}-${parseInt(lastNum) + 1}`;
        } else {
            this.deviceId = `vch-${this.kind}`;
        }
         */

        this.options = options;
        this._label = sourceTrack.label;

        this._settings = sourceTrack.getSettings();
        this._settings.deviceId = `vch-${this.kind}`;
        this._settings.groupId = 'video-call-helper';

        this._constraints = sourceTrack.getConstraints();
        this._constraints.deviceId = `vch-${this.kind}`;

        this._capabilities = sourceTrack.getCapabilities();
        this._capabilities.deviceId = `vch-${this.kind}`;
        this._capabilities.groupId = 'video-call-helper';

        this.sourceTrack = sourceTrack;
        this.track = track;

        return track;

    }

    // Getters
    get label() {
        return this._label;
    }

    get contentHint() {
        // return this._contentHint;
        return super.contentHint
    }

    get enabled() {
        // return this._enabled;
        return super.enabled;
    }

    get muted() {
        return super.muted;
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
        super.enabled = enabled;
        return enabled
    }

    // Methods
    async applyConstraints(constraints) {
        debug(`applyConstraints on ${this.kind} track ${this.id}`, constraints)
        this.sourceTrack.applyConstraints(constraints)
            .then(() => {
                this._settings = this.sourceTrack.getSettings();
                this._settings.deviceId = `vch-${this.kind}`;
                this._settings.groupId = 'video-call-helper';

                this._constraints = this.sourceTrack.getConstraints();
                this._constraints.deviceId = `vch-${this.kind}`;

                debug(`new settings on ${this.kind} track ${this.id}`, this._settings)

            })
            .catch((err) => err);

    }

    clone() {

        /*
        // Failed tests and learnings:

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

        // alterTrack.mjs:202 Uncaught DOMException: Failed to execute 'structuredClone' on 'Window': Value at index 0 does not have a transferable type.
        // const cloneTrack = structuredClone(this, {transfer: [this.track, this.writable]});

        // These don't write
        // const cloneTrack = super.clone();
        // cloneTrack.capabilities = this.capabilities;
        // cloneTrack.constraints = this.constraints;

        // const cloneTrack = new alteredMediaStreamTrackGenerator(this.options, this.sourceTrack.clone());
        // cloneTrack.writable = this.writable;
        // alterTrack(cloneTrack.track).catch((err) => debug("alterTrack error", err));

         */

        const clone = this.sourceTrack.clone();
        const generator = new AlterTrack(clone, AlterTrack.settings);
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
        debug(`getSettings on ${this.kind} track ${this.id}`, this._settings);
        return this._settings;
    }

    stop() {
        debug(`stopping track source track ${this.label}`);
        this.sourceTrack.stop();
        // emit an ended event
        // this.dispatchEvent(new Event('ended'));
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

/* Pseudo-code*/

// ToDo: need to make this all a class so I can expose this.worker
async function changeInputTrack(track) {
    const processor = new MediaStreamTrackProcessor(track);
    const reader = processor.readable;

    // No kind checking
    worker.postMessage({command: "changeInputTrack", track, settings: track.getSettings()}, [reader]);
}

// Sets the GUI to active=false if there are no generated streams
async function checkGeneratorStreams() {
    // ToDo: do better than use window below
    const active = window.newStreams.find(stream => stream.active);
    if (active === undefined)
        // await storage.update('badConnection', {active: false});
        settings.active = false;
}

/*
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
        window.newStreams.push(newStream);
        settings.active = true;
        mh.sendMessage("content", m.UPDATE_BAD_CONNECTION_SETTINGS, settings);
        return newStream;
    } else {
        debug("alterStream error, returning original stream. No active tracks", newStream, newStream.getTracks());
        return stream;
    }

}
*/

// ToDo: need a way to replace an altered track
// ToDo: mute / unmute not working - I think I fixed that in the alteredMediaStreamTrackGenerator, need to verify
export function alterTrack(track) {

    if (!settings.enabled) {
        debug("Bad connection simulator not enabled - disabling");
        return track;
    }

    // ToDo: make this work with a Generated Tracks too
    //  - but I should only be grabbing gUM streams and wny would they be generated?
    // Check if the track id sa MediaStreamTrackGenerator
    if (track instanceof MediaStreamTrackGenerator) {
        debug("track is MediaStreamTrackGenerator");
        return track;
    }

    /*
    // ToDo: gMeet audio self mute debugging
    //  The below works for muting, but doesn't send any audio
    if(track.kind === "audio") {
        // const generator = new MediaStreamTrackGenerator({kind: track.kind});
        const generator = new alteredMediaStreamTrackGenerator({kind: track.kind}, track);
        const writer = generator.writable;

        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable;

        // Needed to add a delay here to avoid the following error:
        //  vch 💉️😈 DEBUG: Insertable stream error DOMException: Failed to execute 'write' on 'UnderlyingSinkBase': Stream closed
        setTimeout(() => {
            reader
                .pipeTo(writer)
                .catch(async err => {
                    debug(`DEBUG: Insertable stream error`, err);
                });
        }, 200);

        return
    }
     */

    // Don't process audio for google meet- it had some issue
    // ToDo: process audio for Google Meet
    if (track.kind === "audio" && window.location.host.includes("google")) {
        debug("alterTrack: google meet audio track, returning original track");
        return track;
    }

    // I used to return the promise which would only resolve after a couple of frames to make sure
    // the track was working. That doesn't work for the clone() method that needs an immediate response
    // so I return the generator and let the generator start when it starts

    const generator = new AlteredMediaStreamTrackGenerator({kind: track.kind}, track, isFakeDevice);

    // keep the promise here in case I need to send a notification on resolve
    new Promise((resolve, reject) => {

        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable;

        const writer = generator.writable;

        // debug("alteredMediaStreamTrackGenerator video track: ", generator);
        // debug("alteredMediaStreamTrackGenerator video track settings: ", generator.getSettings());
        // debug("alteredMediaStreamTrackGenerator video track constraints: ", generator.getConstraints());
        // debug("alteredMediaStreamTrackGenerator video track capabilities: ", generator.getCapabilities());


        // const workerBlobURL = URL.createObjectURL(new Blob([impairmentWorkerScript], {type: 'application/javascript'}));
        const workerName = `vch-bcs-${track.kind}-${track.id.substr(0, 5)}`;
        // const worker = new Worker(workerBlobURL, {name: workerName});

        let worker;
        if (window.trustedTypes && trustedTypes.createPolicy) {
            const policy = trustedTypes.createPolicy('my-policy', {
                createScriptURL: (url) => url,
            });
            const workerBlobURL = URL.createObjectURL(
                new Blob([worker], {type: 'application/javascript'})
            );
            worker = new Worker(policy.createScriptURL(workerBlobURL), {
                name: workerName,
            });
        } else {
            const workerBlobURL = URL.createObjectURL(new Blob([worker], {type: 'application/javascript'}));
            worker = new Worker(workerBlobURL, {name: workerName});
        }

        if (!worker) {
            const error = new Error("Failed to create worker");
            debug(error);
            reject(error);
        }
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
            worker.postMessage({command: newSettings.level});

            /*
            if (newSettings.enabled === false) {
                worker.postMessage({command: "passthrough"});
            }
            if (newSettings.level)
                worker.postMessage({command: newSettings.level});
             */
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

                    // ToDo: better track status mechanism?
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

    alteredTracks.push(generator);
    return generator;

}
