

## Dev build
`npm run watch`

## contexts
1. background (extension)
2. content (extension)
3. inject(web)
4. dash (extension)

content <-> inject uses custom Events
all others use chrome.runtime

## stream transfer
1. Inject creates a video DOM element
2. Content script listens for `gumStreamStart` event from inject
3. The stream is taken from the video element added to vchStreams
4. Track handlers are added to the stream's tracks
5. content responds with `stream_transfer_complete`
6. Inject removes the video element

TODO: Do I handle track additions and removals?

## presence

Send a webhook request whenever `getUserMedia` is active.

`monitorTrack` function in content script
* sends a `NEW_TRACK` message to the background script if live
* checks tracks every 2 seconds to see if they are ended - sends `TRACK_ENDED` message to background script

content script unload listener sends `UNLOADED`

## image capture

Grab images from the local `getUserMedia` stream for ML training
