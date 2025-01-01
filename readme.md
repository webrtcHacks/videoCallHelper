# Video Call Helper (β)

A Chrome Extension that provides a suite of tools to help your video calling experience. 


## Overview

Video Call Helper is a tool box for video calls. 
It provides a set of tools that interact with the underlying media capture and 
real time communications related APIs to provide statistics and modify media. 
Control the extension via a drop-down dashboard accessible from the extension icon.

### Features
Tools include:
- **😈 Bad Connection** - simulate a bad network connection if you are looking for a reason to get out of a meeting or avoid talking
- **🌫️ Blur self-view** - obscure your own video self-view to reduce distractions
- **🖼️ Camera Framing** - overlay a grid on your self-view video to help you frame your camera like a professional
- **🎛️ Device Manager** - remove speaker, audio, and video devices from device enumeration.
  Useful for keeping virtual and used devices from being accidentally used by your video calling app.
- **🎥 Media injection** - record or select a video to insert instead of your camera feed.
Useful for playing a video of yourself to give the appearance of being present without actually being there or
 rick-rolling
- **🟢 Presence** - monitor when your camera and/or microphone are used. 
For developers: send a webhook request whenever the camera or microphone are active.
Useful for triggering a busy light indicator by your workspace or other workflows

See the [applets](#applets) section for more information on each applet.

### Works on most web-based video calling apps

Because Video Call Helper operates at the browser level, it should work with most web-based video calling apps.
Tested with popular video calling apps like Google Meet and Jitsi Meet. 
Make sure to choose the option to run in the browser when using Desktop apps like Microsoft Teams and Zoom. 

ToDo: regular testing against a variety of video calling apps.

### Browser-based with no data sent to external servers
Video Call Helper runs completely with in the browser. We don't collect any data.

### This is Beta
⚠️WARNING: This extension is in beta and will have bugs. Help us out by submitting an issue if you find one.


## Installing into Chrome, Edge, and other Chromium-based browsers

_Note - currently only tested with Chrome and Edge._ 

### Chrome Web Store
Installation from the Chrome Web Store is coming soon.

### Side-loading the extension

1. Download the latest release from the [releases page]()
2. Unzip the release
3. Open the browser's extension page:
    - Chrome: [chrome://extensions/](chrome://extensions/)
    - Edge: [edge://extensions/](edge://extensions/)
4. Enable Developer Mode
5. Click "Load unpacked" and select the unzipped extension directory
6. The extension should now be installed


---
## 🧑‍💻 Developers

Video Call Helper attempts to simplify of development of new applets and features for the extension.
It provides a framework for:
1. Coordination across multiple contexts (background, content, inject, worker)
2. Use of Insertable Streams inside a worker with multiple transforms for media manipulation
3. Storage of settings
4. Exposure of MediaStreamTracks 

### Technologies
Video Call Helper utilizes the following:
* Vanilla ES6 JavaScript with some inline type definitions via [JSDoc](https://jsdoc.app/)
* [npm](https://www.npmjs.com/) for package management
* [WebPack](https://webpack.js.org/) for bundling
* [Bootstrap 5](https://getbootstrap.com/docs/5.0/getting-started/introduction/) - to build a simple UI using lightweight components


### Building from source

```sh
git clone https://github.com/webrtchacks/videocallhelper.git
cd videocallhelper
npm install
 ```

#### Dev build
`npm run watch`

#### Prod build
`npm run build`

### Architecture

The Chrome extension architecture requires many different contexts for complex page interaction. 
Video Call Helper operates in the following contexts:
1. **🫥 background (extension)** - the background service worker script with full access to the [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/api)
2. **🕵 content (extension)** - the content script injected into user pages that maintains access to some extension features
3. **💉 inject (user)** - the injected scripts that operate in the user page context with DOM access
4. **📈️‍ dash (extension)** - a dropdown dashboard page based on Bootstrap 5 that runs in an iFrame from the content script
5. **👷 worker (user)** - worker script injected into the user page to handle insertable streams

#### Overloading functionality

[extension-core/inject.js](./src/extension-core/scripts/inject.js) currently overloads the following browser APIs:
- `navigator.mediaDevices.getUserMedia`
- ~~`navigator.mediaDevices.getDisplayMedia`~~ (commented out)
- `navigator.mediaDevices.enumerateDevices`
- `navigator.mediaDevices.addEventListener`
- `navigator.mediaDevices.removeEventListener`
- `MediaStream.addTrack`
- `MediaStream.cloneTrack`
- `RTCPeerConnection.addTrack`
- `RTCPeerConnection.addStream`
- `RTCRtpSender.replaceTrack`
- `RTCPeerConnection.addTransceiver`
- `RTCPeerConnection.setRemoteDescription`
- `RTCPeerConnection.close`

#### Communication between contexts

The primary communication between handled by the `MessageHandler` class in 
[modules/messageHandler.mjs](./src/modules/messageHandler.mjs).
This class abstracts the differences between 
`chrome.tabs.sendMessage`, 
`chrome.runtime.sendMessage`,
`window.postMessage`, and 
`document.dispatchEvent`
with a simple API for sending and receiving messages. This class also includes event listeners.

Example:
```javascript
import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";
const mh = new MessageHandler(c.INJECT);
mh.sendMessage(c.CONTENT, m.UPDATE_DEVICE_SETTINGS, {currentDevices: devices});
mh.addEventListener(m.DEVICE_SETTINGS_UPDATED, (event) => {
    debug("Device settings updated", event.detail);
});
```

Communication between inject and worker scripts is done via the `WorkerMessageHandler` and `InjectToWorkerMessageHandler` 
classes in `messageHandler.mjs` in [modules/messageHandler.mjs](./src/modules/messageHandler.mjs). 

TODO: consider how to consolidate these into a single `MessageHandler`. 

#### Storage

Extension contexts are able to use [chrome.storage.local](https://developer.chrome.com/docs/extensions/reference/api/storage#property-local)
to store settings and other data. 
A helper class `StorageHandler` in [modules/storageHandler.mjs](./src/modules/storageHandler.mjs) abstracts the storage API and handles disconnections 
with the background service worker script. 

Example:
```javascript
import {Storage} from "../../modules/storage.mjs";
const storage = await new StorageHandler();
// load default settings
await StorageHandler.initStorage('trackData', trackDataSettingsProto);  
await storage.set('trackData', newTrackDataArray);

// Changes to local storage are saved in `StorageHandler.contents`
const newTrackDataArray = storage.contents.trackData.filter(td => td.id !== id);
// or use a get
const trackData = await storage.get('trackData');

// update will only change sub-objects that are different
await storage.update('presence', settings).catch(err => debug(err));

// listen for changes - changedValue only shows what sub-objects have changed
storage.addListener('presence', async (newValue, changedValue) => {
    debug(`presence storage changes - new, changed: `, newValue, changedValue);

    if (changedValue.enabled === true) {
        await presenceOn();
    } else if (changedValue.enabled === false || changedValue.active === false) {
        await presenceOff();
    }
});

```

IndexedDB is used for storage of larger items such as media.

#### Insertable Streams and Inject Worker

Video Call Helper uses [Insertable Streams](https://developer.chrome.com/docs/capabilities/web-apis/mediastreamtrack-insertable-media-processing)
for media manipulation features. Using this in a modular fashion while allowing pipelining of multiple processing transforms
required some complex abstractions.

The `InsertableStreamsManager` class in [modules/insertableStreamsManager.mjs](./src/modules/insertableStreamsManager.mjs)
accepts a `MediaStreamTrack` as an argument and returns a `MediaStreamTrackGenerator`. Since `MediaStreamTrackGenerator` 
has different properties than a `MediaStreamTrack`, the `MediaStreamTrackGenerator` is extended with the 
`AlteredMediaStreamTrack` class in [modules/AlteredMediaStreamTrackGenerator.mjs](./src/modules/AlteredMediaStreamTrackGenerator.mjs) to have all the same properties 
and methods as a `MediaStreamTrack`.
A helper `ProcessedMediaStream` class in [modules/insertableStreamsManager.mjs](./src/modules/insertableStreamsManager.mjs) 
is used process all tracks in a `MediaStream` (vs. managing those stream's tracks individually).

Example:
```javascript
const alteredStream = await new ProcessedMediaStream(stream);   // modify the stream
```

`InsertableStreamsManager` creates a new worker for each track. That worker then applies one or more functions
to the stream of frames using the `transformManager` function in [extension-core/scripts/worker.js](./src/extension-core/scripts/worker.js).  
These worker functions are stored as `worker.mjs` in each applet and need to be added to `worker.js`. The 
`WorkerMessageHandler` is used to communicate with a corresponding `inject.mjs` for each applet. 

Example `worker.mjs`:
```javascript
import {WorkerMessageHandler} from "../../modules/messageHandler.mjs";
const workerMessageHandler = new WorkerMessageHandler();
wmh.addListener(m.PLAYER_START, async (data) => {
    const playerReader = data.reader.getReader();
    paused = false;

    /**
     * Drop the incoming frame and replace it with the player frame
     * @param frame - the incoming frame to process
     * @returns {Promise<*>}
     */
    async function playerTransform(frame) {
        if (paused){
            return frame;
        }

        const {done, value: playerFrame} = await playerReader.read();
        if (done) {
            debug("playerTransform done");
            transformManager.remove("player");
            return frame;
        }

        frame.close();
        return playerFrame
    }

    transformManager.add(playerName, playerTransform);

});
```

### Directory structure

The directory structure of the project is as follows:
```plaintext
src/
├── applets/ - self-contained feature used by the extension
│   └── applet/
│       ├── appletName.md - developer documentation and notes for the applet
│       ├── pages/ - html for associated applet pages
│       ├── scripts/
│       │   ├── background.mjs - modules added to background.js
│       │   ├── content.mjs - modules added to content.js
│       │   ├── dash.mjs - modules added to dash.js for controlling the dashboard UI
│       │   ├── inject.mjs - modules added to inject.js
│       │   ├── settings.mjs - default settings prototype for StorageHanlder (chrome.storage.local)
│       │   └── worker.mjs  - worker script modules
│       └── styles/
├── dash/ - drop down dashboard used to control the applets
├── extension-core/ - extension scripts
│   ├── pages/ - html for pages used by the extension
│   └── scripts/
│       ├── background.js - Extension background worker script
│       ├── content.js - Extension content script added to user pages
│       ├── inject.js - injected into user pages to override RTC APIs
│       ├── options.js - not currently used
│       ├── popup-error.js - shown if communication context lost
│       ├── dash.js - pop-up dashboard main script
│       └── worker.js - insertable streams worker script
├── modules - shared modules (message and storage handling)
├── static - static content (icons)
└── manifest.json - V3 Chrome Extension manifest
```

The `applet/scripts` folder contains a module script (`.mjs`) for each context that is needed.


### Testing

This is a TODO item.

[/test/gum.html](tests/gum.html) for quick, manual `getUserMedia` and `enumerateDevices` related tests.

## Applets

### 😈 badConnection
Simulate a bad network connection if you are looking for a reason to get out of a meeting or avoid talking.
This uses the `InsertableStreamsManager` to lower the resolution, decrease framerate, and add freezing of video 
and add clipping to audio, like what happens during a bad network connection.

Source folder: [badConnection](src/applets/badConnection)

Implementation details: [badConnection.md](src/applets/badConnection/badConnection.md)


### 🎛️ deviceManager
Remove speaker, audio, and video devices from device enumeration.
This apple overrides the `navigator.MediaDevices.enumerateDevices` function to remove devices from the list of available devices.

Source folder: [deviceManager](src/applets/deviceManager)


Implementation details: [deviceManager.md](src/applets/deviceManager/deviceManager.md)

### 📸 imageCapture
Grab images from the local `getUserMedia` stream. 
Originally intended to assist with ML training. 
Saved in IndexedDB with dedicated page for viewing and exporting the images with associated metadata.

Work-in-progress - not currently implemented in the control dashboard.

Source folder: [imageCapture](src/applets/imageCapture)


### 🟢 presence
Background script that monitors when your camera and/or microphone are used to indicate a presence state.
Optionally trigger a webhook whenever presence changes state to trigger external actions, such as changing the 
display on a busy light indicator or triggering a workflow in a service like [IFTTT](https://ifttt.com/).

Dependencies: trackData - used to count the number of active tracks by device type.

Source folder: [presence](src/applets/presence)

Implementation details: [presence.md](src/applets/presence/presence.md)

### 🙈 selfView

Modifies the user's self-view without impacting what is transmitted. 
Options include:
- Blur self-view - blur the self-view to reduce distractions
- Add a grid overlay to help with camera framing - look your best by making sure you are properly framed in the camera

Dependencies: trackData - selfView only activates when there is a video track.

Source folder: [selfView](src/applets/selfView)

Implementation details: [selfView.md](src/applets/selfView/selfView.md)

### 🛤 trackData

Keeps track of the number of active `getUserMedia` tracks by device type.

Source folder: [trackData](src/applets/trackData)

Implementation details: [trackData.md](src/applets/trackData/trackData.md)

### 🎥 videoPlayer

Replaces the getUserMedia stream with a video file.
The user can make a recording or upload a video file to inject.
Note: video files cannot be larger than 250MB due to Chrome extension limitations on local storage.

Source folder: [videoPlayer](src/applets/videoPlayer)

Implementation details: [videoPlayer.md](src/applets/videoPlayer/videoPlayer.md)



