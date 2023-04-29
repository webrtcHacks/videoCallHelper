// handler for standalone image capture display page

import {entries, clear, delMany, get, set} from 'idb-keyval';
import './imageCaptureSettings.mjs';

const showDbBtn = document.querySelector('button#db_show');
const clearDbBtn = document.querySelector('button#db_clear');
const saveDbBtn = document.querySelector('button#db_save');

const dbCountSpan = document.querySelector('span#db_count');
const rowDiv = document.querySelector('div#images');

const idbStorage = await entries();
window.storage = idbStorage;

// Initialize the UI
const imagesData = idbStorage.filter(data => data[1].image);
dbCountSpan.innerText = imagesData.length;
// console.log(imagesData);

// Get and sort data from idb-keyval
async function getImageData() {
    const allStorage = await entries();
    // Filter just entries with images
    const justImages = allStorage.filter(entry=>entry[1].image);

    // reformat and sort
    return justImages
        .map(entry => {
            let data = entry[1];
            data.id = entry[0];
            data.timestamp = new Date(data.date).getTime();
            // console.log(data);
            return data
        })
        .sort((a, b) => b.timestamp - a.timestamp); // descending order
}

// Display images from the database and related metadata on screen
async function showDb() {

    rowDiv.innerHTML = null;

    const imageData = await getImageData();
    console.log(imageData);

    imageData
        .forEach(row => {

            const imgCol = document.createElement('div');
            imgCol.classList.add('imgCol');

            const img = new Image();
            if (row.width && row.height) {
                img.width = row.width;
                img.height = row.height;
            }
            img.src = URL.createObjectURL(row.image);
            // img.decode().then(() => imgCol.appendChild(img));
            imgCol.appendChild(img);

            const dataCol = document.createElement('div');
            dataCol.classList.add('dataCol');

            dataCol.innerHTML = `id: ${row.id} ` + `\nDate: ${row.date} ` + `\nSize: ${row.width}x${row.height} `
                + `\nDeviceId: ${row.deviceId} ` + `\nurl: ${row.url} `;

            rowDiv.appendChild(imgCol);
            rowDiv.appendChild(dataCol);

            // console.log(row);
        });
}

// Permanently clear all contents of the database
async function clearDb() {
    let response = confirm("Are you sure you want permanently clear the database?");
    if (response) {
        await clear();
        console.log("deleted all entries");
    }
}


// Save all images to disk
async function saveDb() {

    // Get the directories if no permissions

    const parentDirectoryHandle = await window.showDirectoryPicker();
    // In that existing directory, create a new directory
    const directoryHandle = await parentDirectoryHandle.getDirectoryHandle('vch_images', {
        create: true,
    });

    console.log(`directory handle "${directoryHandle.name}" under "${parentDirectoryHandle.name}"`);

    // Open the datafile

    const dataFileHandle = await directoryHandle.getFileHandle(`imageData.csv`, {create: true, keepExistingData: true});
    console.log(`file handle for "${dataFileHandle.name}"`);
    const dataFileWritable = await dataFileHandle.createWritable();

    // See if the dataFile already exists
    const file = await dataFileHandle.getFile();
    console.log(`${dataFileHandle.name} size: ${file.size}`);
    const dataFileHeader = `file, id, url, date, time, height, width, deviceId\n`;

    if (file.size === 0) {
        await dataFileWritable.write(dataFileHeader);
    } else {
        // Finding: these did not work - they just insert null
        // await dataFileWritable.write({type: 'seek', position: size});
        // await dataFileWritable.seek(size);

        const text = await file.text();
        await dataFileWritable.write(text);
    }


    // Save all the images and add to dataFile
    const rows = await getImageData();

    for (const row of rows) {
        // write image
        const filename = `image_${row.timestamp}.jpg`;
        const fileHandle = await directoryHandle.getFileHandle(filename, {create: true});
        const imageWritable = await fileHandle.createWritable();
        console.log(row);
        await imageWritable.write(row.image);
        await imageWritable.close();

        // Add to metadata
        // `file, url, time, height, width. deviceId\n`;
        const metaDataRow = `${filename}, ${row.id}, ${row.url}, ${row.date}, ${row.height}, ${row.width}, ${row.deviceId}\n`;
        dataFileWritable.write(metaDataRow);
    }

    // Close the dataFile
    await dataFileWritable.close();

    // Ask to clear the db
    const okToClear = confirm("Clear the database?");
    if (okToClear){
        const keys = rows.map(entry=>entry.id);
        await delMany(keys);
        console.log("removed images from database", keys);
    }
}

showDbBtn.onclick = () => showDb();
clearDbBtn.onclick = () => clearDb();
saveDbBtn.onclick = () => saveDb();
