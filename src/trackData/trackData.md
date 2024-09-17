# t🛤 TrackData applet

Manages MediaStreamTrack information.

## Storage

An array of trackData objects:

```javascript
trackData = {
        id,
        kind,
        label,
        readyState,
        streamId,
        sourceUrl,
        time,
        settings, 
        tabId
    }
```

settings.mjs defaults sets `trackData` to an empty array on startup. 

## Modules

### Background

Monitors `chome.tabs` changes that could result in the stream / track being closed and removes them from storage.

Checks the storage object on start-up.

Note:
MAP not allowed in Chrome Storage.

### Content

Listens for `GUM_STREAM_START`, gets tracks from the stream transferred from inject and monitors for track changes.
Storage is updated on changes.

TODO: handled cloned tracks. Cloned tracks are never passed to the content script.
