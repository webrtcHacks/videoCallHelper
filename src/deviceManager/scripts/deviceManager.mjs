
export class DeviceManager {

    //ToDo: list
    // 1. add a listener for when enabled is changed in the UI
    // 2. emit a deviceChange event when enabled is changed

    constructor() {
        // this.devices = devices;
        this.lastRealAudioId = 'default';
        this.lastRealVideoId = 'default';
    }

    get enabled(){
        return true
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
