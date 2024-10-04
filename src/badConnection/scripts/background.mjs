import {StorageHandler} from "../../modules/storageHandler.mjs";
import {settings as badConnectionSettingsProto} from "../../badConnection/scripts/settings.mjs";

await StorageHandler.initStorage('badConnection', badConnectionSettingsProto);
