# 🟢 Presence Applet
Detects if the camera and/or microphone is being used (via trackData).  The presence of a camera and/or microphone stream is considered "on". 
Displays the number of camera and microphone streams. 
Can be configured to send a webhook to a specified URL when presence is "on" or "off".
I use this to display a busy light outside my office to let visitors know when I am on calls.

## Storage

```javascript
presence = {
  on: {
    onUrl: "",
    onMethod: "POST",
    onPostBody: "",
    onHeaders: "",
  },
  off: {
    offUrl: "",
    offMethod: "POST",
    offPostBody: "",
    offHeaders: "",
  },
  hid: false,
  active: false,
  enabled: false
}
```
## Modules

### Dash
Buttons
- Auto-update
- {Manual-override} Busy / Not busy
- Camera in use - badge count from trackData
- Microphone in use?  - badge count from trackData

Expandable buttons:
- presence on config
  - URL text box
  - Headers
  - Body
  - Get / Post switch?
  - Save
- presence off config
    - URL text box
    - Headers
    - Body
    - Get / Post switch?
- Save

### Background.mjs

- initializes the presence object in storage if it isn't there
- listens for storage changes and triggers on / off actions
- Sets the icon based on the presence state
- Calls webRequest on presence change

TODO: webhook is called twice when both audio and video are captured at the same time


