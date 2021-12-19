'use strict';

// ToDo: build process to import message module

let gumStream;
// let sendImagesInterval = Infinity;
// let faceMeshLoaded = false;
//window.vchStreams = [];
const appEnabled = true;

function debug(...messages) {
    console.debug(`vch 💉 `, ...messages);
}

function sendMessage(to = 'all', message, data = {}) {
    debug(`dispatching "${message}" from inject to ${to} with data:`, data)

    if (!message) {
        debug("ERROR: no message in sendMessage request");
    }
    const messageToSend = {
        from: 'tab',
        to: to,
        message: message,
        data: data
    };

    const toContentEvent = new CustomEvent('vch', {detail: messageToSend});
    document.dispatchEvent(toContentEvent);
}

document.addEventListener('vch', async e => {
    const {from, to, message, data} = e.detail;

    // Edge catching its own events
    if (from === 'tab' || to !== 'tab') {
        return
    }

    if(to === 'tab' && message === 'stream_transfer_complete'){
        const video = document.querySelector(`video#${data.id}`);
        document.body.removeChild(video);
    }

});

function transferStream(stream){
    // debug("Video track info: ", stream.getVideoTracks()[0].getSettings());
    // window.vchStreams.push(stream); // for testing

    // only handle video for now
    if(stream.getVideoTracks().length === 0)
        return;

    // ToDo: shadow dom?
    const video = document.createElement('video');
    // video.id = stream.id;
    video.id = `vch-${Math.random().toString().substring(10)}`;
    video.srcObject = stream;
    video.hidden = true;
    document.body.appendChild(video);
    video.oncanplay = () => sendMessage('all', "gum_stream_start", {id: video.id});

}

if (!window.videoCallHelper) {

    // ToDo: handle screen share later
    /*
    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

    async function shimGetDisplayMedia(constraints) {

        const gdmStream = await origGetDisplayMedia(constraints);
        let [track] = gdmStream.getVideoTracks();
        let capturedHandle = track && track.getCaptureHandle() && track.getCaptureHandle().handle;

        if (capturedHandle) {
            debug(`captured handle is: ${capturedHandle}`);

            track.onended = () => {
                debug(`captured handle ${capturedHandle} ended`);
                sendMessage('background', {lostDisplayMediaHandle: capturedHandle});
            };

            sendMessage('background', {gotDisplayMediaHandle: capturedHandle});
        } else {
            // send a notice a tab wasn't shared
        }
        return gdmStream
    }

    navigator.mediaDevices.getDisplayMedia = shimGetDisplayMedia;

     */

    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    async function shimGetUserMedia(constraints) {

        // ToDo: don't copy the track if we end it changing it
        /*
        if(gumStream?.active)
            gumStream.getVideoTracks()[0].stop();
        const origStream = await origGetUserMedia(constraints);
        const trackCopy = origStream.getVideoTracks()[0].clone();
        gumStream = new MediaStream([trackCopy]);
        debug("got stream. Video track info: ", gumStream.getVideoTracks()[0].getSettings());
        sendMessage('all', "gum_stream_start");
        window.vchStreams.push(origStream); // for testing
        return origStream
                 */
        const stream = await origGetUserMedia(constraints);
        transferStream(stream);
        debug("got stream", stream);
        return stream
    }

    navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (!appEnabled) {
            return origGetUserMedia(constraints)
        }
        debug("navigator.mediaDevices.getUserMedia called");
        return await shimGetUserMedia(constraints);
    };

    let _webkitGetUserMedia = async function (constraints, onSuccess, onError) {
        if (!appEnabled) {
            return _webkitGetUserMedia(constraints, onSuccess, onError)
        }

        debug("navigator.webkitUserMedia called");
        try {
            debug("navigator.webkitUserMedia called");
            const stream = await shimGetUserMedia(constraints);
            return onSuccess(stream)
        } catch (err) {
            debug("_webkitGetUserMedia error!:", err);
            return onError(err);
        }
    };

    navigator.webkitUserMedia = _webkitGetUserMedia;
    navigator.getUserMedia = _webkitGetUserMedia;
    navigator.mediaDevices.getUserMedia = shimGetUserMedia;

    window.videoCallHelper = true;

} else {
    debug("shims already loaded")
}

/*
 * debugging
 */

debug("injected");
