import {MESSAGE as m, CONTEXT as c, MessageHandler, InjectToWorkerMessageHandler} from "../../modules/messageHandler.mjs";
import {Impairment} from "./worker.mjs";
const mh = new MessageHandler(c.INJECT);
const wmh = new InjectToWorkerMessageHandler();
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉😈 `);

let bcsSettings;

// ToDo: remove this if I unify messageHandler or load as module

// ToDo: sort communications logic here
mh.addListener(m.UPDATE_BAD_CONNECTION_SETTINGS, async (data) => {
    wmh.sendMessage('all', m.IMPAIRMENT_CHANGE, data);
});

export function setupImpairment(sourceTrack, worker){

    const sourceTrackSettings = sourceTrack.getSettings();

    debug("starting bacConnection settings: ",  window.vch.settings['badConnection']);

    if(!bcsSettings){
        bcsSettings = window.vch.settings['badConnection']; // Todo: should I use window.vch?
        bcsSettings.settings = sourceTrackSettings;
        bcsSettings.kind = sourceTrack.kind;
        bcsSettings.enabled = bcsSettings.enabled || false;
        bcsSettings.level = bcsSettings.level || 'passthrough';
    }

    wmh.sendMessage(worker, m.IMPAIRMENT_SETUP, bcsSettings);

}
