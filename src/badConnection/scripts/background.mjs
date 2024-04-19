import {StorageHandler} from "../../modules/storageHandler.mjs";
import {settings as badConnectionSettingsProto} from "../../badConnection/scripts/settings.mjs";

const storage = await new StorageHandler();

const settings = await storage.get('badConnection');
if(!settings){
    await storage.set('badConnection', badConnectionSettingsProto);
}
