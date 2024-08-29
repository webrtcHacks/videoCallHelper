import {settings as videoPlayerSettingsProto} from './settings.mjs';
const debug = Function.prototype.bind.call(console.log, console, `🫥💾 `);

import {StorageHandler} from "../../modules/storageHandler.mjs";
await StorageHandler.initStorage('player', videoPlayerSettingsProto);
const storage = await new StorageHandler(debug);

import {IndexedDBHandler} from "./indexedDB.mjs";
const db = new IndexedDBHandler('videoPlayer');

// get the buffer from db, create an object URL and load it into storage
const { mimeType, loop, videoTimeOffsetMs, currentTime} = storage.contents['player'];
const buffer = await db.get('buffer').catch(error => {
    debug("Error getting video buffer from indexedDB", error);
});
if(buffer?.length > 0){
    const blob = new Blob([buffer], {type: mimeType});
    const url = URL.createObjectURL(blob);
    await storage.set('player', {objectUrl: url, mimeType, loop, videoTimeOffsetMs, currentTime});
}
else {
    debug("no media content in storage to load");
    // await storage.set('player', {objectUrl: null, mimeType: ""});
}
