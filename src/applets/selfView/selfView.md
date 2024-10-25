### 📸 Self View Applet

This Applet allows users to obscure their self-view and add framing crosshairs to their video elements.

## Storage
```javascript
selfView = {
    hideView: {
        enabled: false,
        active: false
    },
    showFraming: {
        enabled: false,
        active: false
    }
}
```

`trackData` is also used to control the UI. Injection is only allowed if there is a media track.

## Messages

- `REMOTE_TRACK_ADDED` - content: a remote video track has been added
- `REMOTE_TRACK_REMOVED` - content: a remote video track has been removed
- `SELF_VIEW_SWITCH_ELEMENT` - dash->content: switch to the next self-view element

## Modules
### Dash

#### UI
User inputs:
1. Toggle blur for all self-view elements
2. Toggle framing for all self-view elements
3. Switch to the next self-view element

Button listeners:
* Blur All - toggles the blur state for all self-view elements
* Frame All - toggles the framing state for all self-view elements
* Switch Element - switches to the next self-view element

#### Logic

The dash context uses the `StorageHandler` to listen for changes in the `selfView` storage object and updates the UI accordingly.

### Content

The content script monitors video elements on the page and applies the self-view settings (obscure and framing) based on the `selfView` storage object.

1. `scanVideoElements` - scans the document for active video elements that are not remote tracks or screen shares
2. `modifyCurrentElement` - applies the obscure and framing settings to the current video element
3. `switchToNextElement` - switches to the next video element in the set of self-view elements


`switchToNextElement` should only be a temporary measure until the logic for identifying the active self-view is improved.

### Inject

Not applicable for this applet.

### Worker

Not applicable for this applet.

## Pages

Not applicable for this applet.

# TODO & In-progress

- Improve the logic for identifying the active self-view element or elements
