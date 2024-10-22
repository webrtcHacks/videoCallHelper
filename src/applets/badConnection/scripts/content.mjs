import {StorageHandler} from "../../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.log, console, `vch️ 🕵😈 `);
const storage = await new StorageHandler();
const mh = new MessageHandler(c.CONTENT);

await storage.addListener('badConnection', (newValue) => {
    debug("badConnection settings changed", newValue);
    mh.sendMessage(c.INJECT, m.UPDATE_BAD_CONNECTION_SETTINGS, newValue);
});

mh.addListener(m.GET_BAD_CONNECTION_SETTINGS, async () => {
    const settings = await storage.get('badConnection');
    mh.sendMessage(c.INJECT, m.UPDATE_BAD_CONNECTION_SETTINGS, settings);
});
