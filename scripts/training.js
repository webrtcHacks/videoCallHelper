console.log("Training script");


const div = document.querySelector('div#images');
const button = document.querySelector('button');
const input = document.querySelector('input');
let state = 'not started';

function sendMessage(to, message, data, responseHandler) {
    try{
        const messageToSend = {
            from: "training",
            to: to,
            message: message,
            data: data
        };

        if(to === 'background' || to === 'all')
            chrome.runtime.sendMessage(messageToSend, responseHandler);
        if (to === 'tab' || to === 'all')
            chrome.tabs.query({active: true, currentWindow: true}, tabs => {
                chrome.tabs.sendMessage(tabs[0].id, messageToSend, responseHandler)
            });
    }
    catch (err){
        console.error(err);
    }
}


// Test if this works
chrome.runtime.onMessage.addListener(
    (request, sender) => {
        const {to, from, message, data } = request;
        // console.log(request, sender);
        // console.log(to, from, message);

        if(message === 'image'){
            const imgElem = document.createElement("img");
            imgElem.src = data.blobUrl;
            div.body.appendChild(imgElem);
        }
    }
);

input.oninput = () => {
    // ToDo: sendMessage
    worker.postMessage({
        operation: 'updateInterval',
        interval: input.value * 1 || Infinity
    })
}

button.onclick = () => {
    // not started to running
    if (state === 'not started') {
        getCamera()
            .then((stream) => {
                getImages(stream);
                state = 'running';
                button.innerText = "Pause";
            })
            .catch((err) => console.error(err));
    }
    // running to paused
    else if (state === 'running') {
        window.stream.getVideoTracks()[0].enabled = false;
        state = 'paused';
        button.innerText = "Start";
    }
    // paused to running
    else if (state === 'paused') {
        window.stream.getVideoTracks()[0].enabled = true;
        state = 'running';
        button.innerText = "Pause";
    } else {
        console.error(`You messed up! state: ${state}`)
    }
};
