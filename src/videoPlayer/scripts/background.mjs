import {settings as videoPlayerSettingsProto} from './settings.mjs';
import {StorageHandler} from "../../modules/storageHandler.mjs";

const storage = await new StorageHandler("local");

const settings = await storage.get('player');
if(!settings){
    await storage.set('player', videoPlayerSettingsProto);
}
