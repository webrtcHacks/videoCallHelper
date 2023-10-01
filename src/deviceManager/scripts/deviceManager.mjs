// Manages the devices returned by navigator.mediaDevices.enumerateDevices() and inserts fake vch devices

import {alterTrack} from "../../badConnection/scripts/alterStream.mjs";


/*
    Sits in inject context

    Message Flows:

    Initialization

    * inject.js now sends a `GET_ALL_SETTINGS` and waits for a `ALL_SETTINGS` from content.js (which grabs this from storage)
    This initial value is passed to the constructor

    UI changes
    1. dash.js updates storage under 'deviceManager'
    2. content.js listens for storage changes and sends UPDATE_DEVICE_SETTINGS to inject script
    3. UPDATE_DEVICE_SETTINGS listener in DeviceManager simulates a devicechange event

    Real device changes
    1. inject.js enumerateDevices shim sends UPDATE_DEVICE_SETTINGS to content script with new devices
    2. content.js updates storage under 'deviceManager'
    3. dash.js listens for storage changes and updates device selects
    2. DeviceManager listens for UPDATE_DEVICE_SETTINGS

    Notes:
    * Dash.js will need to send selected devices back to inject.js
    * dash.js dropdown selection shouldn't trigger a simulated devicechange

    // ToDo:
        What happens when what is saved in storage is no longer available?
        When default devices are used when there are no permissions?

 */

// Helper function
function arraysOfObjectsAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) {
            return false;
        }
    }
    return true;
}


import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";

const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️🥸`);
const mh = new MessageHandler('inject', debug);


export class DeviceManager {

    settings = {
        enabled: false,
        currentDevices: [],
        selectedDeviceLabels: {
            audio: null,
            video: null,
        },
        excludedDevices: [],
        // ToDo: take care of onInstall defaults for this
        lastDeviceIds:{
            audio: null,
            video: null,
        }
    }

    deviceChangeListeners = [];
    unalteredStream; /** @type {MediaStream} */
    originalConstraints = {};
    modifiedConstraints = {};


    static fakeVideoDevice = {
        __proto__: InputDeviceInfo.prototype,
        deviceId: "vch-video",
        kind: "videoinput",
        label: "vch-video",
        groupId: "video-call-helper",
        getCapabilities: () => {
            debug("fake video capabilities");
            return {
                aspectRatio: {max: 1920, min: 0.000925925925925926},
                deviceId: "vch-video",
                facingMode: [],
                frameRate: {max: 30, min: 1},
                groupId: "video-call-helper",
                height: {max: 1080, min: 1},
                resizeMode: ["none", "crop-and-scale"],
                width: {max: 1920, min: 1}
            };
        },
        toJSON: () => {
            return {
                __proto__: InputDeviceInfo.prototype,
                deviceId: "vch-video",
                kind: "videoinput",
                label:  "vch-video",
                groupId:  "video-call-helper",
            }
        }

    };

    static fakeAudioDevice = {
        __proto__: InputDeviceInfo.prototype,
        deviceId: "vch-audio",
        kind: "audioinput",
        label: "vch-audio",
        groupId: "video-call-helper",
        getCapabilities: () => {
            debug("fake audio capabilities?");
            return {
                autoGainControl: [true, false],
                channelCount: {max: 2, min: 1},
                deviceId: "vch-audio",
                echoCancellation: [true, false],
                groupId: "video-call-helper",
                latency: {max: 0.002902, min: 0},
                noiseSuppression: [true, false],
                sampleRate: {max: 48000, min: 44100},
                sampleSize: {max: 16, min: 16}
            }
        },
        toJSON: () => {
            return {
                __proto__: InputDeviceInfo.prototype,
                deviceId: "vch-audio",
                kind: "audioinput",
                label: "vch-audio",
                groupId: "video-call-helper",
            }
        }
    };



    constructor(settings) {

        // singleton pattern
        if (DeviceManager.instance) {
            debug("existing DeviceManager instance");
            return DeviceManager.instance;
        }
        DeviceManager.instance = this;

        this.fakeVideoDevice = DeviceManager.fakeVideoDevice;
        this.fakeAudioDevice = DeviceManager.fakeAudioDevice;

        // Setup listener to simulate a devicechange event if enabled is changed
        mh.addListener(m.UPDATE_DEVICE_SETTINGS, (data) => {

            let lastValue = this.isEnabled;
            this.isEnabled = data.enabled;

            let excludedDevicesChanged = data?.excludedDevices && !arraysOfObjectsAreEqual(data.excludedDevices, this.settings.excludedDevices);

            Object.assign(this.settings, data);
            debug(`device manager settings updated. vch device labels: `, data.selectedDeviceLabels);
            // ToDo: how do I change a stream that is using a fake device after it has started
            //  - can do this from the generator, need to feed the generator the new tracks
            //  - can't do that from a non-generator without stopping the stream which would cause problems

            // simulate a devicechange event if enabled is changed or excludedDevices has changed
            if (data.enabled !== lastValue || excludedDevicesChanged) {
                // debug("device manager changed", data);
                this.#simulateDeviceChangeEvent();
            }
        });

        Object.assign(this.settings, settings);
        debug(`device manager initialized and is ${this.settings.enabled ? 'enabled' : 'disabled'}`, this.settings);

    }


    get enabled() {
        return this.settings.enabled;
    }

    // The returns the real deviceId DeviceManager should use
    get vchAudioId() {

        if(this.settings.selectedDeviceLabels.audio) {
            // return the device ID if the label is in this.settings.currentDevices
            const selectedId = this.settings.currentDevices
                .find(device => device.kind === 'audioinput' && device.label === this.settings.selectedDeviceLabels.audio)?.deviceId;
            debug(`selected label ${this.settings.selectedDeviceLabels.audio} has matching id ${selectedId}`);
            if (selectedId)
                return selectedId;
        }
        // if no label or id found, use default
        return null
    }

    // The returns the real deviceId DeviceManager should use
    get vchVideoId() {
        if(this.settings.selectedDeviceLabels.video) {
            // ToDo: this.settings.currentDevices is empty here but populated in storage
            // return the device ID if the label is in this.settings.currentDevices
            const selectedId = this.settings.currentDevices
                .find(device => device.kind === 'videoinput' && device.label === this.settings.selectedDeviceLabels.video)?.deviceId;
            debug(`selected label ${this.settings.selectedDeviceLabels.video} has matching id ${selectedId}`);
            if (selectedId)
                return selectedId;
        }
        // if no label or id found, use default
        return null
    }


    // Checks if  deviceManager is enabled and if the constraints contain vch-audio or vch-video
    useFakeDevices(constraints) {



        // convert constraints to a string and see if it contains "vch-*"
        const constraintsString = JSON.stringify(constraints);
        // Test if the string contains "vch-audio" or "vch-video"
        const useFakeDevices = constraintsString.match(/vch-(audio|video)/)?.length > 0;
        return useFakeDevices;

    }

    /*
    set lastRealAudioId(id){
        this.settings.lastDeviceIds.audio = id;
        mh.sendMessage('content', m.UPDATE_DEVICE_SETTINGS, {lastDeviceIds: {audio: this.lastRealAudioId}})
    }

    set lastRealVideoId(id){
        this.settings.lastDeviceIds.video = id;
        mh.sendMessage('content', m.UPDATE_DEVICE_SETTINGS, {lastDeviceIds: {video: this.lastRealVideoId}})
    }

     */

    /* returns a stream with one or more altered tracks
        arguments:
        - constraints - original constraints passed to getUserMedia by the app
        - getUserMedia - the original, unshimmed getUserMedia function
     */
    async fakeDeviceStream(constraints, getUserMedia){

        let settingsChanged = false;

        this.originalConstraints = constraints;
        const constraintsString = JSON.stringify(constraints);

        const useFakeAudio = constraintsString.includes("vch-audio");
        const useFakeVideo = constraintsString.includes("vch-video");

        // try to look-up the deviceId from dash, if that's not there, then check the last one that was used;
        //  if that's not there, then remove so a default device is used
        if (useFakeAudio){
            const audioDeviceId = this.vchAudioId || this.settings.lastDeviceIds.audio || "default";
            /*if(!audioDeviceId)
                delete(constraints.audio.deviceId)
            else{ */
                constraints.audio.deviceId = audioDeviceId;
                this.settings.lastDeviceIds.audio = audioDeviceId;
                settingsChanged = true;
            // }
        }
        if (useFakeVideo) {
            const videoDeviceId = this.vchVideoId || this.settings.lastDeviceIds.video || "default";
           /*if(!videoDeviceId)
                delete(constraints.video.deviceId)
            else{*/
                constraints.video.deviceId = videoDeviceId;
                this.settings.lastDeviceIds.video = videoDeviceId;
                settingsChanged = true;
            // }
        }

        debug("gUM with fake devices removed using constraints:", constraints);
        // when constraints include vch-audio|video but deviceManager is not enabled
        this.unalteredStream = await getUserMedia(constraints);
        // const noAltering = (!this.settings.enabled || this.settings.currentDevices.length === 0)

        if(this.unalteredStream){
            this.modifiedConstraints = constraints;
            debug("gUM stream with modified constraints", constraints,  this.unalteredStream);
            if(settingsChanged)
                mh.sendMessage('content', m.UPDATE_DEVICE_SETTINGS, {lastDeviceIds: this.settings.lastDeviceIds})
        }

        if(!this.settings.enabled)
            return this.unalteredStream;

        // Run any tracks that should be from vch-(audio|video) through alterTrack
        // Keep track of any non-altered tracks deviceIds for use next call
        const audioTracks = this.unalteredStream.getAudioTracks();
        const videoTracks = this.unalteredStream.getVideoTracks();

        const alteredStreamTracks = [];

        // Create alterTracks where needed and use the existing tracks from the gUM call otherwise
        if (useFakeAudio && !useFakeVideo) {
            audioTracks.forEach(track => alteredStreamTracks.push(alterTrack(track)));
            videoTracks.forEach(track => alteredStreamTracks.push(track));
            this.settings.lastDeviceIds.video = videoTracks[0]?.getSettings()?.deviceId;
        } else if (!useFakeAudio && useFakeVideo) {
            audioTracks.forEach(track => alteredStreamTracks.push(track));
            videoTracks.forEach(track => alteredStreamTracks.push(alterTrack(track)));
            this.settings.lastDeviceIds.audio = audioTracks[0]?.getSettings()?.deviceId;
        } else if (useFakeAudio && useFakeVideo) {
            audioTracks.forEach(track => alteredStreamTracks.push(alterTrack(track)));
            videoTracks.forEach(track => alteredStreamTracks.push(alterTrack(track)));
        } else {
            debug("shouldn't be here");
        }

            // make a new stream with the tracks from above
            const alteredStream = new MediaStream(alteredStreamTracks);
            debug("created alteredStream", alteredStream);
            return alteredStream;

        /*


        // regex match to see if the string contains "vch-audio" or "vch-video"
        const useFakeAudio = constraintsString.match(/vch-audio/)?.length > 0;
        const useFakeVideo = constraintsString.match(/vch-video/)?.length > 0;

        // ToDo: manage no fake audio for Google Meet or fix that

        debug("original constraints", constraints);

        // try to use the last real device ID in place of the vch-(audio|video) if it is there, otherwise use default
        // - constraints.video.deviceId
        // - constraints.video.deviceId.exact
        // - constraints.video.deviceId.ideal

        if (useFakeAudio)
            constraints.audio.deviceId = deviceManager.lastRealAudioId;
        if (useFakeVideo)
            constraints.video.deviceId = deviceManager.lastRealVideoId;

        if (JSON.stringify(constraints) !== constraintsString)
            debug("new constraints", constraints);

        // Now get the stream
        const stream = await origGetUserMedia(constraints);
        debug("got new gUM stream", stream);

        // Run any tracks that should be from vch-(audio|video) through alterTrack
        // Keep track of any non-altered tracks deviceIds for use next call
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();

        const alteredStreamTracks = [];
        // If there are no alternated tracks, then return the stream as is
        if (!useFakeAudio && !useFakeVideo) {
            deviceManager.lastRealAudioId = audioTracks[0]?.getSettings()?.deviceId;
            deviceManager.lastRealVideoId = videoTracks[0]?.getSettings()?.deviceId;
            await transferStream(stream);               // transfer the stream to the content script
            return stream;
        } else {
            // Create alterTracks where needed and use the existing tracks from the gUM call otherwise
            if (useFakeAudio && !useFakeVideo) {
                audioTracks.forEach(track => alteredStreamTracks.push(alterTrack(track, true)));
                videoTracks.forEach(track => alteredStreamTracks.push(track));
                deviceManager.lastRealVideoId = videoTracks[0]?.getSettings()?.deviceId;
            } else if (!useFakeAudio && useFakeVideo) {
                audioTracks.forEach(track => alteredStreamTracks.push(track));
                videoTracks.forEach(track => alteredStreamTracks.push(alterTrack(track, true)));
                deviceManager.lastRealAudioId = audioTracks[0]?.getSettings()?.deviceId;
            } else if (useFakeAudio && useFakeVideo) {
                audioTracks.forEach(track => alteredStreamTracks.push(alterTrack(track, true)));
                videoTracks.forEach(track => alteredStreamTracks.push(alterTrack(track, true)));
            } else {
                debug("shouldn't be here");
            }

            // make a new stream with the tracks from above
            const alteredStream = new MediaStream(alteredStreamTracks);
            debug("using alteredStream", alteredStream);
            await transferStream(stream, m.GUM_STREAM_START, {generated: true});               // transfer the stream to the content script
            return alteredStream;
        }
         */
    }


    /* Enumerate Devices modifiers */

    // runs all the deviceChange listeners
    #simulateDeviceChangeEvent() {
        //debug(`fake device change: "${this.isEnabled ? 'add' : 'remove'}", triggering devicechange listeners`);
        debug(`fake device change`);
        this.deviceChangeListeners.forEach(listener => {
            try {
                listener(new Event('devicechange'));
            } catch (error) {
                debug('Error triggering custom devicechange listener:', error);
            }
        });

        // Note: the below doesn't work :(
        // navigator.mediaDevices.dispatchEvent(new Event("fakeDevicechange"));
        // mh.sendMessage('inject', m.FAKE_DEVICE_CHANGE, {action: data.enabled ? 'add' : 'remove'});
    }

    // Adds vch-audio|video to the list of devices
    modifyDevices(devices) {

        debug("exclude devices", this.settings);
        const excludedDeviceLabels = this.settings.excludedDevices.map(device => device.label);

        // Remove any excluded devices if the labels match
        const filteredDevices = devices.filter(device => {
            return !excludedDeviceLabels.includes(device.label)
        });

        //  Insert the result of function addFakeDevice(audio|video) after all other 'audioinput|videoinput' entries
        let audioInsertIndex = -1;
        let videoInsertIndex = -1;
        let insertFakeAudio = true;
        let insertFakeVideo = true;

        for (let i = 0; i < devices.length; i++) {
            if (devices[i].kind === "audioinput") {
                if (audioInsertIndex === -1 && devices[i].deviceId === "") {
                    insertFakeAudio = false;
                }
                audioInsertIndex = i;
            } else if (devices[i].kind === "videoinput") {
                if (videoInsertIndex === -1 && devices[i].deviceId === "") {
                    insertFakeVideo = false;
                }
                videoInsertIndex = i;
            }
        }

        if (audioInsertIndex !== -1 && insertFakeAudio) {
            filteredDevices.splice(audioInsertIndex + 1, 0, this.fakeAudioDevice);
        }

        if (videoInsertIndex !== -1 && insertFakeVideo) {
            // +2 if fakeAudioDevice has been added, else +1
            filteredDevices.splice(videoInsertIndex + (insertFakeAudio ? 2 : 1), 0, this.fakeVideoDevice);
        }

        return filteredDevices;
    }

    /*
    addFakeDevices(devices) {

        // ToDo: verify proper behavior if there are no browser permissions
        // ToDo: always add a label- ignore the nolabel code
        let noLabel = !devices.find(d => d.label !== "");
        if (noLabel)
            debug("no device labels found");

        // ToDo: adjust these capabilities based on the device selected
        let fakeVideoDevice = {
            __proto__: InputDeviceInfo.prototype,
            deviceId: "vch-video",
            kind: "videoinput",
            label: noLabel ? "" : "vch-video",
            groupId: noLabel ? "" : "video-call-helper",
            getCapabilities: () => {
                debug("fake video capabilities");
                return {
                    aspectRatio: {max: 1920, min: 0.000925925925925926},
                    deviceId: noLabel ? "" : "vch-video",
                    facingMode: [],
                    frameRate: {max: 30, min: 1},
                    groupId: noLabel ? "" : "vch",
                    height: {max: 1080, min: 1},
                    resizeMode: ["none", "crop-and-scale"],
                    width: {max: 1920, min: 1}
                };
            },
            toJSON: () => {
                return {
                    __proto__: InputDeviceInfo.prototype,
                    deviceId: "vch-video",
                    kind: "videoinput",
                    label: noLabel ? "" : "vch-video",
                    groupId: noLabel ? "" : "video-call-helper",
                }
            }

        };

        let fakeAudioDevice = {
            __proto__: InputDeviceInfo.prototype,
            deviceId: "vch-audio",
            kind: "audioinput",
            label: noLabel ? "" : "vch-audio",
            groupId: noLabel ? "" : "video-call-helper",
            getCapabilities: () => {
                debug("fake audio capabilities?");
                return {
                    autoGainControl: [true, false],
                    channelCount: {max: 2, min: 1},
                    deviceId: noLabel ? "" : "vch-audio",
                    echoCancellation: [true, false],
                    groupId: noLabel ? "" : "video-call-helper",
                    latency: {max: 0.002902, min: 0},
                    noiseSuppression: [true, false],
                    sampleRate: {max: 48000, min: 44100},
                    sampleSize: {max: 16, min: 16}
                }
            },
            toJSON: () => {
                return {
                    __proto__: InputDeviceInfo.prototype,
                    deviceId: "vch-audio",
                    kind: noLabel ? "" : "audioinput",
                    label: "vch-audio",
                    groupId: noLabel ? "" : "video-call-helper",
                }
            }
        };

        // filter "vch-audio" and "vch-video" out of existing devices array
        devices.filter(d => d.deviceId !== "vch-audio" && d.deviceId !== "vch-video");
        devices.push(fakeVideoDevice, fakeAudioDevice);

        this.devices = devices;
        return devices
    }
     */

    // ToDo: move the shimUserMedia logic here
    // ToDo: should I also handle the case when deviceManager is disabled but the page has vch-* cached?
    /* if the constraints contain vch-audio or vch-video then need to decide
        Use real audio-only
        use real video-only
        use fake audio-only
        use fake video-only
        use real audio and real video
        use fake audio and fake video
        use fake audio and real video
        use real audio and fake video

     */

}
