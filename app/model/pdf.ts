import { chromium } from 'playwright';
import fs from 'node:fs';
import moment from 'moment';
import path from 'node:path';
import {
  clip,
  endPath,
  PageSizes,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
} from 'pdf-lib';

import { URL } from '../config/config';
import * as Directory from './directory';
import * as Global from './global';

/** Max delay before PDF capture (ms). */
export const DELAY_MS_MAX = 10_000;

/** Optional job timeout bounds (ms), validated in the controller. */
export const TIMEOUT_MS_MIN = 1;
export const TIMEOUT_MS_MAX = 30_000;

const PAGE_SIZES_BY_NAME = PageSizes as Record<string, readonly [number, number]>;

const PAPER_LENGTH = /^(\d+(?:\.\d+)?)(px|pt|in|mm|cm|pc)?$/i;

function paperLengthToPoints(value: string | number): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return Number.NaN;
    }

    return value * 72;
  }

  const s = String(value).trim();
  const m = PAPER_LENGTH.exec(s);
  if (!m) {
    return Number.NaN;
  }

  const n = parseFloat(m[1]);
  const unit = (m[2] || 'in').toLowerCase();
  switch (unit) {
    case 'pt':
      return n;
    case 'in':
      return n * 72;
    case 'mm':
      return (n / 25.4) * 72;
    case 'cm':
      return (n / 2.54) * 72;
    case 'px':
      return (n / 96) * 72;
    case 'pc':
      return n * 12;
    default:
      return n * 72;
  }
}

function lookupNamedPageSize(format: string | undefined): readonly [number, number] {
  if (!format) {
    return PageSizes.A4;
  }

  const t = format.trim();
  if (PAGE_SIZES_BY_NAME[t]) {
    return PAGE_SIZES_BY_NAME[t];
  }

  const cap = Global.capitalize(t);
  if (PAGE_SIZES_BY_NAME[cap]) {
    return PAGE_SIZES_BY_NAME[cap];
  }

  return PageSizes.A4;
}

function marginSideToPoints(side: string | number | undefined, defaultPx: number): number {
  if (side === undefined) {
    return (defaultPx / 96) * 72;
  }

  if (typeof side === 'number' && Number.isFinite(side)) {
    return (side / 96) * 72;
  }

  const p = paperLengthToPoints(side as string);
  return Number.isFinite(p) && p >= 0 ? p : (defaultPx / 96) * 72;
}

function resolveScreenshotPdfPageDimensions(
  options: ConvertHtmlToPdfOptions,
  landscape: boolean,
): { widthPt: number, heightPt: number } {
  let widthPt: number;
  let heightPt: number;
  if (Global.isPopulated(options.width) && Global.isPopulated(options.height)) {
    widthPt = paperLengthToPoints(options.width as string | number);
    heightPt = paperLengthToPoints(options.height as string | number);
    if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt <= 0 || heightPt <= 0) {
      const a4 = PageSizes.A4;
      widthPt = a4[0];
      heightPt = a4[1];
    }
  } else {
    const pair = lookupNamedPageSize(options.format);
    widthPt = pair[0];
    heightPt = pair[1];
  }

  if (landscape) {
    const t = widthPt;
    widthPt = heightPt;
    heightPt = t;
  }

  return { widthPt, heightPt };
}

async function buildPagedPdfFromPng(
  pngBuffer: Buffer,
  options: ConvertHtmlToPdfOptions,
  landscape: boolean,
  margin: { top: string | number, left: string | number, right: string | number, bottom: string | number },
): Promise<Buffer> {
  const { widthPt, heightPt } = resolveScreenshotPdfPageDimensions(options, landscape);
  const top = marginSideToPoints(margin.top, 20);
  const left = marginSideToPoints(margin.left, 20);
  const right = marginSideToPoints(margin.right, 20);
  const bottom = marginSideToPoints(margin.bottom, 20);

  const contentW = Math.max(0, widthPt - left - right);
  const contentH = Math.max(0, heightPt - top - bottom);

  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(pngBuffer);

  if (contentW <= 0 || contentH <= 0) {
    pdfDoc.addPage([widthPt, heightPt]);
    return Buffer.from(await pdfDoc.save());
  }

  const scale = contentW / image.width;
  const drawW = contentW;
  const drawH = image.height * scale;

  if (drawH <= contentH) {
    const pdfPage = pdfDoc.addPage([widthPt, heightPt]);
    const y = bottom + ((contentH - drawH) / 2);

    pdfPage.drawImage(image, {
      x: left,
      y,
      width: drawW,
      height: drawH,
    });
  } else {
    const pageCount = Math.ceil(drawH / contentH);
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const pdfPage = pdfDoc.addPage([widthPt, heightPt]);
      const y = bottom + contentH - drawH + (pageIndex * contentH);

      pdfPage.pushOperators(
        pushGraphicsState(),
        rectangle(left, bottom, contentW, contentH),
        clip(),
        endPath(),
      );
      pdfPage.drawImage(image, {
        x: left,
        y,
        width: drawW,
        height: drawH,
      });
      pdfPage.pushOperators(popGraphicsState());
    }
  }

  return Buffer.from(await pdfDoc.save());
}

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
  margin?: { top?: string | number, left?: string | number, right?: string | number, bottom?: string | number };
  filename?: string;
  /** Max time for setContent, delay, and pdf (ms). Omitted = no job timeout. */
  timeout?: number;
  /** Wait for this selector to exist before delay/hideSelectors/pdf. */
  waitForSelector?: string;
  /** Playwright URL navigation readiness state (`page.goto` only). */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  /** CSS selectors to hide (injected as a style rule before PDF capture). */
  hideSelectors?: string[];
  /** CSS selectors to remove from the DOM before PDF capture. */
  removeSelectors?: string[];
  /** Playwright media emulation; omitted defaults to print. */
  mediaType?: 'print' | 'screen';
  /** Browser viewport before load; both must be set together, validated in controller. */
  viewportWidth?: number;
  viewportHeight?: number;
  /** `pdf` uses Playwright print PDF; `screenshot_pdf` rasterizes the page then embeds one image. */
  captureMode?: 'pdf' | 'screenshot_pdf';
};

export async function convertHtmlContentToPDF(options: ConvertHtmlToPdfOptions): Promise<string> {
  if (!options.url && Global.isEmpty(options?.content)) {
    throw { status: 400, message: `Empty content cannot be empty` };
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    if (options.viewportWidth !== undefined && options.viewportHeight !== undefined) {
      await page.setViewportSize({
        width: options.viewportWidth,
        height: options.viewportHeight,
      });
    }

    const runConversionJob = async (): Promise<string> => {
      if (options.url) {
        await page.goto(options.url, {
          waitUntil: options.waitUntil ?? 'networkidle',
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
        options.delayMs >= 0 ? Math.min(Math.floor(options.delayMs), DELAY_MS_MAX) : undefined;

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

      await page.emulateMedia({ media: options.mediaType ?? 'print' });
      if (options.waitForSelector !== undefined) {
        await page.waitForSelector(
          options.waitForSelector,
          options.timeout !== undefined ? { timeout: options.timeout } : undefined,
        );
      }

      if (delayMs !== undefined) {
        await page.waitForTimeout(delayMs);
      }

      if (options.hideSelectors !== undefined && options.hideSelectors.length > 0) {
        const selectorList = options.hideSelectors.join(', ');
        await page.addStyleTag({
          content: `${selectorList} { display: none !important; visibility: hidden !important; }`,
        });
      }

      if (options.removeSelectors !== undefined && options.removeSelectors.length > 0) {
        await page.evaluate((selectors: string[]) => {
          for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            nodes.forEach((node) => node.remove());
          }
        }, options.removeSelectors);
      }

      const captureMode = options.captureMode ?? 'pdf';
      if (captureMode === 'pdf') {
        await page.pdf(optionsPDF);
      } else {
        const pngBuffer = await page.screenshot({
          fullPage: true,
          type: 'png',
        });

        const pdfBuffer = await buildPagedPdfFromPng(pngBuffer, options, landscape, margin);
        fs.writeFileSync(destination, pdfBuffer);
      }

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
