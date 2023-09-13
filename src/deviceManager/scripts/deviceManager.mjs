import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";
const mh = new MessageHandler('inject');
const debug = Function.prototype.bind.call(console.debug, console, `vch 💉️🥸`);


export class DeviceManager {

    //ToDo: list
    // 1. send a message asking for settings
    // 1. add a listener for when enabled is changed in the UI
    // 2. emit a deviceChange event when enabled is changed

    constructor() {
        // this.devices = devices;
        this.lastRealAudioId = 'default';
        this.lastRealVideoId = 'default';
        this.isEnabled = false;
        this.initialized = false;
        this.devices = [];
        this.deviceChangeListeners = [];

        mh.addListener(m.UPDATE_BAD_CONNECTION_SETTINGS, (data) => {
            this.initialized = true;

            debug("bad connection settings updated", data);
            let lastValue = this.isEnabled;
            this.isEnabled = data.enabled;

            // look for changes; fake the devicechange event if vch-devices should be added or removed
            if( data.enabled !== lastValue){
                // Doesn't work :(
                // navigator.mediaDevices.dispatchEvent(new Event("fakeDevicechange"));
                // mh.sendMessage('inject', m.FAKE_DEVICE_CHANGE, {action: data.enabled ? 'add' : 'remove'});

                debug(`fake device change: "${data.enabled ? 'add' : 'remove'}", triggering devicechange listeners`);
                this.deviceChangeListeners.forEach(listener =>{
                        try {
                            listener(new Event('devicechange'));
                        } catch (error) {
                            debug('Error triggering custom devicechange listener:', error);
                        }});
            }
        });

        mh.sendMessage('content', m.GET_BAD_CONNECTION_SETTINGS);

        debug("device manager initialized");

    }

    // ToDo: be careful of race conditions if this is called before settings are received
    get enabled(){
        return this.isEnabled;
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

    /*
    get lastRealAudioId(){
        return this.lastRealAudioId
    }

    get lastRealVideoId(){
        return this.lastRealVideoId
    }

    set lastRealAudioId(id){
        this.lastRealAudioId = id
    }

    set lastRealVideoId(id){
        this.lastRealVideoId = id
    }
     */


}
