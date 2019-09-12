import chrome from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
import { Request, Response } from 'express';

const isProd = process.env.NODE_ENV === 'production';

export async function papitron(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const content = req.body;

  if (!content) {
    res.status(400).end('Body content is required');
    return;
  }

  const config = isProd
    ? {
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: chrome.headless,
      }
    : { executablePath: require('chrome-finder')() };
  const browser = await puppeteer.launch(config);
  const page = await browser.newPage();
  await page.setContent(content);
  const screenshot = await page.screenshot({ fullPage: true, type: 'png' });

  res.end(screenshot, 'binary');
}

if (!isProd) {
  // tslint:disable-next-line:no-var-requires
  const devServer = require('./dev-server').default;
  devServer.all('/', papitron);
  devServer.listen(8080);
}
