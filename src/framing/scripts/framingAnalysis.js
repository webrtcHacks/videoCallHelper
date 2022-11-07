import {entries} from 'idb-keyval';
const dbCountSpan = document.querySelector('span#db_count');
const startBtn = document.querySelector('button#start');
const results = document.querySelector('div#results');

const idbStorage = await entries();
window.storage = idbStorage;

const imagesData = idbStorage.filter(data => data[1].image);
dbCountSpan.innerText = imagesData.length;

// ToDo: Make this a module?
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


startBtn.onclick = async () => {
    const imageData = await getImageData();
    console.log(imageData);

    imageData
        .forEach(row => {
            if(row.deviceId.match(/screen|window|tab|web-contents/))
                return
            const aspectRatio = (row.width/row.height).toFixed(1);
            console.log(`${row.width}hx${row.height}w; ${aspectRatio}`)
        });

}
