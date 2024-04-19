import {settings as deviceManagerSettingsProto} from "./settings.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

await StorageHandler.initStorage('deviceManager', deviceManagerSettingsProto);
