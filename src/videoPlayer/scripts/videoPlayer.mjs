
/**
 * Helper to convert base64 needed for localStorage to ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
export function base64ToBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Helper to convert ArrayBuffer to base64 needed for localStorage
 * @param buffer
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 *
 */
export class VideoPlayer{

    #decoder;

    constructor(sourceArrayBuffer, debug = {}) {
        this.source = sourceArrayBuffer;
        this.debug = debug;
        this.currentFrame = null;
    }

    async play(){
        // In your worker script

            this.#decoder = new VideoDecoder({
                output: frame => {
                    this.currentFrame.close();
                    this.currentFrame = frame;
                    debug(frame);
                },
                error: e => console.error(e)
            });

            const config = {
                codec: 'avc1.64001f', // Replace with the correct AVC codec string for your video
                description: spsAndPpsBuffer, // ArrayBuffer containing the SPS and PPS data
                // codec: 'vp8',
            };

            this.#decoder.configure(config);

            // Assume the entire file is a single encoded chunk for simplicity
            this.#decoder.decode(new EncodedVideoChunk({
                type: 'key', // or 'delta' for non-keyframes
                timestamp: 0, // in microseconds
                data: this.source
            }));

        }

        async stop() {
            this.currentFrame.close();
            await this.#decoder.flush(); // Ensure all queued frames are emitted
        }

        get frame(){
            return this.currentFrame;
        }

}



export class VideoPlayerFromVideoElement {

    videoProcessor
    videoReader

    constructor(source, debug = {}) {
        this.source = source;
        this.debug = debug;
    }

    #createMediaStreamTrackFromVideoFile() {
        return new Promise((resolve, reject) => {
            // Create a video element
            this.videoElement = document.createElement('video');
            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.loop = true; // Optional: Loop if you want continuous stream

            videoElement.src = this.source;

            // When the video metadata is loaded, start playing
            videoElement.onloadedmetadata = () => {
                videoElement.play().then(() => {
                    // Capture the stream from the video element
                    const stream = videoElement.captureStream();
                    const [videoTrack] = stream.getVideoTracks();
                    resolve(videoTrack);
                }).catch(reject);
            };

            // Handle video element errors
            videoElement.onerror = () => {
                reject(new Error(`Error loading video file: ${this.source}`));
            };
        });
    };

    async play(){
        this.debug("starting video player");
        const videoTrack = await this.#createMediaStreamTrackFromVideoFile(this.source);
        this.videoProcessor = new MediaStreamTrackProcessor(videoTrack);
        this.videoReader = this.videoProcessor.readable.getReader();
    }

    pause(){
        this.debug("pausing video player");
        this.videoElement.pause();
    }

    async unPause(){
        this.debug("unpausing video player");
        await this.videoElement.play();
    }

    async stop(){
        this.debug("stopping video player");
        this.videoElement.pause();
        this.videoElement = null;
        this.videoReader.releaseLock();
    }

    /** @type {VideoFrame} */
    async readFrame(){
        const {done, value} = await this.videoReader.read();
        if(done){
            this.debug("video player has finished reading all frames");
            return null;
        }
        return value;
    }
}
