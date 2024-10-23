/**
 * Primary worker script used for processing a track
 */
// import {Impairment} from "../../badConnection/scripts/worker.mjs";
import {WorkerMessageHandler, MESSAGE as m, CONTEXT as c} from "../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 👷${self.name} `);
self.debug = debug;
// debug(`I am worker ${self.name}`);

self.wmh = new WorkerMessageHandler();

// ToDo: mirror TransformStream? https://developer.mozilla.org/en-US/docs/Web/API/TransformStream/TransformStream

/**
 * TransformManager - class managing a series of transforms on a stream
 *  - TransformStream does not let you add and remove items without interrupting a MediaStreamTrack
 *  - This class allows you to add and remove transform functions inside a private TransformStream
 *  - exposes the output via a readable stream at readable
 * @typedef {Object} TransformManager
 * @property {ReadableStream} inputStream - the input stream to be transformed
 * @property {number} size - the number of transforms in the manager
 * @property {ReadableStream} readable - the readable stream
 * @method add - add a transform to the manager
 * @method remove - remove a transform from the manager
 * @method get readable - get the readable stream
 * @method get size - get the number of transforms in the manager
 */
class TransformManager {

    /**@private */
    #transformFunctions = new Map(); // Using a Map to hold functions with their IDs
    /**@private */
    #transformStream = new TransformStream({
        transform: async (frame, controller) => {
            // Process each chunk using the transforms in order
            let processedFrame = frame;
            for (const transform of this.#transformFunctions.values()) {
                processedFrame = await transform(processedFrame);
            }
            controller.enqueue(processedFrame);
        }
    });

    /**
     * @constructor
     * @param {ReadableStream} inputReadableStream - the input stream to be transformed
     * @returns {ReadableStream} - the readable stream
     */
    constructor(inputReadableStream) {
        this.inputStream = inputReadableStream;
        // Pipe the input stream through the transform stream
        this.inputStream.pipeTo(this.#transformStream.writable).catch(debug);
        // return this.readable;
    }

    /**
     * Add a transform to the manager
     * @param {string} id - a name used to identify the transform
     * @param {function} transformFunc - the transform function to perform first param is a frame
     * @param {number} position - where to insert the transform in the order
     */
    add(id, transformFunc, position = this.#transformFunctions.size) {
        // Insert a transform at a specific position or by default at the end
        if(position + this.#transformFunctions.size < 0 || position > this.#transformFunctions.size){
            debug(`transform addition position ${position} out of range. Putting it at the end.`);
            position = this.#transformFunctions.size;
        }

        let funcArray = Array.from(this.#transformFunctions.entries());
        funcArray.splice(position, 0, [id, transformFunc]);
        this.#transformFunctions = new Map(funcArray);
        debug(`Transform ${id} added at position ${position}.`);
    }

    /**
     * Remove a transform from the manager
     * @param {String} id - the name of the transform to remove
     */
    remove(id) {
        if (this.#transformFunctions.has(id)) {
            this.#transformFunctions.delete(id);
            debug(`Transform ${id} removed.`);
        } else {
            debug(`Transform ${id} not found.`);
        }
    }

    /**
     * Check if a transform is in the manager based on id
     * @param {string} id - the name of the transform to check
     * @returns {boolean}
     */
    has(id) {
        return this.#transformFunctions.has(id);
    }

    /**
     * return the readable stream
     * @returns {ReadableStream<any>}
     */
    get readable() {
        return this.#transformStream.readable;
    }

    /**
     * return the number of transforms in the manager
     * @returns {number}
     */
    get count() {
        return this.#transformFunctions.size;
    }
}


/*
 * testTransform - a simple transform function that increments a frame counter used for testing
 */

let frameCounter = 0;
self.frameCounter = frameCounter;

/**
 * testTransform - a simple transform function that increments a frame counter used for testing
 * @param frame - input frame to modify
 * @returns {*}
 */
function testTransform(frame){
    frameCounter++;
    if (frameCounter % 100 === 0) {
        debug(`transforming frame ${frameCounter}`);
    }
    return frame;
}

/**
 * Mandatory setup to send the reader and writer to the worker
 */
wmh.addListener(m.WORKER_SETUP, async (data) => {
//onmessage = async (event) => {
    const {reader, writer} = data;
    self.reader = reader;
    self.writer = writer;

    debug(`starting transformManager`, reader, writer);

    const transformManager = new TransformManager(reader);
    self.transformManager = transformManager;

    transformManager.readable
        .pipeTo(writer)
        .catch(async err => debug(`Insertable stream error`, err) );

});

// Import applets here; transform.add() is handled in each module
import "../../applets/videoPlayer/scripts/worker.mjs";
import "../../applets/badConnection/scripts/worker.mjs";


debug(`worker ${self.name} is ready`);


// NOTES
// Learning: not easy to pipe streams - could be worth a post
// Attempt:
//         const counterTransfer = new TransformStream({
//             transform: async (frame, controller) => {
//                 frameCount++;
//                 // first frame response causing issues in some services
//                 if(frameCount === ){
//                     debug("second frame");
//                     self.postMessage({response: "started"});
//                 }
//                 controller.enqueue(frame);
//             }
//         });
//     await reader
//                 .pipeThrough(counterTransfer)
//                 .pipeThrough(counterTransfer)
//                 .pipeTo(writer)
// Result
//  50df2885-db3f-468d-b0d5-4be0cf7e92c1:436 Uncaught (in promise) TypeError: Failed to execute 'pipeThrough' on 'ReadableStream': parameter 1's 'writable' is locked
//     at onmessage (50df2885-db3f-468d-b0d5-4be0cf7e92c1:436:18)
// Conclusion: pipeThrough locks the writer, so you can't send it again; would need to clone
