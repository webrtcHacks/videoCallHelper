
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
            effectiveSampleRate: 8000,
            dropProbability: 0.40,
            latency: 500
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

        if(kind === 'video'){
            this.smallerCanvas = new OffscreenCanvas(1, 1);
            this.smallerCtx = this.smallerCanvas.getContext('2d');

            this.ogSizeCanvas = new OffscreenCanvas(1, 1);
            this.ogSizeCtx = this.ogSizeCanvas.getContext('2d');
        }
        else if (kind === 'audio') {
            // ToDo: AudioContext is not available in workers so need to redo it in a worklet
            this.audioContext = new AudioContext({sampleRate: globalThis.sampleRate});
        }


        /*
        this.frameRate = trackSettings.frameRate;
        this.sourceHeight = trackSettings.height;
        this.sourceWidth = trackSettings.width;

         */

    }

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


    /**
     * Process a video frame by applying the configured impairments.
     * @param {VideoFrame} frame - The input video frame to process
     * @returns {Promise<VideoFrame>} - The processed video frame
     */
    async process(frame) {
        if (!this.activate) {
            this.lastFrame?.close();
            this.lastFrame = frame.clone();
            return frame;
        } else {
            // Add latency
            await new Promise(resolve => setTimeout(resolve, this.impairmentConfig.latency));

            // Simulate dropped frames by repeating the last frame
            if (Math.random() < this.impairmentConfig.dropProbability) {
                if (this.lastFrame) {
                    frame.close();
                    return this.lastFrame.clone();
                }
            }

            // adjust resolution
            // Scale down then scale up to original size

            if(this.kind === 'video'){
                const originalWidth = frame.displayWidth;
                const originalHeight = frame.displayHeight;
                const scaledDownWidth = Math.floor(originalWidth * this.impairmentConfig.resolutionScaleFactor);
                const scaledDownHeight = Math.floor(originalHeight * this.impairmentConfig.resolutionScaleFactor);
                this.smallerCanvas.width = scaledDownWidth;
                this.smallerCanvas.height = scaledDownHeight;
                this.smallerCtx.drawImage(frame, 0, 0, scaledDownWidth, scaledDownHeight);

                this.ogSizeCanvas.width = originalWidth;
                this.ogSizeCanvas.height = originalHeight;
                this.ogSizeCtx.drawImage(this.ogSizeCanvas, 0, 0, originalWidth, originalHeight);
                const scaledFrame = new VideoFrame(this.smallerCanvas, {timestamp: frame.timestamp});
                frame.close();

                this.lastFrame?.close();
                this.lastFrame = scaledFrame.clone();
                return scaledFrame;
            } else if (this.kind === 'audio') {
                const audioFrame = await this.processAudio(frame);
                frame.close();

                this.lastFrame?.close();
                this.lastFrame = frame.clone()
                return audioFrame;
            }
        }
    }


    /**
     * Set the current configuration for the impairments.
     * @returns {Object} - The current configuration
     */
    set config(config){
        if(this.kind === 'video') {
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
    start(){
        this.activate = true;
    }

    /**
     * Stop the impairment.
     */
    stop(){
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
                    const newFrame = await impair.process(frame)
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
