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