import {settings as selfViewSettingsProto} from "../../selfView/scripts/settings.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";

await StorageHandler.initStorage('selfView', selfViewSettingsProto);
