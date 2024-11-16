import {createClientMonitor} from "@observertc/client-monitor-js";
import {CONTEXT as c, MessageHandler} from "../../../modules/messageHandler.mjs";

const mh = new MessageHandler(c.INJECT);
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉🤓 `);

const monitor = createClientMonitor();

class TrackImageCapturer {

    /**
     * @typedef {Object} ImageObject
     * @property {string} id - The ID of the image
     * @property {Blob} image - The image as a Blob
     */

    /**
     * @param {RTCPeerConnection} peerConnection - The peer connection to capture images from
     * @param {Number} [width=200] - The width of the image; default to 200px (4:3 aspect ratio)
     * @param {Number} [height=150] - The height of the image; default to 150px
     */
    constructor(peerConnection, width = 200, height = 150) {
        this.peerConnection = peerConnection;
        this.width = width;
        this.height = height;
        this.processors = new Map();
        this.readers = new Map();
        this.canvases = new Map();
        this.ctxs = new Map();
    }

    /**
     * Return a single image the video track with the specified ID
     * @param {string} trackId - The ID of the video track to capture
     * @returns {Promise<Blob|null>} - Promise that resolves to a blob of the image or null if no track found
     */
    async getImage(trackId) {
        let track = this.peerConnection.getTransceivers()
            .map(transceiver => transceiver.sender?.track || transceiver.receiver?.track)
            .find(track => track && track.id === trackId);

        if (!track || track.kind !== 'video') {
            return null;
        }

        if (!this.processors.has(trackId)) {
            const processor = new MediaStreamTrackProcessor({ track });
            this.processors.set(trackId, processor);
            this.readers.set(trackId, processor.readable.getReader());
            const canvas = new OffscreenCanvas(this.width, this.height);
            this.canvases.set(trackId, canvas);
            this.ctxs.set(trackId, canvas.getContext('bitmaprenderer'));
        }

        const reader = this.readers.get(trackId);
        const { value: frame } = await reader.read();

        if (!frame) {
            return null;
        }

        const ctx = this.ctxs.get(trackId);
        ctx.drawImage(frame, 0, 0, this.width, this.height);
        frame.close();
        return this.canvases.get(trackId).convertToBlob({ type: 'image/jpeg' });
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

    const collector = monitor.collectors.addRTCPeerConnection(peerConnection);
    debug(`Monitoring peer connection ${collector.id}:`, peerConnection);
    const imageCapturer = new TrackImageCapturer(peerConnection);

    async function listener() {
        if(peerConnection.connectionState === 'closed'){
            collector.close();
            return;
        }
        const pcStats = monitor.getPeerConnectionStats(collector.id);

        for (const trackStats of monitor.tracks) {

            if(trackStats.kind === 'video'){
                const image = await imageCapturer.getImage(trackStats.trackId);
                debug(`track stats on ${trackStats.trackId}:`, trackStats, image);
            }
            else
                // handle audio
                debug(`track stats on ${trackStats.trackId}:`, trackStats);
            // printTrackStats(trackStats);
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
