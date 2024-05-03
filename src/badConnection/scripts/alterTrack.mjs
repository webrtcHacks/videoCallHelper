// bad connection simulator
// one worker per track for processing and altering

import worker from "!!raw-loader!../../../temp/worker-bundle.js";
import {AlteredMediaStreamTrackGenerator} from "../../modules/AlteredMediaStreamTrackGenerator.mjs";
import {MessageHandler, MESSAGE as m, CONTEXT as c} from "../../modules/messageHandler.mjs";

import {settings} from "./settings.mjs";

// import impairmentWorkerScript from '../../badConnection/scripts/mse-worker.js';
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️😈`);

const mh = new MessageHandler(c.INJECT);

/**
 * Modifies a MediaStreamTrack to simulate a bad connection
 * @param {MediaStreamTrack} track - the track to modify
 * @param {object} settings - the settings for the bad connection simulator
 * @returns {Promise<MediaStreamTrackGenerator>} - a MediaStreamTrackGenerator
 */
export class AlterTrack { // extends MediaStreamTrack {  // Illegal constructor

    generator;
    processor;
    reader;
    writer;
    worker;

    static settings = settings;

    constructor(track, settings) {
        // super();
        AlterTrack.settings = settings;
        /** @type {MediaStreamTrack} */
        this.sourceTrack = track;

        // I should only be processing gUM - check if the track id is a MediaStreamTrackGenerator
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
}

// Learning: I was not able to transfer a modified writer to the worker
// My goal is to wait until something is written to the track before returning the new stream
// it seems there is some typechecking and Chrome doesn't allow an extended object
// I always get the error:
//  DOMException: Failed to execute 'postMessage' on 'Worker': Value at index 1 does not have a transferable type

/**
 * Modifies each track in a MediaStream
 * @param {MediaStream} stream - the stream to modify
 * @returns {MediaStream} - a MediaStream
 */
/** @type {MediaStream} */
export class AlterStream {

    originalTracks;
    originalStream;
    constructor(stream)
    {
        this.originalStream = stream;
        this.originalTracks = stream.getTracks();
        this.tracks = [];
        const bcsSettings = {
            enabled: true,
            active: false,
            level: "passthrough"
        }

        return Promise.all(this.originalTracks.map(async (track) => {
            const alteredTrack = await new AlterTrack(track, {bcsSettings} );
            this.tracks.push(alteredTrack);
        })).then(() => {
            this.alteredStream = new MediaStream(this.tracks);
            return this.alteredStream
        });
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
