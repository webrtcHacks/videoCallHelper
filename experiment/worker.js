// Inside dedicated worker
let mediaSource = new MediaSource();
let handle = mediaSource.handle;
// Transfer the handle to the context that created the worker
postMessage({ arg: handle }, [handle]);

mediaSource.addEventListener("sourceopen", async () => {
    const assetURL =  "bbb360p30_frag.mp4"; // "frag_bunny.mp4"; // "bbb.mp4";
    const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    // const assetURL = "BigBuckBunny_360p30.mp4";
    // const mimeCodec = 'video/mp4; codecs="avc1.64001f, mp4a.40.2"';
    const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
    const response = await fetch(assetURL);
    const buf = await response.arrayBuffer();
    sourceBuffer.addEventListener('updateend',  ()=> mediaSource.endOfStream());
    sourceBuffer.appendBuffer(buf);
});
