import { chromium } from 'playwright';
import fs from 'node:fs';
import moment from 'moment';
import path from 'node:path';

import { URL } from '../config/config';
import * as Directory from './directory';
import * as Global from './global';

/** Max delay before PDF capture (ms). */
export const DELAY_MS_MAX = 10_000;

/** Optional job timeout bounds (ms), validated in the controller. */
export const TIMEOUT_MS_MIN = 1;
export const TIMEOUT_MS_MAX = 30_000;

export function randomInteger(min: number = 100000, max: number = 999999): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

export type ConvertHtmlToPdfOptions = {
  content?: string;
  url?: string;
  headerTemplate?: string;
  footerTemplate?: string;
  style?: string;
  format?: string;
  landscape?: boolean;
  preferCSSPageSize?: boolean;
  printBackground?: boolean;
  scale?: number;
  delayMs?: number;
  width?: string | number;
  height?: string | number;
  margin?: { top?: string | number; left?: string | number; right?: string | number; bottom?: string | number };
  filename?: string;
  /** Max time for setContent, delay, and pdf (ms). Omitted = no job timeout. */
  timeout?: number;
};

export async function convertHtmlContentToPDF(options: ConvertHtmlToPdfOptions): Promise<string> {
  if (!options.url && Global.isEmpty(options?.content)) {
    throw { status: 400, message: `Empty content cannot be empty` };
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    const runConversionJob = async (): Promise<string> => {
      if (options.url) {
        await page.goto(options.url, {
          waitUntil: 'networkidle',
          timeout: options.timeout,
        });
      } else {
        await page.setContent(options.content as string, {
          waitUntil: 'networkidle',
        });
      }

      let title: string;
      if (options.filename) {
        title = `${options.filename.replace(/[^a-zA-Z0-9-_]/g, '')}.pdf`;
      } else {
        const currentDate = moment().format('MMDDHHmmsss');
        const random = randomInteger();
        title = `${currentDate}-${random}.pdf`;
      }

      const destination = path.join(__dirname, '..', 'public', 'pdf', title);

      const margin = {
        top: options.margin?.top || 20,
        left: options.margin?.left || 20,
        right: options.margin?.right || 20,
        bottom: options.margin?.bottom || 20,
      };

      const resetCSS = fs.readFileSync(path.join(__dirname, '..', 'private', 'reset.css'), 'utf-8');
      const defaultCSS = fs.readFileSync(path.join(__dirname, '..', 'private', 'default.css'), 'utf-8');
      const headerCSS = fs.readFileSync(path.join(__dirname, '..', 'private', 'header.css'), 'utf-8');

      let headerTemplate: string = ' ';
      let footerTemplate: string = ' ';
      const displayHeaderFooter = (Global.isPopulated(options.headerTemplate) || Global.isPopulated(options.footerTemplate));
      if (displayHeaderFooter) {
        const headerFooterCSS = `
      <style>
        ${resetCSS}
        ${defaultCSS}
        ${headerCSS}
      </style>
    `;

        if (Global.isPopulated(options.headerTemplate)) {
          headerTemplate = `${headerFooterCSS}<header>${options.headerTemplate}</header>`;
        }

        if (Global.isPopulated(options.footerTemplate)) {
          footerTemplate = `${headerFooterCSS}<footer>${options.footerTemplate}</footer>`;
        }
      }

      let format;
      let width;
      let height;
      if (Global.isPopulated(options.width) && Global.isPopulated(options.height)) {
        width = options.width;
        height = options.height;
      } else {
        format = options.format || 'A4';
      }

      const landscape = options.landscape === true;
      const delayMs =
        options.delayMs !== undefined &&
        Number.isFinite(options.delayMs) &&
        options.delayMs >= 0
          ? Math.min(Math.floor(options.delayMs), DELAY_MS_MAX)
          : undefined;

      const optionsPDF = {
        path: destination,
        format,
        width,
        height,
        margin,
        scale: options.scale ?? 1,
        landscape,
        preferCSSPageSize: options.preferCSSPageSize ?? false,
        printBackground: options.printBackground ?? true,
        displayHeaderFooter,
        headerTemplate,
        footerTemplate,
      };

      // HTML fragments need normalize typography; full URLs must keep the site's own CSS/fonts.
      if (!options.url) {
        await page.addStyleTag({ content: `${resetCSS}${defaultCSS}` });
      }

      if (Global.isPopulated(options.style)) {
        await page.addStyleTag({ content: options.style });
      }

      await page.emulateMedia({ media: 'print' });
      if (delayMs !== undefined) {
        await page.waitForTimeout(delayMs);
      }
      await page.pdf(optionsPDF);

      return `${URL}/public/pdf/${title}`;
    };

    const timeoutMs = options.timeout;
    if (timeoutMs !== undefined) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject({ status: 504, message: 'PDF generation timed out' });
        }, timeoutMs);
      });
      try {
        return await Promise.race([runConversionJob(), timeoutPromise]);
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }
    }

    return await runConversionJob();
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function cleaner(): Promise<void> {
  try {
    const options = {
      directory: path.join(__dirname, '..', 'public', 'pdf'),
      timeUnit: 'hours',
      timeValue: 1,
      whitelist: ['.gitkeep'],
    };

    await Directory.removeOldFiles(options);
  } catch (error) {
    console.error('error cron', 'cleaner', error);
  }
}
