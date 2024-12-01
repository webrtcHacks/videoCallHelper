import {debug, storage, mh, m, c} from "../../../dash/dashCommon.mjs";

mh.addListener(m.RTC_STATS_UPDATE, async data => {
    debug("rtcStats", data);

    const trackStatsArray = data.trackStats;
    const rtcStatsImagesDiv = document.getElementById('rtc-stats-images');

    trackStatsArray.forEach((trackStats, index) => {
        let container = rtcStatsImagesDiv.children[index];
        if (!container) {
            container = document.createElement('div');
            container.classList.add('track-stats-container', 'm-2');
            rtcStatsImagesDiv.appendChild(container);
        }

        // <img src="data:image/jpeg;base64,${trackStats?.image}" class="img-thumbnail h-100 position-absolute" alt="">
        container.innerHTML = `
<div class="track-stats-info position-relative z-1 bg-dark text-white" style="background-color: rgba(10,10, 10, 0.8);">
                <span>${trackStats.direction}: ${trackStats.trackId.substring(0, 8)}</span><br>
                <span>${trackStats.codec}</span><br>
                <span>RTT / loss: ${(trackStats.roundTripTimeInS / 1000).toFixed(0)} / ${(trackStats.fractionLoss * 100).toFixed(0)}%</span><br>
                <span>Bitrate: ${trackStats.bitrateKbps.toFixed(0)} kbps</span>
            </div>
        `;

        if (trackStats.image) {
            // ToDo: debug from here
            debug("trackStats.image", trackStats);
            let img = container.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.classList.add('img-thumbnail', 'position-absolute', 'z-0', 'h-100');
                container.prepend(img);
            }
            img.src = `data:image/jpeg;base64,${trackStats.image}`;
        }

    });

    // Remove any extra containers if trackStatsArray is shorter than rtcStatsImagesDiv children
    while (rtcStatsImagesDiv.children.length > trackStatsArray.length) {
        rtcStatsImagesDiv.removeChild(rtcStatsImagesDiv.lastChild);
    }
});
