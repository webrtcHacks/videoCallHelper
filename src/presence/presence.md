
## Dash
Buttons
- Auto-update
- {Manual-override} Busy / Not busy
- Camera in use? - get from trackData with badge
- Microphone in use?  - get from trackData with badge

Expandable buttons
- presence on config
  -  URL text box
  - Headers
  - Body
  - Get / Post switch?
  - Save
- presence off config
    -  URL text box
    - Headers
    - Body
    - Get / Post switch?
     - Save


## Background

- sets up storage
- listens for `NEW_TRACK` and `TRACK_ENDED`
- listens for tabs.onRemoved
- calls the webhook
- manages the glow light

added: resets trackData on reload - is that a good idea?

presenceOn
- checks for storage.contents.trackData.some(td => td.readyState === 'live') but never populates that


#### trackData issues
1. doesn't clear when tab is refreshed
2. doesn't pick-up clones
3. random background resets clear this

trackData managed in background.js
`NEW_TRACK` and `TRACK_ENDED` messages sent from content.js


who uses trackData?
- Presence
- 


