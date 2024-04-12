import {settings as imageCaptureSettingsProto} from "../../imageCapture/scripts/settings.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";
import {set as idbSet} from "idb-keyval";
import {MESSAGE as m, MessageHandler} from "../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.log, console, `📸`);
const storage = await new StorageHandler("local", debug);

const mh = new MessageHandler('background');

if(!storage.contents['imageCapture'])
    await storage.set('imageCapture', imageCaptureSettingsProto);


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

debug("imageCapture background module loaded");
