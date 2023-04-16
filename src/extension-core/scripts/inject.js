'use strict';
import {MessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";

// Todo: make this an anonymous function for prod

const LOCAL_AUDIO_SAMPLES_PER_SECOND = 5;

// ToDo: find a better way to do these
const appEnabled = true;
let monitorAudioSwitch = false;
let processTrackSwitch = true;
let enableWriter = true;

const debug = function() {
    return Function.prototype.bind.call(console.debug, console, `vch 💉  `);
}();

/*
const {send, listen} = new MessageHandler('inject', debug);
const sendMessage = send;
const addListener = listen;
 */

const mh = new MessageHandler('inject', debug);
const sendMessage = mh.sendMessage;
const addListener = mh.addListener;
const removeListener = mh.removeListener;


// Put the stream in a temp DOM element for transfer to content.js context
// content.js will swap with a replacement stream
async function transferStream(stream){
    // debug("Video track info: ", stream.getVideoTracks()[0].getSettings());
    // window.vchStreams.push(stream); // for testing

    // only handle streams with video for now
    if(stream.getVideoTracks().length === 0)
        return;

    return new Promise((resolve, reject) => {
        const timeOut = 1500;                               // max time to wait for vch to return a new stream
        const startTime = new Date().getTime();             // measure time to return new stream

        // ToDo: shadow dom?
        const video = document.createElement('video');
        // video.id = stream.id;
        video.id = `vch-${Math.random().toString().substring(10)}`;
        video.srcObject = stream;
        video.hidden = true;
        video.muted = true;
        document.body.appendChild(video);
        video.oncanplay = () => {
            video.oncanplay = null;
            sendMessage('all', m.GUM_STREAM_START, {id: video.id});
        }

        // Cancel if nothing happens before the timeout
        const timer = setTimeout(() => {
            debug(`transfer stream failed to return a new stream within ${timeOut} ms`)
            reject(new Error(`transfer stream failed to return a new stream within ${timeOut} ms`) );
        }, timeOut);   // 1 second timeout

        function streamTransferComplete(data) {
            clearTimeout(timer);
            removeListener(m.STREAM_TRANSFER_COMPLETE, streamTransferComplete);

            try{
                const video = document.querySelector(`video#${data.id}`);
                const modifiedStream = video.srcObject;         // ToDo: srcObject coming back as null on Jitsi on change cam preview

                // video.srcObject = null;
                document.body.removeChild(video);           // Clean-up the DOM
                debug(`removed video element ${data.id}; new modified stream ${modifiedStream.id} returned within ${new Date().getTime() - startTime} ms`);
                resolve(modifiedStream);

            }
            catch (e){
                debug(`Error in streamTransferComplete: `, e);
                reject(e);
            }
        }

        addListener(m.STREAM_TRANSFER_COMPLETE, streamTransferComplete);

    });

}

// extract and send track event data
// ToDo: merge this into monitorTrack in content.js?

async function processTrack(track, sourceLabel = ""){

    // ToDo: contentSelfView handler
    const settings = await track.getSettings();
    if(track.kind==='video')
        debug('video track settings', settings);

    if(!processTrackSwitch)
        return;

    // ToDo: do I really need to enumerate the object here?
    const {id, kind, label, readyState, deviceId} = track;
    const trackData = {id, kind, label, readyState, deviceId};
    sendMessage('all', `${sourceLabel}_track_added`, {trackData});

    async function trackEventHandler(event){
        const type = event.type;
        const {id, kind, label, readyState, enabled, contentHint, muted, deviceId} = event.target;
        const trackData = {id, kind, label, readyState, enabled, contentHint, muted, deviceId};
        debug(`${sourceLabel}_${type}`, trackData);
        sendMessage('all', `${sourceLabel}_track_${type}`, {trackData});
    }

    track.addEventListener('ended', trackEventHandler);

    // these were firing too often
    // track.addEventListener('mute', trackEventHandler);
    // track.addEventListener('unmute', trackEventHandler);

}

// monitor local audio track audio levels
// ToDo: need to stop / pause this
// ToDo: should this be in content.js?
function monitorAudio(peerConnection){
    //[...await pc1.getStats()].filter(report=>/RTCAudioSource_1/.test(report))[0][1].audioLevel
    const audioLevels = new Array(LOCAL_AUDIO_SAMPLES_PER_SECOND);
    let counter = 0;

    const interval = setInterval(async ()=>{
        counter++;
        // get audio energies from getStats
        const reports = await peerConnection.getStats();
        const {audioLevel, totalAudioEnergy} = [...reports].filter(report=>/RTCAudioSource/.test(report))[0][1];
        audioLevels.push(audioLevel);
        if(counter>=LOCAL_AUDIO_SAMPLES_PER_SECOND){
            const avg = audioLevels.reduce((p, c) => p + c, 0) / audioLevels.length;
            // debug("audioLevel", avg);
            // ToDo: stop this when it is null or the PC is closed
            sendMessage('all', m.LOCAL_AUDIO_LEVEL, {audioLevel: avg, totalAudioEnergy});
            audioLevels.length = 0;
            counter = 0
        }
    }, 1000 / LOCAL_AUDIO_SAMPLES_PER_SECOND)

    // ToDo: use eventListener to prevent onconnectionstatechange from being overwritten by the app
    // peerConnection.onconnectionstatechange = () => {
    peerConnection.addEventListener('connectionstatechange', () => {
        if(peerConnection.connectionState !== 'connected')
            clearInterval(interval);
    });
}

if (!window.videoCallHelper) {

    // getDisplayMedia Shim
    // ToDo: Google Meet doesn't use this

    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async (constraints) => {
        const gdmStream = await origGetDisplayMedia(constraints);
        // ToDo: check for audio too?
        const [track] = gdmStream.getVideoTracks();
        debug(`getDisplayMedia tracks: `, gdmStream.getTracks());
        await processTrack(track, "gdm");
        return gdmStream
    }

    // getUserMedia Shim

    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    async function shimGetUserMedia(constraints) {
        const stream = await origGetUserMedia(constraints);
        try{
            // Handles track events of the original stream
            const tracks = stream.getTracks();

            // ToDo: move this into content.js
            // tracks.forEach(track=>processTrack(track, "gum"))
            debug("got stream", stream);

            const newStream = await transferStream(stream);         // transfer the stream to the content script
            return newStream                                        // return the altered stream
        }
        catch (err) {
            debug("getUserMedia error!:", err);
            return stream
        }

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
        debug(`addTrack shimmed on peerConnection`, this, track, stream);
        processTrack(track, "local").catch(err=>debug("processTrack error", err));

        // ToDo: handle if the switch is changed
        // ToDo: no check to see if this is an audio track?
        if(monitorAudioSwitch)
            monitorAudio(this);

        return origAddTrack.apply(this, arguments)
    };

    const origPeerConnAddStream = RTCPeerConnection.prototype.addStream;
    RTCPeerConnection.prototype.addStream = function (stream) {
        debug(`addStream shimmed on peerConnection`, this, stream);
        const tracks = stream.getTracks();
        tracks.forEach(track=>processTrack(track,"local"));
        return origPeerConnAddStream.apply(this, arguments)
    };

    const origPeerConnSRD = RTCPeerConnection.prototype.setRemoteDescription;
    RTCPeerConnection.prototype.setRemoteDescription = function () {

        // ToDo: do this as part of onconnectionstatechange
        sendMessage('all', m.PEER_CONNECTION_OPEN, {});

        // ToDo: average this locally before sending?
        let interval = setInterval(()=>
            this.getReceivers().forEach(receiver=>{
                const {track:  {id, kind, label}, transport} = receiver;
                // const {id, kind, label} = track;
                // ToDo: Uncaught TypeError: Cannot read properties of null (reading 'state') - added a `?` to fix, did it work?
                if(transport?.state !=='connected'){
                    // debug("not connected", transport.state);
                    clearInterval(interval);
                    return
                }

                if(kind==='audio' && monitorAudioSwitch){
                    const sources = receiver.getSynchronizationSources();
                    sources.forEach(syncSource=>{
                       const {audioLevel, source} = syncSource;
                        sendMessage('all', m.REMOTE_AUDIO_LEVEL, {audioLevel, source, id, kind, label});
                        // debug(`${source} audioLevel: ${audioLevel}`)
                    })
                }
            }), 1000);

        this.addEventListener('track', (e) => {
            const track = e.track;
            processTrack(track, "remote").catch(err=>debug("processTrack error", err));
            debug(`setRemoteDescription track event on peerConnection`, this, track)
        });
        return origPeerConnSRD.apply(this, arguments)
    };


    const origPeerConnClose = RTCPeerConnection.prototype.close;
    RTCPeerConnection.prototype.close = function() {
        debug("closing PeerConnection ", this);
        sendMessage('all', m.PEER_CONNECTION_CLOSED, this);
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
