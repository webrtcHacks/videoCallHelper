// Import not workinng when this whole file is loaded inline
// import {Impairment} from "../../badConnection/scripts/impairment.mjs";
/*
self.onmessage = function(e) {
    console.debug('Worker received data:', e.data);
}
*/

let mode = "passThrough";

const debug = Function.prototype.bind.call(console.debug, console, `vch 😈👷 `);
debug("I am a worker");
let frameCounter = 0;

const testTransform = new TransformStream({
    start: controller => {
        debug("transform stream started", controller);
    },
    transform: async (frame, controller) => {
        frameCounter++;
        debug(`transforming frame ${frameCounter}`);
        if(mode === "passThrough"){
            controller.enqueue(frame);
        }
        else if(mode === "delay"){
            await new Promise(resolve => setTimeout(resolve, 1000));
            controller.enqueue(frame);
        }
    },
});
// Message handler
onmessage = async (event) => {
    const {operation} = event.data;

    if (operation === 'new_stream'){
        const {reader, writer, impairmentTransform} = event.data;

        debug(`processing new stream video`);
        debug('Impairment transform', impairmentTransform);
        await reader
                .pipeThrough(impairmentTransform)
                .pipeTo(writer)
                .catch(async err => {
                    debug(`Insertable stream error`, err);
                });
    }
    else if (operation === 'delay'){
        mode = "delay";
        debug(`mode set to ${mode}`);
    }
    else if (operation === 'stop') {
        debug("stopping stream");
        // ToDo: handle this
        // await videoReader.cancel(); // no cancel method
    } else {
        debug(`Unhandled message: `, event);
    }
};

