const SHOW_CONNECTORS = false;

function log(...messages) {
    console.log(`🏋️ `, ...messages);
/*
    if (messages.length > 1 || typeof messages[0] === 'object')
        console.log(`🏋️ ️${JSON.stringify(...messages)}`);
    else
        console.log(`🏋️ ️`, ...messages);
 */
}

log("training script");

const div = document.querySelector('div#images');
const button = document.querySelector('button');
const input = document.querySelector('input');
let state = 'not started';

const urlParams = new URLSearchParams(window.location.search);
const sourceTab = parseInt(urlParams.get('source'));


function sendMessage(to, message, data, responseHandler) {

    log(`sending "${message}" to ${to} with data: ${JSON.stringify(data)}`);

    try {
        const messageToSend = {
            from: "training",
            to: to,
            message: message,
            data: data
        };

        if (to === 'background' || to === 'all')
            chrome.runtime.sendMessage(messageToSend, responseHandler);
        if (to === 'tab' || to === 'all')
            chrome.tabs.sendMessage(sourceTab, messageToSend, responseHandler)
    } catch (err) {
        console.error(err);
    }
}

// Test if this works
chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        if (to !== 'training')
            return;

        log(`incoming "${message}" message from ${from} to ${to} with data: `, data);

        if (message === 'image') {

            const imageDiv = document.createElement("div");

            const imgElem = document.createElement("img");
            imgElem.src = data.blobUrl;
            await imgElem.decode();
            // imageDiv.appendChild(imgElem);

            const canvasElement = document.createElement("canvas");
            const ctx = canvasElement.getContext('2d');
            canvasElement.width = imgElem.width;
            canvasElement.height = imgElem.height;
            ctx.drawImage(imgElem, 0,0);

            if(SHOW_CONNECTORS){
                const THIN_LINE = 1;

                const GREY_CONNECTOR = {color: '#C0C0C070', lineWidth: THIN_LINE};
                const WHITE_CONNECTOR = {color: '#E0E0E0', lineWidth: THIN_LINE};
                const RED_CONNECTOR = {color: '#FF3030', lineWidth: THIN_LINE};

                const landmarks = data.faceMesh[0];
                window.landmarks = landmarks;
                console.log(landmarks);

                drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, GREY_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, WHITE_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYEBROW, WHITE_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_RIGHT_IRIS, RED_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, WHITE_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYEBROW, WHITE_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_LEFT_IRIS, RED_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, WHITE_CONNECTOR);
                drawConnectors(ctx, landmarks, FACEMESH_LIPS, WHITE_CONNECTOR);
            }

            imageDiv.appendChild(canvasElement);

            const textSpan = document.createElement("span");
            textSpan.innerText = `\n${data.source}\n` +
                `${new Date(data.time).toLocaleString()}\n` +
                `${data.faceMesh[0].length} facial landmarks`;
            imageDiv.appendChild(textSpan);

            div.appendChild(imageDiv);

        }
    }
);

// send new data to tab everytime the input changes
input.oninput = () => {
    // ToDo: sendMessage
    const sendImagesInterval = input.value * 1 || Infinity;
    sendMessage('tab', 'update_train_interval', {sendImagesInterval})
}

button.onclick = () => {
    const sendImagesInterval = input.value * 1 || Infinity;

    // not started to running
    if (state === 'not started') {
        state = 'running';
        button.innerText = "Pause";
        sendMessage('tab', 'train_start', {sendImagesInterval});
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
        sendMessage('tab', 'update_train_interval', {sendImagesInterval});
    } else {
        console.error(`You messed up! state: ${state}`)
    }
};

// send the tab id
chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    const currentTabId = tabs[0].id;
    sendMessage('background', 'training_tab_id', {id: currentTabId});
});