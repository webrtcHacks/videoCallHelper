import {StorageHandler} from "../modules/storageHandler.mjs";
import {MessageHandler, MESSAGE as m, CONTEXT as c} from "../modules/messageHandler.mjs";
// import 'bootstrap';

const debug = Function.prototype.bind.call(console.debug, console, `vch 📈️‍ `);
const storage = await new StorageHandler(debug);
const mh = new MessageHandler(c.DASH);
export {storage, mh, debug, m, c};

