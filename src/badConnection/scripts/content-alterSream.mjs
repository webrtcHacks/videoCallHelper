// bad connection simulator
// one worker per track for processing and altering

import impairmentWorkerScript from "./impairment.worker.js";

// import impairmentWorkerScript from '../../badConnection/scripts/impairment.worker.js';
const debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️😈`);

import {StorageHandler} from "../../modules/storageHandler.mjs";
let storage = await new StorageHandler("local", debug);


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

// Learning: I was not able to transfer a modified writer to the worker
// My goal is to wait until something is written to the track before returning the new stream
// it seems there is some typechecking and Chrome doesn't allow an extended object
// I always get the error:
//  DOMException: Failed to execute 'postMessage' on 'Worker': Value at index 1 does not have a transferable type
// ToDo: see if I can extend the writer in the worker and have that message back here

// ToDo: implement methods to replicate original track
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

    constructor(options, track) {
        super(options);

        // ToDo:
        // super(track)
        this._label = track.label;
        this._contentHint = track.contentHint;
        this._enabled = track.enabled || true;
        this._muted = track.muted;

        this._settings = track.getSettings();
        this._constraints = track.getConstraints();
        this._capabilities = track.getCapabilities();

        this.sourceTrack = track;
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

    set enabled(enabled) {
        this._enabled = enabled;
        this._muted = enabled;  // ToDo: check the spec for function here
        return this._enabled;
    }

    // Methods
    applyConstraints(constraints) {
        // ToDo:
        debug(`TODO: apply constraints`, constraints);
        // return this.sourceTrack.applyConstraints(constraints);
    }

    clone(){
        // ToDo: will this have a new ID?
        const clone = this.sourceTrack.clone();
        debug(`cloning source track ${this.sourceTrack.label} with id ${this.sourceTrack.id} to ${clone.label} with id ${clone.id}`);
        return clone
    }


    getCapabilities() {
        //debug(`getCapabilities`, this.sourceTrack.getCapabilities());
        // return this.sourceTrack.getCapabilities();
        debug(`getCapabilities`, this._capabilities);
        return this._capabilities;
    }

    getConstraints() {
        //debug(`getConstraints`, this.sourceTrack.getConstraints());
        // return this.sourceTrack.getConstraints();
        debug(`getConstraints`, this._constraints);
        return this._constraints;
    }

    getSettings() {
        // debug(`getSettings`, this.sourceTrack.getSettings());
        // return this.sourceTrack.getSettings();
        debug(`getSettings`, this._settings);
        return this._settings;
    }

    stop() {
        debug(`stopping track source track ${this.label}`);
        this.sourceTrack.stop();
    }

}

// returns a promise that resolves to a MediaStreamTrackGenerator
export async function alterStream(stream) {

    if(!storage.contents['badConnection'].enabled){
        return new Error("Bad connection is not enabled");
    }

    // Sets the GUI to active=false if there are no generated streams
    async function checkGeneratorStreams(){
        const active = window.newStreams.find(stream => stream.active);
        if(active === undefined)
            await storage.update('badConnection', {active: false});
    }

    const tracks = stream.getTracks();
    const newStream = new MediaStream();

    // ToDo: need to close the worker when the stream is closed

    await Promise.all(tracks.map(async (track) => {

        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable;

        const generator = new alteredMediaStreamTrackGenerator({kind: track.kind}, track);
        const writer = generator.writable;

        // make the generator act like the original track
        // const vchTrack = new VCHMediaStreamTrack(generator);
        debug("alteredMediaStreamTrackGenerator video track: ", generator);
        debug("alteredMediaStreamTrackGenerator video track settings: ", generator.getSettings());
        debug("alteredMediaStreamTrackGenerator video track constraints: ", generator.getConstraints());
        debug("alteredMediaStreamTrackGenerator video track capabilities: ", generator.getCapabilities());

        newStream.addTrack(generator);

        debug("newStream video track: ", newStream.getVideoTracks()[0]);
        debug("newStream video track settings: ",  newStream.getTracks()[0].getSettings());
        debug("newStream video track constraints: ", newStream.getTracks()[0].getConstraints());
        debug("newStream video track capabilities: ", newStream.getTracks()[0].getCapabilities());


        // debug(`generator track state before worker ${generator.readyState}`, generator);

        const workerBlobURL = URL.createObjectURL(new Blob([impairmentWorkerScript], {type: 'application/javascript'}));
        const workerName = `vch-bcs-${track.kind}-${track.id.substr(0, 5)}`;
        const worker = new Worker(workerBlobURL, {name: workerName});
        worker.name = workerName;

        function trackDone(){
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

        // ToDo: this is not working
        track.addEventListener('ended', () => {
            debug(`track ${track.id} ended event, stopping worker ${worker.name}`);
            trackDone();
        });


        // wait for the streams pipeline to be setup -
        //  this is a hack to wait for the first frame to be written to the track
        //  this caused problems in some services
        await new Promise((resolve, reject) => {

            worker.onmessage = async (e) => {
                // debug("worker message: ", e.data);
                if (e.data?.response === "started") {
                    resolve();
                } else if (e.data?.response === "error") {
                    if(track.muted && track.readyState === "live")
                        debug(`track ${track.id} is muted, ignoring worker ${worker.name} error: `, e.data.error)
                    else{
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
                impairmentState: storage.contents['badConnection'].level
            }, [reader, writer]);

        });

        await storage.addListener('badConnection', async (newValue) => {
            debug("badConnection changed to: ", newValue);
            if(newValue.level)
                worker.postMessage({command: newValue.level});
        });

    }))
        .catch(err => {
            debug("alterStream error, returning original stream. Error: ", err);
            return stream;
        });

    // Do I need to make sure these work?
    if (newStream.getTracks().filter(track => track.readyState === 'live').length > 0) {
        window.newStreams.push(newStream);      // ToDo: for debugging
        await storage.update('badConnection', {active: true})
        return newStream;
    }
    else {
        debug("alterStream error, returning original stream. No active tracks", newStream, newStream.getTracks());
        return stream;
    }

}
