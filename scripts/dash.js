function debug(...messages) {
    console.debug(`vch 📈️‍ `, ...messages);
}

let currentTabId;
const remoteAudioLevels = [];
const localAudioLevel = [];
let audioLevelInterval = false;

const EventSpanElem = document.querySelector('span.vch');
const remoteAudioLevelSpan = document.querySelector('span.remote_audio_level');
const localAudioLevelSpan = document.querySelector('span.local_audio_level');

// for chart testing
window.events = [];

async function sendMessage(to = 'all', from = 'dash', message, data = {}, responseCallBack = null) {

    if (from === 'dash' && to === 'dash')
        return;

    try {
        // ToDo: response callback
        const messageToSend = {
            from: from,
            to: to,
            message: message,
            data: data
        };

        // ToDo: this is expecting a response
        await chrome.runtime.sendMessage(messageToSend, responseCallBack);
        debug(`sent "${message}" from "tab" to ${to} with data ${JSON.stringify(data)}`);
    } catch (err) {
        debug("ERROR", err);
    }
}

chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        // debug(`receiving "${message}" from ${from} to ${to}. Full request: `, request);

        if (message === 'toggle_dash') {
            currentTabId = data.tabId;
        } else if (message === 'dash_init_data') {
            data.forEach(event => {
                const {message, timeStamp, data} = event;
                EventSpanElem.innerText += `${new Date(timeStamp).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
            });

        } else if (from === 'tab') {
            const ts = data.timestamp || Date.now();

            // for chart testing
            window.events.push({ message, ts, data});

            // https://github.com/jitsi/lib-jitsi-meet/blob/adf2f15d0045747ba609b1fe19c088841717da11/modules/statistics/RTPStatsCollector.js#L209
            // https://jsfiddle.net/fippo/1eL9dm6u/20/
            if (message === 'remote_audio_level') {
                remoteAudioLevelSpan.innerText = `Average: ${data.audioLevel}`;

                /*
                remoteAudioLevels.push(data.audioLevel);

                if (!audioLevelInterval)
                    audioLevelInterval = setInterval(() => {
                        const avg = remoteAudioLevels.reduce((p, c) => p + c, 0) / remoteAudioLevels.length;
                        const max = remoteAudioLevels.reduce((p,c) => c>p? c : p);
                        remoteAudioLevelSpan.innerText =  `Average: \u00A0${avg}\n`+
                                                    `Max: \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${max}\n`+
                                                    `Samples: \u00A0${audioLevels.length}`;
                        remoteAudioLevels.length = 0;
                        // audioLevelSpan.innerText += `${new Date(ts).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
                    }, 1000)
                 */

            }
            else if (message === 'local_audio_level') {
                localAudioLevelSpan.innerText = `Average: ${data.audioLevel}\n`+
                                                `Total audio energy: ${data.totalAudioEnergy}`;
            } else
                EventSpanElem.innerText += `${new Date(ts).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
        }



    }
);


// Initial data load
// finding: content scripts can use chrome.tabs.query - you need to send a message to get the tabID;
// so you might as well just ask for the init data

/*
chrome.storage.local.get(['tabData'], messageObj => {
    if(!messageObj.tabData)
        return;

    debug(messageObj.tabData);
    messageObj.tabData.forEach(event => {
        const {message, timeStamp, data} = event;
        EventSpanElem.innerText += `${new Date(timeStamp).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
    });
});

 */

// await sendMessage('background', 'dash', 'dash_init', (response)=>{debug(response)});
await sendMessage('background', 'dash', 'dash_init');
