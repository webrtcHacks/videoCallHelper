//import {VideoFrameScaler} from './webGLresize.mjs';

/**
 * Class that sets up a transform stream that can add an impairment
 * The constructor and takes a track settings object and an  impairment config object
 *  and returns a Transform Stream object set to `passthrough`
 * The Encoder/Decoder with impairment is invoked of the operation = `impair`
 * 'passthrough' just pushes the frame through without modification
 * The start function changes the operation to 'impair'
 * The config setter applies an impairment configuration
 * Static class objects are included for a moderation and severe impairment
 * @type {Impairment} - a TransformStream object
 * @param {string} kind - 'audio' or 'video'
 * @param {MediaStreamTrackSettings} settings - the track settings object
 * @param {string} id - an optional id for the impairment
 * @param {object} impairmentConfig - an optional impairment configuration object
 * @param {object} debug - an optional debug object
 */
export class Impairment {
    #controller;
    operation = 'passthrough';
    #encoder;
    #decoder;
    frameCounter = 0;
    #forceKeyFrame = false;

    kind;
    codecConfig;
    impairmentConfig;
    id;
    track;
    trackSettings;

    static moderateImpairmentConfig = {
        audio: {
            loss:   0.25,
            payloadSize: 400,
            delayMs: 500,
            // codec config
            bitrate: 10_000
        },
        video: {
            loss:  0.05, //0.0025,
            payloadSize: 90,
            keyFrameInterval: 30,
            delayMs: 250,
            // codec config
            widthFactor: 2,
            heightFactor: 2,
            bitrate: 400_000,   // 750_000
            framerateFactor: 2,
            frameDrop: 0.2,
            frameRate: 10

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
            loss: 0.1, // 0.05,
            payloadSize: 90,
            keyFrameInterval: 30,   // 15
            delayMs: 500,
            // codec config
            widthFactor: 8,        // 4
            heightFactor: 8,        // 4
            bitrate: 25_000,       // 300_000
            framerateFactor: 4,
            frameDrop: 0.5,
            frameRate: 5
        }
    }

    // Placeholder impairment values
    loss = 0.005;
    payloadSize = 90;
    keyFrameInterval = 300;     // was 100
    delayMs = 200;
    frameDrop = 0.01;

    // static #debug = Function.prototype.bind.call(console.debug, console, `vch 😈🫙️`);


    // ToDo: apply the impairment to the track settings
    constructor(kind, settings, id=null,  impairmentConfig = Impairment.moderateImpairmentConfig, debug = {}) {

        // this.track = track;
        this.kind = kind;
        this.id = id || Math.random().toString(36).substring(2, 15);
        this.trackSettings = settings;   // trackSettings;
        this.impairmentConfig = impairmentConfig;
        this.debug = debug;

        if(this.kind === 'video'){
            // this.scaler = new VideoFrameScaler(impairmentConfig.video.widthFactor || 1);
            this.canvas = new OffscreenCanvas(settings.width, settings.height);
            this.ctx = this.canvas.getContext('bitmaprenderer');

        }

        // ToDo: **make this a promise so we can cancel if the codec config doesn't work?
        this.#loadConfig();
        this.#setupCodec();
    }


    async #sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    // This wasn't working consistently - h264 problem?
    #addPacketLoss(chunk) {
        let chunkWithLoss = new Uint8Array(chunk.byteLength);
        chunk.copyTo(chunkWithLoss);

        // getStats analysis showed the headers are ~30 bytes on video;
        // could do the math based on details here: https://datatracker.ietf.org/doc/html/rfc6386#section-9.1
        // errors return if the video header isn't included
        // found 16 worked best with experimentation
        // audio works fine without any header - including it includes some audio information, so ruins the effect

        // changed the 16
        for (let n = this.kind === 'audio' ? 0 : 16; n <= chunkWithLoss.byteLength; n += this.payloadSize) {
            if (Math.random() <= this.loss)
                chunkWithLoss.fill(0, n, n + this.payloadSize);
        }
        const chunkObj = {
            type: chunk.type,
            data: chunkWithLoss,
            timestamp: chunk.timestamp,
            duration: chunk.duration
        };

        if (this.kind === 'video'){
            const newChunk = new EncodedVideoChunk(chunkObj);
            // this.debug("chunk", chunk, "\nnew Chunk", newChunk );
            return newChunk;
        }
        else if (this.kind === 'audio')
            return new EncodedAudioChunk(chunkObj);
    }

    // WebCodecs setup
    #setupCodec() {
        const handleDecodedFrame = async frame => {
            if (this.operation === 'kill') {
                frame.close();
            } else {
                try {
                    // Upscale the video frame to the original resolution
                    if(this.kind === 'video'){

                        const newHeight = frame.displayHeight * (this.impairmentConfig.video.heightFactor || 1);
                        const newWidth = frame.displayWidth * (this.impairmentConfig.video.widthFactor || 1);

                        const bitmap = await createImageBitmap(frame, {resizeHeight: newHeight, resizeWidth: newWidth});
                        this.canvas.width = newWidth;
                        this.canvas.height = newHeight;

                        this.ctx.transferFromImageBitmap(bitmap);
                        const scaledFrame = new VideoFrame(this.canvas, {timestamp: frame.timestamp});
                        frame.close();
                        this.#controller.enqueue(scaledFrame);
                    } else {
                        this.#controller.enqueue(frame);
                    }
                } catch (err) {
                    this.debug("controller enqueue error", err);
                }
            }
        }

        const handleEncodedFrame = async (chunk, metadata) => {
            if (metadata.decoderConfig) {
                this.debug(`${this.kind} metadata: `, metadata);
            }

            // old-school video loss simulation
            // ISSUE HAPPENING HERE
            // const modifiedChunk = this.#addPacketLoss(chunk, this.kind);
            // const modifiedChunk = chunk;

            // add latency
            await this.#sleep(this.delayMs);
            // end test

            // ToDo: figure out how to make sure this has a keyframe after configure
            // hypothesis: packets caught in sleep function
            // add something like if(this.#frameIgnore
            try {
                this.#decoder.decode(chunk);        //(modifiedChunk)
            } catch (err) {
                this.debug(`ERROR: frame ${this.frameCounter}`, err)
            }
        }

        if (this.kind === 'video') {
            // Video decode
            VideoDecoder.isConfigSupported(this.codecConfig).then((decoderSupport) => {
                if (decoderSupport.supported){
                    this.#decoder = new VideoDecoder({output: handleDecodedFrame, error: this.debug});
                    this.#decoder.configure(this.codecConfig);
                    // this.debug(`${this.kind} decoder config supported`, this.codecConfig)
                }
                else
                    this.debug(`${this.kind} decoder config not supported`, this.codecConfig);
            });

            // Video encode
            VideoEncoder.isConfigSupported(this.codecConfig).then((encoderSupport) => {
                if (encoderSupport.supported){
                    this.#encoder = new VideoEncoder({output: handleEncodedFrame, error: this.debug});
                    this.#encoder.configure(this.codecConfig);
                    // this.debug(`${this.kind} encoder config supported`, this.codecConfig);
                }
                else
                    this.debug(`${this.kind} encoder config not supported`, this.codecConfig);
            })
                // ToDo: Session error here
                .catch((err) => {this.debug("encoder config error", err, this.codecConfig, this.trackSettings)});

        } else if (this.kind === 'audio') {
            // Audio decode
            this.#decoder = new AudioDecoder({output: handleDecodedFrame, error: this.debug});
            this.#decoder.configure(this.codecConfig);
            // ToDo: add isSupported check
            // Audio encode
            this.#encoder = new AudioEncoder({output: handleEncodedFrame, error: this.debug});
            this.#encoder.configure(this.codecConfig);
        }
    }

    #loadConfig() {
        if (this.kind === 'video') {
            const {height, width, frameRate} = this.trackSettings;
            const {widthFactor, heightFactor, framerateFactor, keyFrameInterval} = this.impairmentConfig.video;

            /*
                // from: https://raw.githubusercontent.com/tidoust/media-tests/main/main.js for reference
                alpha: 'discard',
                latencyMode: 'realtime',
                bitrateMode: 'variable',
                codec: 'H264',
                width: resolution.width,
                height: resolution.height,
                bitrate: 1000000,
                framerate: frameRate,
                keyInterval: 300,
                codec: 'avc1.42002A',
                avc: { format: 'annexb' },
                pt: 1
             */

            const codecFrameRate =  (frameRate / (framerateFactor || 1)).toFixed(0);


            // Configure the codec
            this.codecConfig = {
                // ToDo: severe to moderate not working when using h264 config below
                //  wanted h264 for better hardware acceleration

                /*
                codec: "avc1.42002A",
                alpha: 'discard',
                latencyMode: 'realtime',
                bitrateMode: 'variable',
                avc: {format: "annexb"},
                hardwareAcceleration: "prefer-hardware",
                pt: 1,
                keyInterval: keyFrameInterval,
                 */

                // ToDo: session screen share putting width, height, and frameRate at 'NaN'
                //  Session is using a MediaStreamTrackGenerator and that doesn't have those properties
                //  Need to find those settings somewhere else

                codec: 'vp8',
                width: (width / (widthFactor || 1)).toFixed(0),
                height: (height / (heightFactor || 1)).toFixed(0),
                // framerate: (frameRate / (framerateFactor || 1)).toFixed(0) || frameRate
                // frameRate: frameRate;
                frameRate: Math.max(this.impairmentConfig.video.frameRate, codecFrameRate )
            }

            this.debug("codecConfig", JSON.stringify(this.codecConfig));

            // Set up the impairment
            const {loss, payloadSize, delayMs, frameDrop} = this.impairmentConfig.video;
            this.loss = loss || 0;
            this.payloadSize = payloadSize || 90;
            this.keyFrameInterval = keyFrameInterval || 100;
            this.delayMs = delayMs || 10;
            this.frameDrop = frameDrop;
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
                if (this.operation === 'kill'){             // || this.track.readyState === 'ended') {
                    this.#encoder.flush();
                    this.#encoder.close();
                    this.#decoder.flush();
                    this.#decoder.close();
                    this.debug(`this impairment track ${this.id} closed`);
                } else if (this.#encoder && this.#encoder?.encodeQueueSize > 2) {
                    this.debug(`${this.kind} encoder overwhelmed, dropping frame`, frame)
                    frame.close();
                } else {
                    // Start webcodecs for impairment
                    if (this.operation === 'impair') {

                        // ToDo: retest this
                        if(Math.random() <= this.frameDrop ){
                            frame.close();
                            return
                        }

                        const keyFrame = this.frameCounter % this.keyFrameInterval === 0 || this.#forceKeyFrame;
                        if (this.#forceKeyFrame) {
                            this.debug(`set ${this.frameCounter} to keyframe`);
                            this.#forceKeyFrame = false;
                        }

                       this.#encoder.encode(frame, this.kind === 'video' ? {keyFrame} : null);

                        if(this.#forceKeyFrame === true)
                            this.#forceKeyFrame = false;

                    }
                    // Do nothing and re-enqueue the frame
                    else if (this.operation === 'passthrough') {
                        // this.debug("passthrough", frame);
                        await this.#controller.enqueue(frame);
                    }
                    // Drop the frame
                    else if (this.operation === 'skip') {
                        // ToDo: skip in the case of track.readyState === 'live' and track.enabled = false indicating muted status?
                        // this.debug("skipping frame");
                    }
                    // Something went wrong
                    else {
                        this.debug(`invalid operation: ${this.operation}`);
                    }

                    this.frameCounter++;
                    // this.debug(`${this.kind} frame ${this.frameCounter} processed`);
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
        }).catch(err => this.debug(`codec config error at frame ${this.frameCounter}`, err))

        this.debug(`New configuration. Operation state: ${this.operation}. Config: `, config)
    }

    get config() {
        return this.impairmentConfig;
    }

    start() {
        this.#forceKeyFrame = true; // update
        // this.operation = "impair";
        this.debug(`start: processing ${this.kind} ${this.id} with ${this.operation}`);
    }

    pause() {
        this.operation = "passthrough";
        this.debug(`passthrough: removing impairment on ${this.kind} ${this.id}`);
    }

    onFrameNumber(frameNumber, callback) {
        if(this.frameCounter >= frameNumber) {
            this.debug(`frameNumber ${frameNumber} already higher than current frame count ${this.frameCounter}`);
            return
        }

        const watcherInterval = setInterval(() => {
            // this.debug(`frame: ${this.frameCounter}`);

            if(this.frameCounter >= frameNumber) {
                clearInterval(watcherInterval);
                callback();
            }
        }, 100);
    }

    async stop() {
        this.operation = "kill";
        await this.#sleep(100); // give some time to finalize the last frames
        this.debug(`kill: stopped ${this.kind} ${this.id}`);
    }
}
