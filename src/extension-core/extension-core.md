
## stream transfer
1. Inject creates a video DOM element
2. Content script listens for `gumStreamStart` event from inject
3. The stream is taken from the video element added to `vch.streams`
4. Track handlers are added to the stream's tracks
5. content responds with `stream_transfer_complete`
6. Inject removes the video element

