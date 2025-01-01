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

const EXTENSION_PATH = path.resolve(__dirname, '../../dist/extension/');
const TEST_PAGE = 'https://localhost:8443/gum.html';
const GUM_HTML_PATH = path.resolve(__dirname, '../gum.html');

// console.log('Resolved EXTENSION_PATH:', path.resolve(EXTENSION_PATH));
// console.log('Resolved TEST_PAGE:', TEST_PAGE);
// console.log('Resolved GUM_HTML_PATH:', GUM_HTML_PATH);

describe('Chrome Extension Dashboard Test', () => {
    let browser, page;
    let server;

    jest.setTimeout(30000); // 30 seconds for this suite

    beforeAll(async () => {
        // Generate a self-signed certificate with a larger key size
        const pems = selfsigned.generate(null, { days: 1, keySize: 2048 });

        // Start the HTTPS server
        server = https.createServer({
            key: pems.private,
            cert: pems.cert
        }, (req, res) => {
            // Serve the test page
            if (req.url === '/gum.html') {
                fs.readFile(GUM_HTML_PATH, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error loading gum.html');
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
            headless: false, // Extensions require a non-headless browser
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--ignore-certificate-errors' // Ignore self-signed certificate errors
            ],
            // dumpio: true, // Log browser communication
        });

    });

    afterAll(async () => {
        // Close the browser
        await browser.close();

        // Stop the HTTPS server
        server.close();
    });

    test('check for the dashboard container', async () => {
        // Open a new page and navigate to gum.html
        const pages = await browser.pages();
        page = pages[0];
        await page.goto(TEST_PAGE);

        await page.waitForSelector('#vch-dash-container');

        const dashboardExists = await page.evaluate(() => {
            return !!document.querySelector('#vch-dash-container');
        });

        expect(dashboardExists).toBe(true);
    });


    test('check that the dashboard opens', async () => {
        await page.evaluate((context, message) => {
            window.vch.mh.sendMessage(context, message, {});
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
