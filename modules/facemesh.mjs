/*
 *  MwdiaPipe Face Mesh setup
 */

const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `../node_modules/@mediapipe/face_mesh/${file}`;
    }
});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

const canvas = new OffscreenCanvas(1,1);
const canvasCtx = canvas.getContext('2d');

// Output display controller - used in as transform
export async function mesh(frame, controller) {

    const flip = true;

    // MediaPipe doesn't take a frame, so need to write this to a canvas
    // we could read right from the element in `new VideoFrame(canvasElement)`, but this lets us flip it too
    canvasCtx.save();
    canvasCtx.scale(flip, 1);
    canvasCtx.drawImage(frame, 0, 0, canvas.width * flip, canvas.height);
    canvasCtx.restore();

    await faceMesh.onResults(async results => {

        /*
        // Show the video or a colored background
        // ToDo: I don't understand why this doesn't work
        if(showScreenShareCheckbox.checked && screenShareStream.active){
            canvasCtx.drawImage(screenShareVideo, 0, 0, canvasElement.width, canvasElement.height);
        }
        else if (!showSelfViewVideoCheckbox.checked){
            canvasCtx.fillStyle = "aqua";
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        }

         */
        canvasCtx.drawImage(screenShareVideo, 0, 0, canvas.width, canvas.height);

        // how to draw the mesh
        if (results.multiFaceLandmarks) {
            const THIN_LINE = 1;
            const THICK_LINE = 2;

            const GREY_CONNECTOR = {color: '#C0C0C070', lineWidth: THIN_LINE};
            const WHITE_CONNECTOR = {color: '#E0E0E0', lineWidth: THIN_LINE};
            const RED_CONNECTOR = {color: '#FF3030', lineWidth: THIN_LINE};
            const GREEN_CONNECTOR = {color: '#30FF30', lineWidth: THIN_LINE};

            for (const landmarks of results.multiFaceLandmarks) {
                drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, GREY_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, WHITE_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, WHITE_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, RED_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, WHITE_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, WHITE_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, RED_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, WHITE_CONNECTOR);
                drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, WHITE_CONNECTOR);
            }
        }

        const meshFrame = new VideoFrame(canvas);
        controller.enqueue(meshFrame);
        frame.close();

    });
    await faceMesh.send({image: canvas})
}
