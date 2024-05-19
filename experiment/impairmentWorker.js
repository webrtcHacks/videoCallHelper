// noinspection DuplicatedCode
import {ImpairmentProcessor} from "../src/badConnection/scripts/worker.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 👷${self.name} `);

self.onmessage = async (event) => {
    const {command} = event.data;
    debug(`received command: ${command}`);

    switch (command) {
        case 'setup':
            const {reader, writer, kind} = event.data;
            self.impair = new ImpairmentProcessor(kind);

            const transformStream = new TransformStream({
                transform: async (frame, controller) => {
                    const newFrame = await impair.process(frame);
                    // debug(frame.data);
                    controller.enqueue(newFrame);
                }
            })
            await reader.pipeThrough(transformStream).pipeTo(writer);
            break;
        case 'config':
            self.impair.config = event.data.config;
            break;
        case 'start':
            self.impair.start();
            break;
        case 'stop':
            self.impair.stop();
            break;
        default:
            console.log(`Unhandled message: `, event);
    }
};
