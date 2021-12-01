function debug(...messages) {
    console.debug(`vch 💉 `, ...messages);
}

function sendToContentJs(messageObj) {
    const toContentEvent = new CustomEvent('vch', {detail: messageObj});
    document.dispatchEvent(toContentEvent);
}

function grabImage(stream){

    /*
    const settings = stream.getVideoTracks()[0].getSettings();
    const height = settings.height;
    const width = settings.width;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage()
     */

    // Using fetch
    async function downloadImage(image) {
        //const image = await fetch(imageSrc)
        const imageBlob = await image.blob()
        const imageURL = URL.createObjectURL(imageBlob)

        const link = document.createElement('a')
        link.href = imageURL
        link.download = 'image_0001.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }


    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.play()
        .then( ()=>{
            console.log("video playing");
            setTimeout(async ()=>{
                console.log("getting image");
                let frame = new VideoFrame(videoElement);
                await downloadImage(frame);
                frame.close();
            }, 2000);

        });

    /*
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor({track});

    processor.readable.pipeThrough(new TransformStream({
        transform: (frame, controller) => console.log(frame)
    }));

     */

    //const frame = new VideoFrame(canvasElement);

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
        sendToContentJs("gumStream");
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