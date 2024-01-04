// Inside dedicated worker
// let mediaSource = new MediaSource();
// let handle = mediaSource.handle;

/*
// Transfer the handle to the context that created the worker
postMessage({ arg: handle }, [handle]);

mediaSource.addEventListener("sourceopen", async () => {
    // const assetURL =  "bbb360p30_frag.mp4"; // "frag_bunny.mp4"; // "bbb.mp4";
    // const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    const assetURL = "BigBuckBunny_360p30.mp4";
    const mimeCodec = 'video/mp4; codecs="avc1.64001f, mp4a.40.2"';
    const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
    const response = await fetch(assetURL);
    const buf = await response.arrayBuffer();
    sourceBuffer.addEventListener('updateend',  ()=> mediaSource.endOfStream());
    sourceBuffer.appendBuffer(buf);
});
 */

// worker.js
let mediaSource = new MediaSource();
let handle = mediaSource.handle;
let sourceBuffer;
let videoData = null;
let maxDuration = 60;
let segmentDuration = 0;

function logsStats() {
    console.log(`Current MediaSource Duration: ${mediaSource.duration}s`);
    console.log(`Current SourceBuffer Duration: ${sourceBuffer.buffered.end(0)}s`);
    console.log(`Current SourceBuffer TimestampOffset: ${sourceBuffer.timestampOffset}s`);
    // console.log(`Current SourceBuffer AppendWindowStart: ${sourceBuffer.appendWindowStart}s`);
    // console.log(`Current SourceBuffer AppendWindowEnd: ${sourceBuffer.appendWindowEnd}s`);
    // console.log(`Current SourceBuffer Mode: ${sourceBuffer.mode}`);
    // console.log(`Current SourceBuffer Updating: ${sourceBuffer.updating}`);
    // console.log(`Current SourceBuffer Buffered length: ${sourceBuffer.buffered.length}`);
    // console.log(`Current SourceBuffer Buffered start: ${sourceBuffer.buffered.start(0)}s`);
}

mediaSource.addEventListener('sourceopen', () => {
    console.log('MediaSource state when open:', mediaSource.readyState);
    if (videoData) {
        addSourceBufferAndAppendData(videoData);
        videoData = null;
    }
});

mediaSource.addEventListener('error', (e) => {
    console.error('MediaSource error:', e);
});


self.addEventListener('message', (event) => {
    console.log('Message received in worker:', event.data.type);
    if (event.data.type === 'playback') {
        videoData = event.data.data;
        console.log('Playback data size:', videoData.byteLength);
        if (mediaSource.readyState === 'open' && !sourceBuffer) {
            addSourceBufferAndAppendData(videoData);
        }
    }
});

let count = 0;

function addToBuffer(timeout) {
    // sourceBuffer.buffered.end(0)
    if (Math.round( mediaSource.duration + segmentDuration) < maxDuration) {
        setTimeout(() => {
            if (mediaSource.readyState === 'open') {
                console.log("--- Adding to buffer ---");
                // mediaSource.duration += segmentDuration;
                sourceBuffer.appendBuffer(new Uint8Array(videoData));
                count++;
            } else
                console.log(`can't add to buffer. mediaSource.readyState: ${mediaSource.readyState}`);
        }, timeout)
    } else {
        console.log("done adding to buffer");
        console.log('Calling endOfStream on mediaSource');
        mediaSource.endOfStream();
    }


}

function addSourceBufferAndAppendData(data) {
    const mimeCodec = 'video/webm; codecs="vp8"';
    console.log('Adding source buffer with codec:', mimeCodec);
    sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
    sourceBuffer.mode = 'sequence';
    const bufferToAdd = new Uint8Array(data);

    sourceBuffer.addEventListener('updateend', async() => {
        console.log('Source buffer update ended');
        logsStats();

        // get the initial video duration
        if (sourceBuffer.timestampOffset === 0) {
            segmentDuration = sourceBuffer.buffered.end(0);
            if(mediaSource.duration === Infinity)
                mediaSource.duration = segmentDuration;
            console.log(`Buffer duration: ${segmentDuration}s`);
        }

        // add or remove from the buffer
        if (!sourceBuffer.updating && mediaSource.readyState === 'open') {

            // Remove from buffer
            // ToDo: I couldn't get this to work for the recorded video
            /*
            const maxSecsInBuffer = 30.0;
            // if playback is more than maxSecsInBuffer, assume the buffer is at least that length
            if (sourceBuffer.timestampOffset > maxSecsInBuffer) {
                console.log("--- Removing from buffer ---");
                sourceBuffer.timestampOffset -= 30.0;
                sourceBuffer.remove(0, 30);
            } else
             */
            addToBuffer(segmentDuration * 1000 * 0.80);

        } else
            console.log(sourceBuffer.updating, mediaSource.readyState);
    });

    sourceBuffer.appendBuffer(bufferToAdd);
    console.log('Data appended to source buffer');

}

postMessage({type: 'sourceOpen', sourceHandle: handle}, [handle]);
