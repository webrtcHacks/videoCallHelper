import {settings as videoPlayerSettingsProto} from './settings.mjs';
import {StorageHandler} from "../../modules/storageHandler.mjs";

await StorageHandler.initStorage('player', videoPlayerSettingsProto);
