// let sendImagesInterval = Infinity;
// let faceMeshLoaded = false;

// ToDo: I think I need to bundle
async function loadFaceMesh(){

    /*
    // This puts FaceMesh in the page context
    return new Promise((resolve, reject)=>{
        // This is giving an error - moved to content.js
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('/node_modules/@mediapipe/face_mesh/face_mesh.js');
        document.body.appendChild(script);
        script.onload = () => {
            debug("FaceMesh script loaded");
            resolve()
        }
    });
    */


    // Uncaught (in promise) EvalError: Refused to evaluate a string as JavaScript because 'unsafe-eval' is
    // not an allowed source of script in the following Content Security Policy directive: "script-src 'self'".
    // -- doesn't let you add `unsafe eval`
    /*
    const result = await fetch(chrome.runtime.getURL('/node_modules/@mediapipe/face_mesh/face_mesh.js'));
    const script = await result.text();
    eval(script);
    console.log(`faceMesh: ${typeof FaceMesh}`);
     */

}

async function processStream(stream, dataHandler) {

    /*
     *  MediaPipe Face Mesh setup
     */

    // Lazy load the lib
    // Didn't work

    // load errors =
    //await loadFaceMesh();

    debug(`faceMesh: ${typeof FaceMesh}`);

    const faceMesh = new FaceMesh({
        locateFile: (file) => {
            debug("faceMesh file:", file);
            return chrome.runtime.getURL(`/node_modules/@mediapipe/face_mesh/${file}`);
            //return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
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
                //sendMessage('training', 'image', data);
                dataHandler(data);
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
