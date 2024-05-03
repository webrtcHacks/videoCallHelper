// noinspection DuplicatedCode

import worker from "!!raw-loader!../../temp/worker-bundle.js";
import {InjectToWorkerMessageHandler, MESSAGE as m, CONTEXT as c} from "./messageHandler.mjs";
import {AlteredMediaStreamTrackGenerator} from "./AlteredMediaStreamTrackGenerator.mjs";
import {setupPlayer} from "../videoPlayer/scripts/inject.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️😈`);
const wmh = new InjectToWorkerMessageHandler();


/**
 * Modifies a MediaStreamTrack with insertable streams
 * - creates a generator and processor for the track
 * - creates a worker to process the track
 */
export class InsertableStreamsManager{
    generator;
    processor;
    reader;
    writer;
    worker;

    /**
     * Modifies a MediaStreamTrack to simulate a bad connection
     * @param {MediaStreamTrack} track - the input track to modify
     * @returns {MediaStreamTrack} - a MediaStreamTrackGenerator disguised as a MediaStreamTrack that may be processed
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

        // Applets
        setupPlayer(this.sourceTrack, this.worker.name);

        debug("InsertableStreamsManager created", this.reader, this.writer);
        // the generator is not ready yet but that doesn't seem to matter
        return generator;

    }

    /**
     * Starts a worker to process the track
     * @returns {Promise<MediaStreamTrackGenerator>} - a MediaStreamTrackGenerator
     * @private
     */
    #startWorker(){

        const workerName = `vch-bcs-${this.sourceTrack.kind}-${this.sourceTrack.id.substr(0, 5)}`;

        // Start the worker
        // Below needed to work around policy problems
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
            // ToDo: should return the original track if this fails, but need to deal with async
            // reject(error);
        }

        this.worker.name = workerName;
        wmh.registerWorker(this.worker);

        const data = {
            reader: this.reader,
            writer: this.writer,
        }

        wmh.sendMessage(workerName, m.WORKER_SETUP, data, [this.reader, this.writer]);
    }

}



/**
 * Modifies each track in a MediaStream and returns a stream with the modified tracks
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
            const generator = new InsertableStreamsManager(track);
            this.tracks.push(generator);
        })).then(() => {
            this.alteredStream = new MediaStream(this.tracks);
            return this.alteredStream
        });
    }

}
