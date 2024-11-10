import {createClientMonitor} from "@observertc/client-monitor-js";
import {CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";

const mh = new MessageHandler(c.INJECT);
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉🧮 `);

const monitor = createClientMonitor();

class TrackImageCapturer {
    /**
     * Capture a images from a video track
     * @param {MediaStreamTrack} track - the video track to capture
     * @param {Number} width - the width of the image; default to 200px (4:3 aspect ratio)
     * @param {Number} height - the height of the image; default to 150px
     */
    constructor(track, width = 150 * 4/3, height = 150) {
        if (track.kind !== 'video') {
            throw new Error('Track must be a video track');
        }
        this.track = track;
        this.width = width;
        this.height = height;
        this.processor = new MediaStreamTrackProcessor({ track });
        this.reader = this.processor.readable.getReader();
        this.canvas = new OffscreenCanvas(this.width, this.height);
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * return a single image from the video track
     * @returns {Promise<Blob>}
     */
    async getImage() {
        const { value: frame } = await this.reader.read();

        if(!frame){
            return null;
        }

        this.ctx.drawImage(frame, 0, 0, this.width, this.height);
        frame.close();
        return this.canvas.convertToBlob({ type: 'image/jpeg' });
    }
}

class VideoTrackImageCapturer {
    /**
     * Capture images from all video tracks in a peer connection
     * @param {RTCPeerConnection} peerConnection - the peer connection to capture images from
     */
    constructor(peerConnection) {
            this.peerConnection = peerConnection;
            this.trackCapturers = new Map();
        }

    getTrackCapturer(track) {
        if (!this.trackCapturers.has(track.id)) {
            const { width, height } = track.getSettings();
            const aspectRatio = width / height;
            const targetHeight = 150;
            const targetWidth = targetHeight * aspectRatio || 16/9;
            this.trackCapturers.set(track.id, new TrackImageCapturer(track, targetWidth, targetHeight));
        }
        return this.trackCapturers.get(track.id);
    }

    async captureImages() {
        const senders = this.peerConnection.getSenders()
            .filter(sender => sender.track && sender.track.kind === 'video');
        const receivers = this.peerConnection.getReceivers()
            .filter(receiver => receiver.track && receiver.track.kind === 'video');

        const senderImages = senders.length > 0 ?
            await Promise.all(senders.map(sender => this.getTrackCapturer(sender.track).getImage())) : undefined;
        const receiverImages = receivers.length > 0 ?
            await Promise.all(receivers.map(receiver => this.getTrackCapturer(receiver.track).getImage())) : undefined;

        return {
            senderImages: senderImages?.length > 0 ? senderImages : undefined,
            receiverImages: receiverImages?.length > 0 ? receiverImages : undefined
        };
    }
}


/**
 * Monitor the peer connection
 * @param {RTCPeerConnection} peerConnection
 */
export function monitorPeerConnection(peerConnection) {
    monitor.collectors.addRTCPeerConnection(peerConnection);
    const imageCapturer = new VideoTrackImageCapturer(peerConnection);
    const id = Math.random().toString().substring(10);
    debug(`Monitoring peer connection ${id}:`, peerConnection);


    monitor.on("stats-collected", async () => {
        if(peerConnection.connectionState !== 'connected'){
            debug(`Connection ${id} is not connected, closing monitor`);
            monitor.close();
            return;
        }


        //debug(`${monitor.storage['id']}`,monitor.storage);

        const images = await imageCapturer.captureImages();
        debug("stats data:", {images, id, stats: monitor.storage})

        // debug(`Images:`, images);
        // const data = {images, stats: JSON.stringify(monitor.storage)};
        // mh.sendMessage(c.DASH, 'stats', ...data);

    });
}
