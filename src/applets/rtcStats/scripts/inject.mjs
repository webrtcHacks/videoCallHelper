import {createClientMonitor} from "@observertc/client-monitor-js";
import {CONTEXT as c, MESSAGE as m, MessageHandler} from "../../../modules/messageHandler.mjs";
import {blobToBase64} from "../../../modules/base64.mjs";

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
     * @param {Number} [outputHeight=70] - The height of the image; default to 70px
     */
    constructor(peerConnection, outputHeight = 70) {
        this.peerConnection = peerConnection;
        this.height = outputHeight;
        this.processors = new Map();
        this.readers = new Map();
        this.canvases = new Map();
        this.ctxs = new Map();
        this.aspectRatios = new Map();
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

        // set the width to the track source aspect ratio
        let width;
        if(!this.aspectRatios.has(trackId)){
            const {aspectRatio} = track.getSettings();
            this.aspectRatios.set(trackId, aspectRatio);
            width =  aspectRatio * this.height;
        } else{
            width = this.aspectRatios.get(trackId) * this.height;
        }

        // debug(`trackId ${trackId}`, track);

        if (!this.processors.has(trackId)) {
            const processor = new MediaStreamTrackProcessor({ track });
            this.processors.set(trackId, processor);
            this.readers.set(trackId, processor.readable.getReader());
            const canvas = new OffscreenCanvas(width, this.height);
            this.canvases.set(trackId, canvas);
            this.ctxs.set(trackId, canvas.getContext('bitmaprenderer'));
        }

        const reader = this.readers.get(trackId);
        const { value: frame } = await reader.read();

        if (!frame) {
            return null;
        }

        const ctx = this.ctxs.get(trackId);
        const imageBitmap = await createImageBitmap(frame, {
            resizeWidth: width || this.height * 16/9,
            resizeHeight: this.height,
            resizeQuality: 'low'
        });
        // debug(`track ${trackId} image`, imageBitmap);
        ctx.transferFromImageBitmap(imageBitmap);
        frame.close();
        const image = await this.canvases.get(trackId).convertToBlob({ type: 'image/jpeg' });
        // debug(`track ${trackId} image`, image);
        return image
    }
}

// temp for testing
function getTrackStatsSummary(trackStats) {
    if (!trackStats) return null;

    const rtpEntries = trackStats.direction === 'inbound' ? [...trackStats.inboundRtps()] : [...trackStats.outboundRtps()];
    const codec = rtpEntries[0]?.getCodec()?.stats.mimeType;

    /*
    debug(`Track ${trackStats.trackId} stats:`, {
        codec,
        'RTT / loss': `${trackStats.roundTripTimeInS} / ${trackStats.fractionLoss}%`,
        bitrate: `${trackStats.bitrate / 1000} kbps`,
    });
     */
    // debug(`${trackStats.kind} track ${trackStats.trackId} stats`, statsSummary); // trackStats.trackId
    return {
        trackId: trackStats.trackId,
        kind: trackStats.kind,
        codec: codec,
        jitter: trackStats.jitter,
        bitrateKbps: trackStats.bitrate / 1000,
        direction: trackStats.direction,
        fractionLoss: trackStats.fractionLoss,
        layers: trackStats.layers,
        remoteLostPackets: trackStats.remoteLostPackets,
        remoteReceivedPackets: trackStats.remoteReceivedPackets,
        roundTripTimeInS: trackStats.roundTripTimeInS,
        sendingBitrate: trackStats.sendingBitrate,
        sentPackets: trackStats.sentPackets
    }
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

        const trackStatsArray = [];
        for (const trackStats of monitor.tracks) {

            let trackStatsSummary = getTrackStatsSummary(trackStats);
            if(trackStats.kind ==='video'){
                const imageBlob =  await imageCapturer.getImage(trackStats.trackId);

                if(trackStats.direction === 'inbound')
                    debug(`inbound track image ${trackStats.trackId} image`, imageBlob);
                if(imageBlob)
                    trackStatsSummary['image'] = await blobToBase64(imageBlob);
            }
            trackStatsArray.push(trackStatsSummary);

        }

        const aggStatsSummary = monitor.storage;

        // debug(trackStatsArray);
        await mh.sendMessage(c.DASH, m.RTC_STATS_UPDATE, {aggStats: aggStatsSummary, trackStats: trackStatsArray});


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
