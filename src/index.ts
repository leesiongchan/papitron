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
  const acceptType = req.headers.accept;

  if (!content) {
    res.status(400).end('`Body` content is required');
    return;
  }

  if (!acceptType) {
    res.status(400).end('`Accept` header is required');
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
  await page.setContent(content, { waitUntil: 'networkidle0' });
  let data: Buffer | undefined;

  switch (acceptType) {
    case 'application/pdf':
      data = await generatePdf(page);
      break;

    default:
      data = await generateImage(page, acceptType);
      break;
  }

  res.setHeader('Content-Type', acceptType);
  res.end(data, 'binary');
}

// Helper functions

async function generateImage(page: puppeteer.Page, type: string) {
  const data = await page.screenshot({
    fullPage: true,
  });
  const jimpImage = await Jimp.read(data);
  // Clean up useless white background
  return new Promise<Buffer>((resolve, reject) => {
    jimpImage.autocrop({}, async (err: any, jimpInstance: Jimp) => {
      if (err) {
        reject(err);
      } else {
        resolve(await jimpInstance.getBufferAsync(type));
      }
    });
  });
}

async function generatePdf(page: puppeteer.Page) {
  await page.emulateMedia('screen');
  const data = await page.pdf({ format: 'A4' });
  return data;
}

if (!isProd) {
  // tslint:disable-next-line:no-var-requires
  const devServer = require('./dev-server').default;
  devServer.all('/', papitron);
  devServer.listen(8080);
}
