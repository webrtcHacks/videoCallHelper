import {createClientMonitor} from "@observertc/client-monitor-js";
import {CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";

const mh = new MessageHandler(c.INJECT);
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉🧮 `);

const monitor = createClientMonitor();

class TrackImageCapturer {

    /**@type {Array.<MediaStreamTrack>}
    tracksImages = []

    /**
     * Capture a images from a video track
     * @param {Array.<MediaStreamTrack>} tracks - the video track to capture
     * @param {Number} width - the width of the image; default to 200px (4:3 aspect ratio)
     * @param {Number} height - the height of the image; default to 150px
     */
    constructor(tracks, width = 150 * 4/3, height = 150) {
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
     * @returns {Promise<Blob>} - promise that resolves to a blob of the image
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

    /**
     * Get the track capturer for a specific track
     * @param track - the track to capture images from
     * @returns {Promise<Blob>} - promise that resolves to a blob of the image
     */
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

    /**
     * Capture a single image from all video tracks in the peer connection
     * @returns {Promise<{senderImages: (Awaited<unknown>[]|undefined), receiverImages: (Awaited<unknown>[]|undefined)}>}
     */
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

// temp for testing
function printTrackStats(trackStats) {
    if (!trackStats) return;

    const rtpEntries = trackStats.direction === 'inbound' ? [...trackStats.inboundRtps()] : [...trackStats.outboundRtps()];
    const codec = rtpEntries[0]?.getCodec()?.stats.mimeType;

    debug(`Track ${trackStats.trackId} stats:`, {
        codec,
        'RTT / loss': `${trackStats.roundTripTimeInS} / ${trackStats.fractionLoss}%`,
        bitrate: `${trackStats.bitrate / 1000} kbps`,
    });
    // debug('track stats', trackStats); // trackStats.trackId
}


/**
 * Monitor the peer connection
 * @param {RTCPeerConnection} peerConnection - the peer connection to monitor
 */
export function monitorPeerConnection(peerConnection) {

    const videoTracks = peerConnection.getTransceivers().map(transceiver => transceiver.sender?.track || transceiver.receiver?.track)
        .filter(track => track && track.kind === 'video');
    // list for new and removed tracks and update videoTracks
    peerConnection.addEventListener('track', (event) => {
        if (event.track.kind === 'video') {
            videoTracks.push(event.track);
        }
    });



    const collector = monitor.collectors.addRTCPeerConnection(peerConnection);
    debug(`Monitoring peer connection ${collector.id}:`, peerConnection);



    async function listener() {
        if(peerConnection.connectionState === 'closed'){
            collector.close();
            return;
        }
        const pcStats = monitor.getPeerConnectionStats(collector.id);
        // debug(`stats data for peerConnection ${collector.id}:`, pcStats)
        // const images = await imageCapturer.captureImages();
        // debug("stats data:", {images, id: collector.id, stats: pcStats})

        for (const trackStats of monitor.tracks) {
            // get the image for each track
            // const image = await imageCapturer.getTrackCapturer(trackStats.track).getImage();
            // input: trackStats.trackId -> output: image
            printTrackStats(trackStats);
        }
    }

    monitor.once('close', () => {
        monitor.off('stats-collected', listener);
    });
    monitor.on('stats-collected', listener);



}

// Add monitor for debugging
document.addEventListener('DOMContentLoaded', async () => {
    window.vch.monitor = monitor;
});
