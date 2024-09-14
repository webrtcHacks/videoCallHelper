import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";
const mh = new MessageHandler(c.CONTENT);

/**
 * Monitor a track and send messages when status changes  to the background script
 * @param track - the track to monitor
 * @param streamId - the id of the stream the track is on
 * @returns {Promise<void>}
 */
async function monitorTrack(track, streamId) {
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
        settings: track.getSettings()
    }

    if (track.readyState === 'live')
        await mh.sendMessage(c.BACKGROUND, m.NEW_TRACK, newTrackData);

    // Note: this only fires if the browser forces the track to stop; not for most user actions
    track.addEventListener('ended', async () => {
        await mh.sendMessage(c.BACKGROUND, m.TRACK_ENDED, {id: track.id});
        // await checkActiveStreams();
    });

    // ToDo: should I use this monitor function?
    // use an interval to check if the track has ended
    const monitor = setInterval(async () => {
        if (track.readyState === 'ended') {
            await mh.sendMessage(c.BACKGROUND, m.TRACK_ENDED, {id: track.id});
            clearInterval(monitor);
        }
    }, 2000);

    // Removed MUTE events - OBS making these  go on and off
}

/**
 * Listen for the start of a gUM stream from inject js and start monitoring its tracks
 */
mh.addListener(m.GUM_STREAM_START, async (data) => {
    const video = document.querySelector(`video#${data.id}`);
    const origStream = video.srcObject;
    origStream.getTracks().forEach(track => monitorTrack(track, origStream.id));
});
