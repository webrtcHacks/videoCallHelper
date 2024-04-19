import {StorageHandler} from "../../modules/storageHandler.mjs";
import {settings as selfViewSettingsProto} from "../../selfView/scripts/settings.mjs";

// ToDo: default debug per context?
const storage = await new StorageHandler("local");

// Initialize image capture settings
const settings = await storage.get('selfView');
if(!settings){
    await storage.set('selfView', selfViewSettingsProto);
}
