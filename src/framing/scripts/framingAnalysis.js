// import {FaceMesh} from '/node_modules/@mediapipe/face_mesh/face_mesh.js';
import {FaceMesh} from '@mediapipe/face_mesh';
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




/*
const faceMesh = new FaceMesh({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }});
 */
const faceMesh = new FaceMesh({locateFile: (file) => {
        return `../face_mesh/${file}`;
    }});

// const faceMesh = new FaceMesh();
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(results=>console.log(results));



startBtn.onclick = async () => {
    const imageData = await getImageData();
    console.log(imageData);

    const row = imageData[10]; // ToDo: debugging
    // imageData
    //    .forEach(row => {
            // Don't include Meet screen shares
            if(row.deviceId.match(/screen|window|tab|web-contents/))
                return

            const img = new Image();
            if (row.width && row.height) {
                img.width = row.width;
                img.height = row.height;
            } else
                // skip if bad data
                return

            img.src = URL.createObjectURL(row.image);
            faceMesh.send({image: row.image});

            const aspectRatio = (row.width/row.height).toFixed(1);
            console.log(`${row.width}hx${row.height}w; ${aspectRatio}`)
      //   })

}

