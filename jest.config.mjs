export default {
    testEnvironment: "jest-environment-jsdom",
    transform: {}, // Disable transformations
    testMatch: ["**/__tests__/**/*.mjs", "**/?(*.)+(test).mjs"],
    setupFilesAfterEnv: ['./tests/jest.setup.js'],
};
