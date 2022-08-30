import {entries} from 'idb-keyval';

const rowDiv = document.querySelector('div#images');
const showDbBtn = document.querySelector('button#db_show');
const clearDbBtn = document.querySelector('button#db_clear');
const settingsBtn = document.querySelector('button#apply_settings');

const dbCountSpan = document.querySelector('span#db_count');

const idbStorage = await entries();
// console.log(idbStorage);
window.storage = idbStorage;

const imagesData = idbStorage.filter(data => data[1].image);
console.log(imagesData);

dbCountSpan.innerText = imagesData.length;

async function showDb() {

    rowDiv.innerHTML = null;

    idbStorage
        .map(entry => {
            let data = entry[1];
            data.id = entry[0];
            data.timestamp = new Date(data.date).getTime();
            // console.log(data);
            return data
        })
        .sort((a, b) => a.timestamp > b.timestamp)
        .forEach(row => {

            const imgCol = document.createElement('div');
            imgCol.classList.add('imgCol');

            const img = new Image();
            if (row.width && row.height) {
                img.width = row.width;
                img.height = row.height;
            }
            img.src = URL.createObjectURL(row.image);
            img.decode().then(() => imgCol.appendChild(img));

            const dataCol = document.createElement('div');
            dataCol.classList.add('dataCol');

            dataCol.innerHTML = `id: ${row.id} ` + `\nDate: ${row.date} ` + `\nSize: ${row.width}x${row.height} `
                + `\nDeviceId: ${row.deviceId} ` + `\nurl: ${row.url} `;

            rowDiv.appendChild(imgCol);
            rowDiv.appendChild(dataCol);

            // console.log(row);
        });
}


showDbBtn.onclick = () => showDb();
