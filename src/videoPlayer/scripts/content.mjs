import {ImageStream} from "../../imageCapture/scripts/content.mjs";
import {base64ToBuffer} from "./videoPlayer.mjs";

import {StorageHandler} from "../../modules/storageHandler.mjs";
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 🎥‍ `)
const storage = await new StorageHandler();
const mh = new MessageHandler(c.CONTENT);


export let imagePreview = null; // used to hold the gUM preview image generator
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
mh.addListener(m.TOGGLE_DASH, async () => {
    // const iframe = document.querySelector('iframe#vch_dash');
    // if (!iframe)
        // wait for 500 ms to see if the dash is opening
        await new Promise(resolve => setTimeout(resolve, 500));

    debug(`toggleDash: dash is ${window.vch.dashOpen ? "open" : "closed" }`);

    if (window.vch.dashOpen)
        await showPreview();
    else if (imagePreview) {
        imagePreview?.stop();
        debug("showPreview stopped - dash closed");
    } else
        debug("showPreview not started and dash closed");
});

// restart on a new stream
mh.addListener(m.GUM_STREAM_START, async () => {
    if (window.vch.dashOpen) {
        imagePreview?.stop();
        debug("restarting showPreview on new gUM stream");
        await showPreview();
    }

});

storage.addListener('player', async (newValue) => {
    debug("player storage changed", newValue);

    if (newValue.buffer) {
        // const buffer = base64ToBuffer(newValue.buffer);
        // debug("buffer", buffer);
        // newValue.buffer  = buffer;

        const {buffer, mimeType, loop, videoTimeOffsetMs, currentTime} = newValue;

        const videoPlayer = document.createElement('video');
        videoPlayer.autoplay = true;
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

        videoPlayer.oncanplay = () => {
            videoPlayer.oncanplay = null;
            const transmissionDelay = new Date().getTime() - currentTime;
            const playbackOffset = (videoTimeOffsetMs + transmissionDelay) / 1000;
            videoPlayer.currentTime = playbackOffset;
            debug("Adjusted playback to match sync", playbackOffset);
            mh.sendMessage(c.INJECT, m.PLAYER_START, {id: videoPlayer.id});
        };

        const arrayBuffer = base64ToBuffer(buffer);
        const blob = new Blob([arrayBuffer], {type: mimeType}); // Ensure the MIME type matches the video format
        videoPlayer.src = URL.createObjectURL(blob);


        // ToDo: revoke the blobURL when it is no longer needed
        // URL.revokeObjectURL(blobUrl);

        // ToDo: player controls

    }
});
