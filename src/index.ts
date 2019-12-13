import Jimp from 'jimp';
import chrome from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
import { Request, Response } from 'express';

const isProd = process.env.NODE_ENV === 'production';

let browser: puppeteer.Browser;

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

  if (!browser) {
    const config = isProd
      ? {
          args: chrome.args,
          executablePath: await chrome.executablePath,
          headless: chrome.headless,
        }
      : { executablePath: require('chrome-finder')() };
    browser = await puppeteer.launch(config);
  }

  const page = await browser.newPage();
  await page.setContent(content);
  const screenshot = await page.screenshot({ fullPage: true });
  const jimpImage = await Jimp.read(screenshot);
  // Clean up useless white background
  jimpImage.autocrop({}, async (err: any, jimpInstance: Jimp) => {
    if (err) {
      throw err;
    } else {
      res.end(await jimpInstance.getBufferAsync(Jimp.MIME_PNG), 'binary');
    }
  });
}

if (!isProd) {
  // tslint:disable-next-line:no-var-requires
  const devServer = require('./dev-server').default;
  devServer.all('/', papitron);
  devServer.listen(8080);
}
