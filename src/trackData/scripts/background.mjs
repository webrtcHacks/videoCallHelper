import {MESSAGE as m, CONTEXT as c, MessageHandler} from "../../modules/messageHandler.mjs";
import {StorageHandler} from "../../modules/storageHandler.mjs";
import {settings as trackDataSettingsProto} from "../../trackData/scripts/settings.mjs";    // just an empty array
self.VERBOSE = true;

const debug = Function.prototype.bind.call(console.log, console, `🫥🎼`);
const storage = await new StorageHandler();
const mh = new MessageHandler(c.BACKGROUND);

await StorageHandler.initStorage('trackData', trackDataSettingsProto);

/**
 * Remove all trackData items that match the tabId from storage
 * @param tabId
 * @returns {Promise<void>}
 */
async function removeTabTracks(tabId) {
    const newTrackData = await storage.contents.trackData.filter(td => td.tabId !== tabId);
    await storage.set('trackData', newTrackData);
    if (self.VERBOSE) debug(`handleTabRemoved: ${tabId}. trackData storage:`, newTrackData);
}


mh.addListener(m.NEW_TRACK, async (newTrackData) => {
    debug(`Received new track data`, newTrackData);

    const trackDataArray = await storage.contents.trackData || [];
    if (trackDataArray.some(td => td.id === newTrackData.id)) {
        if (self.VERBOSE) debug(`track ${id} already in trackData array`);
        return
    }
    trackDataArray.push(newTrackData);
    await storage.set('trackData', trackDataArray);
    if (self.VERBOSE) debug(`added ${newTrackData.id} to trackData array`, trackDataArray);
});


mh.addListener(m.TRACK_ENDED, async (message) => {
    const trackId = message.id;
    const trackDataArray = storage.contents.trackData || [];
    const newTrackDataArray = trackDataArray.filter(td => td.id !== trackId);
    await storage.set('trackData', newTrackDataArray);
    if (self.VERBOSE) debug(`track ${trackId} removed. Remaining tracks`, storage.contents.trackData);
});

/**
 * Tab event listeners
 */

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    await removeTabTracks(tabId);
});

chrome.tabs.onReplaced.addListener(async (tabId, removeInfo) => {
    await removeTabTracks(tabId);
});

// Don't reset storage on start-up since background can restart
// await storage.set('trackData', []);

/**
 *  On start-up - remove any trackData items where the tabId no longer exists
*/

const trackDataArray = await storage.contents.trackData || [];
const currentTabs = await chrome.tabs.query({});
const currentTabIds = currentTabs.map(tab => tab.id);
const newTrackDataArray = trackDataArray.filter(td => currentTabIds.includes(td.tabId));
await storage.set('trackData', newTrackDataArray);

if(newTrackDataArray.length > 0)
    debug(`trackData on background start-up`, newTrackDataArray);
