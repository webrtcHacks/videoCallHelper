// deviceManager settings prototype

/** @typedef {Object} deviceManagerSettings */
export const settings = {
    enabled: false,
    currentDevices: [],
    selectedDeviceLabels: {
        audio: null,
        video: null,
    },
    excludedDevices: [],
    lastDeviceIds: {
        audio: null,
        video: null,
    }
}
