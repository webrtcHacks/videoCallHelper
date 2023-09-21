// Manages the devices returned by navigator.mediaDevices.enumerateDevices() and inserts fake vch devices

/*
    Sits in inject context

    Message Flows:

    Initialization
    1. DeviceManager sends GET_DEVICE_SETTINGS to content.js
    2. content.js gets 'deviceManager' values from storage and sends them in UPDATE_DEVICE_SETTINGS to inject.js

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

 */

import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
const mh = new MessageHandler('inject');
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️🥸`);


export class DeviceManager {

    constructor() {
        this.isEnabled = false;
        this.initialized = false;
        this.devices = [];
        this.deviceChangeListeners = [];

        // Setup listener to:
        //  1. set initialized if settings are received
        //  2. simulate a devicechange event if enabled is changed
        mh.addListener(m.UPDATE_DEVICE_SETTINGS, (data) => {
            this.initialized = true;

            let lastValue = this.isEnabled;
            this.isEnabled = data.enabled;

            // simulate a devicechange event if enabled is changed
            if( data.enabled !== lastValue){
                debug("device manager settings updated", data);
                this.#simulateDeviceChangeEvent();
            }
        });

        mh.sendMessage('content', m.GET_DEVICE_SETTINGS);

        debug("device manager initialized");

    }

    // Race conditions if this is called before settings are received
    /*
    get enabled(){
        return this.isEnabled;
    }
     */

    // Crappy work-around to make sure we know if deviceManager is enabled before returning
    //  my attempts to delay the constructor didn't work since it has to be synchronous
    async enabled(){
        // wait if not initialized
        if(!this.initialized) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!this.initialized) {
                debug("device manager not initialized after 0.5 second, disabling it");
                this.initialized = true;    // set this to true so we don't delay other calls to enumerateDevices
            }
        }
        return this.isEnabled;
    }

    #simulateDeviceChangeEvent() {
        debug(`fake device change: "${this.isEnabled ? 'add' : 'remove'}", triggering devicechange listeners`);
        this.deviceChangeListeners.forEach(listener =>{
            try {
                listener(new Event('devicechange'));
            } catch (error) {
                debug('Error triggering custom devicechange listener:', error);
            }});

        // Note: the below doesn't work :(
        // navigator.mediaDevices.dispatchEvent(new Event("fakeDevicechange"));
        // mh.sendMessage('inject', m.FAKE_DEVICE_CHANGE, {action: data.enabled ? 'add' : 'remove'});
    }


    addFakeDevices(devices) {

        // ToDo: verify proper behavior if there are no browser permissions
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

}
