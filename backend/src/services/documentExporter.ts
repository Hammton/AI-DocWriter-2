import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, ImageRun, Header, Footer } from 'docx';
import { GeneratedReport } from './reportGenerator';
import fs from 'fs';
import path from 'path';

export interface ExportOptions {
  format: 'pdf' | 'docx';
  logoPath?: string;
  useDefaultLogo?: boolean;
  stakeholderAudience?: string[];
  customInstructions?: string;
}

export class DocumentExporter {
  async exportDocument(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    console.log(`🚀 Exporting ${options.format.toUpperCase()} - Vercel compatible version`);

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
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create header with logo
    const headerChildren: any[] = [];

    // Add logo to header if specified
    if (options.useDefaultLogo) {
      try {
        // Try to use the actual DQ logo from the project
        const defaultLogoPath = this.getDefaultLogoPath();
        if (defaultLogoPath) {
          const logoBuffer = fs.readFileSync(defaultLogoPath);
          headerChildren.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: logoBuffer,
                  transformation: {
                    width: 100,
                    height: 50,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          );
        } else {
          // Fallback to SVG logo
          headerChildren.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: await this.createDQLogoBuffer(),
                  transformation: {
                    width: 100,
                    height: 50,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          );
        }
      } catch (error) {
        console.warn('Failed to load default DQ logo for DOCX, using text fallback:', error);
        // Add text placeholder instead
        headerChildren.push(
          new Paragraph({
            text: "DQ LOGO",
            alignment: AlignmentType.CENTER,
          })
        );
      }
    } else if (options.logoPath && fs.existsSync(options.logoPath)) {
      try {
        const logoBuffer = fs.readFileSync(options.logoPath);
        headerChildren.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: logoBuffer,
                transformation: {
                  width: 100,
                  height: 50,
                },
              }),
            ],
            alignment: AlignmentType.CENTER,
          })
        );
      } catch (error) {
        console.warn('Failed to add custom logo to DOCX:', error);
        // Add text placeholder instead
        headerChildren.push(
          new Paragraph({
            text: "[CUSTOM LOGO]",
            alignment: AlignmentType.CENTER,
          })
        );
      }
    }

    // Create footer with stakeholder audience
    const footerChildren: any[] = [
      new Paragraph({
        text: `Generated on ${currentDate} by AI DocWriter 4.0`,
        alignment: AlignmentType.CENTER,
      })
    ];

    if (options.stakeholderAudience && options.stakeholderAudience.length > 0) {
      footerChildren.push(
        new Paragraph({
          text: `Stakeholder Audience: ${this.formatStakeholderAudience(options.stakeholderAudience)}`,
          alignment: AlignmentType.CENTER,
        })
      );
    }

    const doc = new Document({
      sections: [{
        properties: {},
        headers: headerChildren.length > 0 ? {
          default: new Header({
            children: headerChildren,
          }),
        } : undefined,
        footers: {
          default: new Footer({
            children: footerChildren,
          }),
        },
        children: await this.generateDOCXContent(report, options)
      }]
    });

    return await Packer.toBuffer(doc);
  }

  private async generateSimplePDF(report: GeneratedReport, options: ExportOptions): Promise<Buffer> {
    console.log('📄 Using simple PDF generation with enhanced logo support');

    // Import jsPDF for PDF generation
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF();
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Set default font
    try {
      doc.setFont('helvetica', 'normal');
    } catch {
      // Fallback if font setting fails
    }

    let yPos = 20;

    // Enhanced logo handling
    if (options.useDefaultLogo) {
      try {
        // Try to use the actual DQ logo from the project
        const defaultLogoPath = this.getDefaultLogoPath();
        if (defaultLogoPath) {
          const logoBuffer = fs.readFileSync(defaultLogoPath);
          const logoBase64 = logoBuffer.toString('base64');
          const logoExt = path.extname(defaultLogoPath).toLowerCase();

          let format = 'PNG';
          if (logoExt === '.jpg' || logoExt === '.jpeg') format = 'JPEG';
          else if (logoExt === '.gif') format = 'GIF';

          // Add logo centered at top
          doc.addImage(`data:image/${format.toLowerCase()};base64,${logoBase64}`, format, 85, yPos - 5, 20, 15);
          yPos += 25;
        } else {
          // Fallback to text-based DQ logo
          doc.setFillColor(37, 99, 235); // Blue background
          doc.rect(85, yPos - 5, 20, 15, 'F');
          doc.setFontSize(16);
          doc.setTextColor(255, 255, 255); // White text
          doc.text('DQ', 92, yPos + 5);
          yPos += 25;
        }
      } catch (error) {
        console.warn('Failed to load default DQ logo, using text fallback:', error);
        // Fallback to text-based DQ logo
        doc.setFillColor(37, 99, 235); // Blue background
        doc.rect(85, yPos - 5, 20, 15, 'F');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255); // White text
        doc.text('DQ', 92, yPos + 5);
        yPos += 25;
      }
    } else if (options.logoPath && fs.existsSync(options.logoPath)) {
      try {
        // Try to add custom logo image
        const logoBuffer = fs.readFileSync(options.logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        const logoExt = path.extname(options.logoPath).toLowerCase();

        let format = 'JPEG';
        if (logoExt === '.png') format = 'PNG';
        else if (logoExt === '.gif') format = 'GIF';

        // Add logo centered at top
        doc.addImage(`data:image/${format.toLowerCase()};base64,${logoBase64}`, format, 85, yPos - 5, 20, 15);
        yPos += 25;
      } catch (error) {
        console.warn('Failed to add custom logo, using placeholder:', error);
        // Fallback to placeholder
        doc.setFillColor(229, 231, 235); // Light gray background
        doc.rect(85, yPos - 5, 20, 15, 'F');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text('LOGO', 92, yPos + 5);
        yPos += 25;
      }
    } else if (!options.useDefaultLogo) {
      // Custom logo selected but no file provided - show placeholder
      doc.setFillColor(229, 231, 235); // Light gray background
      doc.rect(85, yPos - 5, 20, 15, 'F');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('LOGO', 92, yPos + 5);
      yPos += 25;
    }

    // Title and header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Blue color
    doc.text(report.organizationName, 20, yPos);
    yPos += 15;

    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175); // Darker blue
    doc.text(report.title, 20, yPos);
    yPos += 10;

    doc.setFontSize(12);
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
    doc.setFontSize(12);
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
      doc.setFontSize(12);
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

      // Section content
      doc.setFontSize(12);
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
          if (key && value && key.length < 50 && value.length < 100) {
            tableRows.push([key, value]);
            hasTableData = true;
          }
        }
      });

      // Only render as table if we have clear key-value pairs
      const nonTableLines = lines.filter(line => !line.includes(':') || line.split(':').length !== 2);
      const shouldRenderAsTable = hasTableData && tableRows.length >= 2 && nonTableLines.length < tableRows.length;

      if (shouldRenderAsTable) {
        // Render as professional table
        tableRows.forEach((row, index) => {
          if (yPos > 260) {
            doc.addPage();
            yPos = 20;
          }

          // Alternate row colors
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(25, yPos - 4, 160, 10, 'F');
          }

          doc.setFontSize(12);
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
        // Render as improved text
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        // Split content into paragraphs
        const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());

        if (paragraphs.length === 0) {
          paragraphs.push(cleanContent);
        }

        for (const paragraph of paragraphs) {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          // Split paragraph into lines that fit
          const textLines = doc.splitTextToSize(paragraph.trim(), 145);

          for (let i = 0; i < textLines.length; i++) {
            if (yPos > 250) {
              doc.addPage();
              yPos = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);

            const cleanLine = textLines[i].trim();
            if (cleanLine) {
              doc.text(cleanLine, 25, yPos);
              yPos += 10;
            }
          }

          // Add space between paragraphs
          yPos += 8;
        }
      }

      yPos += 15;
    }

    // Enhanced footer
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

    // Title (no logo for DOCX to avoid file system issues)
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

  private formatStakeholderAudience(stakeholders?: string[]): string {
    if (!stakeholders || stakeholders.length === 0) return '';

    if (stakeholders.length === 1) return stakeholders[0];
    if (stakeholders.length === 2) return stakeholders.join(' and ');

    const lastStakeholder = stakeholders.pop();
    return stakeholders.join(', ') + ', and ' + lastStakeholder;
  }

  private async createDQLogoBuffer(): Promise<Buffer> {
    // Create a simple DQ logo as SVG and convert to buffer
    const svgLogo = `
      <svg width="100" height="50" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="50" fill="#2563eb" rx="5"/>
        <text x="50" y="32" font-family="Arial, sans-serif" font-size="18" font-weight="bold" 
              text-anchor="middle" fill="white">DQ</text>
        <text x="50" y="45" font-family="Arial, sans-serif" font-size="8" 
              text-anchor="middle" fill="white">LOGO</text>
      </svg>
    `;

    return Buffer.from(svgLogo, 'utf-8');
  }

  private getDefaultLogoPath(): string {
    // Try multiple possible locations for the default logo
    const possiblePaths = [
      path.join(__dirname, '../../../Logo.png'),
      path.join(__dirname, '../../Logo.png'),
      path.join(process.cwd(), 'Logo.png'),
      path.join(__dirname, '../../../frontend/src/assets/dq-logo.png'),
      path.join(__dirname, '../../../backend/public/assets/dq-logo.png')
    ];

    for (const logoPath of possiblePaths) {
      if (fs.existsSync(logoPath)) {
        console.log(`Found default logo at: ${logoPath}`);
        return logoPath;
      }
    }

    console.warn('Default logo not found in any expected location');
    return '';
  }
}