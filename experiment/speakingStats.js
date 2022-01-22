
// Dedupe events that are the same
function dedupe(events, timeTolerance = 100){
        const notDupes = [];
        let dupeCount = 0;
        let lastEvent = {message: null, ts: null, data: null};

        for(const e in events){
            const event = events[e];
            const lastEventDelta = Math.abs(event.ts - lastEvent.ts);
            const dataTheSame = JSON.stringify(event.data) === JSON.stringify(lastEvent.data);
            const dupe = event.message === lastEvent.message && dataTheSame && lastEventDelta < timeTolerance;
            lastEvent = event;
            if (dupe) {
                // console.log("repeat", lastEventDelta, event);
                dupeCount++;
            }
            else{
                notDupes.push(event)
            }
        }

        console.log("dupes", dupeCount);
        return notDupes;
}

async function formatForDisplay(events) {
    const localLevels = [];
    const remoteLevels = [];
    let localTrackEvents = [];
    let remoteTrackEvents = [];

    events.forEach(event => {

        // segment into local, remote, and events
        const datetime = new Date(event.ts).toLocaleTimeString();
        if (event.message === 'local_audio_level') {
            const audioLevelData = {timeString: datetime, ts: event.ts, level: event.data.audioLevel};
            localLevels.push(audioLevelData)
            // console.log(datetime, event.message, event.data.audioLevel)
        } else if (event.message === 'remote_audio_level') {
            const audioLevelData = {
                timeString: datetime,
                ts: event.ts,
                level: event.data.audioLevel,
                source: event.data.source
            };
            remoteLevels.push(audioLevelData)
            // console.log(datetime, event.message, event.data.audioLevel)
        } else {
            const eventData = {
                timeString: datetime,
                ts: event.ts,
                message: event.message,
                kind: event.data.kind || event.data?.trackData?.kind || null,
                id: event.data.id || event.data?.trackData?.id || null
            }
            // trackEvents.push(eventData)
            // gum_track_added, local_track_added, local_track_mute

            const local_events = ["gum_track_added", "local_track_added", "local_track_mute", "local_track_unmute", "local_track_ended"];
            const remote_events = ["remote_track_added", "remote_track_mute", "remote_track_unmute", "remote_track_ended", "peerconnection_closed"];

            if (local_events.includes(event.message))
                localTrackEvents.push(eventData);
            else if (remote_events.includes(event.message))
                remoteTrackEvents.push(eventData);
            else
                console.error(`unprocesed event: ${event.message}`, eventData);
        }
    });

    // ToDo: min threshold needs calibration
    async function getLevels(audioLevelArray = [], label = "", MIN_THRESHOLD = 0.05) {
        const returnArray = [];
        let lastSampleSpeaking = false;
        let sampleCount = 0;
        let avgAudioLevel = 0;
        let lastStart = {};

        // Get thresholds based on the input
        const levels = audioLevelArray.map(e => e.level);
        const lowerThreshold = Math.max(...levels) * MIN_THRESHOLD;


        //for( const [key, value] in Object.entries(localLevels) ){ console.log(localLevels[key])};

        for (const n in audioLevelArray) {
            //audioLevelArray.forEach(value => {
            const value = audioLevelArray[n];
            // console.log(value);

            const {timeString, ts, level} = value

            // console.log(timeString, level >= localThreshold);
            if (level >= lowerThreshold) {
                // console.log("speaking");
                sampleCount++;
                avgAudioLevel += level;
                if (!lastSampleSpeaking) {
                    lastStart = value;
                }
                lastSampleSpeaking = true;

            } else if (level < lowerThreshold) {
                if (lastSampleSpeaking && sampleCount > 1) {
                    const interval = {
                        start: lastStart,
                        stop: value,
                        sampleCount: sampleCount,
                        avgAudioLevel: avgAudioLevel / sampleCount,
                        label: label
                    }

                    returnArray.push(interval);
                    // console.log("start:", lastStart.timeString)
                    // console.log("stop:", timeString)
                }
                sampleCount = 0;
                avgAudioLevel = 0;
                lastSampleSpeaking = false;
            }

        }

        return returnArray;
    }

    const localSpeakingIntervals = await getLevels(localLevels, "local");
    // console.log("local levels: ", JSON.stringify(localSpeakingIntervals));

    const remoteSpeakingIntervals = await getLevels(remoteLevels, "remote");
    // console.log("remote levels: ", JSON.stringify(remoteSpeakingIntervals));

    // Dedupe and extract track events
    // ToDo: better dedupe; need to include ts

    function dedupeTrackEvents(eventArray){
        const s = new Set(eventArray.filter(e => e.kind === 'audio').map(e => {
            const {timeString, ts, message, kind} = e;
            return JSON.stringify({timeString, ts, message, kind})
        }));
        return [...s].map(v => JSON.parse(v))
    }

    // console.log(`localTrackEvents before dedupe: ${localTrackEvents.length}`);
    // console.log(`remoteTrackEvents before dedupe: ${remoteTrackEvents.length}`);

    localTrackEvents = dedupeTrackEvents(localTrackEvents);
    remoteTrackEvents = dedupeTrackEvents(remoteTrackEvents);

    // console.log(`localTrackEvents after dedupe: ${localTrackEvents.length}`);
    // console.log(`remoteTrackEvents after dedupe: ${remoteTrackEvents.length}`);

    function addStopTime(trackEventArray) {
        return trackEventArray.map(event => {
            const {ts, message, kind, id} = event;
            const fakeTs = ts + 1000;
            return {
                start: event,
                stop: {
                    timeString: new Date(fakeTs).toLocaleTimeString(),
                    ts: fakeTs,
                    message: message,
                    kind: kind,
                    id: id
                }
            }
        })
    }

    localTrackEvents = addStopTime(localTrackEvents);
    remoteTrackEvents = addStopTime(remoteTrackEvents);
    // console.log("intervals: ", {localTrackEvents}, {remoteTrackEvents});

    return {localSpeakingIntervals, remoteSpeakingIntervals, localTrackEvents, remoteTrackEvents};

}

function plot(data){
    /*
*  Plotly setup
*/

    const chart = document.getElementById('chart');

    let localLevelsSeries = {
        x: [],
        y: [],
        type: 'histogram',
        name: 'local',
        opacity: 0.5,
        histfunc: "sum",
        autobinx: true,
    };

    let remoteLevelsSeries = {
        x: [],
        y: [],
        type: 'histogram',
        name: 'remote',
        opacity: 0.5,
        histfunc: "sum",
        autobinx: true

    };


    let layout = {
        grid: {rows: 2, columns: 1, pattern: 'independent'},
        xaxis: {
            autorange: true,
            fixedrange: false,
            showgrid: true,
            type: 'time'
        },
        yaxis: {
            autorange: true,
            showgrid: true,
            title: 'AudioLevels',
            range: [0],

        },
        barmode: 'overlay',
        margin: {t: 0}
    };


    // Doesn't work
    /*
    const myChart = TimelinesChart();
    const data = [{
        group: "local",
        data: localSpeakingIntervals.map(e=>{
            return {
                timeRange:  [new Date(e.start.ts), new Date(e.stop.ts)],
                val: 'speaking'
            }

        })
    }]

    console.log(data);
    myChart.data(data)(chart);
     */

    // https://stackoverflow.com/questions/44133677/plotly-create-horizontal-timeline
    /*
    const layout = {
        height: 300,
        yaxis: {
            showgrid: false,
            zeroline: false,
            showline: false,
            showticklabels: false
        },
        //  xaxis: {type: "time"}
    };

     */


    /*
    Plotly.plot('chart', [{
        type: 'scatter',
        x: ["10:05:23 AM", "10:05:27 AM"],
        y: [1, 1],
        line: {width: 30},
    },
        {
            type: 'scatter',
            x: ["10:05:38 AM", "10:05:44 AM"],
            y: [1, 1],
            line: {width: 30},
        }

    ], layout)

     */


    /*

            Plotly.plot('chart', [{
                type: 'bar',
                x: ["10:05:23 AM", "10:05:27 AM", "10:05:53 AM"],
                y: [0, 0, 0],
                // line: {width: 30},
                orientation: 'h',
                base: [4,26,0]

            }], {xaxis:{type:"time"}})


     */
}

function speakingStats(locals, remotes, granularity = 1000){
    const intervals = locals.concat(remotes);
    window.intervals = intervals;
    // console.log(intervals);
    let startTime = Math.min(...intervals.map(i=>i.start.ts));
    let endTime = Math.max(...intervals.map(i=>i.stop.ts));
    startTime = Math.floor(startTime/granularity)*granularity;
    endTime = Math.ceil(endTime/granularity)*granularity;
    // console.log(new Date(startTime).toLocaleTimeString(), new Date(endTime).toLocaleTimeString());
    // console.log(startTime, endTime);
    // console.log( (endTime-startTime)/granularity );

    const stats = [];

    let currTime = startTime;
    while(currTime<endTime){
        const currTimeStop = currTime + granularity;
        /*
        const localSpeaking = locals.reduce((p,c)=> {
            const s = currTime >= c.start.ts && currTimeStop < c.stop.ts;
            //console.log(`start: ${c.start.ts}, current: ${currTime}, stop: ${c.stop.ts}`, s);
            return s || p
        }, false );
        console.log(`${new Date(currTime).toLocaleTimeString()}: ${localSpeaking}`);

         */
        const localSpeaking = locals.reduce((p,c)=> (currTime >= c.start.ts && currTimeStop < c.stop.ts) || p, false);
        const remoteSpeaking = remotes.reduce((p,c)=> (currTime >= c.start.ts && currTimeStop < c.stop.ts) || p, false);

        const stat = {
            local: localSpeaking,
            remote: remoteSpeaking,
            overTalk: localSpeaking && remoteSpeaking,
            silent: (localSpeaking || remoteSpeaking) === false
        }
        stats.push(stat);

        // console.log(localSpeaking);
        currTime+=granularity;
    }

    console.log(stats);

    const localPct = stats.reduce( (p,c)=>c.local+p, 0) / stats.length;
    const remotePct = stats.reduce( (p,c)=>c.remote+p, 0) / stats.length;
    const overTalkPct = stats.reduce( (p,c)=>c.overTalk+p, 0) / stats.length;
    const silentPct = stats.reduce( (p,c)=>c.silent+p, 0) / stats.length;


    console.assert(localPct+remotePct+overTalkPct+silentPct === 1);

    return {localPct, remotePct, overTalkPct, silentPct};

}

async function main(){
    const response = await fetch("events.json");
    const events = await response.json();
    window.events = events;
    console.log("number of raw events: ", events.length);
    const uniqEvents = dedupe(events);
    console.log("number of unique events: ", uniqEvents.length);
    const displayData = await formatForDisplay(uniqEvents);
    const {localSpeakingIntervals, remoteSpeakingIntervals, localTrackEvents, remoteTrackEvents} = displayData;
    // console.log(JSON.stringify(displayData));

    //console.log();

    const stats = speakingStats(localSpeakingIntervals, remoteSpeakingIntervals, 100);
    console.log(stats);

}

main().catch(err=>console.error(err));
