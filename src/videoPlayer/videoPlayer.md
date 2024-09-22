# 🎥‍ Video Player Applet

This Applet replaces a stream with a video that the user uploads or records.

## Storage
```javascript
player = {
    active: false,
    enabled: true,
    objectUrl: null,
    currentTime: 0,
    loop: false,
    mimeType: "",
    videoTimeOffsetMs: 0
}
```

## Messages

Listeners
- `INJECT_LOADED` - inject->content: waits for inject to finish
- `PLAYER_TRANSFER` - dash->content: sends the video blob to content
- `PLAYER_START` - dash->inject: starts the video
- `PLAYER_PAUSE` - dash->inject: pause playback
- `PLAYER_RESUME` - inject: pauses the video
- `PLAYER_END` - inject: ends the video

Senders
- `PLAYER_START` - inject->worker: loads the video
- `PLAYER_RESUME` - inject->worker: loads the video
- `PLAYER_PAUSE` - inject->worker: pauses the video
- `PLAYER_END` - inject->worker: ends the video

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

It first checks storage for a buffer, loads that into the media preview, and sends a `PLAYER_LOAD` command to the content

Button listeners:
* Inject -starts the preview and sends a `PLAYER_START` to inject
* Stop - pauses the preview and sends a `PLAYER_PAUSE` to  inject
* record - TODO
* addMediaButton -  uses a file input to open any video file and then loads it to storage.


### Content 

How to get the video from the extension context (dash) to content??
1. transfer the blob over sendMessage - would need to break it up into 1-2MB segments and then reassemble
2.  transfer an objectURL? DOESN'T WORK - not a web accessible resource for the extension and can't make it one
3. Save in storage - put in storage temporarily so it doesn't slow down other storage functions

* `loadMedia` function - sets up a new video element and sets a converted string buffer as its source
* Listens for storage changes and calls loadMedia if the buffer changes
* Listens for a `PLAYER_LOAD` command and calls loadMedia

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





----
TODO:
- enable / disable logic
- inject video not working - only if dash is opened first
- Review the PLAYER_END logic
- reconcile css issues
- fix docs

- load buffer faster - storage detection appears slow
- preview video autoplay


#### Stream modification  button

Enabled & gUM -> disabled:  PLAYER_END & warning
Enabled & no-gUM -> disabled: PLAYER_END & warning
Disabled & gUM -> enabled:  warning
Disabled & no-gUM -> enabled:  do nothing

How can dash context know if alterStream is loaded?
    Maybe have processedMediaStream add to trackData? - would need to send a message to context for that
Should I be able to run alterStream just on new tracks and not old ones? Not for initial launch

TODO:
- content.mjs
  - remove db
  - listen for storage changes on url
- dash.mjs
  - verify UI logic 

Dash.html is in the extension context


#### loading the video from indexedDB

debugging scenario where gUM happens before dash is opened

When dash is opened first
- dash.mjs
  - opens the indexedDB
  - puts the video in storage under temp
- content.mjs
  - listens for storage changes on temp
  - loads the media from storage
  - creates a videoPlayer
- inject.mjs
  - listens for PLAYER_TRANSFER and assigns the video to the videoPlayerElement
  - insertableStreamsManager uses setupPlayer - but videoPlayer isn't ready

    might need to setup a dummy element and stream and then swap the player when dash is open?

Sat morning:
 tried to create a videoElement - test when I am back

Sunday:
x need to change the logic so that inject.mjs creates the video element
x how to get the video element id to content.mjs? - just using "vch-player"

TODO:
- player doesn't stop in dash inject icon or hidden player if the original source track is stopped
- quality simulator doesn't work with video player; just frame-rate
x occasional atob errors
- disable dash ui inject until the video is loaded
x try shadow DOM for the video element




/*
Not easy to send a stream to dash:
* can't access the iframe content - CORS issues
* can't send the stream over postMessage - it's not serializable
* can't pass a resource URL - treated as different domains
ideas:
1. open a new stream - could cause gUM conflicts, more encoding
2. send snapshots - this is what did
*/
