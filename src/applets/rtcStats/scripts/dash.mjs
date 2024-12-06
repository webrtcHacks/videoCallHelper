import {debug, mh, m} from "../../../dash/dashCommon.mjs";

const tabId = await new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            resolve(tabs[0].id);
        }
        else
            reject("ERROR: No active tab found");
    });
});

mh.addListener(m.RTC_STATS_UPDATE, async data => {
    debug("rtcStats", data);
    // Ignore stats from other tabs
    if(data.tabId !== tabId) return;

    // Only show stats for the currently displayed page
    const trackStatsArray = data.trackStats;
    const rtcStatsImagesDiv = document.getElementById('rtc-stats-images');

    trackStatsArray.forEach((trackStats, index) => {
        let container = rtcStatsImagesDiv.children[index];
        if (!container) {
            container = document.createElement('div');
            container.classList.add('track-stats-container', 'm-2');
            rtcStatsImagesDiv.appendChild(container);
        }

        let layerOutput = "";
        if(trackStats?.layerInfo)
            trackStats.layerInfo?.forEach(layer => {
                layerOutput += `<span class="small">${layer.layerId}: ${layer.width}x${layer.height}p${layer.fps}@${layer.bitrateKbps}</span><br>`;
            });

        // <img src="data:image/jpeg;base64,${trackStats?.image}" class="img-thumbnail h-100 position-absolute" alt="">
        container.innerHTML = `
<div class="track-stats-info position-relative z-1 bg-dark text-white" style="background-color: rgba(10,10, 10, 0.8);">
                <span>${trackStats.direction}: ${trackStats.trackId.substring(0, 8)}</span><br>
                <span>${trackStats?.codec}</span>@${trackStats.bitrateKbps} kbps<br>
                ${layerOutput}
                <span>RTT: ${(trackStats.roundTripTimeInS / 1000)?.toFixed(0)}, 
                Loss: ${(trackStats.fractionLoss * 100).toFixed(0)}%</span><br>
            </div>
        `;

        const trackImageObj = data.images.find(item => item.trackId === trackStats.trackId);

        if (trackImageObj) {
            let img = container.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.classList.add('img-thumbnail', 'position-absolute', 'z-0', 'h-100');
                container.prepend(img);
            }
            img.src = `data:image/jpeg;base64,${trackImageObj.image}`;
        }

    });

    // Remove any extra containers if trackStatsArray is shorter than rtcStatsImagesDiv children
    while (rtcStatsImagesDiv.children.length > trackStatsArray.length) {
        rtcStatsImagesDiv.removeChild(rtcStatsImagesDiv.lastChild);
    }
});
