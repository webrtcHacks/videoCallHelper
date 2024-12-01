import {base64ToBuffer} from "../../../modules/base64.mjs";
import {StorageHandler} from "../../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 🎥‍ `)
const storage = await new StorageHandler();
const mh = new MessageHandler(c.CONTENT);

// Use a shadow root to isolate the video player from the page
const shadowContainer = document.createElement('div');
shadowContainer.id = 'vch-player-container';
const shadowRoot = shadowContainer.attachShadow({ mode: 'open' });

// create the video player
const videoPlayerElement = document.createElement('video');
const placeHolderVideo = chrome.runtime.getURL('media/black_static.mp4');
videoPlayerElement.src = placeHolderVideo;
videoPlayerElement.loop = true;
videoPlayerElement.id = `vch-player`;
videoPlayerElement.preload = "auto";
videoPlayerElement.hidden = true;
videoPlayerElement.muted = true;

// Append the video player element to the shadow root
shadowRoot.appendChild(videoPlayerElement);

// Append the shadow container to the body so inject can access it
document.addEventListener('DOMContentLoaded', async () => {
    document.body.appendChild(shadowContainer);
    debug("added video player element", videoPlayerElement);
});


/**
 *  Look for storage changes and update media if a new media file is loaded
 *   - used to preload media for faster playback
 */
storage.addListener('player', async (newValue) => {
    // debug("player storage changed", newValue);

    if (newValue?.currentTime) {
        // storage can be slow with large objects, so do await with get
        const temp = await storage.get('temp');
        const buffer = temp?.buffer;
        // In the future also check for changes to other video params
        if (buffer?.length) {
            const arrayBuffer = base64ToBuffer(buffer);
            // const mimeType = storage.contents['player']?.mimeType;
            const blob = new Blob([arrayBuffer]); //, {type: mimeType}); // Ensure the MIME type matches the video format
            videoPlayerElement.src = URL.createObjectURL(blob);
            storage.delete('temp').catch(err => debug(err));
            debug("loaded player media", buffer.length);
            mh.sendMessage(c.DASH, m.PLAYER_CANPLAY);
        }
        else
            debug("failed load player media - invalid buffer", buffer);
    }
});
