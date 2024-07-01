import {WorkerMessageHandler, MESSAGE as m} from "../../modules/messageHandler.mjs";

const wmh = new WorkerMessageHandler();
const debug = Function.prototype.bind.call(console.debug, console, `vch 👷🎥${self.name} `);

/**
 * Set up the transform on start
 */
wmh.addListener(m.PLAYER_START, async (data) => {
    const playerReader = data.reader.getReader();

    /**
     * Drop the incoming frame and replace it with the player frame
     * @param frame
     * @returns {Promise<*>}
     */
    async function playerTransform(frame) {
        const {done, value: playerFrame} = await playerReader.read();
        if (done) {
            debug("playerTransform done");
            return frame;
        }

        frame.close();
        return playerFrame
    }

    transformManager.add("player", playerTransform);

});

/**
 * Remove the transform on stop
 */
wmh.addListener(m.PLAYER_STOP, async (data) => {
    debug(`player stop`, data);
    transformManager.remove("player");
});
