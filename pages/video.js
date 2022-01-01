// ToDo: refactor webgazer.mjs code and import

const imgElem = document.querySelector('img');
const videoElem = document.querySelector('video');
const canvasElem = document.querySelector('canvas');
const spanElem = document.querySelector('span');

let stream;
stream = window.stream;

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

let videoDevices = []
navigator.mediaDevices.enumerateDevices()
    .then(devices=>videoDevices = devices.filter(device=>device.kind==='videoinput'))
    .catch(err=>console.error(err));

const messageToSend = {
    from: 'video',
    to: 'all',
    message: 'video_tab',
}

// ToDo: tell each tab to send track infos
chrome.runtime.sendMessage( messageToSend, {});

videoElem.onclick = async () => {
    let pip = await videoElem.requestPictureInPicture();
    console.log(`Picture-in-Picture size: ${pip.width}x${pip.height}`);
}

async function getCamera(constraints){

    if (stream && stream.active) {
        stream.getTracks().forEach(track => track.stop());
    }
    stream = await navigator.mediaDevices.getUserMedia({video: constraints});
    log("got new stream", stream);

    // ToDo: add webgazer code here
    videoElem.srcObject = stream;
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

        if (to !== 'video') // && sender.tab.id !== sourceTab)
            return;

        /*
        if(sourceTabUrl === ""){
            sourceTabUrl = sender.url;
            spanElem.innerText = `Source tab: ${sourceTabUrl}`;
        }
        */

        log(`incoming "${message}" message from ${from} to ${to} with data: `, data);

        let currentVideoTrack;
        if(stream && stream.active)
            [currentVideoTrack] = stream.getVideoTracks();

        if (message === 'track_info') {
            // log("video tab devices: ", videoDevices);
            // log("incoming data: ", data.trackInfo);
            // log(`number of tracks: ${data.trackInfo.length}`);
            // const settings = data.trackInfos.at(-1);
            const settings = data.trackInfo;

            if (settings.label) {
                const {deviceId} = videoDevices.find(device => settings.label === device.label);
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
    }
);
