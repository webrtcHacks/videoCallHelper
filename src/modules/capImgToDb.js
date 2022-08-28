
export async function* getImages(stream){
    // Insertable stream image capture
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    const {width, height} = stream.getVideoTracks()[0].getSettings()
    const canvas = new OffscreenCanvas(width,height);
    const ctx = canvas.getContext("bitmaprenderer");

    let stopGenerator = false;

    async function readFrame() {
        const {value: frame, done} = await reader.read();
        if (frame && !done) {

            const bitmap = await createImageBitmap(frame, 0, 0, frame.codedHeight, frame.codedWidth);
            ctx.transferFromImageBitmap(bitmap);
            const blob = await canvas.convertToBlob({type: "image/jpeg"});
            const blobUrl = window.URL.createObjectURL(blob);

            frame.close();
            bitmap.close();

            return blobUrl
        }
    }

    while (!stopGenerator){
        const blobUrl = await readFrame();

        if(blobUrl){
            const imgData = {
                url: window?.location.href || "",
                date: (new Date()).toLocaleString(),
                blobUrl: blobUrl
            }
            yield imgData
        }
        else{
            stopGenerator = true;
            return false
        }
    }
}

export async function __capImgToDb(stream, afterImageFunction) {
    // Insertable stream image capture
    // This guarantees every frame is unique
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    let captureInterval;

    const {width, height} = stream.getVideoTracks()[0].getSettings()
    const canvas = new OffscreenCanvas(width,height);
    const ctx = canvas.getContext("bitmaprenderer");

    async function readFrame() {
        const {value: frame, done} = await reader.read();
        if (frame) {

            const bitmap = await createImageBitmap(frame, 0, 0, frame.codedHeight, frame.codedWidth);
            ctx.transferFromImageBitmap(bitmap);
            const blob = await canvas.convertToBlob({type: "image/jpeg"});
            const blobUrl = window.URL.createObjectURL(blob);

            const imgData = {
                url: window?.location.href || "",
                date: (new Date()).toLocaleString(),
                blobUrl: blobUrl
            }
            // await set(`image_${Date.now()}`, imgData);
            // ToDo: put sendMessage into a module
            afterImageFunction('all', 'content', 'frame_cap', imgData);
            frame.close();
            bitmap.close();
        }
        if (done)
            clearInterval(captureInterval);
    }

    // ToDo: set this from a message
    let interval = 5*1000;

    captureInterval = setInterval(async () => await readFrame(), interval);
    return captureInterval
}

