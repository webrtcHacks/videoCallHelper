export default {
    // https://github.com/puppeteer/puppeteer/issues/10976#issuecomment-2068728993
    // testEnvironment: "jest-environment-jsdom",
    transform: {}, // Disable transformations
    testMatch: ["**/__tests__/**/*.mjs", "**/?(*.)+(test).mjs"],
    setupFilesAfterEnv: ['./tests/jest.setup.js'],
    preset: "jest-puppeteer"
};
