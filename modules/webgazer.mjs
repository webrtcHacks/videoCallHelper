// import webgazer from '../node_modules/webgazer/dist/webgazer.min.js'

// window.webgazer = webgazer;

let started = false;
const guide = document.getElementById("guide");
const stats = document.getElementById("stats");
const statusText = document.getElementById("status");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");

// ToDo: check for viewport size change
let maxViewport = {};

function eyetracker() {
//    webgazer.setRegression('weightedRidge')

    webgazer.showPredictionPoints(true)
    webgazer.params.showVideoPreview = true;

    webgazer
        .setGazeListener((data, elapsedTime) => {
            if (data == null) {
                return;
            }

            let xPct = (100.0 * data.x / window.innerWidth).toFixed(0);
            let yPct = (100.0 * data.y / window.innerHeight).toFixed(0);
            // console.log(`x: ${data.x}, y: ${data.y}`);
            stats.innerText =
                `Coordinates: ( ${data.x.toFixed(0)}, ${data.y.toFixed(0)} )\n` +
                `Percent:     ( ${xPct}%, ${yPct}% )\n` +
                `Viewport:    ( ${window.innerWidth}, ${window.innerHeight} )\n`;

            if (xPct < 60 && xPct > 40 && yPct < 20) {
                guide.style.color = "green";
                statusText.innerText = "Keep looking here";
            } else {
                guide.style.color = "red";
                statusText.innerText = "You are not looking at the camera";
            }

        })
        .begin();

    started = true;
}

startButton.addEventListener("click", () => {
    document.documentElement.requestFullscreen().catch(e => console.error(e));

    // ToDo: stop button isn't showing; style.display & style.visibility didn't work
    startButton.hidden = true;
    stopButton.hidden = false;

    if (!started) {
        console.log("starting");
        statusText.innerText = "It may take a minute to self-train before loading";
        eyetracker();
    } else {
        console.log("resuming");
        webgazer.resume();
    }
});


stopButton.addEventListener("click", () => {
    console.log("stopping");
    document.exitFullscreen().catch(e => console.error(e));
    startButton.hidden = false;
    stopButton.hidden = true;
    webgazer.pause();
});
