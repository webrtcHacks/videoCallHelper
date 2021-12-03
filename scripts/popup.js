const statusSpan = document.querySelector('span#gumStatus');
const trainBtn = document.querySelector('button#train');

function log(...messages) {
    if(messages.length === 1)
        console.log(`🐰 ️`, messages[0])
    else
        console.log(`🐰 ️`, ...messages);
}

// wrapper
function sendMessage(to, message, responseHandler) {
    try{
        if(to === 'background' || to === 'all')
            chrome.runtime.sendMessage({from: "popup", to: to, message: message}, responseHandler)
        if (to === 'tab' || to === 'all')
            chrome.tabs.query({active: true, currentWindow: true}, tabs => {
                const sendObj = {from: "popup", to: to, message: message};
                chrome.tabs.sendMessage(tabs[0].id, sendObj, responseHandler)
            });
        /*
        // ToDo: do we need to handle sending to all tabs?
        //  Should the below be filtered?
        if (to === 'tabs' || to === 'all'){
            chrome.tabs.query({active: true, currentWindow: true}, tabs => {
                tabs.forEach(tab=>
                    chrome.tabs.sendMessage(tab.id, message, responseHandler))
            });
        }
*/
    }
    catch (err){
        console.error(err);
    }
}

chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if(request.to && ( request.to === 'popup' || request.to === 'all')){
            log(`message from ${request.from}: ${request.message}`);
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
        if(request.message === "gum_stream_start") {
            statusSpan.textContent = "active";
            trainBtn.disabled = false;
        }
        else {
            statusSpan.textContent = "inactive";
            trainBtn.disabled = true;
        }
   });

// Get state
sendMessage('background', "open", (response)=>{
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

trainBtn.onclick = () => sendMessage('tab', "train")