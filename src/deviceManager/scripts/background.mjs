import {settings as deviceManagerSettingsProto} from "./settings.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

const storage = await new StorageHandler("local");

const settings = storage.get('deviceManager');
if(!settings)
    await storage.set('deviceManager', deviceManagerSettingsProto);
