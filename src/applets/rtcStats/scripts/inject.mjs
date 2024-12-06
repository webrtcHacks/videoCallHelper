import {createClientMonitor} from "@observertc/client-monitor-js";
import {CONTEXT as c, MESSAGE as m, MessageHandler} from "../../../modules/messageHandler.mjs";
import {blobToBase64} from "../../../modules/base64.mjs";

const mh = new MessageHandler(c.INJECT);
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉🤓 `);

const pcs = new Map();          // Map of peer connections
let monitor;
let monitoring = false;

class TrackImageCapturer {

    /**
     * @typedef {Object} ImageObject
     * @property {string} id - The ID of the image
     * @property {Blob} image - The image as a Blob
     */

    /**
     * @param {Number} [outputHeight=70] - The height of the image; default to 70px
     * @param {Number} [outputWidth=124] - The width of the image; default to 124px
     */
    constructor(outputHeight = 70, outputWidth = 124) {
        this.height = outputHeight;
        this.width = outputWidth;
        this.processors = new Map();
        this.readers = new Map();
        this.canvases = new Map();
        this.ctxs = new Map();
        this.aspectRatios = new Map();
    }

    /**
     * Return a single image from the video track with the specified ID
     * @param {string} trackId - The ID of the video track to capture
     * @param {Array<MediaStreamTrack>} tracks - The array of tracks to capture images from
     * @returns {Promise<Blob|null>} - Promise that resolves to a blob of the image or null if no track found
     */
    async getImage(trackId, tracks) {
        const track = tracks.find(track => track && track.id === trackId);

        if (!track) {
            console.debug(`No track found for trackId ${trackId}`, tracks);
            return null;
        }
        else if(!track.enabled)
            debug(`Track ${trackId} is not enabled`, track);
        else if(track.readyState === "ended")
            debug(`Track ${trackId} is ended`, track);

        // set the width to the track source aspect ratio
        const aspectRatio = this.aspectRatios.get(trackId) || track.getSettings().aspectRatio || 16/9;
        this.aspectRatios.set(trackId, aspectRatio);
        const width = Math.max((aspectRatio * this.height).toFixed(0), this.width);

        if (!this.processors.has(trackId)) {
            try{
                const processor = new MediaStreamTrackProcessor({track});
                this.processors.set(trackId, processor);
                const r = await processor.readable.getReader();
                this.readers.set(trackId, r);
                const canvas = new OffscreenCanvas(1, 1);
                this.canvases.set(trackId, canvas);
                this.ctxs.set(trackId, canvas.getContext('bitmaprenderer'));
            } catch (e) {
                    debug(`Failed to create processor on track ${trackId}`, tracks);
                    return null;
                }

        }

        const reader = this.readers.get(trackId);

        if(!reader || reader.read) {
            // debug(`Failed to get reader on track ${trackId}`);
            this.readers.delete(trackId);
            return null;
        }

        const { value: frame, done } = await reader.read();

        if(done) {
            debug(`Reader is done on track ${trackId}`, tracks);
            return null;
        }
        if (!frame) {
            debug(`Failed to read frame on track ${trackId}`, tracks);
            return null;
        }

        const canvas = this.canvases.get(trackId);
        canvas.width = width;
        canvas.height = this.height;
        const ctx = this.ctxs.get(trackId);
        const imageBitmap = await createImageBitmap(frame, {
            resizeWidth: width || 124, // ToDo: find why width isn't set here
            resizeHeight: this.height,
            resizeQuality: 'low'
        });
        ctx.transferFromImageBitmap(imageBitmap);
        frame.close();
        const image =  await canvas.convertToBlob({type: 'image/jpeg'});
        if(!image)  debug(`Failed to create image on track ${trackId}`, tracks);
        return image;
    }
}

const imageCapturer = new TrackImageCapturer();

function getTrackStatsSummary(trackStats) {
    if (!trackStats) return null;

    const rtpEntries = trackStats.direction === 'inbound' ? [...trackStats.inboundRtps()] : [...trackStats.outboundRtps()];
    const codec = rtpEntries[0]?.getCodec()?.stats.mimeType;

    let layerInfo = false;
    if(trackStats?.layers?.length > 0)
        layerInfo = rtpEntries.map((entry, index    ) => {
        return {
            layerId: entry.stats?.rid || `L${index+1}`,
            height: entry.stats.frameHeight || "",
            width: entry.stats.frameWidth || "",
            fps: entry.stats.framesPerSecond || "",
            bitrateKbps: (entry?.sendingBitrate / 1000).toFixed(0) || "",
        }
    })

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
        bitrateKbps: (trackStats.bitrate / 1000).toFixed(0),
        direction: trackStats.direction,
        fractionLoss: trackStats.fractionLoss,
        // layers: trackStats.layers,
        remoteLostPackets: trackStats.remoteLostPackets,
        remoteReceivedPackets: trackStats.remoteReceivedPackets,
        roundTripTimeInS: trackStats.roundTripTimeInS,
        sendingBitrate: trackStats.sendingBitrate,
        sentPackets: trackStats.sentPackets,
        layerInfo: layerInfo
    }
}

/**
 * Handler for the stats-collected event
 * @param collectedStats
 * @returns {Promise<void>}
 */
async function listener(collectedStats) {

    // ToDo: only start listening once there is a peerConnection
    if(collectedStats?.length === 0){
        debug("No stats collected");
        return;
    }

    const pcStats = collectedStats.map(entry => monitor.getPeerConnectionStats(entry.peerConnectionId));
    const trackStats = monitor.tracks.map(trackStats => getTrackStatsSummary(trackStats));

    const videoTracks = [];

    // ToDo: come back to this - getImage is not working
    /*
    pcs.forEach((value) => {
        const peerConnection = value;
        // debug(`peerConnectionId ${key}`, peerConnection);
        peerConnection.getReceivers().forEach(receiver => {
            if(receiver?.track?.kind === 'video')
                videoTracks.push(receiver.track)
        });
        peerConnection.getSenders().forEach(sender => {
            if(sender?.track?.kind === 'video')
                videoTracks.push(sender.track)
        });
    });

    const images= [];
    for(const stats of trackStats) {
        if(stats.kind !== 'video') continue;
        if(stats.trackId==='probator') continue;    // ToDo: mediasoup debugging - probabor video track is messing up getImage
        // debug("stats", stats);
        const image = await imageCapturer.getImage(stats.trackId, videoTracks);
        if(image)
            images.push({trackId: stats.trackId, image: await blobToBase64(image)});
    }
     */
    const images= [];

    // debug("images:", images, "tracks", videoTracks);
    await mh.sendMessage(c.DASH, m.RTC_STATS_UPDATE, {aggStats: monitor.storage, trackStats, pcStats, images});

}

/**
 * Monitor the peer connection
 * @param {RTCPeerConnection} peerConnection - the peer connection to monitor
 * @returns {void}
 */
export function monitorPeerConnection(peerConnection) {

    // start monitoring if not already
    if (!monitoring){
        monitoring = true;
        monitor = createClientMonitor();

        monitor.on('stats-collected', (data) => listener(data.collectedStats));
        monitor.once('close', () => {
            monitor.off('stats-collected', (data) => listener(data.collectedStats));
        });
    }
    else {
        const collector = monitor.collectors.addRTCPeerConnection(peerConnection);
        debug(`Monitoring peer connection ${collector.id}:`, peerConnection);
        pcs.set(collector.id, peerConnection);

    }
}



// Add monitor for debugging
document.addEventListener('DOMContentLoaded', async () => {
    window.vch.monitor = monitor;
    debug("monitor added to window", monitor);
});
