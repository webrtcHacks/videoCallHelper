// Manages the devices returned by navigator.mediaDevices.enumerateDevices() and inserts fake vch devices

import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";
import {AlterTrack} from "../../badConnection/scripts/alterTrack.mjs";
import {settings} from "./settings.mjs";


/*
    Sits in inject context`

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

// Helper function to see if two arrays of objects are the same
function arraysOfObjectsAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) {
            return false;
        }
    }
    return true;
}


const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️🥸`);
const mh = new MessageHandler(c.INJECT);


export class DeviceManager {

    settings = settings;

    deviceChangeListeners = [];
    /** @type {MediaStream} */
    unalteredStream;
    originalConstraints = {};
    modifiedConstraints = {};
    devices = []

    /** @type {InputDeviceInfo} */
    static defaultVideoCapabilities = {
        __proto__: InputDeviceInfo.prototype,
        aspectRatio: {max: 1920, min: 0.000925925925925926},
        deviceId: "vch-video",
        facingMode: [],
        frameRate: {max: 30, min: 1},
        groupId: "video-call-helper",
        height: {max: 1080, min: 1},
        resizeMode: ["none", "crop-and-scale"],
        width: {max: 1920, min: 1}
    }

    /** @type {InputDeviceInfo} */
    static defaultAudioCapabilities = {
        __proto__: InputDeviceInfo.prototype,
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


    // ToDo: adjust these capabilities based on the device selected
    /** @type {InputDeviceInfo} */
    static fakeVideoDevice = {
        __proto__: InputDeviceInfo.prototype,
        deviceId: "vch-video",
        kind: "videoinput",
        label: "vch-video",
        groupId: "video-call-helper",
        getCapabilities: () => {
            debug("fake video capabilities");
            return DeviceManager.defaultVideoCapabilities;
        },
        toJSON: () => {
            return {
                __proto__: InputDeviceInfo.prototype,
                deviceId: "vch-video",
                kind: "videoinput",
                label: "vch-video",
                groupId: "video-call-helper",
            }
        }

    };

    /** @type {InputDeviceInfo} */
    static fakeAudioDevice = {
        __proto__: InputDeviceInfo.prototype,
        deviceId: "vch-audio",
        kind: "audioinput",
        label: "vch-audio",
        groupId: "video-call-helper",
        getCapabilities: () => {
            debug("fake audio capabilities?");
            return DeviceManager.defaultAudioCapabilities;
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


    // ToDo: get these somehow
    bcsSettings = {
        enabled: true,
        active: false,
        level: "passthrough"

    }

    constructor(settings) {

        // singleton pattern
        if (DeviceManager.instance) {
            debug("existing DeviceManager instance");
            return DeviceManager.instance;
        }
        DeviceManager.instance = this;

        this.fakeVideoDevice = DeviceManager.fakeVideoDevice;
        this.fakeAudioDevice = DeviceManager.fakeAudioDevice;

        // ToDo: I could transmit the devices here
        // Setup the fake devices with capabilities - some apps check this before calling getUserMedia
        navigator.mediaDevices.enumerateDevices().then(devices => {

            const findSelectedDevice = (kind) => {
                const key = kind === 'videoinput' ? 'video' : 'audio';

                return this.settings.currentDevices
                        .find(device => device.kind === kind && device.label === this.settings.selectedDeviceLabels[kind]) ||
                    // Try the last device IDs next
                    devices.find(device => device.kind === kind && device.deviceId === this.settings.lastDeviceIds[key]) ||
                    // If it doesn't exist, use the default device of that kind
                    devices.find(device => device.kind === kind && device.deviceId !== "default");
            };

            const getCapabilitiesForDevice = (kind, defaultCapabilities) => {
                const selected = findSelectedDevice(kind);
                const key = kind === 'videoinput' ? 'video' : 'audio';
                const selectedDevice = devices.find(device => device.kind === kind && device.deviceId === selected?.deviceId);

                if (selectedDevice) {
                    const capabilities = selectedDevice.getCapabilities();
                    capabilities.deviceId = `vch-${key}`;
                    capabilities.groupId = "video-call-helper";
                    return { ...defaultCapabilities, ...capabilities }; // Using the spread operator instead of Object.assign
                }

                return defaultCapabilities;
            };

            this.fakeVideoDevice.getCapabilities = () => getCapabilitiesForDevice('videoinput', DeviceManager.defaultVideoCapabilities);
            this.fakeAudioDevice.getCapabilities = () => getCapabilitiesForDevice('audioinput', DeviceManager.defaultAudioCapabilities);

        }).catch(error => debug("error mapping fake devices to real device", error));



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

        if (this.settings.selectedDeviceLabels.audio) {
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
        if (this.settings.selectedDeviceLabels.video) {
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
        return constraintsString.match(/vch-(audio|video)/)?.length > 0;

    }

    /* returns a stream with one or more altered tracks
        arguments:
        - constraints - original constraints passed to getUserMedia by the app
        - getUserMedia - the original, un-shimmed getUserMedia function
     */
    async fakeDeviceStream(constraints, getUserMedia) {

        let settingsChanged = false;

        this.originalConstraints = constraints;
        const constraintsString = JSON.stringify(constraints);

        const useFakeAudio = constraintsString.includes("vch-audio");
        const useFakeVideo = constraintsString.includes("vch-video");

        // try to look up the deviceId from dash, if that's not there, then check the last one that was used;
        //  if that's not there, then remove so a default device is used
        if (useFakeAudio) {
            const audioDeviceId = this.vchAudioId || this.settings.lastDeviceIds.audio || "default";
            constraints.audio.deviceId = audioDeviceId;
            this.settings.lastDeviceIds.audio = audioDeviceId;
            settingsChanged = true;
            this.devices.push(DeviceManager.fakeAudioDevice);


        }
        if (useFakeVideo) {
            const videoDeviceId = this.vchVideoId || this.settings.lastDeviceIds.video || "default";
            constraints.video.deviceId = videoDeviceId;
            this.settings.lastDeviceIds.video = videoDeviceId;
            settingsChanged = true;
            this.devices.push(DeviceManager.fakeVideoDevice);

        }

        // debug("gUM with fake devices removed using constraints:", constraints);
        // when constraints include vch-audio|video but deviceManager is not enabled
        /** @type {MediaStream} */
        this.unalteredStream = await getUserMedia(constraints)
            .catch(error => Promise.reject(error));

        if (this.unalteredStream) {
            this.modifiedConstraints = constraints;
            debug("gUM stream with modified constraints", constraints, this.unalteredStream);
            if (settingsChanged)
                mh.sendMessage(c.CONTENT, m.UPDATE_DEVICE_SETTINGS, {lastDeviceIds: this.settings.lastDeviceIds})
        }
        // ToDo: what if unalteredStream is null?

        if (!this.settings.enabled)
            return this.unalteredStream;

        // Run any tracks that should be from vch-(audio|video) through alterTrack
        // Keep track of any non-altered tracks deviceIds for use next call
        const audioTracks = this.unalteredStream.getAudioTracks();
        const videoTracks = this.unalteredStream.getVideoTracks();

        const alteredStreamTracks = [];

        // ToDo: need to remove AlterTrack?

        // Create alterTracks where needed and use the existing tracks from the gUM call otherwise
        if (useFakeAudio && !useFakeVideo) {
            audioTracks.forEach(track => alteredStreamTracks.push( new AlterTrack(track, this.bcsSettings)));
            videoTracks.forEach(track => alteredStreamTracks.push(track));
            this.settings.lastDeviceIds.video = videoTracks[0]?.getSettings()?.deviceId;
        } else if (!useFakeAudio && useFakeVideo) {
            audioTracks.forEach(track => alteredStreamTracks.push(track));
            videoTracks.forEach(track => alteredStreamTracks.push(new AlterTrack(track, this.bcsSettings)));
            this.settings.lastDeviceIds.audio = audioTracks[0]?.getSettings()?.deviceId;
        } else if (useFakeAudio && useFakeVideo) {
            audioTracks.forEach(track => alteredStreamTracks.push(new AlterTrack(track, this.bcsSettings)));
            videoTracks.forEach(track => alteredStreamTracks.push(new AlterTrack(track, this.bcsSettings)));
        } else {
            debug("shouldn't be here");
        }

        // ToDo: Debug - not getting here

        // make a new stream with the tracks from above
        /** @type {MediaStream} */
        const alteredStream = new MediaStream(alteredStreamTracks);
        debug("created alteredStream", alteredStream);
        return alteredStream;
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

}
