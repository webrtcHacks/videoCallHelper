import '/node_modules/@mediapipe/drawing_utils/drawing_utils.js';
import '/node_modules/@mediapipe/face_mesh/face_mesh.js';
import '/node_modules/lovefield/dist/lovefield.js';

const trainingDiv = document.querySelector('div#training');
const getImagesBtn = document.querySelector('button#get_images');
const trainBtn = document.querySelector('button#train');
const showDbBtn = document.querySelector('button#db_show');
const clearDbBtn = document.querySelector('button#db_clear');
const showMeshCheck = document.querySelector('input#show_mesh');

const dbCountSpan = document.querySelector('span#db_count');
const input = document.querySelector('input');
let state = 'not started';
let db, facesTable;    // database holder

const urlParams = new URLSearchParams(window.location.search);
const sourceTab = parseInt(urlParams.get('source'));

function log(...messages) {
    console.log(`🏋️ `, ...messages);
    /*
        if (messages.length > 1 || typeof messages[0] === 'object')
            console.log(`🏋️ ️${JSON.stringify(...messages)}`);
        else
            console.log(`🏋️ ️`, ...messages);
     */

}

/*
 * database
 */

async function startDb() {

    // create the db if it doesn't exist
    const schemaBuilder = lf.schema.create('videoCallHelper', 1);

    schemaBuilder.createTable('faces')
        .addColumn('id', lf.Type.INTEGER)
        .addColumn('source', lf.Type.STRING)
        .addColumn('date', lf.Type.DATE_TIME)
        .addColumn('class', lf.Type.STRING)
        .addColumn('image', lf.Type.OBJECT)
        .addColumn('multiFaceLandmarks', lf.Type.OBJECT)
        .addPrimaryKey(['id'], true)
        .addIndex('idxDate', ['date'], true, lf.Order.DESC);

    // test getting data from it
    db = await schemaBuilder.connect();
    window.db = db;

    facesTable = db.getSchema().table('faces')
    /*
    .catch(err=>{
    if(err.code === 101)
        console.log("faces database does not exist")
});
     */

    // return todoDb.select().from(item).where(item.done.eq(false)).exec();

    await updateDbRows();
}

async function updateDbRows() {
    // ToDo: there is probably a better way to get a row count here
    const rows = await db.select().from(facesTable).exec();
    dbCountSpan.textContent = rows.length.toString();
}

async function clearDb() {
    if (window.confirm(`Are you sure you want to clear the database?`))
        db.delete().from(facesTable).exec();  // Delete everything in infoCard
    await updateDbRows();
}

startDb().catch(err => console.error(err));

async function showDb() {

    trainingDiv.innerHTML = null;
    // trainingDiv.hidden = true;

    // ToDo: sorting not working consistently
    //facesTable.source, facesTable.date, facesTable.image, facesTable.multiFaceLandmarks
    const rows = await db.select()
        .from(facesTable)
        .orderBy(facesTable.id, lf.Order.ASC)
        .exec();

    // log(Date.now())
    // let promises = [];
    //await rows.forEach( row => {
    for (const row of rows) {
        const data = {
            id: row.id,
            source: row.source,
            date: row.date,
            imgClass: row.class,
            image: row.image,
            faceMesh: row.multiFaceLandmarks
        }

        await showImage(data, showMeshCheck.checked)
        // promises.push( showImage(data, showMeshCheck.checked) );
    }

    // await Promise.all(promises);
    // log(Date.now())
    // trainingDiv.hidden = false;

    const radios = document.querySelectorAll('input.training_radio');
    radios.forEach(radio => {
        radio.onclick = (e) => {
            const value = e.target.value;
            const id = e.target.dataset.imageId;
            /*
            const notValue = value === 'correct' ? 'incorrect' : 'correct';
            // e.target.checked = true;

            log(`selected: ${value}-${id}`);
            const selector = `#radio-${notValue}-${id}`;
            const notTarget = document.querySelector(selector);
            notTarget.checked = false;
             */

            db.update(facesTable)
                .set(facesTable.class, value)
                .where(facesTable.id.eq(id))
                .exec()
        }
    });
}

async function showImage(data, showConnector = false) {
    const parentDiv = document.createElement("div");
    const imageDiv = document.createElement("div");
    const infoDiv = document.createElement("div");

    const {id, source, date, imgClass, image, faceMesh} = data;
    parentDiv.classList.add('training');

    const textSpan = document.createElement("span");
    textSpan.innerText = `${source}\n` +
        `${new Date(date).toLocaleString()}\n` +
        `${faceMesh[0].length} facial landmarks`;
    infoDiv.appendChild(textSpan);

    // log(`${data.id}. correct: ${data.class}`);

    infoDiv.innerHTML += `<br><span>class: ${imgClass === "" ? "not set" : imgClass}</span>` +
        `<br><input type="radio" id="radio-correct-${id}" name="radio-${id}" value="correct" class="training_radio" ` +
            `data-image-id="${id}" ${imgClass==='correct' ? "checked" : ""}>` +
        `<label for="radio-${date}">Correct</label>` +
        `<br><input type="radio" id="radio-incorrect-${id}" name="radio-${id}" value="incorrect" class="training_radio" ` +
            `data-image-id="${id}" ${imgClass==='incorrect' ? "checked" : ""}>` +
        `<label for="radio-incorrect-${date}">Incorrect</label>`;

    // Display the image
    const imageBlob = image;
    const canvasElement = document.createElement("canvas");
    const ctx = canvasElement.getContext('2d');

    const img = new Image();
    img.src = URL.createObjectURL(imageBlob);
    await img.decode();

    canvasElement.width = img.width;
    canvasElement.height = img.height;
    ctx.drawImage(img, 0, 0);

    if (showConnector) {

        const THIN_LINE = 1;
        const GREY_CONNECTOR = {color: '#C0C0C070', lineWidth: THIN_LINE};
        const WHITE_CONNECTOR = {color: '#E0E0E0', lineWidth: THIN_LINE};
        const RED_CONNECTOR = {color: '#FF3030', lineWidth: THIN_LINE};

        const landmarks = data.faceMesh[0];
        window.landmarks = landmarks;
        // log(landmarks);

        drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, GREY_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, WHITE_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYEBROW, WHITE_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_RIGHT_IRIS, RED_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, WHITE_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYEBROW, WHITE_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_LEFT_IRIS, RED_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_FACE_OVAL, WHITE_CONNECTOR);
        drawConnectors(ctx, landmarks, FACEMESH_LIPS, WHITE_CONNECTOR);
    }

    imageDiv.appendChild(canvasElement);

    parentDiv.appendChild(imageDiv);
    parentDiv.appendChild(infoDiv);
    trainingDiv.prepend(parentDiv);

}

function sendMessage(to, message, data, responseHandler) {

    log(`sending "${message}" to ${to} with data: ${JSON.stringify(data)}`);

    try {
        const messageToSend = {
            from: "training",
            to: to,
            message: message,
            data: data
        };

        if (to === 'background' || to === 'all')
            chrome.runtime.sendMessage(messageToSend, responseHandler);
        if (to === 'tab' || to === 'all')
            chrome.tabs.sendMessage(sourceTab, messageToSend, responseHandler)
    } catch (err) {
        console.error(err);
    }
}

// Test if this works
chrome.runtime.onMessage.addListener(
    async (request, sender) => {
        const {to, from, message, data} = request;
        if (to !== 'training')
            return;

        log(`incoming "${message}" message from ${from} to ${to} with data: `, data);

        if (message === 'image') {
            const imageBlob = await fetch(data.blobUrl).then(response => response.blob());
            data.image = imageBlob;
            await showImage(data, showMeshCheck.checked)

            const row = facesTable.createRow({
                'source': data.source,
                'date': new Date(data.date),
                'class': "",
                'image': imageBlob,
                'multiFaceLandmarks': data.faceMesh
            });

            await db.insertOrReplace().into(facesTable).values([row]).exec();
            await updateDbRows();
        }
    }
);

/*
 * UI Handlers
 */
// send new data to tab everytime the input changes
input.oninput = () => {
    const sendImagesInterval = input.value * 1000 || Infinity;
    sendMessage('tab', 'update_train_interval', {sendImagesInterval})
}

getImagesBtn.onclick = () => {
    const sendImagesInterval = input.value * 1000 || Infinity;

    // not started to running
    if (state === 'not started') {
        state = 'running';
        getImagesBtn.innerText = "Pause";
        sendMessage('tab', 'train_start', {sendImagesInterval});
    }
    // running to paused
    else if (state === 'running') {
        state = 'paused';
        getImagesBtn.innerText = "Start";
        sendMessage('tab', 'train_stop');
    }
    // paused to running
    else if (state === 'paused') {
        state = 'running';
        getImagesBtn.innerText = "Pause";
        sendMessage('tab', 'update_train_interval', {sendImagesInterval});
    } else {
        console.error(`You messed up! state: ${state}`)
    }
};

clearDbBtn.onclick = () => clearDb();
showDbBtn.onclick = () => showDb();
showMeshCheck.onclick = () => showDb();

// send the tab id
chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    const currentTabId = tabs[0].id;
    sendMessage('background', 'training_tab_id', {id: currentTabId});
});


log("training script");
