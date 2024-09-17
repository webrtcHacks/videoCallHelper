import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";
const mh = new MessageHandler(c.CONTENT);
const storage = await new StorageHandler();
// const debug = process.env.NODE_ENV === 'development' ? Function.prototype.bind.call(console.info, console, `🫥🛤`) : ()=>{};
// const debug = window.vch.debug ? Function.prototype.bind.call(console.info, console, `🫥🛤`) : ()=>{};
const debug = Function.prototype.bind.call(console.info, console, `🫥🛤`);
const TRACK_CHECK_INTERVAL = 2000;  // hwo often to check tracks in ms

/**
 * Monitor a track and send messages when status changes  to the background script
 * @param track - the track to monitor
 * @param streamId - the id of the stream the track is on
 * @returns {Promise<void>}
 */
async function monitorTrack(track, streamId) {
    if(!window.vch.tabId){
        debug("ERROR - failed to monitor track because tabId is missing");
        return
    }
    // debug(`new ${track.kind} track on stream ${streamId} with settings: `, track);
    const {id, kind, label, readyState} = track;
    const newTrackData = {
        id,
        kind,
        label,
        readyState: readyState,
        streamId,
        sourceUrl: window.location.href,            // To help with debugging
        time: new Date().toLocaleString(),
        settings: track.getSettings(),
        tabId: window.vch.tabId
    }

    if (track.readyState === 'live') {
        const trackDataArray = await storage.contents.trackData || [];
        if (trackDataArray.some(td => td.id === newTrackData.id)) {
            debug(`track ${id} already in trackData array`);
            return
        }
        trackDataArray.push(newTrackData);
        await storage.set('trackData', trackDataArray);
        // await mh.sendMessage(c.BACKGROUND, m.NEW_TRACK, newTrackData);
        debug(`added ${newTrackData.id} to trackData array`, trackDataArray);
    }

    // Note: this only fires if the browser forces the track to stop; not for most user actions
    track.addEventListener('ended', async () => {

        const newTrackDataArray = storage.contents.trackData.filter(td => td.id !== id);
        await storage.set('trackData', newTrackDataArray);
        // await mh.sendMessage(c.BACKGROUND, m.TRACK_ENDED, {id: track.id});
        debug(`track ${id} removed. Remaining tracks:`, storage.contents.trackData);
    });

    // use an interval to check if the track has ended
    const monitor = setInterval(async () => {
        if (track.readyState === 'ended') {
            // await mh.sendMessage(c.BACKGROUND, m.TRACK_ENDED, {id: track.id});
            const newTrackDataArray = storage.contents.trackData.filter(td => td.id !== id);
            await storage.set('trackData', newTrackDataArray);
            debug(`track ${id} removed.`);
            clearInterval(monitor);
        }
    }, TRACK_CHECK_INTERVAL);

    // Removed MUTE events - OBS making these  go on and off
}

/**
 * Listen for the start of a gUM stream from inject js and start monitoring its tracks
 */
mh.addListener(m.GUM_STREAM_START, async (data) => {
    const video = document.querySelector(`video#${data.id}`);
    const origStream = video.srcObject;
    origStream.getTracks().forEach(track => monitorTrack(track, origStream.id));

    // events
    origStream.addEventListener('addtrack', async (event) => {
        await monitorTrack(event.track, origStream.id);
    });

    origStream.addEventListener('removetrack', async (event) => {
        const newTrackDataArray = storage.contents.trackData.filter(td => td.id !== event.track.id);
        await storage.set('trackData', newTrackDataArray);
        debug(`track ${event.track.id} removed.`);
    });

    origStream.addEventListener('inactive', async (event) => {
        const newTrackDataArray = storage.contents.trackData.filter(td => td.streamId !== origStream.id);
        await storage.set('trackData', newTrackDataArray);
        debug(`stream ${origStream.id} inactive`);
    });

});

/**
 * Listen for the stop of a gUM stream from inject js and stop monitoring its tracks
 */
mh.addListener(m.GUM_STREAM_STOP, async (data) => {
    const newTrackDataArray = storage.contents.trackData.filter(td => td.streamId !== data.id);
    await storage.set('trackData', newTrackDataArray);
    debug(`stream ${data.id} stopped`);
});

/**
 * TODO: Listen for track cloning events from inject js and start monitoring the new track
 */
mh.addListener(m.CLONE_TRACK, async (data) => {
    // await monitorTrack(newTrack, `cloned-${data.track.id}`);
    debug(`TODO: cloned track ${data.track.id} nog being monitored in trackData`);
});
