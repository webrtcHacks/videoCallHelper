import {settings as selfViewSettingsProto} from "./settings.mjs";
import {StorageHandler} from "../../../modules/storageHandler.mjs";

await StorageHandler.initStorage('selfView', selfViewSettingsProto);
