/*
 * REMOVED FROM video.js
 * NOT A WORKING MODULE
 * I just copied it here in case I need it later
 */


const pc = new RTCPeerConnection();

chrome.runtime.onConnect.addListener(async port => {
    console.assert(port.name === 'frames' || port.name === 'peerConnection');

    const tabId = port.sender.tab.id;
    log(`port connected to tab ${tabId}`);
    const signalPeer = (message, data= null) => port.postMessage({message: message, data});
    signalPeer("connected");

    /*
    const generator = new MediaStreamTrackGenerator({kind: 'video'});
    const transform = new TransformStream({transform: frame => log(frame)});
    const writer = await generator.writable.getWriter();

    const ctx = canvasElem.getContext("2d");
     */


    port.onMessage.addListener(async msg => {
        log(`incoming port msg: ${msg.message}`, msg.data);

        // if(msg.blobUrl)  imgElem.src = msg.blobUrl;

        if (msg.message === 'offer'){
            await pc.setRemoteDescription(msg.data);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            pc.ondatachannel = (e)=> {
                const MAXIMUM_MESSAGE_SIZE = 65535;
                const END_OF_FILE_MESSAGE = 'EOF';
                const receivedBuffers = [];
                let url;
                let frameCount = 0;

                const channel = e.channel;
                channel.binaryType = 'arraybuffer';
                channel.onopen = () => log("dataChannel connected");
                channel.onclose = () => log("dataChannel closed");
                channel.onmessage = async (e) => {

                    // https://levelup.gitconnected.com/send-files-over-a-data-channel-video-call-with-webrtc-step-6-d38f1ca5a351
                    const { data } = e;
                    log(e);
                    try {
                        if (data !== END_OF_FILE_MESSAGE) {
                            receivedBuffers.push(data);
                        } else {
                            const buf = receivedBuffers.reduce((acc, buf) => {
                                const tmp = new Uint8Array(acc.byteLength + buf.byteLength);
                                tmp.set(new Uint8Array(acc), 0);
                                tmp.set(new Uint8Array(buf), acc.byteLength);
                                return tmp;
                            }, new Uint8Array());
                            // const blob = new Blob([arrayBuffer]);
                            const blob = new Blob( [ buf ], { type: "image/jpeg" } );
                            if(url)
                                URL.revokeObjectURL(url);
                            url =  URL.createObjectURL(blob);
                            imgElem.src = url;
                            // log(blob);
                            frameCount++;
                        }
                    } catch (err) {
                        console.error('failure', err);
                    }

                    /*
                    // log("dataChannel message", e);
                    const buf = e.data;
                    const blob = new Blob( [ buf ], { type: "image/jpeg" } );
                    // log(blob);

                    if(url)
                        URL.revokeObjectURL(url);
                    url =  URL.createObjectURL(blob);
                    imgElem.src = url;
                    frameCount++;
                    spanElem.innerText = frameCount.toString();

                     */
                    /*

                    const height = frame.codedHeight;
                    const width = frame.codedWidth;

                    canvasElem.height = height;
                    canvasElem.width = width;
                    ctx.drawImage(frame, 0, 0, width, height);

                     */

                    // await writer.write(frame);
                }
            }

            signalPeer('answer', answer)

        }
        else if(msg.message === 'candidate'){
            await pc.addIceCandidate(msg.data);

        }

        // else log(msg);
    });
});

// Failed attempt to send all unencoded frames over the datachannel
async function framesFromDataChannel(){
    const pc = new RTCPeerConnection();

    document.addEventListener('candidate', async e => {
        console.debug(e.detail);
        await pc.addIceCandidate(e.detail.candidate);
    });

    await pc.setRemoteDescription(e.detail);

    window.receiverPc = pc;

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const toSenderEvent = new CustomEvent('answer', {detail: answer});
    document.dispatchEvent(toSenderEvent);
}
