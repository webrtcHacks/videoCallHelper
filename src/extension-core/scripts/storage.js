// Testing storage options
import { get, set } from 'idb-keyval';
const span = document.createElement('span');

const {time: timeString1} = await chrome.storage.local.get(['time']);
console.log(timeString1);
span.innerText = `chrome.storage.local: ${timeString1}`;

const timeString2 = await get('time');
console.log(timeString2);
span.innerText += `\n` + `idb-keyval: ${timeString2}`;

document.body.appendChild(span);
