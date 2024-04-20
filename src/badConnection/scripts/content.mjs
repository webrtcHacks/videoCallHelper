import {StorageHandler} from "../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.log, console, `🫥`);
const storage = await new StorageHandler();
const mh = new MessageHandler(c.CONTENT);


/************ START bad connection ************/

/*
const bcsInitSettings = {
    enabled: storage.contents['badConnection']?.enabled ?? false,
    active: false,
    level: "passthrough",
    noPeerOnStart: null
}

await storage.update('badConnection', bcsInitSettings);
 */

await storage.addListener('badConnection', (newValue) => {
    debug("badConnection settings changed", newValue);
    mh.sendMessage(c.INJECT, m.UPDATE_BAD_CONNECTION_SETTINGS, newValue);
});

mh.addListener(m.GET_BAD_CONNECTION_SETTINGS, async () => {
    const settings = await storage.get('badConnection');
    mh.sendMessage(c.INJECT, m.UPDATE_BAD_CONNECTION_SETTINGS, settings);
});

// if a peerConnection is open and badConnection is not enabled then permanently disable it
//  - no longer needed with device manager
/*
mh.addListener(m.PEER_CONNECTION_OPEN,  () => {
    if (!bcsInitSettings.enabled) {
        storage.update('badConnection', {noPeerOnStart: true})
            .catch(err => debug("Error updating badConnection settings", err));
    }
    else{
        storage.update('badConnection', {noPeerOnStart: false})
            .catch(err => debug("Error updating badConnection settings", err));
    }
});
 */

/************ END bad connection ************/
