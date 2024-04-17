import '../../dash/style.scss';
import {MessageHandler, MESSAGE as m, CONTEXT as c} from "../../modules/messageHandler.mjs";

const mh = new MessageHandler('popup');

document.getElementById('close').addEventListener('click', ()=> {
    window.close();
});

document.getElementById('refresh').addEventListener('click', async ()=> {
    await mh.sendMessage(c.BACKGROUND, m.DASH_OPEN_NEXT, {});
    await chrome.tabs.reload();
    // const thisTab = await chrome.tabs.getCurrent();
    window.close();
});
