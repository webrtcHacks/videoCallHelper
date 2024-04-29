// noinspection DuplicatedCode

import worker from "!!raw-loader!../../temp/worker-bundle.js";
import {MessageHandler, WorkerMessageHandler, MESSAGE as m, CONTEXT as c} from "./messageHandler.mjs";
import {AlteredMediaStreamTrackGenerator} from "../badConnection/scripts/alterTrack.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️😈`);
const mh = new MessageHandler(c.INJECT);

export class InsertableStreamsManager{
    generator;
    processor;
    reader;
    writer;
    worker;

    /**
     * Modifies a MediaStreamTrack to simulate a bad connection
     * @param {MediaStreamTrack} track - the track to modify
     * @returns {MediaStreamTrackProcessor, MediaStreamTrackGenerator} - the processor and generator for the track
     */
    constructor(track) {
        this.sourceTrack = track;
        let generator;

        /** @type {MediaStreamTrackProcessor}*/
        const processor = new MediaStreamTrackProcessor(track);
        this.processor = processor;
        this.reader = this.processor.readable;

        // I should only be processing gUM - check if the track id is a MediaStreamTrackGenerator
        if (track instanceof MediaStreamTrackGenerator) {
            debug("Unexpected track type - track is MediaStreamTrackGenerator", track);
            this.generator = false;
        } else {
            generator = new AlteredMediaStreamTrackGenerator({kind: track.kind}, track);
            this.generator = generator;
            this.writer = generator.writable;
        }

        this.#startWorker();

        debug("InsertableStreamsManager created", this.reader, this.writer);
        // the generator is not ready yet but that doesn't seem to matter
        return {processor, generator};


    }

    #startWorker(){

        const workerName = `vch-bcs-${this.sourceTrack.kind}-${this.sourceTrack.id.substr(0, 5)}`;

        // Start the worker
        // Needed to work around policy problems
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
            // reject(error);
        }


        this.workerName = workerName;

        this.worker.onmessage = (event) => {
            if(event.data === m.WORKER_START){
                debug(`Worker ${this.workerName} start received`);
                this.worker.onmessage = null;
                this.wmh = new WorkerMessageHandler(c.INJECT, this.worker);

                const data = {
                    reader: this.reader,
                    writer: this.writer,
                }
                const transferable = [this.reader, this.writer];

                this.wmh.sendMessage(m.WORKER_SETUP, data, transferable);

            }
            else{
                debug(`Unhandled message: `, event);
            }

        }


    }

}



/**
 * Modifies each track in a MediaStream
 * @param {MediaStream} stream - the stream to modify
 * @returns {MediaStream} - a MediaStream
 */
export class ProcessedMediaStream {

    originalTracks;
    originalStream;
    constructor(stream)
    {
        this.originalStream = stream;
        this.originalTracks = stream.getTracks();
        this.tracks = [];

        return Promise.all(this.originalTracks.map(async (track) => {
            const {generator} = new InsertableStreamsManager(track);
            this.tracks.push(generator);
        })).then(() => {
            this.alteredStream = new MediaStream(this.tracks);
            return this.alteredStream
        });
    }

}
