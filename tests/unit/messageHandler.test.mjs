import { jest } from '@jest/globals';
import { MessageHandler, CONTEXT, MESSAGE } from '../../src/modules/messageHandler.mjs';

global.CustomEvent = class CustomEvent {
    constructor(type, params) {
        this.type = type;
        this.detail = params.detail;
    }
};

describe('MessageHandler', () => {
    let messageHandler;

    beforeEach(() => {
        jest.clearAllMocks();
        messageHandler = new MessageHandler(CONTEXT.CONTENT);

        // Ensure document.addEventListener is mocked
        document.addEventListener = jest.fn();
    });

    test('should enforce singleton behavior', () => {
        const anotherHandler = new MessageHandler(CONTEXT.CONTENT);
        expect(anotherHandler).toBe(messageHandler);
    });

    // finding: very complex mocking would be needed to replicate the Chrome runtime APIs
    /*
     test('should add and invoke listeners', async () => {
        const callback = jest.fn();
        messageHandler.addListener(MESSAGE.PING, callback);

        // Check if addEventListener was called
        // expect messageHandler.#listeners to contain the listener
        // expect(messageHandler.#listeners[MESSAGE.PING]).toContain(callback);

        // expect(document.addEventListener).toHaveBeenCalled();

        const backgroundMh = new MessageHandler(CONTEXT.BACKGROUND);
        await backgroundMh.sendMessage(CONTEXT.CONTENT, MESSAGE.PING, {});

        // expect callback to have been called
        expect(callback).toHaveBeenCalled();
    });

    /*
    test('should remove listeners', () => {
        const callback = jest.fn();
        messageHandler.addListener(MESSAGE.PING, callback);
        messageHandler.removeListener(MESSAGE.PING, callback);

        const mockEvent = { detail: { to: CONTEXT.CONTENT, from: CONTEXT.BACKGROUND, message: MESSAGE.PING, data: {} } };
        const listener = document.addEventListener.mock.calls[0][1];
        listener(mockEvent);

        expect(callback).not.toHaveBeenCalled();
    });

    test('should send a message to inject context', () => {
        const data = { key: 'value' };
        messageHandler.sendMessage(CONTEXT.INJECT, MESSAGE.PING, data);

        expect(document.dispatchEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'vch',
                detail: expect.objectContaining({
                    from: CONTEXT.CONTENT,
                    to: CONTEXT.INJECT,
                    message: MESSAGE.PING,
                    data,
                }),
            })
        );
    });

    test('should send a message to dash context', () => {
        const data = { key: 'value' };
        messageHandler.sendMessage(CONTEXT.DASH, MESSAGE.PING, data);

        expect(window.parent.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                from: CONTEXT.CONTENT,
                to: CONTEXT.DASH,
                message: MESSAGE.PING,
                data,
            }),
            '*'
        );
    });

    test('should handle ping and pong communication', async () => {
        const backgroundHandler = new MessageHandler(CONTEXT.BACKGROUND);
        const mockSendMessage = jest.fn((tabId, message) => {
            return Promise.resolve({ message: MESSAGE.PONG });
        });
        chrome.tabs.sendMessage = mockSendMessage;

        await expect(backgroundHandler.ping(1)).resolves.toBeUndefined();
        expect(mockSendMessage).toHaveBeenCalledWith(1, { message: MESSAGE.PING }, expect.any(Function));
    });

     */
});
