### 😈 Bad Connection Applet

This Applet simulates a bad network connection by degrading the quality of audio and video streams.

## Storage
```javascript
badConnection = {
    active: false,
    enabled: true,
    level: "passthrough",
}
```

`trackData` is also used to control the UI. Injection is only allowed if there is a media track.

## Messages

- `UPDATE_BAD_CONNECTION_SETTINGS` - content->inject: updates the bad connection settings
- `GET_BAD_CONNECTION_SETTINGS` - inject->content: requests the current bad connection settings
- `IMPAIRMENT_SETUP` - inject->worker: sets up the impairment processor
- `IMPAIRMENT_CHANGE` - inject->worker: changes the impairment settings

## Modules
### Dash

#### UI
User inputs:
1. Select bad connection level (none, moderate, severe)

Button listeners:
* Bad Quality Off - sets the bad connection level to "none"
* Bad Quality Moderate - sets the bad connection level to "moderate"
* Bad Quality Severe - sets the bad connection level to "severe"

#### Logic

The dash context uses the `StorageHandler` to listen for changes in the `badConnection` storage object and updates the UI accordingly.

### Content

The content script monitors bad connection settings and propagates changes to the inject script.

1. `updateBadConnectionSettings` - updates the bad connection settings in storage and sends `UPDATE_BAD_CONNECTION_SETTINGS` to inject
2. `getBadConnectionSettings` - retrieves the current bad connection settings from storage and sends them to inject

### Inject

The inject script manages the impairment of media streams based on the bad connection settings.

1. `setupImpairment` - sets up the impairment processor for a media track
2. `changeImpairment` - changes the impairment settings for a media track

### Worker

The worker script processes the media streams to simulate a bad connection.

1. `ImpairmentProcessor` - class that handles the degradation of audio and video streams
2. `process` - method that applies the configured impairments to a media frame

#### Impairment Levels

- **None (Passthrough)**: No impairment is applied. The media streams are transmitted as-is.
- **Moderate**:
    - **Video**:
        - Resolution Scale Factor: 0.20 (20% of the original resolution)
        - Effective Frame Rate: 10 fps
        - Drop Probability: 20% (1 in 5 frames are dropped)
        - Latency: 200 ms
    - **Audio**:
        - Drop Probability: 20% (1 in 5 audio frames are dropped)
        - Latency: 300 ms
        - Clipping Percentage: 10% (10% of the audio is clipped)
- **Severe**:
    - **Video**:
        - Resolution Scale Factor: 0.10 (10% of the original resolution)
        - Effective Frame Rate: 5 fps
        - Drop Probability: 30% (3 in 10 frames are dropped)
        - Latency: 400 ms
    - **Audio**:
        - Drop Probability: 50% (1 in 2 audio frames are dropped)
        - Latency: 600 ms
        - Clipping Percentage: 25% (25% of the audio is clipped)

## Pages

Not applicable for this applet.

# TODO & In-progress
