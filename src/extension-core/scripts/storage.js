// Testing storage options
import {entries} from 'idb-keyval';
const span = document.createElement('span');

const chromeStorage = await chrome.storage.local.get();
console.log(chromeStorage);
span.innerText = `chrome.storage.local: \n${JSON.stringify(chromeStorage)}`;

const idbStorage = await entries();
console.log(idbStorage);
span.innerText += `\n` + `idb-keyval: \n${JSON.stringify(idbStorage)}`;

document.body.appendChild(span);
