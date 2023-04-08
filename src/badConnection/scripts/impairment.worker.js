// Import not workinng when this whole file is loaded inline
// import {Impairment} from "../../badConnection/scripts/impairment.mjs";
/*
self.onmessage = function(e) {
    console.debug('Worker received data:', e.data);
}
*/

// ToDo: put this back as a separate module and figure out how to get webpack to load it
/*
 * Class that sets up a transform stream that can add an impairment
 * The constructor and takes a track settings object and an  impairment config object
 *  and returns a Transform Stream object set to `passthrough`
 * The Encoder/Decoder with impairment is invoked of the operation = `impair`
 * 'passthrough' just pushes the frame through without modification
 * The start function changes the operation to 'impair'
 * The config setter applies an impairment configuration
 * Static classes are included for a moderation and severe impairment
 */
class Impairment {
    #controller;
    operation = 'passthrough';
    #encoder;
    #decoder;
    #frameCounter = 0;
    #forceKeyFrame = false;

    kind;
    codecConfig;
    impairmentConfig;
    id;
    track;
    trackSettings;

    static moderateImpairmentConfig = {
        audio: {
            loss: 0.25,
            payloadSize: 400,
            delayMs: 500,
            // codec config
            bitrate: 10_000
        },
        video: {
            loss: 0.0025,
            payloadSize: 90,
            keyFrameInterval: 30,
            delayMs: 250,
            // codec config
            widthFactor: 2,
            heightFactor: 2,
            bitrate: 750_000,
            framerateFactor: 2
        }
    }

    static severeImpairmentConfig = {
        audio: {
            loss: 0.50,
            payloadSize: 400,
            delayMs: 700,
            // codec config
            bitrate: 6_000
        },
        video: {
            loss: 0.05,
            payloadSize: 90,
            keyFrameInterval: 15,
            delayMs: 500,
            // codec config
            widthFactor: 4,
            heightFactor: 4,
            bitrate: 300_000,
            framerateFactor: 4
        }
    }

    // Placeholder impairment values
    loss = 0.005;
    payloadSize = 90;
    keyFrameInterval = 100;
    delayMs = 200;

    // ToDo: apply the impairment to the track settings
    constructor(track, impairmentConfig = Impairment.moderateImpairmentConfig) {

        this.track = track;
        this.kind = track.kind;
        this.id = track.id;
        this.trackSettings = track.getSettings();// trackSettings;
        this.impairmentConfig = impairmentConfig;

        this.#loadConfig();
        this.#setupCodec();
    }

    /*static #debug(...messages) {
        console.debug(`vch 💉😈 `, ...messages);
    }
     */
    static #debug = Function.prototype.bind.call(console.debug, console, `vch 💉😈️: `);

    async #sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ToDo: update impairment values here
    #addPacketLoss(chunk) {
        let chunkWithLoss = new Uint8Array(chunk.byteLength);
        chunk.copyTo(chunkWithLoss);

        // getStats analysis showed the headers are ~30 bytes on video;
        // could do the math based on details here: https://datatracker.ietf.org/doc/html/rfc6386#section-9.1
        // errors return if the video header isn't included
        // found 16 worked best with experimentation
        // audio works fine without any header - including it includes some audio information, so ruins the effect
        for (let n = this.kind === 'audio' ? 0 : 16; n <= chunkWithLoss.byteLength; n += this.payloadSize) {
            if (Math.random() <= this.loss)
                chunkWithLoss.fill(0, n, n + this.payloadSize);
        }
        const chunkObj = {
            timestamp: chunk.timestamp,
            type: chunk.type,
            data: chunkWithLoss
        };

        if (this.kind === 'video')
            return new EncodedVideoChunk(chunkObj);
        else if (this.kind === 'audio')
            return new EncodedAudioChunk(chunkObj);
    }

    // WebCodecs setup
    #setupCodec() {
        const handleDecodedFrame = frame => {
            if (this.operation === 'kill') {
                frame.close();
            } else {
                try {
                    this.#controller.enqueue(frame)
                } catch (err) {
                    Impairment.#debug("controller enqueue error", err);
                }
            }
        }

        const handleEncodedFrame = async (chunk, metadata) => {
            if (metadata.decoderConfig) {
                Impairment.#debug(`${this.kind} metadata: `, metadata);
            }
            const modifiedChunk = this.#addPacketLoss(chunk, this.kind);
            await this.#sleep(this.delayMs);

            // ToDo: figure out how to make sure this has a keyframe after configure
            // hypothesis: packets caught in sleep function
            // add something like if(this.#frameIgnore
            try {
                this.#decoder.decode(modifiedChunk)
            } catch (err) {
                Impairment.#debug(`frame ${this.#frameCounter}`, err)
            }
        }

        if (this.kind === 'video') {
            // Video decode
            this.#decoder = new VideoDecoder({output: handleDecodedFrame, error: debug});
            this.#decoder.configure(this.codecConfig);
            // Video encode
            this.#encoder = new VideoEncoder({output: handleEncodedFrame, error: debug});
            this.#encoder.configure(this.codecConfig);
        } else if (this.kind === 'audio') {
            // Audio decode
            this.#decoder = new AudioDecoder({output: handleDecodedFrame, error: debug});
            this.#decoder.configure(this.codecConfig);
            // Audio encode
            this.#encoder = new AudioEncoder({output: handleEncodedFrame, error: debug});
            this.#encoder.configure(this.codecConfig);
        }
    }

    #loadConfig() {
        if (this.kind === 'video') {
            const {height, width, frameRate} = this.trackSettings;
            const {widthFactor, heightFactor, framerateFactor} = this.impairmentConfig.video;

            // Configure the codec
            this.codecConfig = {
                // ToDO: this was 'vp8' - try h264 for better hardware acceleration
                codec: "avc1.420034",
                width: (width / (widthFactor || 1)).toFixed(0),
                height: (height / (heightFactor || 1)).toFixed(0),
                framerate: (frameRate / (framerateFactor || 1)).toFixed(0)
            }

            // Set up the impairment
            const {loss, payloadSize, keyFrameInterval, delayMs} = this.impairmentConfig.video;
            this.loss = loss || 0;
            this.payloadSize = payloadSize || 90;
            this.keyFrameInterval = keyFrameInterval || 100;
            this.delayMs = delayMs || 10;
        } else if (this.kind === 'audio') {
            // Configure the codec
            const {channelCount, sampleRate} = this.trackSettings;
            const {loss, payloadSize, delayMs, bitrate} = this.impairmentConfig.audio;

            this.codecConfig = {
                codec: 'opus',
                numberOfChannels: channelCount || 1,
                sampleRate: sampleRate,
                bitrate: Math.max(bitrate || 10_000, 6_000)
            }

            // Set up the impairment
            this.loss = loss || 0;
            this.payloadSize = payloadSize || 400;
            this.delayMs = delayMs || 10;
        }

    }

    get transformStream() {
        return new TransformStream({
            start: (controller) => this.#controller = controller,
            transform: async (frame) => {
                if (this.operation === 'kill' || this.track.readyState === 'ended') {
                    this.#encoder.flush();
                    this.#encoder.close();
                    this.#decoder.flush();
                    this.#decoder.close();
                    debug(`this impairment track ${this.id} closed`);
                } else if (this.#encoder.encodeQueueSize > 2) {
                    Impairment.#debug(`${this.kind} encoder overwhelmed, dropping frame`, frame)
                    frame.close();
                } else {
                    // Start webcodecs for impairment
                    if (this.operation === 'impair') {
                        const keyFrame = this.#frameCounter % this.keyFrameInterval === 0 || this.#forceKeyFrame;
                        if (this.#forceKeyFrame) {
                            Impairment.#debug(`set ${this.#frameCounter} to keyframe`);
                            this.#forceKeyFrame = false;
                        }
                        this.#frameCounter++;
                        await this.#encoder.encode(frame, this.kind === 'video' ? {keyFrame} : null);
                    }
                    // Do nothing and re-enqueue the frame
                    else if (this.operation === 'passthrough') {
                        await this.#controller.enqueue(frame);
                    }
                    // Drop the frame
                    else if (this.operation === 'skip') {
                        // ToDo: skip in the case of track.readyState === 'live' and track.enabled = false indicating muted status?
                        // Impairment.#debug("skipping frame");
                    }
                    // Something went wrong
                    else {
                        Impairment.#debug(`invalid operation: ${this.operation}`);
                    }
                    frame.close();
                }
            },
            flush: (controller) => {
                // from https://streams.spec.whatwg.org/#transformstream: (Note that there is no need to call
                // controller.terminate() inside flush(); the stream is already in the process of successfully closing
                // down, and terminating it would be counterproductive.)
                // controller.terminate();
            }
        })
    }

    set config(config) {
        this.impairmentConfig = config;

        this.#encoder.flush().then(() => {
            this.#loadConfig();
            this.#encoder.configure(this.codecConfig);
            this.#decoder.configure(this.codecConfig);
            this.#forceKeyFrame = true;
            this.#decoder.flush();
        }).catch(err => Impairment.#debug(`codec config error at frame ${this.#frameCounter}`, err))

        Impairment.#debug(`New configuration. Operation state: ${this.operation}. Config: `, config)
    }

    start() {
        this.operation = "impair";
        Impairment.#debug(`start: processing ${this.kind} ${this.id}`);
    }

    pause() {
        this.operation = "passthrough";
        Impairment.#debug(`passthrough: removing impairment on ${this.kind} ${this.id}`);
    }

    async stop() {
        this.operation = "kill";
        await this.#sleep(100); // give some time to finalize the last frames
        Impairment.#debug(`kill: stopped ${this.kind} ${this.id}`);
    }
}



const debug = Function.prototype.bind.call(console.debug, console, `vch 😈👷 `);
debug("I am a worker");

let stopped = false;
let videoFrameCounter = 0;
let manualSendKeyFrame = false;
let keyFrameRate = 30;
let videoController, audioController;
let delayMs = 500; // delay in ms
// reference: https://github.com/webrtc/samples/blob/gh-pages/src/content/insertable-streams/video-crop/js/worker.js

// ToDo: replace this example with the Impairment class
// Message handler
onmessage = async (event) => {
    const {operation} = event.data;

    if (operation === 'video') {
        debug("processing video");
        const {videoReader, videoWriter} = event.data;
        await videoReader
            // .pipeThrough(new TransformStream({transform}))
            .pipeThrough(new TransformStream({
                start: controller => videoController = controller,
                transform: async (frame) => {

                    if (stopped)
                        frame.close();
                    else
                        return frame
                },
                flush: (controller) => {
                    controller.terminate();
                }
            }))
            .pipeTo(videoWriter);
    } else if (operation === 'audio') {
        debug("not doing audio")
    } else if (operation === 'stop') {
        debug("stopping stream");
        stopped = true;
        // await videoReader.cancel(); // no cancel method
    } else {
        debug(`Unhandled message: `, event);
    }
};

