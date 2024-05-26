import {MESSAGE as m, CONTEXT as c, MessageHandler, InjectToWorkerMessageHandler} from "../../modules/messageHandler.mjs";

const mh = new MessageHandler(c.INJECT);
const wmh = new InjectToWorkerMessageHandler();
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️🎥 `);


let playerAudioTrack = null;


/**
 * Setup the video player
 *  - video: create a canvas to capture and resize the video and get the track
 *  - audio: create a MediaStreamDestination to capture the audio and get the track
 *  - passes a readable stream to the worker
 * @param {MediaStreamTrack} sourceTrack - the track to play
 * @param {string} workerName - the name of the worker to send messages to
 */
export function setupPlayer(sourceTrack, workerName) {

    let videoPlayer;

    /**
     * Set up the canvas or audio context on player start
     */
    mh.addListener(m.PLAYER_START, async (data) => {
        debug("player loaded: ", data);
        /**@type {HTMLVideoElement} */
        videoPlayer = document.querySelector(`video#${data.id}`);
        debug(sourceTrack.getSettings());

        let processor;

        if (sourceTrack.kind === "audio") {

            // ToDo: Google Meet uses 2 audio tracks but I can only attach a single context
            // use webAudio to capture audio from the video element

            async function captureAudio(mediaElement){
                if(!playerAudioTrack || playerAudioTrack?.readyState === 'ended'){
                    const audioCtx = new AudioContext();
                    const sourceNode = audioCtx.createMediaElementSource(videoPlayer);
                    const destinationNode = audioCtx.createMediaStreamDestination();
                    sourceNode.connect(destinationNode);
                    // mute the video without muting the source
                    audioCtx.setSinkId({type: "none"})
                        .catch((error) => debug("failed to mute audio - setSinkId error: ", error));
                    videoPlayer.muted = false;
                    playerAudioTrack = destinationNode.stream.getAudioTracks()[0];
                }

                debug("capture videoplayer audio track: ", playerAudioTrack);
                return playerAudioTrack;
            }

            processor = new MediaStreamTrackProcessor(await captureAudio(videoPlayer));
        } else if (sourceTrack.kind === "video") {
            debug("track settings: ", sourceTrack.getSettings());
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
                const sourceAspectRatio = videoPlayer.videoWidth / videoPlayer.videoHeight;
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

                ctx.drawImage(videoPlayer, offsetX, offsetY, drawWidth, drawHeight);
                requestAnimationFrame(drawVideoPlayerToCanvas); // Keep updating the canvas with the video frame
            }

            drawVideoPlayerToCanvas();

            // Capture the stream from the canvas and get the track
            const canvasStream = canvas.captureStream(frameRate);
            const playerVideoTrack = canvasStream.getVideoTracks()[0];

            // uses videoHeight & videoWidth - no good way to change the size here
            debug("player settings: ", playerVideoTrack.getSettings());
            processor = new MediaStreamTrackProcessor(playerVideoTrack);
        } else {
            debug("ERROR! Video player fail - unknown kind: ", sourceTrack);
            return;
        }

        const reader = processor.readable;

        wmh.sendMessage(workerName, m.PLAYER_START, {reader}, [reader]);
        await videoPlayer.play();

    });

    /**
     * Stop the player
     */
    mh.addListener(m.PLAYER_STOP, async (data) => {
        debug("player stopped: ", data);
        wmh.sendMessage(workerName, m.PLAYER_STOP);
        videoPlayer.pause();
    });
}
