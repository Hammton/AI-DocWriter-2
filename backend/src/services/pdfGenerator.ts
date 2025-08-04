import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';
import { GeneratedReport } from './reportGenerator';
const htmlPdf = require('html-pdf-node');
import { jsPDF } from 'jspdf';
import { JSDOM } from 'jsdom';

export async function generatePDFFromHTML(htmlContent: string, outputPath: string): Promise<void> {
  let browser;

  try {
    const isVercel = process.env.VERCEL === '1';

    browser = await puppeteer.launch({
      args: isVercel ? chromium.args : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: isVercel ? await chromium.executablePath() : undefined,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set content and wait for any resources to load
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF with proper formatting
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      displayHeaderFooter: false,
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function generateReportPDF(report: GeneratedReport): Promise<string> {
  // Ensure output directory exists
  const outputDir = path.join(__dirname, '../../data/generated');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename
  const sanitizedName = report.applicationName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizedName}_${report.metadata.applicationId}_${Date.now()}.pdf`;
  const outputPath = path.join(outputDir, filename);

  // Generate PDF
  await generatePDFFromHTML(report.htmlContent, outputPath);

  return outputPath;
}

// New function for generating PDF buffer (for Vercel)
export async function generateReportPDFBuffer(report: GeneratedReport): Promise<Buffer> {
  let browser;

  try {
    console.log('Generating PDF for report:', report.applicationName);

    // Check if we're running in a Vercel environment
    const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isVercel) {
      // Configure Chromium for Vercel/serverless environment
      await chromium.font('https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf');

      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--hide-scrollbars',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // Local development configuration
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        headless: true,
      });
    }

    const page = await browser.newPage();

    // Replace placeholders with actual values for PDF generation
    const applicationData = {
      applicationName: report.applicationName,
      organizationName: report.organizationName,
      applicationId: report.metadata.applicationId
    };

    const htmlWithReplacedPlaceholders = report.htmlContent
      .replace(/\{application_name\}/g, applicationData.applicationName || 'Application Name')
      .replace(/\{organization_name\}/g, applicationData.organizationName || 'Organization Name')
      .replace(/\{application_id\}/g, applicationData.applicationId || 'Application ID');

    // Set content and wait for any resources to load
    await page.setContent(htmlWithReplacedPlaceholders, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF buffer directly
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      displayHeaderFooter: false,
      timeout: 30000,
    });

    console.log('PDF generation successful');
    return Buffer.from(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF buffer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Fallback PDF generation using html-pdf-node (more reliable on serverless)
export async function generateReportPDFBufferFallback(report: GeneratedReport): Promise<Buffer> {
  try {
    console.log('Using fallback PDF generation with html-pdf-node');

    // Replace placeholders with actual values for PDF generation
    const applicationData = {
      applicationName: report.applicationName,
      organizationName: report.organizationName,
      applicationId: report.metadata.applicationId
    };

    const htmlWithReplacedPlaceholders = report.htmlContent
      .replace(/\{application_name\}/g, applicationData.applicationName || 'Application Name')
      .replace(/\{organization_name\}/g, applicationData.organizationName || 'Organization Name')
      .replace(/\{application_id\}/g, applicationData.applicationId || 'Application ID');

    // Use puppeteer-core with @sparticuz/chromium for serverless
    const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isVercel) {
      // Use puppeteer-core directly for better control in serverless
      let browser;
      try {
        browser = await puppeteer.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setContent(htmlWithReplacedPlaceholders, {
          waitUntil: 'networkidle0',
          timeout: 25000
        });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm',
          },
          displayHeaderFooter: false,
          timeout: 25000,
        });

        console.log('Fallback PDF generation successful with puppeteer-core');
        return Buffer.from(pdfBuffer);
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    } else {
      // Use html-pdf-node for local development
      const options = {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      };

      const file = { content: htmlWithReplacedPlaceholders };
      const pdfBuffer = await htmlPdf.generatePdf(file, options);

      console.log('Fallback PDF generation successful with html-pdf-node');
      return pdfBuffer;
    }

  } catch (error) {
    console.error('Error in fallback PDF generation:', error);
    throw error;
  }
}

export function getGeneratedReportsDir(): string {
  // Use /tmp for serverless environments, local path for development
  const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const outputDir = isServerless
    ? path.join('/tmp', 'generated')
    : path.join(__dirname, '../../data/generated');

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  } catch (error) {
    console.warn('Could not create output directory:', error);
    // Return /tmp as fallback for serverless
    return '/tmp';
  }

  return outputDir;
}

// Simple PDF generation using jsPDF (no Chromium required)
export async function generateSimplePDFBuffer(report: GeneratedReport): Promise<Buffer> {
  try {
    console.log('Using simple PDF generation with jsPDF');

    const doc = new jsPDF();

    // Replace placeholders with actual values
    const applicationData = {
      applicationName: report.applicationName || 'Application Name',
      organizationName: report.organizationName || 'Organization Name',
      applicationId: report.metadata.applicationId || 'Application ID'
    };

    // Parse HTML content to extract text
    const dom = new JSDOM(report.htmlContent);
    const document = dom.window.document;

    // Extract text content from HTML
    const textContent = document.body.textContent || document.body.innerText || '';

    // Set up PDF document
    doc.setFontSize(16);
    doc.text(`${applicationData.applicationName} Report`, 20, 20);

    doc.setFontSize(12);
    doc.text(`Organization: ${applicationData.organizationName}`, 20, 35);
    doc.text(`Application ID: ${applicationData.applicationId}`, 20, 45);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55);

    // Add content
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(textContent, 170);
    doc.text(lines, 20, 70);

    // Convert to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    console.log('Simple PDF generation successful');
    return pdfBuffer;

  } catch (error) {
    console.error('Error in simple PDF generation:', error);
    throw error;
  }
}