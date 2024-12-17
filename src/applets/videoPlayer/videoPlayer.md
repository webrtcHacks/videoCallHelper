# 🎥‍ Video Player Applet

This Applet replaces a stream with a video that the user uploads or records.

## Storage
```javascript
player = {
    active: false,
    enabled: true,
    currentTime: 0,
    mimeType: "",
}
```

`trackData` is also used to control the UI. Injection is only allowed if there is a media track.


## Messages

- `PLAYER_CANPLAY` - content->dash: video is ready to play to allow inject button
- `PLAYER_START` - dash->inject->worker: loads the video
- `PLAYER_PAUSE` - dash->inject->worker: pauses the video
- `PLAYER_RESUME` - inject->worker: loads the video
- `PLAYER_END` - dash{dash}->inject->worker: ends the video

## Modules
### Dash

#### UI
User inputs:
1. Record media
2. Upload media
3. Start media injection
4. Stop media injection - actually pauses it

Shows a preview of the media that will be injected from Record or Upload on mouseover.


#### Logic 

Large files caused slow interactions with `storage`, so indexedDB is used for long-term media storage.

On load it first checked indexDB to see if there is a buffer in storage. This is then loaded into the media preview.
The same IndexedDB is not available in other contexts, so the video file is transferred to the content context. 
The dataTransfer method of MessageHandler is used to stream this data (other approaches caused issues).

When a video is uploaded or recorded, the video is loaded into the preview.

Then the player storage object is updated with the `mimeType` and `currentTime` - these are not currently used.

Button listeners:
* Inject -starts the preview and sends a `PLAYER_START` to inject
* Stop - pauses the preview and sends a `PLAYER_PAUSE` to  inject
* record - uses mediaRecorder to record a blob
* addMediaButton -  uses a file input to open any video file and then loads it to storage.

Maximum recording length is 120 seconds under `MAX_RECORDING_TIME_SEC`.

Maximum file size is 250MB under `MAX_FILE_SIZE_MB`.


### Content 

A `<video>` element shared between content and inject is used to transfer media to the inject context.
Content uses `onDataTransfer` from `MessageHandler` for updates on new media and sends `PLAYER_CANPLAY` to dash when it is loaded. 


###  Inject 

Media injection logic:
1. inject.js  loads ProcessedMediaStream from the InsertableStreamsManager
2. ProcessedMediaStream generates individual workers for each track via InsertableStreamsManager and returns a MediaStream with modified tracks
3. InsertableStreamsManager sets up the player from "../videoPlayer/scripts/inject.mjs" when a new track comes in
4. inject.mjs' setupPlayer sets up the following listeners:
   -  ~~`PLAYER_LOAD` - loads the video element created by content.js and creates a MediaStreamTrackProcessor from either WebAudio or canvas.captureStream~~
   - `PLAYER_START` - sends `play()` to the video element, tells the worker to start, and transfers control of the reader to the worker
   -  `PLAYER_PAUSE` - pauses the video element and tells the worker to pause
   -  `PLAYER_END` - pauses the video element, tells the worker to end, and removes the video element if it exists
 
If there is both audio and video tracks, then the commands to the video element are redundant. 
Having a single video element is easier for keeping the audio and video in sync vs. 2 separate elements.

### Worker 

worker.js imports "../../videoPlayer/scripts/worker.mjs".

worker.mjs has a global `paused` for passing through frames.

worker.mjs sets up the following listeners:
- `PLAYER_START` - creates a transform that returns the read frame from the reader and sends that to the transform manager. 
If paused it will just return the frame the transformManager gives to it
- `PLAYER_PAUSE` - pauses the transform by setting `paused` to true
- `PLAYER_RESUME` - sets `pause` to false
- `PLAYER_END` - removes the transform from the transform manager

## Pages

I originally experimented with making recordings in a separate page - [recorder.html]("pages/recorder.html). 
This is not used currently.

# TODO & In-progress

#### Stream modification  button logic 

Enabled & gUM -> disabled:  PLAYER_END & warning
Enabled & no-gUM -> disabled: PLAYER_END & warning
Disabled & gUM -> enabled:  warning
Disabled & no-gUM -> enabled:  do nothing

How can dash context know if alterStream is loaded?
    Maybe have processedMediaStream add to trackData? - would need to send a message to context for that
Should I be able to run alterStream just on new tracks and not old ones? Not for initial launch
