'use strict';

let gumStream;
let sendImagesInterval = Infinity;

function debug(...messages) {
    console.debug(`vch 💉 `, ...messages);
}

function sendMessage(to = 'all', message, data = {}) {
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
    const {message, data} = e.detail;
    if (message === 'train_start') {
        sendImagesInterval = data.sendImagesInterval || 2000;
        debug(`sending images every ${sendImagesInterval} ms`);
        await sendImages(gumStream);
    }
    else if (message === 'train_stop') {
        sendImagesInterval = Infinity;
        debug(`Pausing sending images`);
    }
    else{
        debug("DEBUG:",  e.detail)
    }
});

async function sendImages(stream) {
    const [track] = stream.getVideoTracks();
    const {width, height} = track.getSettings();

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("bitmaprenderer");

    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    const processor = new MediaStreamTrackProcessor({track});

    let timer = new Date();

    async function extractImage(frame) {
        const now = Date.now();
        if (now - timer > sendImagesInterval) {
            const bitmap = await createImageBitmap(frame, 0, 0, width, height);
            ctx.transferFromImageBitmap(bitmap);
            const blob = await canvas.convertToBlob({type: "image/jpeg"});
            const blobUrl = window.URL.createObjectURL(blob);
            // debug(blob);
            window.blob = blob;

            // Finding: can't send a blob or convert it
            //  {blobString: JSON.stringify(blob) didn't work
            //  await new FileReader().readAsArrayBuffer(blob)
            //  const blobArray = await blob.arrayBuffer();

            // Finding: just send the URL?
            sendMessage('all', 'image', {blobUrl: blobUrl});

            // Show the image for debugging
            /*
            const imgElem = document.createElement("img");
            imgElem.src = blobUrl;
            document.body.appendChild(imgElem);
             */

            timer = now;
        }
        frame.close();
    }

    await processor.readable
        .pipeThrough(new TransformStream({transform: frame => extractImage(frame)}))
        .pipeTo(generator.writable);
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
                sendMessage('background', {lostDisplayMediaHandle: capturedHandle});
            };

            sendMessage('background', {gotDisplayMediaHandle: capturedHandle});
        } else {
            // send a notice a tab wasn't shared
        }
        return gdmStream
    }

    navigator.mediaDevices.getDisplayMedia = shimGetDisplayMedia;

    const origGetGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

    async function shimGetUserMedia(constraints) {

        gumStream = await origGetGetUserMedia(constraints);
        debug("got stream", gumStream);
        sendMessage('all', "gum_stream_start");
        return gumStream
    }

    navigator.mediaDevices.getUserMedia = shimGetUserMedia;

    window.videoCallHelper = true;

} else {
    debug("shims already loaded")
}

/*
 * debugging
 */

debug("injected");
