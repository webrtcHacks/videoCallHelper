// vp-worker.js


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

postMessage({type: 'sourceOpen', sourceHandle: handle}, [handle]);
