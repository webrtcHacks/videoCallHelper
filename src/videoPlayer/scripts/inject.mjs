import {
    MESSAGE as m,
    CONTEXT as c,
    MessageHandler,
    InjectToWorkerMessageHandler
} from "../../modules/messageHandler.mjs";

const mh = new MessageHandler(c.INJECT);
const wmh = new InjectToWorkerMessageHandler();
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️🎥 `);


/** @type {HTMLVideoElement} */
let videoPlayerElement = null; // document.querySelector('video#vch-player');
/** @type {AudioContext} */
let audioCtx = null;
/** @type {MediaElementAudioSourceNode} */
let sourceNode = null;


/**
 * Set up the video player
 *  - video: create a canvas to capture and resize the video and get the track
 *  - audio: create a MediaStreamDestination to capture the audio and get the track
 *  - passes a readable stream to the worker
 * @param {MediaStreamTrack} sourceTrack - the track to play
 * @param {string} workerName - the name of the worker to send messages to
 */
export function setupPlayer(sourceTrack, workerName) {
    const shadowContainer = document.querySelector('div#vch-player-container').shadowRoot;
    videoPlayerElement = shadowContainer.querySelector('video#vch-player');
    if (!videoPlayerElement) {
        debug("ERROR! Video player not found", videoPlayerElement);
        return
    }
    debug("Player setup", videoPlayerElement, sourceTrack.getSettings());


    /** @type {MediaStreamTrack} */
    let playerAudioTrack = null;
    /** @type {MediaStreamTrackProcessor} */
    let processor = null;
    let hasAlreadyPlayed = false;

    if (sourceTrack.kind === "audio") {

        // ToDo: Google Meet uses 2 audio tracks but I can only attach a single context
        // use webAudio to capture audio from the video element

        function captureAudio() {
            if (!audioCtx) {
                audioCtx = new AudioContext();
            }
            if (!sourceNode) {
                sourceNode = audioCtx.createMediaElementSource(videoPlayerElement);
            }
            if (!playerAudioTrack || playerAudioTrack.readyState === 'ended') {
                const destinationNode = audioCtx.createMediaStreamDestination();
                sourceNode.connect(destinationNode);
                audioCtx.setSinkId({type: "none"})
                    .catch((error) => debug("failed to mute audio - setSinkId error: ", error));
                videoPlayerElement.muted = false;
                playerAudioTrack = destinationNode.stream.getAudioTracks()[0];
            }

            // debug("captured videoplayer audio track: ", playerAudioTrack);
            return playerAudioTrack;
        }

        processor = new MediaStreamTrackProcessor(captureAudio());
    } else if (sourceTrack.kind === "video") {
        // debug("track settings: ", sourceTrack.getSettings());
        const {height, width, frameRate} = sourceTrack.getSettings();

        /* Things that didn't work

        // videoPlayer.height = height;
        // videoPlayer.width = width;

        // No srcObject, so you can't do this
        // const [videoPlayerSourceTrack] = videoPlayer.srcObject.getVideoTracks();
        // await videoPlayerSourceTrack.applyConstraints({height, width, frameRate});

        //
        // const playerVideoStream = videoPlayer.captureStream(frameRate);
        // const playerVideoTrack = playerVideoStream.getVideoTracks()[0];

        // const canvas = new OffscreenCanvas(width, height);   // no captureStream on an OffscreenCanvas
        */

        // Create a canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Implementing a cover to fit strategy
        function drawVideoPlayerToCanvas() {
            const sourceAspectRatio = videoPlayerElement.videoWidth / videoPlayerElement.videoHeight;
            const targetAspectRatio = width / height;
            let drawWidth, drawHeight, offsetX, offsetY;

            // Cover to fit strategy
            if (sourceAspectRatio > targetAspectRatio) {
                // Source is wider
                drawHeight = height;
                drawWidth = drawHeight * sourceAspectRatio;
                offsetX = (width - drawWidth) / 2;
                offsetY = 0;
            } else {
                // Source is taller
                drawWidth = width;
                drawHeight = drawWidth / sourceAspectRatio;
                offsetX = 0;
                offsetY = (height - drawHeight) / 2;
            }

            ctx.drawImage(videoPlayerElement, offsetX, offsetY, drawWidth, drawHeight);
            requestAnimationFrame(drawVideoPlayerToCanvas); // Keep updating the canvas with the video frame
        }

        drawVideoPlayerToCanvas();

        // Capture the stream from the canvas and get the track
        const canvasStream = canvas.captureStream(frameRate);
        const playerVideoTrack = canvasStream.getVideoTracks()[0];

        // uses videoHeight & videoWidth - no good way to change the size here
        // debug("player video settings: ", playerVideoTrack.getSettings());
        processor = new MediaStreamTrackProcessor(playerVideoTrack);
    } else {
        debug("ERROR! Video player fail - unknown kind: ", sourceTrack);
    }

    debug(`${sourceTrack.kind} player loaded`);


    /**
     * Start the player
     *  - data not currently used
     */
    mh.addListener(m.PLAYER_START, async (data) => {
        if (!videoPlayerElement) {
            debug("ERROR! Video player not loaded");
            return;
        }

        // if there is already a processor then assume we just need to resume
        if (hasAlreadyPlayed) {
            wmh.sendMessage(workerName, m.PLAYER_RESUME);
            videoPlayerElement.currentTime = 0;    // restart the video for now since I have no timing controls in dash
            videoPlayerElement.play()
                .catch((error) => debug("failed to resume video - error: ", error));
        }
        // otherwise start a new player transform in the worker
        else {
            const reader = processor.readable;
            wmh.sendMessage(workerName, m.PLAYER_START, {reader}, [reader]);
            videoPlayerElement.play()
                .catch((error) => debug("failed to play video - error: ", error));
            hasAlreadyPlayed = true;
        }
    });

    /**
     * Pause the player
     */
    mh.addListener(m.PLAYER_PAUSE, async (data) => {
        debug("player paused: ", data);
        wmh.sendMessage(workerName, m.PLAYER_PAUSE);
        videoPlayerElement.pause();
    });

    /**
     * End the player
     */
    mh.addListener(m.PLAYER_END, async (data) => {
        debug("player ended: ", data);
        wmh.sendMessage(workerName, m.PLAYER_END);
        if (videoPlayerElement) {
            videoPlayerElement.pause();
            videoPlayerElement.remove();
            videoPlayerElement = null;
        }
    });
}
