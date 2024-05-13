// noinspection DuplicatedCode

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

    lastIntervalUpdate = 0;
    intervals = [];

    /**
     * Degrades the quality of an audio frame
     *  - First part simulates a cluster of dropped packets by zeroing repeated frames from the audio stream
     *  - Then calls dropRandomAudioFrames for frames that are not completely silenced
     * @param {AudioData} frame - every frame
     * @param {number} pctPerMinute - percent as an integer of 60 seconds to clip
     */
    degradeAudio(frame, pctPerMinute) {
        // Get the current time in seconds
        const currentTime = frame.timestamp / 1000000;

        // If a minute or more has passed since the last interval update, recalculate the intervals
        if (currentTime - this.lastIntervalUpdate >= 60) {
            // debug('Recalculating intervals');
            // Calculate the total number of one-second intervals in a minute, which is 60
            const totalIntervals = 60;
            // Calculate the number of intervals to be silenced based on the `pctPerMinute` parameter
            const silenceIntervals = Math.round(pctPerMinute / 100 * totalIntervals);
            // Create an array with the specified number of silenced intervals
            this.intervals = Array(silenceIntervals).fill(1);
            // Fill the rest of the array with zeros
            this.intervals = [...this.intervals, ...Array(totalIntervals - silenceIntervals).fill(0)];
            // Shuffle the array to randomize the silenced intervals
            this.intervals = this.intervals.sort(() => Math.random() - 0.5);
            debug(this.intervals);

            // Update the last interval update time
            this.lastIntervalUpdate = currentTime;
        }

        // Get the current second of the minute
        const currentSecond = Math.floor(currentTime) % 60;

        // If the current second should be silenced, return a silent frame
        if (this.intervals[currentSecond] === 1) {
            // debug('Silent frame created');
            return this.createSilentAudioFrame(frame);
        } else {
            // return frame;
            // Simulate some noise
            return this.dropRandomAudioFrames(frame);

        }
    }

    /**
     * Create a silent AudioData with the same properties as the input AudioData.
     * @param {AudioData} audioData
     * @returns {AudioData}
     */
    createSilentAudioFrame(audioData) {
        /*
        duration:2666
        format:"f32-planar"
        numberOfChannels:1
        numberOfFrames: 256
        sampleRate: 96000
        timestamp: 46190019210
        */

        // debug("making silent frame from:" , frame);
        const {duration, format, numberOfChannels, numberOfFrames, sampleRate, timestamp} = audioData;
        const audioBuffer = new Float32Array(numberOfFrames * numberOfChannels).fill(0);
        const init = {duration, format, numberOfChannels,numberOfFrames, sampleRate, timestamp, data: audioBuffer }
        audioData.data = audioBuffer

        // Create the AudioData object
        const silentAudioFrame = new AudioData(init);

        // console.log('Silent audio frame created:', silentAudioFrame);

        return silentAudioFrame;

    }

    /**
     * Simulate packet loss by zeroing out random frames within AudioData
     * @param audioData
     * @returns {AudioData}
     */
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

    // this didn't work - too much distortion
    /**
     * Simulate lower fidelity audio by dropping the higher-order bits of the audio samples.
     * @param {AudioData} audioData
     * @param {number} bitsToDrop
     * @returns {AudioData}
     */
    dropHigherOrderBits(audioData, bitsToDrop) {

        // Get the number of frames and channels from the AudioData object
        const bitDepth = 16;
        const numberOfFrames = audioData.numberOfFrames;
        const numberOfChannels = audioData.numberOfChannels;

        // Convert the AudioData data to a Float32Array
        const audioBuffer = new Float32Array(numberOfFrames * numberOfChannels);
        audioData.copyTo(audioBuffer, {planeIndex: 0});

        // Bit mask for the desired bit depth
        const bitMask = (1 << (bitDepth - bitsToDrop)) - 1;

        // Iterate over each sample in the audio buffer
        for (let i = 0; i < audioBuffer.length; i++) {
            // if(i % 128 === 0) {  // attempt to do this only some samples
                // Scale to 16-bit integer range, apply bit mask, then scale back
                //console.log(audioBuffer.length);    // == 128
            audioBuffer[i] = ((audioBuffer[i] * 32768) & bitMask) / 32768;
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
        this.frameCount++;
        // debug(`processing ${this.kind} frame: `, frame);
        if (!this.activate) {
            /*
            if(this.frameCount % 266 === 0) {
                const interval = frame.timestamp - this.lastFrame?.timestamp;
                debug(`time between frames is ${interval/1000} ms; frame rate is ${1 / (interval/100000)} fps`);
            }
             */
            this.lastFrame?.close();
            this.lastFrame = frame.clone();
            return frame;
        } else {
            // Add latency (always)
            // ToDo: investigate why MediaRecord doesn't record when this is used
            // await new Promise(resolve => setTimeout(resolve, this.impairmentConfig.latency));
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
                // const modifiedFrame = this.addPacketLoss(frame);
                modifiedFrame = this.degradeAudio(frame, 25);
                // modifiedFrame = this.dropHigherOrderBits(modifiedFrame, 2);
                frame.close();
                return modifiedFrame;

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
