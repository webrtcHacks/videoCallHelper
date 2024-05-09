const debug = Function.prototype.bind.call(console.debug, console, `vch 👷${self.name} `);

/**
 * A class to simulate network impairments on video and audio streams.
 * The impairments include:
 * - Video: resolution scaling, frame rate reduction, frame drops, and latency
 * - Audio: TODO
 * The impairments can be configured on the fly using the `config` property.
 */
class ImpairmentProcessor {

    static severeImpairment = {
        video: {
            resolutionScaleFactor: 0.5,
            effectiveFrameRate: 15,
            dropProbability: 0.30,
            latency: 300
        },
        audio: {
            effectiveSampleRate: 8000, // source is 48K
            dropProbability: 0.40,
            latency: 500,
            bitrate: 6_000
        }
    };

    /**
     * Create a new ImpairmentProcessor instance.
     * @param {string} kind - The kind of stream to process (video or audio)
     * @param {Object} impairmentConfig - The initial configuration for the impairments
     */
    constructor(kind, impairmentConfig = ImpairmentProcessor.severeImpairment) {
        this.activate = false;
        this.lastFrame = null;
        this.kind = kind;
        this.impairmentConfig = impairmentConfig[kind];
        this.audioFrameQueue = [];

        // using OffscreenCanvas to process video frames instead of webcodecs to save on resources
        if (kind === 'video') {
            this.canvas = new OffscreenCanvas(1, 1);
            this.ctx = this.canvas.getContext('bitmaprenderer');
        }
        // Using webcodecs here because it is relatively lightweight and can be used in a worker easily (unlike webaudio)
        else if (kind === 'audio') {
            // const {channelCount, sampleRate} = this.trackSettings;
            const channelCount = 1;
            const sampleRate = 8000;
            const {bitrate} = this.impairmentConfig;

            this.codecConfig = {
                codec: 'opus',
                numberOfChannels: 1, // channelCount || 1,
                sampleRate: 48_000, //sampleRate,
                bitrate: 10_000 //Math.max(bitrate || 10_000, 6_000)
            }

            // >this.audioFrameQueue.push(frame)

            /*
            // Audio decode
            this.decoder = new AudioDecoder({output: frame => this.audioFrameQueue.push(frame), error: debug});
            this.decoder.configure(this.codecConfig);
            // ToDo: add isSupported check


            // Audio encode
            this.encoder = new AudioEncoder({output: frame => this.decoder.decode(frame), error: debug});
            this.encoder.configure(this.codecConfig);

            /*
            this.decoder.ondequeue = async () => {
                const modifiedFrame = this.audioFrameQueue[0];
                debug(`decoder ondeque - queue size is ${this.audioFrameQueue.length}`);
                if (!modifiedFrame) {
                    debug("No modified frame available");
                }
            }

             */

            /*
            this.encoder.ondequeue = async () => {
                // debug("encoder dequeued");
                // debug(this.audioFrameQueue);
                // debug(this.encoder);}

            */

        }


        /*
        this.frameRate = trackSettings.frameRate;
        this.sourceHeight = trackSettings.height;
        this.sourceWidth = trackSettings.width;

         */

    }

    /**
     * Scale down a video frame to simulate a lower resolution while keeping the resolution the same.
     *  - uses impairementConfig.resolutionScaleFactor to determine the scaling factor
     * @param {VideoFrame} frame - The input video frame to scale down
     */
    async #scaleVideo(frame) {
        // Scale down

        const newHeight = frame.displayHeight * (this.impairmentConfig.resolutionScaleFactor || 1);
        const newWidth = frame.displayWidth * (this.impairmentConfig.resolutionScaleFactor || 1);

        const bitmap = await createImageBitmap(frame, {resizeHeight: newHeight, resizeWidth: newWidth});
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;

        this.ctx.transferFromImageBitmap(bitmap);
        return new VideoFrame(this.canvas, {timestamp: frame.timestamp});

    }

    async getFirstFrameFromQueue() {
        while (this.audioFrameQueue.length === 0) {
            // Wait for a frame to be available in the queue
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        // Remove the first frame from the queue and return it
        return this.audioFrameQueue.shift();
    }

    createSilentAudioFrame(frame) {
        /*
        // Define the audio format and parameters
        const audioFormat = 'f32'; // Floating-point 32-bit samples
        const sampleRate = 48000; // Sample rate in Hz
        const numberOfFrames = 1024; // Number of frames in the audio sample
        const numberOfChannels = 1; // Number of audio channels (stereo)
        // const timestamp = 0; // Timestamp in microseconds
         */

        /*
        duration:2666
        format:"f32-planar"
        numberOfChannels:1
        numberOfFrames: 256
        sampleRate: 96000
        timestamp: 46190019210
        */

        // debug("making silent frame from:" , frame);
        const {duration, format, numberOfChannels, numberOfFrames, sampleRate, timestamp} = frame;

        // Create a silent audio buffer
        const audioBuffer = new Float32Array(numberOfFrames * numberOfChannels).fill(0);

        const init = {duration, format, numberOfChannels,numberOfFrames, sampleRate, timestamp, data: audioBuffer }

        frame.data = audioBuffer

        // Create the AudioData object
        const silentAudioFrame = new AudioData(init);

        // console.log('Silent audio frame created:', silentAudioFrame);

        return silentAudioFrame;

    }

    dropRandomAudioFrames(audioData) {
        // Get the number of frames and channels from the AudioData object
        const numberOfFrames = audioData.numberOfFrames;
        const numberOfChannels = audioData.numberOfChannels;


        // Convert the AudioData data to a Float32Array
        const audioBuffer = new Float32Array(numberOfFrames* numberOfChannels);
        audioData.copyTo(audioBuffer, {planeIndex: 0});


        // Determine the number of frames to zero out (e.g., 10% of the total frames)
        const framesToZero = Math.floor(numberOfFrames * this.impairmentConfig.dropProbability);

        for (let i = 0; i < framesToZero; i++) {
            // Select a random frame
            const frame = Math.floor(Math.random() * numberOfFrames);

            // Zero out the selected frame for all channels
            for (let channel = 0; channel < numberOfChannels; channel++) {
                audioBuffer[frame * numberOfChannels + channel] = 0;
            }
        }

        // Create a new AudioData object with the modified buffer
        const modifiedAudioData = new AudioData({
            format: audioData.format,
            sampleRate: audioData.sampleRate,
            numberOfFrames: numberOfFrames,
            numberOfChannels: numberOfChannels,
            timestamp: audioData.timestamp,
            data: audioBuffer,
        });

        return modifiedAudioData;
    }

    /*
    // Removed because AudioContext is not available in workers
    // Need to redo this in a worklet OR look into https://github.com/aolsenjazz/libsamplerate-js

    async processAudio(audioFrame) {
        // Create an AudioBuffer from the audio frame data
        let audioBuffer = this.audioContext.createBuffer(1, audioFrame.samples.length, this.impairmentConfig.effectiveSampleRate);
        let channelData = audioBuffer.getChannelData(0);
        channelData.set(audioFrame.samples);

        // Create an OfflineAudioContext with the desired sample rate
        let offlineCtx = new OfflineAudioContext(1, audioBuffer.length, 4000); // 1 channel, same length as input, 6000 Hz sample rate

        // Create a buffer source
        let source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        // Create a lowpass filter
        let filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000; // Half of the sample rate

        // Connect the source to the filter, and the filter to the destination
        source.connect(filter);
        filter.connect(offlineCtx.destination);

        // Start the source
        source.start();

        // Render the audio and get a promise for the completed audio buffer
        let renderedBuffer = await offlineCtx.startRendering();

        // Convert the processed AudioBuffer back to an audio frame
        let processedSamples = new Float32Array(renderedBuffer.getChannelData(0));
        let processedFrame = new AudioFrame({ samples: processedSamples, sampleRate: 4000 });

        return processedFrame;
    }
    */

    frameCount = 0;

    /**
     * Process a video frame by applying the configured impairments.
     * @param {VideoFrame} frame - The input video frame to process
     * @returns {Promise<VideoFrame>} - The processed video frame
     */
    async process(frame) {
        // debug(`processing ${this.kind} frame: `, frame);
        if (!this.activate) {
            // this.lastFrame?.close();
            // this.lastFrame = frame.clone();
            return frame;
        } else {
            this.frameCount++;
            // Add latency (always)
            // ToDo: investigate why MediaRecord doesn't record when this is used
            await new Promise(resolve => setTimeout(resolve, this.impairmentConfig.latency));
            // END generic handling - START Audio and video specific handling

            let modifiedFrame;
            /* Video processing */
            if (this.kind === 'video') {
                // Simulate dropped frames by repeating the last frame
                if (Math.random() < this.impairmentConfig.dropProbability) {
                    if (this.lastFrame) {
                        frame.close();
                        return this.lastFrame.clone();
                    }
                }

                // TODO: implement FPS reduction
                modifiedFrame = await this.#scaleVideo(frame);

                frame.close();
                this.lastFrame?.close();
                // debug(`modified ${this.kind} frame: `, modifiedFrame);
                this.lastFrame = modifiedFrame.clone();
                return modifiedFrame;

            }
            /* Audio processing */
            else if (this.kind === 'audio') {
                // debug(`processing ${this.kind} frame: `, frame);
                const modifiedFrame = this.dropRandomAudioFrames(frame);
                // const modifiedFrame = this.addPacketLoss(frame);
                frame.close();
                return modifiedFrame;
/*
                // Simulate dropped frames by inserting blank frames
                if (Math.random() < this.impairmentConfig.dropProbability) {
                    // debug(`Dropped audio frame at ${frame.timestamp}`, frame);
                    const silentFrame =  this.createSilentAudioFrame(frame);
                    frame.close();
                    return silentFrame;
                }

                return frame;

                /*
                // Encode the audio frame at a lower quality
                this.encoder.encode(frame || this.createSilentAudioFrame());

                // Get the last frame in the queue
                modifiedFrame = this.audioFrameQueue.shift();
                if (!modifiedFrame){
                    debug(`No decoded frame available for ${this.frameCount} at ${frame.timestamp}`, frame);
                    // modifiedFrame = frame.clone();
                    modifiedFrame = this.createSilentAudioFrame();
                }

                return modifiedFrame;

                 */

            }

        }
    }


    /**
     * Set the current configuration for the impairments.
     */
    set config(config) {
        if (this.kind === 'video') {
            this.impairmentConfig = {
                resolutionScaleFactor: config.resolutionScaleFactor || this.impairmentConfig.resolutionScaleFactor,
                effectiveFrameRate: config.effectiveFrameRate || this.impairmentConfig.effectiveFrameRate,
                dropProbability: config.dropProbability || this.impairmentConfig.dropProbability,
                latency: config.latency || this.impairmentConfig.latency
            };
        }
    }

    /**
     * Start the impairment.
     */
    start() {
        this.activate = true;
    }

    /**
     * Stop the impairment.
     */
    stop() {
        this.activate = false;
    }
}

self.onmessage = async (event) => {
    const {command} = event.data;

    switch (command) {
        case 'setup':
            const {reader, writer, kind} = event.data;
            self.impair = new ImpairmentProcessor(kind);

            const transformStream = new TransformStream({
                transform: async (frame, controller) => {
                    const newFrame = await impair.process(frame);
                    // debug(frame.data);
                    controller.enqueue(newFrame);
                }
            })
            await reader.pipeThrough(transformStream).pipeTo(writer);
            break;
        case 'config':
            self.impair.config = event.data.config;
            break;
        case 'start':
            self.impair.start();
            break;
        case 'stop':
            self.impair.stop();
            break;
        default:
            console.log(`Unhandled message: `, event);
    }
};
