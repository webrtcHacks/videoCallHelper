import '../../dash/style.scss';
import {MESSAGE as m} from "../../modules/messageHandler.mjs";
import {MessageHandler} from "../../modules/messageHandler.mjs";

const mh = new MessageHandler('popup');

document.getElementById('close').addEventListener('click', ()=> {
    window.close();
});

document.getElementById('refresh').addEventListener('click', async ()=> {
    // ToDo: this is not working
    await mh.sendMessage('background', m.DASH_OPEN_NEXT, {});
    await chrome.tabs.reload();
    // const thisTab = await chrome.tabs.getCurrent();
    window.close();
});
