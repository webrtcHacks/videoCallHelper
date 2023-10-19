import {Impairment} from "../../badConnection/scripts/impairment.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 👷${self.name} `);
debug(`I am worker ${self.name}`);
let impairment;


// Frame counter transform for testing
let frameCounter = 0;
self.frameCounter = frameCounter;

const testTransform = new TransformStream({
    start: controller => {
        debug("transform stream started", controller);
    },
    transform: async (frame, controller) => {
        frameCounter++;
        if(frameCounter % 100 === 0)
            debug(`transforming frame ${frameCounter}`);
        controller.enqueue(frame);
    },
});

// Holders for transform class onMessage
const transformMessageHandlers = [];

// Message handler
onmessage = async (event) => {
    let transform = testTransform;

    debug("received message", event.data);
    const {command} = event.data;
    const impairmentData = event.data.transformData?.impairment;

    if (command === 'setup'){
        const {reader, writer, id, kind, settings} = event.data;

        let config, operation;
        if(impairmentData){
            const impairmentState = impairmentData.state === "passthrough" ? "passthrough" : "impair";

            const impairmentDebug = Function.prototype.bind.call(console.debug, console, `vch ${self.name}👷😈 `);
            impairment = new Impairment(kind, settings, id, impairmentState, impairmentDebug);
            transformMessageHandlers.push(impairment.onmessage);

            // impairment.start();

            transform = impairment.transformStream;

            debug(`processing new stream video with operation ${impairment.operation} and impairment:`, impairment.impairmentConfig[kind]);

            // first frame response (or maybe 0) causing issues in some services
            const minFrameNumberToStart = 3;
            impairment.onFrameNumber(minFrameNumberToStart, () => {
                // debug(`frame ${impairment.frameCounter} is >= ${minFrameNumberToStart}, sending "started"`);
                self.postMessage({response: "started"});
            });

        }

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
        // Conclusion: pipeThrough locks the writer so you can send it again; would need to clone

        await reader
                // ToDo: abstract the transformStream so I can swap them
                .pipeThrough(transform)
                .pipeTo(writer)
                .catch(async err => {
                    // ToDo: don't throw error on muted - backpressure?
                    debug(`Insertable stream error`, err);
                    self.postMessage({response: "error", error: err});
                });
    }

    else {
        // push message handling to each transform handler
        transformMessageHandlers.forEach(handler => {
            handler(event.data);
        })

    }
};

