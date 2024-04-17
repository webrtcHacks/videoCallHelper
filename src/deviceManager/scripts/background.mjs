import {settings} from "./settings.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

const storage = await new StorageHandler("local");
if(!storage.contents['deviceManager'])
    await storage.set('deviceManager', settings);
