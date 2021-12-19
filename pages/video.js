const imgElem = document.querySelector('img');
const videoElem = document.querySelector('video');

function log(...messages) {
    console.debug(`vch 🎞‍ `, ...messages);
}

chrome.runtime.onConnect.addListener(port => {
    console.assert(port.name === "frames");
    port.onMessage.addListener(msg => {
        if (msg.message)
            log(msg.message);
        else if(msg.blobUrl){
            imgElem.src = msg.blobUrl;
        }
        else log(msg);
    });
});

const messageToSend = {
    from: 'video',
    to: 'all',
    message: 'video_tab',
}
chrome.runtime.sendMessage( {...messageToSend});
