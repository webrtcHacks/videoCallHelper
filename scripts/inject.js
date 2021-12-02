function debug(...messages) {
    console.debug(`vch 💉 `, ...messages);
}

function sendToContentJs(messageObj) {
    const toContentEvent = new CustomEvent('vch', {detail: messageObj});
    document.dispatchEvent(toContentEvent);
}

function sendImages(stream){



}

if (!window.videoCallHelper) {
    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    async function shimGetDisplayMedia(constraints) {

        const gdmStream = await origGetDisplayMedia(constraints);
        let [track] = gdmStream.getVideoTracks();
        let capturedHandle = track && track.getCaptureHandle() && track.getCaptureHandle().handle;

        if (capturedHandle) {
            debug(`captured handle is: ${capturedHandle}`);

            track.onended = () => {
                debug(`captured handle ${capturedHandle} ended`);
                sendToContentJs({lostDisplayMediaHandle: capturedHandle});
            };

            sendToContentJs({gotDisplayMediaHandle: capturedHandle});
        } else {
            // send a notice a tab wasn't shared
        }
        return gdmStream
    }

    navigator.mediaDevices.getDisplayMedia = shimGetDisplayMedia;

    const origGetGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    async function shimGetUserMedia(constraints) {

        let gumStream = await origGetGetUserMedia(constraints);
        debug("got stream", gumStream);
        // grabImage(gumStream);
        sendToContentJs({state:"gumStream"});
        return gumStream
    }

    navigator.mediaDevices.getUserMedia = shimGetUserMedia;

    window.videoCallHelper = true;

}
else{
    debug("shims already loaded")
}

/*
 * debugging
 */


debug("injected");