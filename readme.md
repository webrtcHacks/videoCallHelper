

## Dev build
`npm run watch`

## prod build
`npm run build`

# Architecture

## Directory structure

src/
├── applet/
│   ├── pages/
│   ├── scripts/
│   │   ├── background.mjs - modules added to background.js 
│   │   ├── content.mjs - modules added to content.js
│   │   ├── dash.mjs - modules added to dash.js for controlling the dashboard UI
│   │   ├── inject.mjs - modules added to inject.js
│   │   ├── settings.mjs - default settings added to chrome.storage.local
│   │   └── worker.mjs  - worker script modules
│   └── styles/
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
└── manifest.json - chrome extension manifest

## contexts
1. background (extension)
2. content (extension)
3. inject (user)
4. dash (extension)
5. worker (user)

content <-> inject uses custom Events
all others use chrome.runtime

## stream transfer
1. Inject creates a video DOM element
2. Content script listens for `gumStreamStart` event from inject
3. The stream is taken from the video element added to `vch.streams`
4. Track handlers are added to the stream's tracks
5. content responds with `stream_transfer_complete`
6. Inject removes the video element

TODO: Do I handle track additions and removals?


# Applets

## Bad Connection

## Device Manager


## Image Capture

Grab images from the local `getUserMedia` stream for ML training 

## Presence

Send a webhook request whenever `getUserMedia` is active.

`monitorTrack` function in content script
* sends a `NEW_TRACK` message to the background script if live
* checks tracks every 2 seconds to see if they are ended - sends `TRACK_ENDED` message to background script

content script unload listener sends `UNLOADED`


## Video Player
