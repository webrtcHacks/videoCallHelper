### 🎛️ Device Manager Applet

This Applet allows users to manage their audio, video, and speaker devices by removing them from device enumeration.

## Storage
```javascript
deviceManager = {
    enabled: true,
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
```

`trackData` is also used to control the UI. Injection is only allowed if there is a media track.

## Messages

- `UPDATE_DEVICE_SETTINGS` - content->inject: updates the device settings
- `GET_DEVICE_SETTINGS` - inject->content: requests the current device settings

## Modules
### Dash

#### UI
User inputs:
1. Select audio device
2. Select video device
3. Exclude devices from enumeration

Button listeners:
* Select Audio Device - updates the selected audio device
* Select Video Device - updates the selected video device
* Exclude Device - toggles the exclusion state of a device

#### Logic

The dash context uses the `StorageHandler` to listen for changes in the `deviceManager` storage object and updates the UI accordingly.

### Content

The content script monitors device settings and propagates changes to the inject script.

1. `updateDeviceSettings` - updates the device settings in storage and sends `UPDATE_DEVICE_SETTINGS` to inject
2. `getDeviceSettings` - retrieves the current device settings from storage and sends them to inject

### Inject

The inject script manages the devices returned by `navigator.mediaDevices.enumerateDevices()` and inserts fake devices.

1. `modifyDevices` - filters devices to exclude and adds fake devices to the list of devices returned by `enumerateDevices`
2. `fakeDeviceStream` - returns a stream with one or more altered tracks based on the constraints

### Worker

Not applicable for this applet.

## Pages

Not applicable for this applet.

# TODO & In-progress

- Improve the logic for handling multiple device selections and exclusions
- Add support for dynamically updating device capabilities based on user selection
