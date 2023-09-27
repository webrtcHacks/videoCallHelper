// Manages the devices returned by navigator.mediaDevices.enumerateDevices() and inserts fake vch devices

/*
    Sits in inject context

    Message Flows:

    Initialization
    ~1. DeviceManager sends GET_DEVICE_SETTINGS to content.js~
    ~2. content.js gets 'deviceManager' values from storage and sends them in UPDATE_DEVICE_SETTINGS to inject.js~

    inject.js now sends a `GET_ALL_SETTINGS` and waits for a `ALL_SETTINGS` from content.js (which grabs this from storage)
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
        excludedDevices: {}
    }

    devices = [];
    deviceChangeListeners = [];


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

            let excludedDevicesChanged = !arraysOfObjectsAreEqual(data.excludedDevices, this.settings.excludedDevices);

            Object.assign(this.settings, data);
            debug(`device manager settings updated. vch device labels: `, data.selectedDeviceLabels);

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
