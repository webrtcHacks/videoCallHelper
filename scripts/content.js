const streams = [];
let trackInfos = [];
// const trackIds = new Set();

window.vchStreams = streams;
const DEFAULT_SEND_IMAGES_INTERVAL = 30 * 1000;
let sendImagesInterval = Infinity;
let faceMeshLoaded = false;
let videoTabId;

function debug(...messages) {
    console.debug(`vch 🕵️‍ `, ...messages);
}

debug(`content.js loaded on ${window.location.href}`);

// inject inject script
function addScript(path) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(path);
    script.onload = () => this.remove;
    (document.head || document.documentElement).appendChild(script);
}

addScript('/scripts/inject.js');
debug("inject injected");


/* Methods for sending streams */
async function dataChannel(stream) {
    console.log("peerConnection starting");

    const port = chrome.runtime.connect({name: 'peerConnection'});
    port.postMessage({message: "start sending frames here"});

    function signalPeer(message, data) {
        port.postMessage({message: message, data: data});
    }

    // const [track] = stream.getVideoTracks();
    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel(`stream-${stream.id}`, {orderd: true});
    // chrome doesn't support 'blob' - looks like they are finally working on it now: https://bugs.chromium.org/p/webrtc/issues/detail?id=2276
    // dc.binaryType = "blob";

    pc.onicecandidate = e => {
        debug(e.candidate);
        signalPeer('candidate', e.candidate);
    }

    port.onMessage.addListener(async msg => {
        debug("incoming message from port: ", msg);
        if (msg.message === "stop") {
            debug("stop")
        }
        if (msg.message === 'answer') {
            await pc.setRemoteDescription(msg.data);
        }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    debug(offer);
    signalPeer('offer', offer);

    dc.onmessage = async (event) => {
        console.log("received: " + event.data);
        if (event.data.message === 'answer')
            await pc.setRemoteDescription(event.data);
    };

    dc.onopen = async () => {
        console.log("datachannel open");


        const MAXIMUM_MESSAGE_SIZE = 16 * 1024// 65535;
        const END_OF_FILE_MESSAGE = 'EOF';

        const highWaterMark = 16777216;

        const [track] = stream.getVideoTracks();
        const {width, height} = track.getSettings()
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('bitmaprenderer');

        let frameCount = 0;

        async function sendFrame(frame) {
            // ToDo: not sure if you can send a videoFrame
            // ToDo: if not frame.done??
            // no way to convert the frame to something you can convert directly
            // debug(frame.toBlob());

            frameCount++;
            if (frameCount !== 30) {
                frame.close();
                return
            }

            // ctx.drawImage(frame, 0, 0, width, height);
            const bitmap = await createImageBitmap(frame);
            ctx.transferFromImageBitmap(bitmap);
            // debug(bitmap);

            // offscreen doesn't support dataUrl
            // const dataUrl = canvas.toDataURL()

            const blob = await canvas.convertToBlob();
            const buf = await blob.arrayBuffer();
            debug(buf);

            // https://levelup.gitconnected.com/send-files-over-a-data-channel-video-call-with-webrtc-step-6-d38f1ca5a351
            for (let i = 0; i < buf.byteLength; i += MAXIMUM_MESSAGE_SIZE) {
                dc.send(buf.slice(i, i + MAXIMUM_MESSAGE_SIZE));
            }
            dc.send(END_OF_FILE_MESSAGE);

            /*
            let bufferedAmount = dc.bufferedAmount;
            debug(bufferedAmount);
            if(bufferedAmount >= highWaterMark){
                // problem is this sends a JSON.stringify instead of data
                dc.send(buf);
            }
            else
                debug("dropped frame");

            */

            frameCount = 0;
            frame.close();

        }

        // learning: this is better than TransformStream
        const processor = new MediaStreamTrackProcessor(track);
        const reader = processor.readable.getReader();
        while (true) {
            const result = await reader.read();
            if (result.done) {
                debug("reader done");
                break;
            }
            let frame = result.value;
            // debug(frame);
            await sendFrame(frame)
                .catch(err => debug("ERROR: send frame error: ", err));
        }

        // learning: reader above is better than TransformStream
        /*
        await processor.readable
            .pipeThrough(new TransformStream({transform: frame => sendFrame(frame)}))
            .pipeTo(generator.writable);
         */


    };

    dc.onclose = () => {
        console.log("datachannel close");
    };

}

// this doesn't work
async function sendStreamAsFrameString(tab, stream) {
    const port = chrome.runtime.connect({name: "frames"});
    port.postMessage({message: "start sending frames here"});
    port.onMessage.addListener(msg => {
        if (msg.message === "stop") {
            debug("stop")
        }
    });

    const [track] = stream.getVideoTracks();
    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    const processor = new MediaStreamTrackProcessor({track});

    async function sendFrame(frame) {
        // finding: frame doesn't get converted
        const {format, codedWidth, codedHeight, displayWidth, displayHeight, duration, timestamp} = frame;
        port.postMessage({frameString: JSON.stringify(frame)})
        frame.close()
    }

    await processor.readable
        .pipeThrough(new TransformStream({transform: frame => sendFrame(frame)}))
        .pipeTo(generator.writable);
}


// send individual frames as blob URLs
async function sendStreamAsBlobUrls(tab, stream) {
    // create a connection
    const port = chrome.runtime.connect({name: "frames"});
    port.postMessage({message: "start sending frames here"});
    port.onMessage.addListener(msg => {
        if (msg.message === "stop") {
            debug("stop")
        }
    });

    // send frames
    const [track] = stream.getVideoTracks();
    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    const processor = new MediaStreamTrackProcessor({track});

    const {width, height} = track.getSettings();

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("bitmaprenderer")

    async function sendFrame(frame) {

        // Method doesn't exist :(
        //const blob = await frame.convertToBlob({type: "image/jpeg"});

        // bulkier method
        const bitmap = await createImageBitmap(frame, 0, 0, width, height);
        ctx.transferFromImageBitmap(bitmap);
        const blob = await canvas.convertToBlob({type: "image/jpeg"});
        const blobUrl = window.URL.createObjectURL(blob);

        port.postMessage({blobUrl})
        frame.close()
    }

    await processor.readable
        .pipeThrough(new TransformStream({transform: frame => sendFrame(frame)}))
        .pipeTo(generator.writable);

}

async function syncTrackInfo() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    debug("getting current video devices:", videoDevices);

    // just use the last stream for now
    const stream = streams.at(-1);
    // ToDo: stream event handlers
    stream.onremovetrack = async (track) => {
        debug("track removed", track);
        await sendMessage('video', 'tab', 'remove_track', track.id);
        trackInfos = trackInfos.filter(info => info.id !== track.id);
        debug("updated trackInfos", trackInfos);
    };

    const [videoTrack] = stream.getVideoTracks();
    videoTrack.onended = (e) => {
        debug("track stopped: ", e.srcElement);
        const {id} = e.srcElement;
        trackInfos = trackInfos.filter(info => info.id !== id);
        debug("updated trackInfos", trackInfos);
    };
    videoTrack.onmute = async e => {
        await sendMessage('video', 'tab', 'mute', e.srcElement.id)
        debug("track muted: ", e.srcElement)
    };
    videoTrack.onunmute = async e => {
        await sendMessage('video', 'tab', 'unmute', e.srcElement.id)
        debug("track unmuted: ", e.srcElement)
    };


    // ToDo: find out if a gUM stream can ever have more than 1 video track
    const settings = videoTrack.getSettings();
    debug("settings: ", settings);

    const {label} = videoDevices.find(device => settings.deviceId === device.deviceId);
    debug("device label: ", label);
    if (label !== "")
        settings.label = label;

    // ToDo: make sure to only push unique tracks
    settings.id = videoTrack.id;
    trackInfos = trackInfos.filter(info => info.id !== videoTrack.id);
    debug("updated trackInfos", trackInfos);

    trackInfos.push(settings);
    await sendMessage('video', 'tab', 'track_info', {trackInfo: settings});
    // Keep for debugging
    /*
    streams.forEach( stream => {

        // ToDo: stream event handlers
        stream.onremovetrack = async (track) => {
            debug("track removed", track);
            await sendMessage('video', 'tab', 'remove_track', track.id)
            // ToDo: take it out of the list
        };

        const [videoTrack] = stream.getVideoTracks();
        videoTrack.onended = (e) => {
            debug("track stopped: ", e.srcElement);
            const {id} = e.srcElement;
            trackInfos = trackInfos.filter(info => info.id !== id);
            debug()
        };
        videoTrack.onmute = async e => {
            await sendMessage('video', 'tab', 'mute', e.srcElement.id)
            debug("track muted: ", e.srcElement)
        };
        videoTrack.onunmute = async e => {
            await sendMessage('video', 'tab', 'unmute', e.srcElement.id)
            debug("track unmuted: ", e.srcElement)
        };


        // ToDo: find out if a gUM stream can ever have more than 1 video track
        const settings = videoTrack.getSettings();
        debug("settings: ", settings);

        const {label} = videoDevices.find(device => settings.deviceId === device.deviceId);
        debug("device label: ", label);
        if (label !== "")
            settings.label = label;

        // trackIds.add(settings.id);
        // ToDo: make sure to only push unique tracks
        trackInfos.push(settings);
        sendMessage('video', 'tab', 'track_info', {trackInfos})
            .catch(err=>debug("sendMessage error: ", err));

    });

     */
}

/*
 * Communicate with the background worker context
 */

async function sendMessage(to = 'all', from = 'tab', message, data = {}, responseCallBack = null) {

    if (from === 'tab' && to === 'tab')
        return;

    try {
        // ToDo: response callback
        const messageToSend = {
            from: from,
            to: to,
            message: message,
            data: data
        };

        // ToDo: this is expecting a response
        await chrome.runtime.sendMessage(messageToSend, {});

        // debug(`sent "${message}" from "tab" to ${to} with data ${JSON.stringify(data)}`);
    } catch (err) {
        debug("ERROR", err);
    }
}

// Main message handler
chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        debug(`receiving "${message}" from ${from} to ${to}`, request);

        if (to === 'tab' || to === 'all') {

            const sendTrainingImage = image => sendMessage('training', 'tab', 'training_image', image);

            if (message === 'video_tab') {
                videoTabId = data.sourceTabId;
                debug(`video tab id is: ${videoTabId}`)
                // await sendStreamAsFrameString(videoTabId, streams[0]);
                // await dataChannel(streams[0]);
                // ToDo: ???
                await syncTrackInfo();
            }
                // ToDo: come back to training
            /*else if (message === 'train_start') {
                sendImagesInterval = data.sendImagesInterval || DEFAULT_SEND_IMAGES_INTERVAL;
                if (faceMeshLoaded) {
                    debug(`Resumed sending images. Sending every ${sendImagesInterval} sec`);
                } else {
                    debug(`sending images every ${sendImagesInterval} sec`);
                    streams.forEach(stream => processStream(stream, sendTrainingImage));
                }
            } else if (message === 'train_stop') {
                sendImagesInterval = Infinity;
                debug(`Pausing sending images`);
            } else if (message === 'update_train_interval') {
                sendImagesInterval = data.sendImagesInterval || DEFAULT_SEND_IMAGES_INTERVAL;
                debug(`Resumed sending images. Sending every ${sendImagesInterval} ms`);
                streams.forEach(stream => {
                    if (!faceMeshLoaded && stream.active)
                        processStream(stream, sendTrainingImage)
                });
            } */
            else {
                debug("DEBUG: Unhandled event", request)
            }

            /*
            // No more need to forward anything to inject?
            const forwardedMessage = {
                from: from,
                to: to,
                message: request.message,
                data: data
            };
            sendToInject(forwardedMessage);
             */

        } else if (to === 'content') {
            // Nothing to do here yet
            debug("message for content.js", request)
        } else {
            if (sender.tab)
                debug(`unrecognized format from tab ${sender.tab.id} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);
            else
                debug(`unrecognized format : `, sender, request);
        }
    }
);


/*
 * Communicate with the injected content
 */

const sendToInject = message => {
    debug("sending this to inject.js", message);
    const toInjectEvent = new CustomEvent('vch', {detail: message});
    document.dispatchEvent(toInjectEvent);
};

// Messages from inject
document.addEventListener('vch', async e => {
    const {to, from, message, data} = e.detail;
    // ToDo: stop inject for echoing back
    if (from === 'content')
        return;

    debug("message from inject", e.detail);

    if (!e.detail) {
        return
    }


    if (message === 'gum_stream_start') {
        const id = data.id;
        const video = document.querySelector(`video#${id}`);
        const stream = video.srcObject;
        streams.push(stream);
        debug(`stream video settings: `, stream.getVideoTracks()[0].getSettings());
        sendMessage(to, 'tab', message, data);

        // check if videoTab is already open
        // ToDo: query this
        //  const url = chrome.runtime.getURL("pages/video.html"); // + `?source=${tabId}`;
        // Learning: not allowed in content
        // const videoTab = await chrome.tabs.query({url: url});
        //  debug("videoTab", videoTab);

        if (videoTabId)
            await syncTrackInfo();

        // send a message back to inject to remove the temp video element
        const responseMessage = {
            to: 'tab',
            from: 'content',
            message: 'stream_transfer_complete',
            data: {id}
        }
        sendToInject(responseMessage);


    }
});

// Tell background to remove unneeded tabs
window.addEventListener('beforeunload', () => {
    sendMessage('all', 'tab', 'unload')
});

// sendMessage('background', 'content', 'tab_loaded', {url: window.location.href});
