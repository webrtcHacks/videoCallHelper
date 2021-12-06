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

// send new data to tab everytime the input changes
input.oninput = () => {
    // ToDo: sendMessage
    const sendImagesInterval = input.value * 1 || Infinity;
    sendMessage('tab', 'update_train_interval', {sendImagesInterval: sendImagesInterval})
}

button.onclick = () => {
    const sendImagesInterval = input.value * 1 || Infinity;

    // not started to running
    if (state === 'not started') {
        state = 'running';
        button.innerText = "Pause";
        sendMessage('tab', 'train_start', {sendImagesInterval: sendImagesInterval});
    }
    // running to paused
    else if (state === 'running') {
        state = 'paused';
        button.innerText = "Start";
        sendMessage('tab', 'train_stop');

    }
    // paused to running
    else if (state === 'paused') {
        state = 'running';
        button.innerText = "Pause";
        sendMessage('tab', 'update_train_interval', {sendImagesInterval: sendImagesInterval});
    } else {
        console.error(`You messed up! state: ${state}`)
    }
};
