import {ImageStream} from "../../imageCapture/scripts/content.mjs";
import {base64ToBuffer} from "./base64.mjs";

import {StorageHandler} from "../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 🎥‍ `)
const storage = await new StorageHandler();
const mh = new MessageHandler(c.CONTENT);

/* type {HTMLVideoElement} */
let videoPlayer = null;
export let imagePreview = null; // used to hold the gUM preview image generator
let injectReady = false;


mh.addListener(m.INJECT_LOADED, async () => {
    injectReady = true;
});

// await storage.update('player', {active: false});


/*
   Not easy to send a stream to dash:
     * can't access the iframe content - CORS issues
     * can't send the stream over postMessage - it's not serializable
     * can't pass a resource URL - treated as different domains
   ideas:
     1. open a new stream - could cause gUM conflicts, more encoding
     2. send snapshots - this is what did
*/
/**
 * Grabs the last stream and generates preview thumbnails
 * @returns {Promise<void>}
 */
export async function showPreview() {
    const stream = window.vch.streams
        .filter(stream=>stream.active)
        .at(-1);  // get the last stream  // ToDo: get the highest res gUM stream
    if (stream) {
        imagePreview = new ImageStream(stream, 200, c.DASH, true);
        debug("showPreview:: stream", stream);
        await imagePreview.start();
    } else
        imagePreview = null;
}

// Stop the preview image stream if the dash is closed
/*
mh.addListener(m.TOGGLE_DASH, async () => {
    // const iframe = document.querySelector('iframe#vch_dash');
    // if (!iframe)
        // wait for 500 ms to see if the dash is opening
        await new Promise(resolve => setTimeout(resolve, 500));

    debug(`toggleDash: dash is ${window.vch?.dashOpen ? "open" : "closed" }`);

    if (window.vch.dashOpen)
        await showPreview();
    else if (imagePreview) {
        imagePreview?.stop();
        debug("showPreview stopped - dash closed");
    } else
        debug("showPreview not started and dash closed");
});
 */

// ToDo: consider if I want to show this
/*
// restart on a new stream
mh.addListener(m.GUM_STREAM_START, async () => {
    if (window.vch.dashOpen) {
        imagePreview?.stop();
        debug("restarting showPreview on new gUM stream");
        await showPreview();
    }

});

 */

/**
 * Load a media file into a video element
 * @returns {Promise<void>}
 */
 async function loadMedia() {

     return new Promise(async (resolve, reject) => {

         /**
          * @param  {string} buffer - base64 encoded video file
          * @param {string} mimeType - the mime type of the video file
          * @param  {boolean} loop - loop the video (not used)
          * @param {number} playbackOffset
          */

         const {buffer, mimeType, loop, videoTimeOffsetMs, currentTime} = storage.contents['player'];
         if(!buffer){
             debug("no media content in storage to load");
             resolve();
             // reject("no media content in storage to load");
         }
         if(!mimeType){
             debug("no mimeType in storage to load media");
             reject("no mimeType in storage to load media");
         }

         const transmissionDelay = new Date().getTime() - currentTime;
         const playbackOffset = (videoTimeOffsetMs + transmissionDelay) / 1000;

         const arrayBuffer = base64ToBuffer(buffer);
         const blob = new Blob([arrayBuffer], {type: mimeType}); // Ensure the MIME type matches the video format

         // Set up the video player if it doesn't exist
         if(!videoPlayer) {
             // ToDo: use shadow DOM
             videoPlayer = document.createElement('video');
             videoPlayer.src = URL.createObjectURL(blob);
             videoPlayer.loop = loop;
             videoPlayer.id = `vch-player-${Math.random().toString().substring(2, 6)}`;
             videoPlayer.preload = "auto";
             videoPlayer.hidden = true;
             videoPlayer.muted = true;
             // set the style to fit to cover
             // videoPlayer.style.cssText = "object-fit:cover;";

             // captureStream takes the source video size so this doesn't matter
             // const {width, height} = streams.at(-1)?.getVideoTracks()[0]?.getSettings();
             // videoPlayer.height = height;
             // videoPlayer.width = width;

             document.body.appendChild(videoPlayer);
             debug("added video element", videoPlayer);

              function sendVideoElement(){
                 if(injectReady)
                      mh.sendMessage(c.INJECT, m.PLAYER_TRANSFER, {id: videoPlayer.id});
                 else
                    setTimeout(async ()=> sendVideoElement(), 500)
             }
             sendVideoElement();


             videoPlayer.oncanplay = async () => {
                 videoPlayer.oncanplay = null;
                 // videoPlayer.currentTime = playbackOffset;
                 debug("Adjusted playback to match sync", playbackOffset);
                 resolve();
             };
         }
         else {
             videoPlayer.src = URL.createObjectURL(blob);
             debug("Adjusted playback to match sync", playbackOffset);
             resolve();
         }
     });

}


/**
 *  Look for storage changes and update media if a new media file is loaded
 *   - used to preload media for faster playback
 */
storage.addListener('player', async (newValue) => {
    debug("player storage changed", newValue);

    // In the future also check for changes to other video params
    if (newValue.buffer) {
        await loadMedia().catch(error => debug("Error loading media into player", error));
    }
});


/**
 *  Tell inject to take the video player stream
 */
/*
mh.addListener(m.GUM_STREAM_START, async () => {
    if (!storage.contents['player']?.enabled) return;

    if (videoPlayer) {
        mh.sendMessage(c.INJECT, m.PLAYER_START, { id: videoPlayer.id });
        // await storage.update('player', { active: true });
    } else {
        try {
            await loadMedia();
            mh.sendMessage(c.INJECT, m.PLAYER_START, { id: videoPlayer.id });
            // await storage.update('player', { active: true });
        } catch (error) {
            debug("Error loading media", error);
        }
    }
});
 */



loadMedia().catch(error => debug("Error loading media into player", error));
