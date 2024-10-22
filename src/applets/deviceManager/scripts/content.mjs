import {StorageHandler} from "../../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 🕵🎛️️`);
const storage = await new StorageHandler();
const mh = new MessageHandler(c.CONTENT);

// Dash UI enabled change should be propagated to inject
await storage.addListener('deviceManager', (newValue) => {
    debug("deviceManager settings changed", newValue);
    mh.sendMessage(c.INJECT, m.UPDATE_DEVICE_SETTINGS, newValue);
});

// Inject (fakeDeviceManager) should ask for these settings when it loads
mh.addListener(m.GET_DEVICE_SETTINGS, () => {
    mh.sendMessage(c.INJECT, m.UPDATE_DEVICE_SETTINGS, storage.contents['deviceManager']);
});

// Inject should send content UPDATE_DEVICE_SETTINGS on any deviceChange or permission change
mh.addListener(m.UPDATE_DEVICE_SETTINGS, async (data) => {
    let deviceSettings = storage.contents['deviceManager'];
    debug("deviceManager settings updated", data);
    Object.assign(deviceSettings, data);
    await storage.update('deviceManager', deviceSettings);
});
