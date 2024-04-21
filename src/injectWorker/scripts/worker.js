import {Worker} from "../../badConnection/scripts/worker.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 👷${self.name} `);
debug(`I am worker ${self.name}`);
let impairment;

/*
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

 */

let usePlayer = false;
let playerReader;

async function loadImpairment(reader, writer, id, kind, settings, impairmentState) {
    let config;
    let operation = impairmentState === "passthrough" ? "passthrough" : "impair";

    if(impairmentState === "severe"){
        config = Worker.severeImpairmentConfig;
        // impairmentState.operation = "impair";
    }
    if(impairmentState === "moderate") {
        config = Worker.moderateImpairmentConfig;
        // impairmentState.operation = "impair";
    }
    else{
        // debug(`Error: invalid impairmentState: ${impairmentState}}`);
        operation = "passthrough";
    }

    const impairmentDebug = Function.prototype.bind.call(console.debug, console, `vch ${self.name}👷😈 `);
    impairment = new Worker(kind, settings, id, config, impairmentDebug);
    impairment.operation = operation;
    impairment.start();

    debug(`processing new stream video with operation ${impairment.operation} and impairment:`, impairment.impairmentConfig[kind]);
    // self.postMessage({response: "before reader"});

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

    // first frame response (or maybe 0) causing issues in some services
    const minFrameNumberToStart = 3;
    impairment.onFrameNumber(minFrameNumberToStart, () => {
        // debug(`frame ${impairment.frameCounter} is >= ${minFrameNumberToStart}, sending "started"`);
        self.postMessage({response: "started"});
    });

    // debug("playerReader", self.playerReader);

    await reader
        .pipeThrough( new TransformStream(
            { transform: async (frame, controller) => {
                    if(usePlayer) {
                        const {done, value} = await playerReader.read();
                        if(!done){
                            controller.enqueue(value);
                            frame.close();
                        }
                        else{
                            controller.enqueue(frame);
                        }
                    }
                    else{
                        controller.enqueue(frame);
                    }
                }}))
        .pipeThrough(impairment.transformStream)
        .pipeTo(writer)
        .catch(async err => {
            // ToDo: don't throw error on muted - backpressure?
            debug(`Insertable stream error`, err);
            self.postMessage({response: "error", error: err});
        });
}

// Message handler
onmessage = async (event) => {
    const {command, data} = event.data;
    debug(`worker command ${command}`, data);

    switch (command) {
        case 'player_start':
            usePlayer = true;
            // const {reader} = event.data;
            playerReader = data.getReader();
            break;
        case 'player_stop':
            usePlayer = false;
            break;
        case 'setup':
            const {reader, writer, id, kind, settings, impairmentState} = event.data;
            self.writer = writer;
            await loadImpairment(reader, writer, id, kind, settings, impairmentState);
            break;
        case 'moderate':
        case 'severe':
            impairment.operation = "impair";
            impairment.config = Worker[`${command}ImpairmentConfig`];
            break;
        case 'passthrough':
        case 'pause':
            impairment.operation = command;
            break;
        case 'unpause':
            impairment.operation = "impair";
            break;
        case 'stop':
            await impairment.stop();
            break;
        default:
            debug(`Unhandled message: `, event);
    }
};
