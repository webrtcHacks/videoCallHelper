import {StorageHandler} from "../../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";
import {settings as imageCaptureSettingsProto} from "./settings.mjs";
import {set as idbSet} from "idb-keyval";

// const debug = Function.prototype.bind.call(console.log, console, `🫥📸`);
const mh = new MessageHandler(c.BACKGROUND);

// Initialize image capture settings
await StorageHandler.initStorage('imageCapture', imageCaptureSettingsProto);

/**
 * Frame capture listener function - saves image capture data to indexedDB
 * @param {object} data - image capture data
 * @returns {Promise<void>}
 */
async function frameCap(data){
    const imageBlob = await fetch(data.blobUrl).then(response => response.blob());

    const imgData = {
        url: data.url,
        date: data.date,
        deviceId: data.deviceId,
        image: imageBlob,
        width: data.width,
        height: data.height
    }

    const id = `image_${(Math.random() + 1).toString(36).substring(2)}`;
    const dataToSave = {};
    dataToSave[id] = imgData;

    await idbSet(id, imgData);
}


// Q: is it better to use storage for this?
mh.addListener(m.FRAME_CAPTURE, frameCap);

// debug("imageCapture background module loaded");

