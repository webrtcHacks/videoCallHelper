// noinspection DuplicatedCode
import {WorkerMessageHandler, MESSAGE as m} from "../../../modules/messageHandler.mjs";

const wmh = new WorkerMessageHandler();
const debug = Function.prototype.bind.call(console.debug, console, `vch 👷😈${self.name} `);


export class ImpairmentProcessor {

    static severeImpairment = {
        video: {
            resolutionScaleFactor: 0.10,
            effectiveFrameRate: 5,
            dropProbability: 0.30,
            latency: 400
        },
        audio: {
            dropProbability: 0.50,
            latency: 600,
            clippingPct: 0.25
        }
    };

    static moderateImpairment = {
        video: {
            resolutionScaleFactor: 0.20,
            effectiveFrameRate: 10,
            dropProbability: 0.20,
            latency: 200
        },
        audio: {
            dropProbability: 0.20,
            latency: 300,
            clippingPct: 0.10
        }
    }

    /**
     * Create a new ImpairmentProcessor instance.
     * @param {string} kind - The kind of stream to process (video or audio)
     * @param {Object} impairmentConfig - The initial configuration for the impairments
     */
    constructor(kind, impairmentConfig = ImpairmentProcessor.moderateImpairment) {
        this.activate = false;
        this.lastFrame = null;
        this.kind = kind;
        this.impairmentConfig = impairmentConfig[kind];

        // using OffscreenCanvas to process video frames instead of webcodecs to save on resources
        if (kind === 'video') {
            this.canvas = new OffscreenCanvas(1, 1);
            this.ctx = this.canvas.getContext('bitmaprenderer');
        }
        // Using webcodecs here because it is relatively lightweight and can be used in a worker easily (unlike webaudio)
        else if (kind === 'audio') {
            // See impairmentWorker.mjs in scratch for failed attempt at webcodecs
        }

    }

    // noinspection DuplicatedCode
    /**
     * Scale down a video frame to simulate a lower resolution while keeping the resolution the same.
     *  - uses impairementConfig.resolutionScaleFactor to determine the scaling factor
     * @param {VideoFrame} frame - The input video frame to scale down
     */
    async #scaleVideo(frame) {
        // Scale down
        const {displayWidth, displayHeight, codedWidth, codedHeight, timestamp} = frame;

        const newHeight = codedHeight * (this.impairmentConfig.resolutionScaleFactor || 1);
        const newWidth = codedWidth * (this.impairmentConfig.resolutionScaleFactor || 1);

        const bitmap = await createImageBitmap(frame, {resizeHeight: newHeight, resizeWidth: newWidth});
        this.canvas.width = codedWidth; // newWidth;
        this.canvas.height = codedHeight; // newHeight;

        this.ctx.transferFromImageBitmap(bitmap);

        const options = {
            timestamp: timestamp,
            codedWidth: codedWidth,
            codedHeight: codedHeight,
            displayWidth: displayWidth,
            displayHeight: displayHeight,
        }
        return new VideoFrame(this.canvas, options);

    }
    lastIntervalUpdate = 0;
    intervals = [];

    /**
     * Degrades the quality of an audio frame
     *  - First part simulates a cluster of dropped packets by zeroing repeated frames from the audio stream
     *  - Then calls dropRandomAudioFrames for frames that are not completely silenced
     * @param {AudioData} frame - every frame
     * @param {number} pctPerMinute - percent as a decimal of 60 seconds to clip
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
            const silenceIntervals = Math.round(pctPerMinute * totalIntervals);
            // Create an array with the specified number of silenced intervals
            this.intervals = Array(silenceIntervals).fill(1);
            // Fill the rest of the array with zeros
            this.intervals = [...this.intervals, ...Array(totalIntervals - silenceIntervals).fill(0)];
            // Shuffle the array to randomize the silenced intervals
            this.intervals = this.intervals.sort(() => Math.random() - 0.5);
            // debug(this.intervals);

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
     * @param {AudioData} audioData - input AudioData to process
     * @returns {AudioData} - modified AudioData with zeroed out frames
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

    frameCount = 0;

    /**
     * Process a video frame by applying the configured impairments.
     * @param {VideoFrame|AudioData} frame - The input video frame or AudioData to process
     * @returns {Promise<VideoFrame>} - The processed video frame or AudioData
     */
    process = async(frame) =>{
        // debug(`processing ${this.kind} frame: `, frame);
        if (!this.activate) {
            this.lastFrame?.close();
            return frame;
        } else {
            // END generic handling - START Audio and video specific handling

            let modifiedFrame;
            /* Video processing */
            if (this.kind === 'video') {

                // Add latency
                // ToDo: investigate how to add audio delays
                //  Adding this for video messes up MediaRecorder and peer connections later in the stream
                //  was originally run for both audio and video
                await new Promise(resolve => setTimeout(resolve, this.impairmentConfig.latency));

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
                modifiedFrame = this.degradeAudio(frame, this.impairmentConfig.clippingPct);
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
            this.impairmentConfig = config[this.kind];
        }
        else if (this.kind === 'audio') {
            this.impairmentConfig = config[this.kind];
        }
        else
            throw new Error(`unknown kind: ${this.kind}`);

        debug(`set config for ${this.kind} to: `, this.impairmentConfig);

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

/**
 * Message handlers for the impairment worker
 */

// self.impairmentConfig = ImpairmentProcessor.moderateImpairment;
// debug("default impairmentConfig: ", self.impairmentConfig);

wmh.addListener(m.IMPAIRMENT_SETUP, async (data) => {
    const {kind, level, enabled} = data;

    let impairmentConfig;
    if(level==="severe")
        impairmentConfig = ImpairmentProcessor.severeImpairment;
    else
        impairmentConfig = ImpairmentProcessor.moderateImpairment;

    self.impairment = new ImpairmentProcessor(kind, impairmentConfig);

    // ToDo: need a way to force this to be the last transform.
    //  Currently need to set videoPlayer to `0` to force it to be the first of two transforms
    transformManager.add(`${kind}-impairment`, self.impairment.process);
    if(enabled && level !== "passthrough"){
        self.impairment.start();
        debug(`impairment started with level: ${level}`, impairmentConfig[kind]);
    }

});

wmh.addListener(m.IMPAIRMENT_CHANGE, async (data) => {
    const {level, enabled} = data;
    let newConfig;
    if(level==="severe")
        newConfig = ImpairmentProcessor.severeImpairment;
    else
        newConfig = ImpairmentProcessor.moderateImpairment;

    const kind = self.impairment.kind;
    // debug("changing impairment config from, to: ", self.impairmentConfig[kind], newConfig[kind]);
    self.impairment.config = newConfig;

    if(enabled && self.impairment.activate === true){
        debug("impairment is already running. config set to ", newConfig[kind] );
    }

    if(!enabled || level === "passthrough"){
        self.impairment.stop();
        debug(`impairment stopped`);
    }
    else if(enabled && self.impairment.activate === false && level !== "passthrough"){
        self.impairment.start();
        debug(`impairment started with level: ${level}`, newConfig[kind]);
    }

});
