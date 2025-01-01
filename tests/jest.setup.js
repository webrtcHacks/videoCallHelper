// jest.setup.js
import { jest } from '@jest/globals';

// Mock the Chrome APIs
global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn(),
        },
        getURL: jest.fn((path) => `chrome-extension://extension-id${path}`),
    },
    tabs: {
        create: jest.fn(),
        query: jest.fn(),
    },
    // Add other APIs as needed
};

// Mock document.addEventListener
document.addEventListener = jest.fn();

// Add any other global setup or configuration here
global.CustomEvent = class CustomEvent {
    constructor(type, params) {
        this.type = type;
        this.detail = params.detail;
    }
};
