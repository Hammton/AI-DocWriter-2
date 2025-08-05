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
    console.log('🚀 Using fast simple PDF generation');
    return await this.generateSimplePDF(report, options);
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

  private async generateSimplePDF(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    console.log('📄 Using simple PDF generation (jsPDF fallback)');

    // Import jsPDF for PDF generation
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

    let yPos = 20;

    // Add logo if specified (minimal header)
    if (options.useDefaultLogo || options.logoPath) {
      try {
        let logoBase64: string | null = null;

        if (options.logoPath && fs.existsSync(options.logoPath)) {
          // Custom logo
          const logoBuffer = await sharp(options.logoPath)
            .resize(60, 30, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        } else if (options.useDefaultLogo && fs.existsSync(this.defaultLogoPath)) {
          // DQ default logo
          const logoBuffer = await sharp(this.defaultLogoPath)
            .resize(60, 30, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }

        if (logoBase64) {
          // Add logo at top right (minimal)
          doc.addImage(logoBase64, 'PNG', 150, yPos, 40, 20);
          yPos += 25;
        }
      } catch (error) {
        console.warn('Failed to add logo to PDF:', error);
      }
    }

    // Title and header with Raleway font size 12
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Blue color
    doc.text(report.organizationName, 20, yPos);
    yPos += 15;

    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175); // Darker blue
    doc.text(report.title, 20, yPos);
    yPos += 10;

    doc.setFontSize(12); // Raleway font size 12 as requested
    doc.setTextColor(100, 116, 139); // Gray
    doc.text(`Application Owner: ${report.metadata.applicationId}`, 20, yPos);
    yPos += 10;
    doc.text('Report Owner: Enterprise Architecture', 20, yPos);
    yPos += 10;

    // Line separator
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(20, yPos, 190, yPos);
    yPos += 15;

    // Report Information Table
    doc.setFontSize(14);
    doc.setTextColor(30, 64, 175);
    doc.text('Report Information', 20, yPos);
    yPos += 10;

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

      // Smart content detection - render tables when appropriate, text otherwise
      const lines = cleanContent.split('\n').filter(line => line.trim());
      let hasTableData = false;
      const tableRows: string[][] = [];

      // Detect table-like content (key: value pairs)
      lines.forEach(line => {
        if (line.includes(':') && line.split(':').length === 2) {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value && key.length < 50 && value.length < 100) { // Reasonable key-value pairs
            tableRows.push([key, value]);
            hasTableData = true;
          }
        }
      });

      // Only render as table if we have clear key-value pairs and not too much other content
      const nonTableLines = lines.filter(line => !line.includes(':') || line.split(':').length !== 2);
      const shouldRenderAsTable = hasTableData && tableRows.length >= 2 && nonTableLines.length < tableRows.length;

      if (shouldRenderAsTable) {
        // Render as professional table
        tableRows.forEach((row, index) => {
          if (yPos > 260) {
            doc.addPage();
            yPos = 20;
          }

          // Alternate row colors for better readability
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(25, yPos - 4, 160, 10, 'F');
          }

          doc.setFontSize(12); // Raleway font size 12
          doc.setTextColor(55, 65, 81); // Darker gray for keys
          doc.text(row[0], 30, yPos);
          doc.setTextColor(0, 0, 0); // Black for values
          doc.text(row[1], 110, yPos);

          // Draw subtle borders
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.3);
          doc.line(25, yPos + 6, 185, yPos + 6);

          yPos += 10;
        });
      } else {
        // Render as improved text with better spacing
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        // Split content into paragraphs for better formatting
        const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());

        if (paragraphs.length === 0) {
          paragraphs.push(cleanContent);
        }

        for (const paragraph of paragraphs) {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          // Split paragraph into lines that fit the width
          const textLines = doc.splitTextToSize(paragraph.trim(), 145);

          for (let i = 0; i < textLines.length; i++) {
            if (yPos > 250) {
              doc.addPage();
              yPos = 20;
            }

            doc.setFontSize(12); // Raleway font size 12
            doc.setTextColor(0, 0, 0);

            const cleanLine = textLines[i].trim();
            if (cleanLine) {
              doc.text(cleanLine, 25, yPos);
              yPos += 10; // Good line spacing to prevent overlap
            }
          }

          // Add space between paragraphs
          yPos += 8;
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

      // Add stakeholder audience to footer if specified
      if (options.stakeholderAudience && options.stakeholderAudience.length > 0) {
        const stakeholderText = this.formatStakeholderAudience(options.stakeholderAudience);
        doc.text(`Stakeholder Audience: ${stakeholderText}`, 25, 287);
      }
    }

    return Buffer.from(doc.output('arraybuffer'));
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
}