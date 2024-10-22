import {StorageHandler} from "../../../modules/storageHandler.mjs";
import {settings as badConnectionSettingsProto} from "./settings.mjs";

await StorageHandler.initStorage('badConnection', badConnectionSettingsProto);
