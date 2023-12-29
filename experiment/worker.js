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
let queuedData = null;

mediaSource.addEventListener('sourceopen', () => {
    console.log('MediaSource state when open:', mediaSource.readyState);
    if (queuedData) {
        addSourceBufferAndAppendData(queuedData);
        queuedData = null;
    }
});

mediaSource.addEventListener('error', (e) => {
    console.error('MediaSource error:', e);
});


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

function addSourceBufferAndAppendData(arrayBuffer) {
    const mimeCodec = 'video/webm; codecs="vp8"';
    console.log('Adding source buffer with codec:', mimeCodec);
    sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);

    sourceBuffer.addEventListener('updateend', () => {
        console.log('Source buffer update ended');
        if (!sourceBuffer.updating && mediaSource.readyState === 'open') {
            console.log('Calling endOfStream on mediaSource');
            mediaSource.endOfStream();
        }
    });

    sourceBuffer.appendBuffer(new Uint8Array(arrayBuffer));
    console.log('Data appended to source buffer');
}

postMessage({ type: 'sourceOpen', sourceHandle: handle }, [handle]);
