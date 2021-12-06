const statusSpan = document.querySelector('span#gumStatus');
const trainBtn = document.querySelector('button#train');

function log(...messages) {
    if (messages.length > 1 || typeof messages[0] === 'object')
        console.log(`🐰 ️${JSON.stringify(...messages)}`);
    else
        console.log(`🐰 ️${messages}`);
}

// wrapper
function sendMessage(to, message, data, responseHandler) {
    try{
        const messageToSend = {
            from: "popup",
            to: to,
            message: message,
            data: data
        };

        if(to === 'background' || to === 'all')
            chrome.runtime.sendMessage(messageToSend, responseHandler)
        if (to === 'tab' || to === 'all')
            chrome.tabs.query({active: true, currentWindow: true}, tabs => {
                chrome.tabs.sendMessage(tabs[0].id, messageToSend, responseHandler)
            });
    }
    catch (err){
        console.error(err);
    }
}

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        log(request);
        const {to, from, message, data} = request;

        if(to === 'popup' || to === 'all'){
            log(`message from ${from}: ${message}`);
        }
        else {
            /*
            if(sender.tab)
                log(`unrecognized format from tab ${sender.tab.id} on ${sender.tab ? sender.tab.url : "undefined url"}`, request);
            else
                log(`unrecognized format : `, sender, request);
            return
             */
        }

        // message handlers
        if(message === "gum_stream_start") {
            statusSpan.textContent = "active";
            trainBtn.disabled = false;
        }
        if(message === "training_image") {
            log(data)
        }
        else {
            log("unrecognized request: ", request)
            // statusSpan.textContent = "inactive";
            // trainBtn.disabled = true;
        }
   });

// Get state
sendMessage('background', "open", {}, (response)=>{
    log("response: ", response);
    if(response.message === "active") {
        statusSpan.textContent = "active";
        trainBtn.disabled = false;
    }
    else {
        statusSpan.textContent = "inactive";
        trainBtn.disabled = true;
    }
});

trainBtn.onclick = async () => {
    sendMessage('tab', "train_start", {sendImagesInterval: 5000});
    let url = chrome.runtime.getURL("pages/training.html");
    let inputTab = await chrome.tabs.create({url});
    console.log(`training page open on tab ${inputTab.id}`)
}
