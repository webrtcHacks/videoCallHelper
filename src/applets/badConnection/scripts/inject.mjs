import {MESSAGE as m, CONTEXT as c, MessageHandler, InjectToWorkerMessageHandler} from "../../../modules/messageHandler.mjs";
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
    const bcsSettings = window.vch.settings['badConnection'] || {};     // todo: check on window.vch.settings
    const updatedSettings = {
        ...bcsSettings,
        settings: sourceTrackSettings,
        kind: sourceTrack.kind,
        enabled: bcsSettings.enabled || false,
        level: bcsSettings.level || 'passthrough'
    };

    wmh.sendMessage(worker, m.IMPAIRMENT_SETUP, updatedSettings);

}
