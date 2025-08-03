import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { GeneratedReport } from './reportGenerator';

export async function generatePDFFromHTML(htmlContent: string, outputPath: string): Promise<void> {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
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
    // Check if we're running in a Vercel environment
    const isVercel = process.env.VERCEL === '1';
    
    const launchOptions = {
      headless: true,
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
      ]
    };
    
    // Add additional args for serverless environments
    if (isVercel) {
      launchOptions.args.push(
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      );
    }
    
    browser = await puppeteer.launch(launchOptions);
    
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
    await page.setContent(htmlWithReplacedPlaceholders, { waitUntil: 'networkidle0' });
    
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
    });
    
    return pdfBuffer;
    
  } catch (error) {
    console.error('Error generating PDF buffer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export function getGeneratedReportsDir(): string {
  const outputDir = path.join(__dirname, '../../data/generated');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}