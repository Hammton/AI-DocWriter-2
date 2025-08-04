import fs from 'fs'
import path from 'path'
import { GeneratedReport } from './reportGenerator'
import { jsPDF } from 'jspdf'
import { JSDOM } from 'jsdom'

function isServerless() {
  return process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME
}

async function launchBrowser() {
  if (isServerless()) {
    // Use puppeteer-core with chromium for serverless environments
    const puppeteer = await import('puppeteer-core')
    const chromium = await import('@sparticuz/chromium')

    return await puppeteer.default.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(),
      defaultViewport: chromium.default.defaultViewport,
      headless: chromium.default.headless,
    })
  } else {
    // Use regular puppeteer for local development, fallback to puppeteer-core
    try {
      // Try to dynamically import puppeteer (might not be available in all environments)
      const puppeteer = await import('puppeteer').catch(() => null)
      if (puppeteer) {
        return await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        })
      }
      throw new Error('Puppeteer not available')
    } catch (error) {
      // Fallback to puppeteer-core if puppeteer is not available
      console.warn('Regular puppeteer not available, falling back to puppeteer-core')
      const puppeteerCore = await import('puppeteer-core')
      return await puppeteerCore.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }
  }
}

export async function generatePDFFromHTML(htmlContent: string, outputPath: string): Promise<void> {
  let browser
  try {
    const page = await (browser = await launchBrowser()).newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: false,
    })
  } finally {
    if (browser) await browser.close()
  }
}

export function getGeneratedReportsDir(): string {
  const out = isServerless() ? path.join('/tmp', 'generated') : path.join(__dirname, '../../data/generated')
  try {
    if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true })
  } catch {
    return '/tmp'
  }
  return out
}

export async function generateReportPDF(report: GeneratedReport): Promise<string> {
  const outputDir = getGeneratedReportsDir()
  const sanitizedName = report.applicationName.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `${sanitizedName}_${report.metadata.applicationId}_${Date.now()}.pdf`
  const outputPath = path.join(outputDir, filename)
  await generatePDFFromHTML(report.htmlContent, outputPath)
  return outputPath
}

export async function generateReportPDFBuffer(report: GeneratedReport): Promise<Buffer> {
  let browser
  try {
    console.log(`🚀 Starting PDF generation for report: ${report.applicationName}`)
    console.log(`📊 Environment: ${isServerless() ? 'Serverless (Vercel)' : 'Local Development'}`)

    browser = await launchBrowser()
    const page = await browser.newPage()

    const applicationData = {
      applicationName: report.applicationName,
      organizationName: report.organizationName,
      applicationId: report.metadata.applicationId,
    }

    const html = report.htmlContent
      .replace(/\{application_name\}/g, applicationData.applicationName || 'Application Name')
      .replace(/\{organization_name\}/g, applicationData.organizationName || 'Organization Name')
      .replace(/\{application_id\}/g, applicationData.applicationId || 'Application ID')

    console.log('🎨 Setting viewport and loading HTML content...')

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })

    console.log('🎨 Applying CSS for styling preservation...')

    // Add CSS to ensure colors and backgrounds are preserved - inspired by openhtmltopdf
    await page.addStyleTag({
      content: `
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Force all elements to preserve their styling in PDF */
        body, div, h1, h2, h3, h4, h5, h6, p, table, th, td, span {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Ensure borders and backgrounds are visible */
        .header, .metadata, .section-title, .table th, .highlight {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `
    });

    // Wait a bit for styles to be applied
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('📄 Generating PDF with enhanced styling...')

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      displayHeaderFooter: false,
      timeout: 30000,
      preferCSSPageSize: true, // Use CSS @page rules
    })

    console.log('✅ PDF generation successful!')
    return Buffer.from(pdfBuffer)
  } catch (error) {
    console.error('❌ PDF generation failed:', error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
      console.log('🔒 Browser closed')
    }
  }
}

export async function generateSimplePDFBuffer(report: GeneratedReport): Promise<Buffer> {
  const doc = new jsPDF()
  const applicationData = {
    applicationName: report.applicationName || 'Application Name',
    organizationName: report.organizationName || 'Organization Name',
    applicationId: report.metadata.applicationId || 'Application ID',
  }
  const dom = new JSDOM(report.htmlContent)
  const document = dom.window.document
  const textContent = document.body.textContent || document.body.innerText || ''
  doc.setFontSize(16)
  doc.text(`${applicationData.applicationName} Report`, 20, 20)
  doc.setFontSize(12)
  doc.text(`Organization: ${applicationData.organizationName}`, 20, 35)
  doc.text(`Application ID: ${applicationData.applicationId}`, 20, 45)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 55)
  doc.setFontSize(10)
  const lines = doc.splitTextToSize(textContent, 170)
  doc.text(lines, 20, 70)
  return Buffer.from(doc.output('arraybuffer'))
}

export async function generateUltraSimplePDFBuffer(report: GeneratedReport): Promise<Buffer> {
  const doc = new jsPDF()
  const applicationData = {
    applicationName: report.applicationName || 'Application Name',
    organizationName: report.organizationName || 'Organization Name',
    applicationId: report.metadata.applicationId || 'Application ID',
  }
  const dom = new JSDOM(report.htmlContent)
  const document = dom.window.document
  let textContent = ''
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
  const paragraphs = document.querySelectorAll('p')
  const lists = document.querySelectorAll('ul, ol')
  headings.forEach(h => { textContent += `\n${h.textContent?.trim()}\n` })
  paragraphs.forEach(p => { textContent += `\n${p.textContent?.trim() || ''}\n` })
  lists.forEach(list => {
    const items = list.querySelectorAll('li')
    items.forEach(item => { textContent += `• ${item.textContent?.trim() || ''}\n` })
  })
  if (!textContent.trim()) {
    textContent = document.body.textContent || document.body.innerText || 'No content available'
  }
  doc.setFontSize(18)
  doc.text(`${applicationData.applicationName}`, 20, 20)
  doc.setFontSize(16)
  doc.text('Application Profile Report', 20, 35)
  doc.setFontSize(12)
  doc.text(`Organization: ${applicationData.organizationName}`, 20, 50)
  doc.text(`Application ID: ${applicationData.applicationId}`, 20, 60)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 70)
  doc.line(20, 80, 190, 80)
  doc.setFontSize(10)
  const lines = doc.splitTextToSize(textContent.trim(), 170)
  let y = 90
  const pageHeight = doc.internal.pageSize.height
  const margin = 20
  for (let i = 0; i < lines.length; i++) {
    if (y > pageHeight - margin) { doc.addPage(); y = margin }
    doc.text(lines[i], 20, y)
    y += 5
  }
  return Buffer.from(doc.output('arraybuffer'))
}
