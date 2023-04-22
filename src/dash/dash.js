import './style.scss';

// import {MessageHandler, MESSAGE as m} from "../modules/messageHandler.mjs";
// ToDo: this isn't working - doesn't save
import '../imageCapture/scripts/imageCaptureSettings.mjs';
// import '../presence/scripts/presenceSettings.mjs';
import {StorageHandler} from '../modules/storageHandler.mjs';

// const debug = (args)=> {
const debug = function() {
    return Function.prototype.bind.call(console.debug, console, `vch 📈️‍ `);
}();

let storage = await new StorageHandler("local", debug);
// for debugging
window.storage = storage;

let currentTabId;
const remoteAudioLevels = [];
const localAudioLevel = [];
let audioLevelInterval = false;

const eventSpanElem = document.querySelector('span#events');

// Remote Audio
const remoteAudioLevelSpan = document.querySelector('span.remote_audio_level');
const localAudioLevelSpan = document.querySelector('span.local_audio_level');


// for chart testing
window.events = [];

// ToDo: should this be `dash` ???
// const mh = new MessageHandler('dash', debug);
// const sendMessage = mh.sendMessage;

// mh.addListener(m.DASH_OPEN, handleInitMessage);

// Status message updates
/*
Object.keys(m).forEach(key => {
    const message = m[key];

    if([
        m.GUM_STREAM_START,
        m.GUM_STREAM_STOP,
        m.AUDIO_TRACK_ADDED,
        m.VIDEO_TRACK_ADDED,
        m.PEER_CONNECTION_OPEN,
        m.PEER_CONNECTION_CLOSED,
        m.UNLOAD
    ].includes(message)){
        mh.addListener(message, (e)=>{
            statusSpanElem.innerText = message;
            debug(e);
            debug(`status message should be ${message}`);
        });

        // debug(message);

    }
});

 */

/*
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

                // remoteAudioLevels.push(data.audioLevel);
                //
                // if (!audioLevelInterval)
                //     audioLevelInterval = setInterval(() => {
                //         const avg = remoteAudioLevels.reduce((p, c) => p + c, 0) / remoteAudioLevels.length;
                //         const max = remoteAudioLevels.reduce((p,c) => c>p? c : p);
                //         remoteAudioLevelSpan.innerText =  `Average: \u00A0${avg}\n`+
                //                                     `Max: \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${max}\n`+
                //                                     `Samples: \u00A0${audioLevels.length}`;
                //         remoteAudioLevels.length = 0;
                //         // audioLevelSpan.innerText += `${new Date(ts).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
                //     }, 1000)

            }
            else if (message === 'local_audio_level') {
                localAudioLevelSpan.innerText = `Average: ${data.audioLevel}\n`+
                                                `Total audio energy: ${data.totalAudioEnergy}`;
            } else
                EventSpanElem.innerText += `${new Date(ts).toLocaleTimeString()}: ${message} with data ${JSON.stringify(data)}\n`;
        }
    }
);
*/

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

// Image capture button
document.querySelector("button#open_sampling").onclick = async ()=> {
    const url = chrome.runtime.getURL("pages/imageCapture.html");
    await chrome.tabs.create({url});
}

/* Presence */
const statusSpanElem = document.querySelector('span#presence_status');

document.querySelector("button#presence_setup").onclick = async ()=> {
    const url = chrome.runtime.getURL("pages/presence.html");
    await chrome.tabs.create({url});
}

// ToDo: redo this
/*
const presence = await storage.get("presence");

if(presence.active !== undefined){
    debug("presence state", presence);
    statusSpanElem.innerText = `${presence.active ? "active" : "inactive"}`;
}
else {
    debug("presence state not found");
    statusSpanElem.innerText = "ERROR";
}

 */

storage.addListener('presence', (newValue) => {
    debug("presence changed", newValue);
    statusSpanElem.innerText = newValue.active ? "active" : "inactive";
});

// Hide self view
// ToDo: move this into a module?
const selfViewCheckbox = document.querySelector("input#hide_self_view_check");
const selfViewStatus = document.querySelector("span#self_view_status");

function updateSelfViewUI() {

    // const enabled = storage.contents['selfView']?.enabled || false
    // const active = storage.contents['selfView']?.active || false;
    // debug("updateSelfViewUI | storage:", storage.contents['selfView']);
    const enabled = storage.contents['selfView'].enabled;
    const active = storage.contents['selfView'].active;

    if(enabled && active)
        selfViewStatus.innerText = "Obscuring self-view";
    else if(enabled && !active)
        selfViewStatus.innerText = "Looking for self-view";
    else
        selfViewStatus.innerText = "Click above to enable";

    // TODO: this is always showing active: false
    //  issue is storage['key']:{active: true, enabled: true} is created which means update isn't working
    debug("updateSelfViewUI | enabled:", enabled, "active:", active);

}


// let selfViewSettings = (await chrome.storage.local.get('selfView'))?.selfView || false;
//let selfViewSettings = await storage.get('selfView');
debug("self-view settings:", storage.contents['selfView']);
selfViewCheckbox.checked = storage.contents['selfView']?.enabled || false;
updateSelfViewUI();


selfViewCheckbox.onclick = async (e)=> {
    const enabled = selfViewCheckbox.checked;
    debug(`set self-view enabled to ${enabled}`);
    await storage.update('selfView', {enabled: enabled});
    // updateSelfViewUI();
}

storage.addListener('selfView', (newValue) => {
    // selfViewCheckbox.checked = storage.contents['selfView'].enabled;
    updateSelfViewUI();
});


async function main(){
    // await sendMessage('background', m.DASH_INIT);
    // statusSpanElem.innerText = 'Waiting for data...';
}

main().catch(err=>debug(err));
