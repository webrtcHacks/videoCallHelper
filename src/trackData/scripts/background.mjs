import {StorageHandler} from "../../modules/storageHandler.mjs";
import {settings as trackDataSettingsProto} from "../../trackData/scripts/settings.mjs";    // just an empty array

const VERBOSE = true;
const debug = VERBOSE ? Function.prototype.bind.call(console.log, console, `🫥🛤`) : ()=>{};
const storage = await new StorageHandler(debug);

/**
 * Remove all trackData items that match the tabId from storage
 * @param tabId - the tabId to remove
 * @param change - optional string for debugging
 * @returns {Promise<void>}
 */
async function removeTabTracks(tabId, change = "") {
    const newTrackData = await storage.contents.trackData.filter(td => td.tabId !== tabId);
    await storage.set('trackData', newTrackData);
    debug(`tab ${change} - checking tracks on ${tabId}. trackData storage:`, newTrackData);
}


/**
 * Tab event listeners
 */

chrome.tabs.onRemoved.addListener(async (tabId) => {
    await removeTabTracks(tabId, "removed");
});

chrome.tabs.onReplaced.addListener(async (tabId) => {
    await removeTabTracks(tabId, "replaced");
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete')
        await removeTabTracks(tabId, "refreshed");
    // else debug(`tab ${tabId} updated with status: ${changeInfo.status}`);

});

/**
 *  On start-up - remove any trackData items where the tabId no longer exists
*/

await StorageHandler.initStorage('trackData', trackDataSettingsProto);

const trackDataArray = await storage.contents.trackData || [];
const currentTabs = await chrome.tabs.query({});
const currentTabIds = currentTabs.map(tab => tab.id);
const newTrackDataArray = trackDataArray.filter(td => currentTabIds.includes(td.tabId));
await storage.set('trackData', newTrackDataArray);

if(newTrackDataArray.length > 0)
    debug(`trackData on background start-up`, newTrackDataArray);
