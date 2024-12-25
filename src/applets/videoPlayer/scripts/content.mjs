import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 🎥‍ `)
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

// ToDo: current insertable streams manager requires the video player to be loaded before the track is set
//  So the videoPlayer element is loaded to the DOM of every pag
// Append the shadow container to the body so inject can access it
document.addEventListener('DOMContentLoaded', async () => {
    document.body.appendChild(shadowContainer);
    debug("added video player element", videoPlayerElement);
});

// ToDo: this was firing multiple times - test this

// Define the handleCanPlay function
const handleCanPlay = ()=> {
    mh.sendMessage(c.DASH, m.PLAYER_CANPLAY);
}

// Listen for data transfer events to load new media
mh.onDataTransfer(async (blob) => {

    // remove previous event listener
    videoPlayerElement.removeEventListener('canplay', handleCanPlay);

    debug("received data transfer", blob);
    if (blob) {
        videoPlayerElement.src = URL.createObjectURL(blob);
        videoPlayerElement.addEventListener('canplay', handleCanPlay);
    }
    else
        debug("failed load player media - invalid blob", blob);
});
