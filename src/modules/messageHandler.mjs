/*
 * Communicate with the background worker context
 */

// ToDo: turn this into a class with init values

export async function sendMessage(to = 'all', from = 'tab', message = "", data = {}, responseCallBack = null) {

    if (from === 'tab' && to === 'tab')
        return;

    try {
        // ToDo: response callback
        const messageToSend = {
            from: from,
            to: to,
            message: message,
            timestamp: (new Date).toLocaleString(),
            data: data
        };

        // ToDo: this is expecting a response
        await chrome.runtime.sendMessage(messageToSend, {});

        // debug(`sent "${message}" from "tab" to ${to} with data ${JSON.stringify(data)}`);
    } catch (err) {
        debug("ERROR", err);
    }
}
