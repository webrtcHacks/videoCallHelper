'use strict';

// ToDo: build process to import message module

let gumStream;
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
        data: JSON.parse(JSON.stringify(data))      // can't pass objects:
    };

    const toContentEvent = new CustomEvent('vch', {detail: messageToSend});
    // debug("CustomEvent: ", toContentEvent);
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

// Put the stream in a temp DOM element for transfer to content.js context
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

function processTrack(track, sourceLabel = ""){

    const {id, kind, label, readyState} = track;
    const trackData = {id, kind, label, readyState};
    sendMessage('all', `${sourceLabel}_track_added`, {trackData});


    function trackEventHandler(event){
        debug("track event", event);
        const {id, kind, label, readyState} = event.target;
        const trackData = {id, kind, label, readyState, type: 'track'};
        debug(`${sourceLabel}_${event.type}`);
        sendMessage('all', `${sourceLabel}_track_ended`, trackData);
    }

    track.addEventListener('ended', trackEventHandler);
    track.addEventListener('mute', trackEventHandler);
    track.addEventListener('unmute', trackEventHandler);

    /*
    // Handle events
    track.addEventListener("ended", e => {
        debug(`${sourceLabel}_track_ended`);
        sendMessage('all', `${sourceLabel}_track_ended`, e?.track);
    });
    track.addEventListener("mute", e => {
        debug(`${sourceLabel}_track_mute`);
        sendMessage('all', `${sourceLabel}_track_mute`, e?.track);
    });
    track.addEventListener("unmute", e => {
        debug(`${sourceLabel}_track_unmute`);
        sendMessage('all', `${sourceLabel}_track_unmute`, e?.track);
    });
     */


}

if (!window.videoCallHelper) {

    // getDisplayMedia Shim
    // ToDo: Google Meet doesn't use this

    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async (constraints) => {
        const gdmStream = await origGetDisplayMedia(constraints);
        const [track] = gdmStream.getVideoTracks();
        debug(`getDisplayMedia tracks: `, gdmStream.getTracks());
        processTrack(track, "gdm");
        return gdmStream
    }

    // getUserMedia Shim

    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    async function shimGetUserMedia(constraints) {
        const stream = await origGetUserMedia(constraints);
        transferStream(stream);
        const tracks = stream.getTracks();
        // ToDo:
        tracks.forEach(track=>processTrack(track, "gum"))
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

    // peerConnection shims

    const origAddTrack = RTCPeerConnection.prototype.addTrack;
    RTCPeerConnection.prototype.addTrack = function (track, stream) {
        debug('addTrack shimmed', track, stream);
        processTrack(track, "local");
        return origAddTrack.apply(this, arguments)
    };

    const origPeerConnAddStream = RTCPeerConnection.prototype.addStream;
    RTCPeerConnection.prototype.addStream = function (stream) {
        debug('addStream shimmed', stream);
        const tracks = stream.getTracks();
        tracks.forEach(track=>processTrack(track,"local"));
        // ToDo: track events
        return origPeerConnAddStream.apply(this, arguments)
    };

    const origPeerConnSRD = RTCPeerConnection.prototype.setRemoteDescription;
    RTCPeerConnection.prototype.setRemoteDescription = function () {
        this.addEventListener('track', (e) => {
            const track = e.track;
            processTrack(track, "remote")
            // ToDo: track events
            debug('setRemoteDescription track event', track)
        });
        return origPeerConnSRD.apply(this, arguments)
    };

    const origPeerConnClose = RTCPeerConnection.prototype.close;
    RTCPeerConnection.prototype.close = function() {
        debug("closing PeerConnection ", this);
        sendMessage('all', "peerconnection_closed", this);
        return origPeerConnClose.apply(this, arguments)
    };

    window.videoCallHelper = true;

} else {
    debug("shims already loaded")
}

/*
 * debugging
 */

debug("injected");
