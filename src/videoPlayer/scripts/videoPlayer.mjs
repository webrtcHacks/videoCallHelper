
export class VideoPlayer {
    mediaSource
    handle
    sourceBuffer
    queuedData = null
    #reader

    constructor() {
        this.mediasource = new MediaSource();
        this.handle = this.mediasource.handle;
        this.mediasource.addEventListener('sourceopen', () => {
            debug('MediaSource state when open:', this.mediasource.readyState);
            if (this.queuedData) {
                // this.#addSourceBufferAndAppendData(this.queuedData)
                this.#addSourceBufferAndAppendData().then(() => {
                    this.queuedData = null;

                    const videoTrack = this.handle.getVideoTracks()[0];
                    const videoTrackReader = videoTrack.readable;
                    this.#reader = videoTrackReader.getReader();
                });

            }

            // return this.handle;
        });

        this.mediasource.addEventListener('error', (e) => {
            debug('MediaSource error:', e);
        });
    }




    async #addSourceBufferAndAppendData(arrayBuffer) {
        const mimeCodec = 'video/mp4; codecs="avc1.64001f, mp4a.40.2"';
        const assetURL =  "../frag_bunny.mp4";
        const response = await fetch(assetURL);
        const buf = await response.arrayBuffer();
        this.mediasource.sourceBuffers[0].appendBuffer(buf);

        // const mimeCodec = 'video/webm; codecs="vp8"';
        debug('Adding source buffer with codec:', mimeCodec);
        this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeCodec);

        this.sourceBuffer.addEventListener('updateend', () => {
            debug('Source buffer update ended');
            if (!this.sourceBuffer.updating && this.mediaSource.readyState === 'open') {
                // reset to start of video
                this.sourceBuffer.timestampOffset = 0;
                debug('Calling endOfStream on mediaSource - will this restart?');
                // mediaSource.endOfStream();
            }
        });

        sourceBuffer.appendBuffer(new Uint8Array(arrayBuffer));
        debug('Data appended to source buffer');
    }

    get transformStream() {
        return new TransformStream({ transform: async (frame, controller) => {
            //const playerFrame = await this.#reader.read();
                // debug("transforming frame");
                controller.enqueue(frame);
            }});
    }

}

/*

self.addEventListener('message', (event) => {
    console.log('Message received in worker:', event.data.type);
    if (event.data.type === 'playback') {
        console.log('Playback data size:', event.data.data.byteLength);
        if (mediaSource.readyState === 'open' && !sourceBuffer) {
            addSourceBufferAndAppendData(event.data.data);
        } else {
            queuedData = event.data.data;
        }
    }
});



postMessage({ type: 'sourceOpen', sourceHandle: handle }, [handle]);
*/
