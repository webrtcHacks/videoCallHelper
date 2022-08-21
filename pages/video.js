// ToDo: refactor webgazer.mjs code and import

const videoElem = document.querySelector('video');
const imageDiv = document.querySelector('div#images');

// const imgElem = document.querySelector('img');
// const canvasElem = document.querySelector('canvas');
// const spanElem = document.querySelector('span');

let captureInterval;

let stream;
stream = window.stream;

// ToDo: console.log override: https://ourcodeworld.com/articles/read/104/how-to-override-the-console-methods-in-javascript
function log(...messages) {
    console.debug(`🎞‍ `, ...messages);
}

/*
// get URL params
// let sourceTabUrl = "";
// const urlParams = new URLSearchParams(window.location.search);
// const sourceTab = parseInt(urlParams.get('source'));

if(!urlParams.get('source')){
    spanElem.innerText = "no source tab identified";
}

// log(sourceTab);
*/

// let videoDevices = []
/*
navigator.mediaDevices.enumerateDevices()
    .then(devices=>videoDevices = devices.filter(device=>device.kind==='videoinput'))
    .catch(err=>console.error(err));
 */



window.onload = ()=> {
    log("video page loaded");
    const messageToSend = {
        from: 'video',
        to: 'all',
        message: 'video_tab',
    }
    chrome.runtime.sendMessage( messageToSend, {});
}

videoElem.onclick = async () => {
    let pip = await videoElem.requestPictureInPicture();
    log(`Picture-in-Picture size: ${pip.width}x${pip.height}`);
}

async function getCamera(constraints){

    if (stream && stream.active) {
        stream.getTracks().forEach(track => track.stop());
    }
    stream = await navigator.mediaDevices.getUserMedia({video: constraints});
    log("got new stream", stream);

    // ToDo: add webgazer code here
    videoElem.srcObject = stream;

    // ToDo: do image capture here

    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor(track);
    const reader = await processor.readable.getReader();

    async function readFrame() {
        const {value: frame, done} = await reader.read();
        if (frame) {
            const bitmap = await createImageBitmap(frame);
            // console.log(bitmap);
            // ToDo: send to cloud storage
            const canvas = document.createElement('Canvas');
            canvas.height = videoElem.videoHeight;
            canvas.width = videoElem.videoWidth;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElem, 0,0);
            imageDiv.appendChild(canvas);

            frame.close();
        }
        if (done)
            clearInterval(captureInterval);
    }

    // const interval = (parseInt(intervalSec) >= 1 ? intervalSec.value * 1 : 1) * 1000;
    const interval = 10 * 1000;
    captureInterval = setInterval(async () => await readFrame(), interval);
    /*
    // Insertable streams
    const [track] = stream.getVideoTracks();
    const processor = new MediaStreamTrackProcessor({track});

    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    videoElem.srcObject  = new MediaStream([generator]);

    await processor.readable.pipeThrough(new TransformStream({
        transform: (frame, controller) => mesh(frame, controller)
    })).pipeTo(generator.writable);

     */

}

chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {

        // ToDo: not sure why sendResponse isn't null
        if (sendResponse) {
            sendResponse(true);
        }

        const {to, from, message, data} = request;
        log(`incoming "${message}" message from ${from} to ${to} with data: `, data);

        if (to !== 'video') // && sender.tab.id !== sourceTab)
            return;

        /*
        if(sourceTabUrl === ""){
            sourceTabUrl = sender.url;
            spanElem.innerText = `Source tab: ${sourceTabUrl}`;
        }
        */


        let currentVideoTrack;
        if(stream && stream.active)
            [currentVideoTrack] = stream.getVideoTracks();

        if (message === 'track_info') {
            // log("incoming data: ", data.trackInfo);
            // log(`number of tracks: ${data.trackInfo.length}`);
            // const settings = data.trackInfos.at(-1);
            const settings = data.trackInfo;

            if (settings.label) {
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(device=>device.kind==='videoinput');
                log("video tab devices: ", videoDevices);
                log("settings", settings);
                const {deviceId} = videoDevices.find(device => settings.label === device.label);
                log("deviceId", deviceId);
                settings.deviceId = deviceId;
            }

            log("constraints: ", settings);
            await getCamera(settings);

        } else if (message === 'mute') {
            log("muting track");
            currentVideoTrack.enabled = false;
        } else if (message === 'unmute') {
            log("unmuting track");
            currentVideoTrack.enabled = true;
        } else if (message === 'remove_track') {
            const trackId = data.track.id;
            if (trackId === currentVideoTrack.id) {
                log(`remove track: ${trackId} - removed`);
                stream.removetrack(currentVideoTrack);
            } else {
                log(`remove track: ${trackId} - ${currentVideoTrack.id} doesn't match`);
            }
        }
        else if (message === 'unload'){
            // need something to check the id
            // videoElem.srcObject.getTracks().forEach(track=>track.stop);
        }
    }
);
