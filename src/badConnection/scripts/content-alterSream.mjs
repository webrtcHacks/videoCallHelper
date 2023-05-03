// bad connection simulator
// one worker per track for processing and altering

import impairmentWorkerScript from "./impairment.worker.js";

// import impairmentWorkerScript from '../../badConnection/scripts/impairment.worker.js';
const debug = Function.prototype.bind.call(console.debug, console, `vch 🕵️😈`);

import {StorageHandler} from "../../modules/storageHandler.mjs";
let storage = await new StorageHandler("local", debug);

// returns a promise that resolves to a MediaStreamTrackGenerator
export async function alterStream(stream) {

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
            super(track)
            this._label = track.label;
            this._contentHint = track.contentHint;
            this._enabled = track.enabled || true;
            this._muted = track.muted;

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

    // Sets the GUI to active=false if there are no generated streams
    async function checkGeneratorStreams(){
        const active = window.newStreams.find(stream => stream.active);
        if(active === undefined)
            await storage.update('badConnection', {active: false});
    }

    const newStream = new MediaStream();
    const tracks = stream.getTracks();

    // ToDo: need to close the worker when the stream is closed

    await Promise.all(tracks.map(async (track) => {

        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable;

        const generator = new alteredMediaStreamTrackGenerator({kind: track.kind}, track);
        const writer = generator.writable;

        newStream.addTrack(generator);

        debug(`generator track state before worker ${generator.readyState}`, generator);

        const workerBlobURL = URL.createObjectURL(new Blob([impairmentWorkerScript], {type: 'application/javascript'}));
        const workerName = `vch-bcs-${track.kind}-${track.id.substr(0, 5)}`;
        const worker = new Worker(workerBlobURL, {name: workerName});
        worker.name = workerName;

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
            debug(`track ${track.id} ended, stopping worker ${worker.name}`);
            worker.postMessage({command: "stop"});  // clean-up resources?
            generator.stop();
            worker.terminate();
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
                        worker.postMessage({command: "stop"});  // clean-up resources?
                        worker.terminate()
                        debug(`terminating worker ${worker.name}. worker error: `, e.data.error);

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
