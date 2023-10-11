'use strict';
import {MESSAGE as m, MessageHandler} from "../../modules/messageHandler.mjs";
import {DeviceManager} from "../../deviceManager/scripts/deviceManager.mjs";
// import {alterTrack} from "../../badConnection/scripts/alterTrack.mjs";

// Todo: make this an anonymous function for prod

const LOCAL_AUDIO_SAMPLES_PER_SECOND = 5;

// ToDo: find a better way to do these - like feature flags
const appEnabled = true;
let monitorAudioSwitch = false;
let processTrackSwitch = true;

const debug = Function.prototype.bind.call(console.debug, console, `vch 💉`);

const mh = new MessageHandler('inject', debug);
const sendMessage = mh.sendMessage;

// get settings from storage
async function getSettings() {
    return new Promise((resolve, reject) => {

       debug("get initial settings timer started");
        const timeout = setTimeout(() => {
            debug("get initial settings timeout");
            reject("get initial settings timeout")
        }, 1000);

        mh.addListener(m.ALL_SETTINGS, (data) => {
            debug("initial settings from content", data);
            clearTimeout(timeout);
            resolve(data);
        });

        mh.sendMessage('content', m.GET_ALL_SETTINGS);

    });

}

// Call the function
const settings = await getSettings().catch(err => debug("error getting initial settings", err));
debug("initial settings", settings);

// ToDo: use the settings to initialize any other inject context modules

// ForDeviceManager
const deviceManager = new DeviceManager(settings['deviceManager'] ?? null);


// Put the stream in a temp DOM element for transfer to content.js context
// content.js will swap with a replacement stream
async function transferStream(stream, message = m.GUM_STREAM_START, data = {}) {
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
        sendMessage('all', message, {id: video.id, ...data});
    }
}

// Note - there was a more complicated TransferStream that handled transfer failures;
//  I guess I removed this because that wasn't necessary anymore

// ToDo: merge this into monitorTrack in content.js?
// extract and send track event data
async function processTrack(track, sourceLabel = "") {

    // ToDo: contentSelfView handler
    const settings = await track.getSettings();
    if (track.kind === 'video')
        debug('video track settings', settings);

    if (!processTrackSwitch)
        return;

    // ToDo: do I really need to enumerate the object here?
    const {id, kind, label, readyState, deviceId} = track;
    const trackData = {id, kind, label, readyState, deviceId};
    sendMessage('all', `${sourceLabel}_track_added`, {trackData});

    async function trackEventHandler(event) {
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
function monitorAudio(peerConnection) {
    //[...await pc1.getStats()].filter(report=>/RTCAudioSource_1/.test(report))[0][1].audioLevel
    const audioLevels = new Array(LOCAL_AUDIO_SAMPLES_PER_SECOND);
    let counter = 0;

    const interval = setInterval(async () => {
        counter++;
        // get audio energies from getStats
        const reports = await peerConnection.getStats();
        const {audioLevel, totalAudioEnergy} = [...reports].filter(report => /RTCAudioSource/.test(report))[0][1];
        audioLevels.push(audioLevel);
        if (counter >= LOCAL_AUDIO_SAMPLES_PER_SECOND) {
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
        if (peerConnection.connectionState !== 'connected')
            clearInterval(interval);
    });
}

if (window.videoCallHelper) {
    debug("shims already loaded");
}
// Load shims
else {

// ToDo: Google Meet doesn't use this
// ToDo: make a switch for this - not sure I need to shim this now
    /*
    // getDisplayMedia Shim
    const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async (constraints) => {
        const gdmStream = await origGetDisplayMedia(constraints);
        // ToDo: check for audio too?
        const [track] = gdmStream.getVideoTracks();
        debug(`getDisplayMedia tracks: `, gdmStream.getTracks());
        await processTrack(track, "gdm");
        return gdmStream
    }
     */

// getUserMedia Shim

    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    // shim getUserMedia; return alterStream track if vch-audio or vch-video is in the constraints
    async function shimGetUserMedia(constraints) {
        // ToDo: need to handle the case when a subsequent gUM call asks for vch-(audio|video) when
        //  it was already created - do I force the stop of the old one and start a new worker? Reuse?
        //  Does track.stop() even stop the worker?

        if(deviceManager.useFakeDevices(constraints)) {
            const fakeStream = await deviceManager.fakeDeviceStream(constraints, origGetUserMedia);
            await transferStream(deviceManager.unalteredStream);
            // await transferStream(fakeStream);
            return fakeStream;
        }
        else {
            debug("gUM with no fakeDevices using constraints:", constraints);
            const stream = await origGetUserMedia(constraints);
            await transferStream(stream);
            return stream;
        }

    }

    navigator.mediaDevices.getUserMedia = async (constraints) => {
        debug("navigator.mediaDevices.getUserMedia called");

        if (!appEnabled) {
            return origGetUserMedia(constraints)
        }

        return await shimGetUserMedia(constraints);

    }

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


// This doesn't seem to be used by Google Meet
    const origMediaStreamAddTrack = MediaStream.prototype.addTrack;
    MediaStream.prototype.addTrack = function (track) {
        debug(`addTrack shimmed on MediaStream`, this, track);
        debug("MediaStream track settings", track.getSettings());
        return origMediaStreamAddTrack.apply(this, arguments);
    }


// peerConnection shims

    window.pcTracks = [];
    window.pcStreams = [];      // streams always empty
    window.pcs = [];

    const origAddTrack = RTCPeerConnection.prototype.addTrack;
    RTCPeerConnection.prototype.addTrack = function (track, stream) {
        let streams = [...arguments].slice(1);
        debug(`addTrack shimmed on peerConnection`, this, track, ...streams);
        debug("peerConnection local track settings", track.getSettings());
        // window.pcTracks.push(track);
        processTrack(track, "local").catch(err => debug("processTrack error", err));

        // ToDo: handle if the switch is changed
        // ToDo: no check to see if this is an audio track?
        if (monitorAudioSwitch)
            monitorAudio(this);

        return origAddTrack.apply(this, arguments)
    };

    const origPeerConnAddStream = RTCPeerConnection.prototype.addStream;
    RTCPeerConnection.prototype.addStream = function (stream) {
        debug(`addStream shimmed on peerConnection`, this, stream);
        const tracks = stream.getTracks();
        tracks.forEach(track => processTrack(track, "local"));

        /*
        // I shouldn't need to do this anymore if using vch-device approach
        const alteredTracks = tracks.map(track => {
            alterTrack(track);
            window.pcTracks.push(track);
        });

        const alteredStream = new MediaStream(alteredTracks);
        transferStream(alteredStream, m.PEER_CONNECTION_LOCAL_ADD_TRACK)
            .catch(err => debug("transferStream error", err));
        debug("changing addStream stream (source, change)", stream, alteredStream);
        return origPeerConnAddStream.apply(this, [alteredStream, ...arguments])
         */

        return origPeerConnAddStream.apply(this, arguments)
    };

//  It looks like Google Meet has its own addStream shim that does a track replacement instead of addTrack
//  try to shim RTCRtpSender.replaceTrack() - from MDN: https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender
//    "Attempts to replace the track currently being sent by the RTCRtpSender with another track, without
//    performing renegotiation. This method can be used, for example, to toggle between the front- and
//    rear-facing cameras on a device.

    const origSenderReplaceTrack = RTCRtpSender.prototype.replaceTrack;
    RTCRtpSender.prototype.replaceTrack = function (track) {
        debug(`replaceTrack shimmed on RTCRtpSender`, this, track);
        debug("RTC sender track settings", track.getSettings());

        window.pcTracks.push(track);

        /*
        if (track.sourceTrack) {
            debug("track already altered");
        } else {
            const alteredTrack = alterTrack(track);
            arguments[0] = alteredTrack;
            transferStream(new MediaStream([alteredTrack]), m.PEER_CONNECTION_LOCAL_REPLACE_TRACK)
                .catch(err => debug("transferStream error", err));

        }
         */

        return origSenderReplaceTrack.apply(this, arguments);

    }


    const origAddTransceiver = RTCPeerConnection.prototype.addTransceiver;
    RTCPeerConnection.prototype.addTransceiver = function () {
        const init = arguments[1] || undefined;
        debug(`addTransceiver shimmed on peerConnection`, this, arguments);
        window.pcs.push(this);
        if (typeof (arguments[0]) !== 'string') {  // could be MediaStreamTrack, Canvas, Generator, etc
            const track = arguments[0];
            window.pcTracks.push(track);

            /*
            const alteredTrack = alterTrack(track);
            debug("changing transceiver track (source, change)", track, alteredTrack);
            arguments[0] = alteredTrack;
             */

            return origAddTransceiver.apply(this, arguments)
        }
        /*
        else if((init?.direction === 'sendrecv' || init?.direction === 'sendonly') && init?.streams){
            init.streams.forEach( (stream, idx) => {
                debug("addTransceiver stream", stream);
                debug("addTransceiver stream tracks", stream.getTracks());
                window.pcStreams.push(stream);

                // This doesn't do anything
                stream.addEventListener('addtrack', (event) => {
                    debug("addTransceiver stream addtrack event", event);
                    const track = event.track;
                    window.pcTracks.push(track);
                });
            });

            const newArguments = [arguments[0], init];
            // return origAddTransceiver.apply(this, newArguments)
            debug("addTransceiver changed [debug]", newArguments);
            return origAddTransceiver.apply(this, arguments)

        }

         */
        else {
            debug("addTransceiver no change");
            return origAddTransceiver.apply(this, arguments)
        }
    }

    const origPeerConnSRD = RTCPeerConnection.prototype.setRemoteDescription;
    RTCPeerConnection.prototype.setRemoteDescription = function () {

        // ToDo: do this as part of onconnectionstatechange
        sendMessage('all', m.PEER_CONNECTION_OPEN, {});

        // Remove audio level monitoring
        /*
        // ToDo: average this locally before sending?
        let interval = setInterval(() =>
            this.getReceivers().forEach(receiver => {
                const {track: {id, kind, label}, transport} = receiver;
                // const {id, kind, label} = track;
                if (transport?.state !== 'connected') {
                    // debug("not connected", transport.state);
                    clearInterval(interval);
                    return
                }

                if (kind === 'audio' && monitorAudioSwitch) {
                    const sources = receiver.getSynchronizationSources();
                    sources.forEach(syncSource => {
                        const {audioLevel, source} = syncSource;
                        sendMessage('all', m.REMOTE_AUDIO_LEVEL, {audioLevel, source, id, kind, label});
                        // debug(`${source} audioLevel: ${audioLevel}`)
                    })
                }
            }), 1000);

         */

        this.addEventListener('track', (e) => {
            const track = e.track;
            processTrack(track, "remote").catch(err => debug("processTrack error", err));
            debug(`setRemoteDescription track event on peerConnection`, this, track)
        });
        return origPeerConnSRD.apply(this, arguments)
    };


    const origPeerConnClose = RTCPeerConnection.prototype.close;
    RTCPeerConnection.prototype.close = function () {
        debug("closing PeerConnection ", this);
        sendMessage('all', m.PEER_CONNECTION_CLOSED, this);
        return origPeerConnClose.apply(this, arguments)
    };

// Enumerate Devices Shim

    const origEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async function () {
        debug("navigator.mediaDevices.enumerateDevices called");

        if (!appEnabled || !deviceManager.enabled)
            return origEnumerateDevices();

        const devices = await origEnumerateDevices();
        mh.sendMessage('content', m.UPDATE_DEVICE_SETTINGS, {currentDevices: devices});

        // Only add fake devices if there are other devices
        // In the future when adding generated sources w/o gUM, it may make sense to have a device even with no permissions
        if (devices !== undefined && Array.isArray(devices))
            return deviceManager.modifyDevices(devices);
    }

// devicechange shim
    const originalAddEventListener = navigator.mediaDevices.addEventListener.bind(navigator.mediaDevices);

    navigator.mediaDevices.addEventListener = function (type, listener) {
        debug(`navigator.mediaDevices.addEventListener called with "${type}" and listener:`, listener);

        if (type === 'devicechange') {
            // debug('navigator.mediaDevices.addEventListener called with "devicechange"');
            deviceManager.deviceChangeListeners.push(listener);
        }

        return originalAddEventListener(type, listener);
    };

    const originalRemoveEventListener = navigator.mediaDevices.removeEventListener.bind(navigator.mediaDevices);
    navigator.mediaDevices.removeEventListener = function (type, listener) {
        if (type === 'devicechange') {
            debug('navigator.mediaDevices.removeEventListener called with "devicechange"');
            const index = deviceManager.deviceChangeListeners.indexOf(listener);
            if (index > -1) {
                deviceManager.deviceChangeListeners.splice(index, 1); // Remove this listener
            }
            return;
        }
        return originalRemoveEventListener(type, listener);
    };

    window.videoCallHelper = true;
}

/*
 * debugging
 */
debug("injected");
