'use strict';

let gumStream;
let sendImagesInterval = Infinity;
let faceMeshLoaded = false;

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

const DEFAULT_SEND_IMAGES_INTERVAL = 30 * 1000;

document.addEventListener('vch', async e => {
    const {from, to, message, data} = e.detail;

    // Edge catching its own events
    if (from === 'tab' || to !== 'tab') {
        return
    }

    if (message === 'train_start') {
        sendImagesInterval = data.sendImagesInterval || DEFAULT_SEND_IMAGES_INTERVAL;
        if(faceMeshLoaded){
            debug(`Resumed sending images. Sending every ${sendImagesInterval} sec`);
        }
        else{
            debug(`sending images every ${sendImagesInterval} sec`);
            await sendImages(gumStream);
        }

    } else if (message === 'train_stop') {
        sendImagesInterval = Infinity;
        debug(`Pausing sending images`);
    } else if (message === 'update_train_interval') {
        sendImagesInterval = data.sendImagesInterval || DEFAULT_SEND_IMAGES_INTERVAL;
        debug(`Resumed sending images. Sending every ${sendImagesInterval} ms`);
    } else {
        debug("DEBUG: Unhandled event", e.detail)
    }
});

async function sendImages(stream) {

    // ToDo: load this dynamically
    /*
     *  MediaPipe Face Mesh setup
     */
    const faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `chrome-extension://daddijhcmajcmnhfeampakkjllggmplg/node_modules/@mediapipe/face_mesh/${file}`;
            // return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMeshLoaded = true;

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

            // ToDo: move this?
            faceMesh.onResults(async results => {
                // Finding: can't send a blob or convert it
                //  {blobString: JSON.stringify(blob) didn't work
                //  await new FileReader().readAsArrayBuffer(blob)
                //  const blobArray = await blob.arrayBuffer();

                // Finding: just send the URL
                // debug(results);

                const data = {
                    source: window.location.href,
                    date: now,          // Date.now()
                    blobUrl: blobUrl,   // get the image from faceMesh
                    faceMesh: results.multiFaceLandmarks
                }
                sendMessage('training', 'image', data);
            });

            await faceMesh.send({image: canvas});

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
