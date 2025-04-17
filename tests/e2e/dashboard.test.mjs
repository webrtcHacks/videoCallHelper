import { fileURLToPath } from 'url';
import { dirname } from 'path';
import https from 'https';
import selfsigned from 'selfsigned';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { jest } from '@jest/globals';
import {CONTEXT as c, MESSAGE as m} from '../../src/modules/messageHandler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 8443;
const TEST_PAGE = "gum.html";
const pathToTest = process.env.NODE_ENV === 'production' ?  'extension' : 'dev';
const EXTENSION_PATH = path.resolve(__dirname, `../../dist/${pathToTest}`);
const TEST_URL = `https://localhost:${PORT}/${TEST_PAGE}`;
const PAGE_PATH = path.resolve(__dirname, `../${TEST_PAGE}`);

console.log("Environment: ", process.env.NODE_ENV);

describe('Chrome Extension Dashboard Test', () => {
    let browser, page;
    let server;

    jest.setTimeout(20000);     // 20 seconds for this suite

    beforeAll(async () => {
        // Generate a self-signed certificate
        const pems = selfsigned.generate(null, { days: 1, keySize: 2048 });

        // Start the HTTPS server
        server = https.createServer({
            key: pems.private,
            cert: pems.cert
        }, (req, res) => {
            // Serve the test page
            if (req.url === `/${TEST_PAGE}`) {
                fs.readFile(PAGE_PATH, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end(`Error loading ${TEST_PAGE}`);
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(data);
                    }
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(8443);

        // Launch Puppeteer with the extension loaded
        browser = await puppeteer.launch({
            headless: process.env.NODE_ENV === 'production',
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--ignore-certificate-errors' // Ignore self-signed certificate errors
            ],
            // dumpio: true, // Log browser communication
        });

        // Open a new page
        const pages = await browser.pages();
        page = pages[0];
        await page.goto(TEST_URL);
        await page.setViewport({ width: 1920, height: 1080 });  // Default to 1080p resolution

    });

    afterAll(async () => {
        // Close the browser
        await browser.close();

        // Stop the HTTPS server
        server.close();
    });

    // ToDo: debug  failing tests
    test("dummy", ()=>{
        expect(true).toBe(true)
    });

    test('check for the dashboard container', async () => {
        await page.waitForSelector('#vch-dash-container');

        const dashboardExists = await page.evaluate(() => {
            return !!document.querySelector('#vch-dash-container');
        });

        expect(dashboardExists).toBe(true);
    });


    test('check that the dashboard opens', async () => {
        import { MessageHandler, MESSAGE as m, CONTEXT as c } from "../../src/modules/messageHandler.mjs" ;
        const mh = new MessageHandler(c.BACKGROUND);
        await page.evaluate((context, message) => {
            mh.sendMessage(context, message, {});
        }, c.CONTENT, m.TOGGLE_DASH);

        // wait for document.querySelector("#vch-dash-container").shadowRoot.querySelector("#vch_dash")
        let container;
        let dashFrame;

        const dashLoaded = await page.waitForFunction(() => {
            container = document.querySelector('#vch-dash-container');
            dashFrame = container?.shadowRoot.querySelector('#vch_dash');
            return  dashFrame;
        });

        expect(dashLoaded).not.toBeNull();

        // check if dashFrame has a "dashOpen" class
        const dashOpen = await page.evaluate(() => {
            return !!document.querySelector("#vch-dash-container").shadowRoot.querySelector("#vch_dash.dashOpen");
        });

        expect(dashOpen).toBe(true);

    });

});
