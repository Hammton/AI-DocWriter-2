import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { GeneratedReport } from './reportGenerator';

export interface ExportOptions {
  format: 'pdf' | 'docx';
  logoPath?: string;
  useDefaultLogo?: boolean;
  stakeholderAudience?: string[];
  customInstructions?: string;
}

export interface LogoConfig {
  path: string;
  width: number;
  height: number;
}

export class DocumentExporter {
  private defaultLogoPath = path.join(__dirname, '../../public/assets/dq-logo.png');

  async exportDocument(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    if (options.format === 'pdf') {
      return this.generatePDF(report, options);
    } else {
      return this.generateDOCX(report, options);
    }
  }

  private async generatePDF(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    // TEMPORARY: Skip slow methods and go directly to fast simple PDF
    console.log('🚀 Using fast simple PDF generation (skipping slow methods)');
    return await this.generateSimplePDF(report, options);

    // Try ConvertAPI first if available (better styling preservation)
    if (process.env.CONVERTAPI_SECRET) {
      try {
        console.log('🔄 Using ConvertAPI for PDF generation (better styling)');
        return await this.generatePDFWithConvertAPI(report, options);
      } catch (error) {
        console.warn('⚠️ ConvertAPI failed, falling back to Puppeteer:', error);
        // Fall through to Puppeteer fallback
      }
    }

    // Try Puppeteer fallback
    try {
      console.log('🔄 Using Puppeteer for PDF generation (fallback)');
      const isVercel = process.env.VERCEL === '1';

      const browser = await puppeteer.launch({
        args: isVercel ? [
          ...chromium.args,
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
          '--single-process',
          '--disable-extensions'
        ] : [
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
        ignoreDefaultArgs: isVercel ? ['--disable-extensions'] : false,
      });

      try {
        const page = await browser.newPage();

        // Generate HTML with logo and stakeholder audience
        const htmlContent = await this.generateHTMLWithLogo(report, options);

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          }
        });

        return Buffer.from(pdfBuffer);
      } finally {
        await browser.close();
      }
    } catch (puppeteerError) {
      console.warn('⚠️ Puppeteer also failed, using simple PDF fallback:', puppeteerError);
      // Final fallback to simple PDF generation
      return await this.generateSimplePDF(report, options);
    }
  }

  private async generateDOCX(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    const doc = new Document({
      sections: [{
        properties: {},
        children: await this.generateDOCXContent(report, options)
      }]
    });

    return await Packer.toBuffer(doc);
  }

  private async generateHTMLWithLogo(report: GeneratedReport, options: ExportOptions): Promise<string> {
    const logoBase64 = await this.getLogoAsBase64(options);
    const stakeholderText = this.formatStakeholderAudience(options.stakeholderAudience);
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            background-color: #ffffff;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }
        .logo {
            margin-bottom: 20px;
        }
        .logo img {
            max-height: 80px;
            max-width: 200px;
            object-fit: contain;
        }
        .organization-name {
            color: #2563eb;
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .report-title {
            font-size: 2rem;
            color: #1e40af;
            margin: 10px 0;
        }
        .subtitle {
            font-size: 1.2rem;
            color: #64748b;
            margin: 5px 0;
        }
        .metadata {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #2563eb;
        }
        .section {
            margin: 30px 0;
            page-break-inside: avoid;
        }
        .section-title {
            font-size: 1.5rem;
            color: #1e40af;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
        }
        .section-content {
            margin-left: 10px;
            line-height: 1.8;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        .table th, .table td {
            border: 1px solid #d1d5db;
            padding: 12px;
            text-align: left;
        }
        .table th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
        }
        .table tr:nth-child(even) {
            background-color: #f9fafb;
        }
        .highlight {
            background-color: #fef3c7;
            padding: 2px 4px;
            border-radius: 3px;
        }
        .footer {
            margin-top: 50px;
            text-align: center;
            color: #6b7280;
            font-size: 0.9rem;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
        .stakeholder-info {
            background-color: #eff6ff;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #3b82f6;
        }
        @media print {
            body { margin: 0; padding: 20px; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        ${logoBase64 ? `<div class="logo"><img src="${logoBase64}" alt="Organization Logo" /></div>` : ''}
        <div class="organization-name">${report.organizationName}</div>
        <h1 class="report-title">${report.title}</h1>
        <div class="subtitle">Application Owner: ${report.metadata.applicationId}</div>
        <div class="subtitle">Report Owner: Enterprise Architecture</div>
    </div>

    ${stakeholderText ? `
    <div class="stakeholder-info">
        <h3>Stakeholder Audience</h3>
        <p>${stakeholderText}</p>
    </div>
    ` : ''}

    <div class="metadata">
        <h3>Report Information</h3>
        <table class="table">
            <tr><td><strong>Application Name:</strong></td><td>${report.applicationName}</td></tr>
            <tr><td><strong>Organization:</strong></td><td>${report.organizationName}</td></tr>
            <tr><td><strong>Generated Date:</strong></td><td>${currentDate}</td></tr>
            <tr><td><strong>Template:</strong></td><td>${report.metadata.templateId}</td></tr>
        </table>
    </div>

    ${report.sections.map(section => `
        <div class="section">
            <h2 class="section-title">${section.title}</h2>
            <div class="section-content">
                ${this.formatContent(section.content)}
            </div>
        </div>
    `).join('')}

    <div class="footer">
        <p>This report was generated on ${currentDate} by AI DocWriter 4.0</p>
        ${stakeholderText ? `<p>Stakeholder Audience: ${stakeholderText}</p>` : ''}
    </div>
</body>
</html>
`;
  }

  private async generateDOCXContent(report: GeneratedReport, options: ExportOptions): Promise<any[]> {
    const content: any[] = [];
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Add logo if available
    if (options.logoPath || options.useDefaultLogo) {
      try {
        const logoPath = options.logoPath || this.defaultLogoPath;
        if (fs.existsSync(logoPath)) {
          const logoBuffer = await this.processImageForDOCX(logoPath);
          content.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: logoBuffer,
                  transformation: {
                    width: 200,
                    height: 80,
                  },
                }),
              ],
            })
          );
        }
      } catch (error) {
        console.warn('Failed to add logo to DOCX:', error);
      }
    }

    // Title
    content.push(
      new Paragraph({
        text: report.organizationName,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: report.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      })
    );

    // Stakeholder audience
    if (options.stakeholderAudience && options.stakeholderAudience.length > 0) {
      content.push(
        new Paragraph({
          text: "Stakeholder Audience",
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: this.formatStakeholderAudience(options.stakeholderAudience),
        })
      );
    }

    // Report sections
    for (const section of report.sections) {
      content.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: section.content.replace(/<[^>]*>/g, ''), // Strip HTML tags
        })
      );
    }

    // Footer
    content.push(
      new Paragraph({
        text: `This report was generated on ${currentDate} by AI DocWriter 4.0`,
        alignment: AlignmentType.CENTER,
      })
    );

    if (options.stakeholderAudience && options.stakeholderAudience.length > 0) {
      content.push(
        new Paragraph({
          text: `Stakeholder Audience: ${this.formatStakeholderAudience(options.stakeholderAudience)}`,
          alignment: AlignmentType.CENTER,
        })
      );
    }

    return content;
  }

  private async getLogoAsBase64(options: ExportOptions): Promise<string | null> {
    try {
      let logoPath: string | null = null;

      if (options.logoPath && fs.existsSync(options.logoPath)) {
        logoPath = options.logoPath;
      } else if (options.useDefaultLogo && fs.existsSync(this.defaultLogoPath)) {
        logoPath = this.defaultLogoPath;
      }

      if (!logoPath) return null;

      // Process image with sharp to ensure it's web-compatible
      const processedImage = await sharp(logoPath)
        .resize(200, 80, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();

      return `data:image/png;base64,${processedImage.toString('base64')}`;
    } catch (error) {
      console.warn('Failed to process logo:', error);
      return null;
    }
  }

  private async processImageForDOCX(imagePath: string): Promise<Buffer> {
    return await sharp(imagePath)
      .resize(200, 80, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  }

  private formatStakeholderAudience(stakeholders?: string[]): string {
    if (!stakeholders || stakeholders.length === 0) return '';

    if (stakeholders.length === 1) return stakeholders[0];
    if (stakeholders.length === 2) return stakeholders.join(' and ');

    const lastStakeholder = stakeholders.pop();
    return stakeholders.join(', ') + ', and ' + lastStakeholder;
  }

  private async generatePDFWithConvertAPI(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    const secret = process.env.CONVERTAPI_SECRET;
    if (!secret) {
      throw new Error('ConvertAPI secret not configured');
    }

    // Generate enhanced HTML with better styling for ConvertAPI
    const htmlContent = await this.generateEnhancedHTMLForConvertAPI(report, options);

    // Debug: Check HTML content
    console.log('📄 HTML content length:', htmlContent.length);
    if (htmlContent.length < 100) {
      console.warn('⚠️ HTML content seems too short:', htmlContent.substring(0, 200));
    }

    // Use the existing working approach from app.ts - send HTML directly in JSON
    const parameters: any[] = [
      { Name: 'Html', Value: htmlContent },
      { Name: 'PageSize', Value: 'A4' },
      { Name: 'MarginTop', Value: '20' },
      { Name: 'MarginRight', Value: '15' },
      { Name: 'MarginBottom', Value: '20' },
      { Name: 'MarginLeft', Value: '15' },
      { Name: 'PrintBackground', Value: 'true' },
      { Name: 'LoadErrorHandling', Value: 'skip' },
      { Name: 'WaitTime', Value: '5' }
    ];

    console.log('🚀 Sending JSON request to ConvertAPI...');
    const response = await fetch(`https://v2.convertapi.com/convert/html/to/pdf?Secret=${encodeURIComponent(secret)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Parameters: parameters })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ConvertAPI error response:', errorText);
      throw new Error(`ConvertAPI request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    console.log('✅ ConvertAPI response received:', { filesCount: data.Files?.length });

    const file = data.Files?.[0];
    if (!file?.Url) {
      console.error('❌ No file URL in response:', data);
      throw new Error('No file URL returned from ConvertAPI');
    }

    console.log('📥 Downloading PDF from ConvertAPI...');
    const pdfResponse = await fetch(file.Url);
    if (!pdfResponse.ok) {
      throw new Error('Failed to download PDF from ConvertAPI');
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    console.log('✅ PDF downloaded successfully, size:', pdfBuffer.length, 'bytes');

    return pdfBuffer;
  }

  private async generateEnhancedHTMLForConvertAPI(report: GeneratedReport, options: ExportOptions): Promise<string> {
    const logoBase64 = await this.getLogoAsBase64(options);
    const stakeholderText = this.formatStakeholderAudience(options.stakeholderAudience);
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        @page {
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
        }
        
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        
        body {
            font-family: 'Segoe UI', 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            color: #333333;
            font-size: 11pt;
        }
        
        .page-container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20mm 15mm;
            background: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            background-color: #ffffff;
        }
        
        .logo {
            margin-bottom: 15px;
        }
        
        .logo img {
            max-height: 60px;
            max-width: 180px;
            object-fit: contain;
        }
        
        .organization-name {
            color: #2563eb !important;
            font-size: 24pt;
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
        }
        
        .report-title {
            font-size: 18pt;
            color: #1e40af !important;
            margin: 8px 0;
            font-weight: 600;
            text-align: center;
        }
        
        .subtitle {
            font-size: 11pt;
            color: #64748b !important;
            margin: 4px 0;
            text-align: center;
        }
        
        .metadata {
            background-color: #f8fafc !important;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #2563eb !important;
            page-break-inside: avoid;
        }
        
        .metadata h3 {
            color: #1e40af !important;
            font-size: 13pt;
            margin: 0 0 10px 0;
            font-weight: 600;
        }
        
        .section {
            margin: 25px 0;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        .section-title {
            font-size: 14pt;
            color: #1e40af !important;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #e2e8f0 !important;
            font-weight: 600;
            page-break-after: avoid;
        }
        
        .section-content {
            margin-left: 8px;
            line-height: 1.7;
            font-size: 10pt;
        }
        
        .section-content p {
            margin: 8px 0;
            text-align: justify;
        }
        
        .table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 10pt;
            page-break-inside: avoid;
        }
        
        .table th, .table td {
            border: 1px solid #d1d5db !important;
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
        }
        
        .table th {
            background-color: #f3f4f6 !important;
            font-weight: 600;
            color: #374151 !important;
        }
        
        .table tr:nth-child(even) {
            background-color: #f9fafb !important;
        }
        
        .highlight {
            background-color: #fef3c7 !important;
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280 !important;
            font-size: 9pt;
            border-top: 1px solid #e5e7eb !important;
            padding-top: 15px;
            page-break-inside: avoid;
        }
        
        .stakeholder-info {
            background-color: #eff6ff !important;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #3b82f6 !important;
            page-break-inside: avoid;
        }
        
        .stakeholder-info h3 {
            color: #1e40af !important;
            font-size: 12pt;
            margin: 0 0 8px 0;
            font-weight: 600;
        }
        
        .stakeholder-info p {
            margin: 0;
            font-size: 10pt;
        }
        
        /* Enhanced list styling */
        ul, ol {
            margin: 8px 0;
            padding-left: 20px;
        }
        
        li {
            margin: 4px 0;
            line-height: 1.5;
        }
        
        /* Strong text styling */
        strong, b {
            font-weight: 600;
            color: #1f2937 !important;
        }
        
        /* Page break controls */
        .page-break {
            page-break-before: always;
        }
        
        .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        @media print {
            body { 
                margin: 0; 
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .page-container {
                margin: 0;
                padding: 0;
            }
            .section { 
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .metadata, .stakeholder-info {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="header no-break">
            ${logoBase64 ? `<div class="logo"><img src="${logoBase64}" alt="Organization Logo" /></div>` : ''}
            <div class="organization-name">${report.organizationName}</div>
            <h1 class="report-title">${report.title}</h1>
            <div class="subtitle">Application Owner: ${report.metadata.applicationId}</div>
            <div class="subtitle">Report Owner: Enterprise Architecture</div>
        </div>

        ${stakeholderText ? `
        <div class="stakeholder-info no-break">
            <h3>Stakeholder Audience</h3>
            <p>${stakeholderText}</p>
        </div>
        ` : ''}

        <div class="metadata no-break">
            <h3>Report Information</h3>
            <table class="table">
                <tr><td><strong>Application ID:</strong></td><td>${report.metadata.applicationId}</td></tr>
                <tr><td><strong>Application Name:</strong></td><td>${report.applicationName}</td></tr>
                <tr><td><strong>Organization:</strong></td><td>${report.organizationName}</td></tr>
                <tr><td><strong>Status:</strong></td><td>Active</td></tr>
                <tr><td><strong>Generated Date:</strong></td><td>${currentDate}</td></tr>
            </table>
        </div>

        ${report.sections.map(section => `
            <div class="section no-break">
                <h2 class="section-title">${section.title}</h2>
                <div class="section-content">
                    ${this.formatContent(section.content)}
                </div>
            </div>
        `).join('')}

        <div class="footer no-break">
            <p>This report was generated on ${currentDate} by AgroFuture Connect</p>
            ${stakeholderText ? `<p>Stakeholder Audience: ${stakeholderText}</p>` : ''}
        </div>
    </div>
</body>
</html>
`;
  }

  private async generateSimplePDF(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    console.log('📄 Using simple PDF generation (jsPDF fallback)');

    // Import jsPDF and autoTable for better table formatting
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Set default font to Raleway (fallback to Helvetica if not available)
    try {
      doc.setFont('Raleway', 'normal');
    } catch {
      doc.setFont('helvetica', 'normal');
    }

    // Title and header with Raleway font size 12
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Blue color
    doc.text(report.organizationName, 20, 30);

    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175); // Darker blue
    doc.text(report.title, 20, 45);

    doc.setFontSize(12); // Raleway font size 12 as requested
    doc.setTextColor(100, 116, 139); // Gray
    doc.text(`Application Owner: ${report.metadata.applicationId}`, 20, 55);
    doc.text('Report Owner: Enterprise Architecture', 20, 65);

    // Line separator
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(20, 75, 190, 75);

    // Report Information Table
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text('Report Information', 20, 90);

    let yPos = 100;

    // Create a proper table for report information
    const reportInfoData = [
      ['Application ID', report.metadata.applicationId],
      ['Application Name', report.applicationName],
      ['Organization', report.organizationName],
      ['Status', 'Active'],
      ['Generated Date', currentDate]
    ];

    // Draw table manually with better formatting
    doc.setFontSize(12); // Raleway font size 12
    doc.setTextColor(0, 0, 0);

    // Table headers
    doc.setFillColor(243, 244, 246); // Light gray background
    doc.rect(20, yPos - 5, 170, 8, 'F');
    doc.setTextColor(55, 65, 81); // Dark gray text
    doc.setFontSize(10);
    doc.text('Field', 25, yPos);
    doc.text('Value', 100, yPos);

    // Draw header border
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(20, yPos - 5, 190, yPos - 5); // Top
    doc.line(20, yPos + 3, 190, yPos + 3); // Bottom
    doc.line(20, yPos - 5, 20, yPos + 3); // Left
    doc.line(95, yPos - 5, 95, yPos + 3); // Middle
    doc.line(190, yPos - 5, 190, yPos + 3); // Right

    yPos += 10;

    // Table rows
    reportInfoData.forEach((row, index) => {
      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251); // Very light gray
        doc.rect(20, yPos - 5, 170, 8, 'F');
      }

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12); // Raleway font size 12
      doc.text(row[0], 25, yPos);
      doc.text(row[1], 100, yPos);

      // Draw row borders
      doc.setDrawColor(209, 213, 219);
      doc.line(20, yPos + 3, 190, yPos + 3); // Bottom
      doc.line(20, yPos - 5, 20, yPos + 3); // Left
      doc.line(95, yPos - 5, 95, yPos + 3); // Middle
      doc.line(190, yPos - 5, 190, yPos + 3); // Right

      yPos += 8;
    });

    yPos += 15;

    // Report sections with better formatting
    for (const section of report.sections) {
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Section title with background
      doc.setFillColor(239, 246, 255); // Light blue background
      doc.rect(20, yPos - 5, 170, 12, 'F');
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(2);
      doc.line(20, yPos + 7, 190, yPos + 7); // Bottom border

      doc.setFontSize(14);
      doc.setTextColor(30, 64, 175);
      doc.text(section.title, 25, yPos + 2);
      yPos += 20;

      // Section content with Raleway font size 12
      doc.setFontSize(12); // Raleway font size 12 as requested
      doc.setTextColor(0, 0, 0);

      // Clean and format content
      const cleanContent = section.content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
        .trim();

      // Check if content contains structured data that could be a table
      const lines = cleanContent.split('\n').filter(line => line.trim());
      let hasTableData = false;
      const tableRows: string[][] = [];

      // Try to detect table-like content
      lines.forEach(line => {
        if (line.includes(':') && line.split(':').length === 2) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            tableRows.push([key, value]);
            hasTableData = true;
          }
        }
      });

      if (hasTableData && tableRows.length > 0) {
        // Render as table
        tableRows.forEach((row, index) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          // Alternate row colors
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(25, yPos - 4, 160, 8, 'F');
          }

          doc.setFontSize(12); // Raleway font size 12
          doc.setTextColor(55, 65, 81);
          doc.text(row[0], 30, yPos);
          doc.setTextColor(0, 0, 0);
          doc.text(row[1], 110, yPos);

          // Draw borders
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.3);
          doc.line(25, yPos + 4, 185, yPos + 4);

          yPos += 8;
        });
      } else {
        // Render as regular text with better formatting
        doc.setFontSize(12); // Set font size before splitTextToSize for accurate measurement
        const textLines = doc.splitTextToSize(cleanContent, 155); // Reduced width for better wrapping

        for (let i = 0; i < textLines.length; i++) {
          if (yPos > 265) { // More conservative page break
            doc.addPage();
            yPos = 20;
          }

          // Ensure consistent formatting for each line
          doc.setFontSize(12); // Raleway font size 12
          doc.setTextColor(0, 0, 0);

          // Clean the line text to avoid formatting issues
          const cleanLine = textLines[i].trim();
          if (cleanLine) { // Only render non-empty lines
            doc.text(cleanLine, 25, yPos);
            yPos += 8; // Increased line spacing from 6 to 8 to prevent overlap
          }
        }
      }

      yPos += 15;
    }

    // Enhanced footer with table-like formatting
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Footer background
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 275, 170, 15, 'F');

      // Footer border
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(20, 275, 190, 275);

      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated on ${currentDate} by AgroFuture Connect`, 25, 283);
      doc.text(`Page ${i} of ${pageCount}`, 160, 283);
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  private formatContent(content: string): string {
    // Convert newlines to paragraphs
    const paragraphs = content.split('\n').filter(p => p.trim());

    return paragraphs.map(paragraph => {
      // Check if it's a list item
      if (paragraph.trim().match(/^\d+\./)) {
        return `<li>${paragraph.replace(/^\d+\.\s*/, '')}</li>`;
      }
      // Check if it's a bullet point
      if (paragraph.trim().startsWith('•') || paragraph.trim().startsWith('-')) {
        return `<li>${paragraph.replace(/^[•-]\s*/, '')}</li>`;
      }
      // Check if it contains key-value pairs
      if (paragraph.includes(':**') || paragraph.includes('**')) {
        const formatted = paragraph.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return `<p>${formatted}</p>`;
      }
      return `<p>${paragraph}</p>`;
    }).join('');
  }
}