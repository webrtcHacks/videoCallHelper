function debug(...messages) {
    console.debug(`vch 📈️‍ `, ...messages);
}

// Messages from inject

// This doesn't work
/*
document.addEventListener('vch', async e => {
    const {to, from, message, data} = e.detail;
    debug("message from inject", e.detail);


    if (from === 'tab') {
        span.innerText += `${message} at ${Date.now().toLocaleString()}\n`;
    }

});
 */

chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        debug(`receiving "${message}" from ${from} to ${to}`, request);

        if (from === 'tab') {
            document.querySelector('span').innerText += `${message} at ${(new Date).toLocaleString()}\n`;
        }
    }
);
