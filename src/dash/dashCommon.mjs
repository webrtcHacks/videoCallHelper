import {StorageHandler} from "../modules/storageHandler.mjs";
import {MessageHandler} from "../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 📈️‍ `);
const storage = await new StorageHandler("local", debug);
const mh = new MessageHandler('dash');
export {storage, mh, debug};
