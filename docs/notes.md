
# Passing information between contexts

## Doing something in inject.js when the user clicks on something in the dash
1. dash.js watches for UI actions
2. dash.js updates storage based on action
3. content.js has listeners for storage changes
4. content.js does a sendMessage to 'inject' with the update
5. inject.js has a listener for messages from content.js


# Alterstream

gum -> transferStream -> content 
    -> alterStream -> impairment.worker
gum <---------------- 

applyConstraint 


aspectRatio: {max: 1920, min: 0.0005208333333333333}
deviceId:"a22f9a8278dee2ee22fe7fa046737d7dd8b55fb836211c9595eaf30a0ee847b7"
facingMode:[]
frameRate: {max: 30, min: 0}
groupId: "1b6de2c476a29ad15fa5affb4456e5a5c1a8b8c257a6cb8c0742dbf5150a3820"
height:{max: 1920, min: 1}
resizeMode: ['none', 'crop-and-scale']
width: {max: 1920, min: 1}

## content vs. inject context

Tried to run the worker in the content context.
The stream/track object would get reset when switching contexts, so it would look like a 
MediaStreamTrackGenerator instead of the faked MediaStreamTrack I setup with alteredMediaStreamTrack.
This inturn would cause errors in the apps

## cloning options

1. clone the source gUM track and run it through a new generator
 - Pro: could do applyContraints to the clone track without affecting the original source
 - Con: way more resources
2. clone the generated track
 - Pro: easy
 - Con: won't work with apply contraints
3. Tee the generator output to a new stream 
 - Pro: no new resources
 - Con: can't do applyContraints


# Saving to disk

`parentDirectoryHandle = await window.showDirectoryPicker();
`

https://web.dev/file-system-access/

Permissions get reset everytime video.js is opened, so user would need to click 3 confirmations every time.

ToDo: try it from background.js?
