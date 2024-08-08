# Video Player Applet

This Applet replaces a stream with a video that the user uploads or records.

## Dash 

### UI
User inputs:
1. Record media
2. Upload media
3. Start media injection
4. Stop media injection - actually pauses it

Shows a preview of the media that will be injected from Record or Upload on mouseover.


### Logic 

It first checks storage for a buffer, loads that into the media preview, and sends a `PLAYER_LOAD` command to the content

Button listeners:
* Inject -starts the preview and sends a `PLAYER_START` to inject
* Stop - pauses the preview and sends a `PLAYER_PAUSE` to  inject
* record - TODO
* addMediaButton -  uses a file input to open any video file and then loads it to storage.



TODO






## Content 

* `loadMedia` function - sets up a new video element and sets a converted string buffer as its source
* Listens for storage changes and calls loadMedia if the buffer changes
* Listens for a `PLAYER_LOAD` command and calls loadMedia

##  Inject 

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

## Worker 

worker.js imports "../../videoPlayer/scripts/worker.mjs".

worker.mjs has a global `paused` for passing through frames.

worker.mjs sets up the following listeners:
- `PLAYER_START` - creates a transform that returns the read frame from the reader and sends that to the transform manager. 
If paused it will just return the frame the transformManager gives to it
- `PLAYER_PAUSE` - pauses the transform by setting `paused` to true
- `PLAYER_RESUME` - sets `pause` to false
- `PLAYER_END` - removes the transform from the transform manager





----
TODO:
- Recording
- enable / disable logic
- Review the PLAYER_END logic
- Show "loading" in the previewVideo when loading
- init storage.contents.player.enabled 

