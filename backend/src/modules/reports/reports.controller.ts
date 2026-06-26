import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService, type ReportQuery } from './reports.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import * as ExcelJS from 'exceljs';

@Roles('ADMINISTRATOR' as any, 'GENERAL_MANAGER' as any, 'PRODUCTION_MANAGER' as any, 'HEAD_OF_OPERATIONS' as any, 'ACCOUNTANT' as any)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** JSON report data (for frontend rendering) */
  @Get()
  async getReport(
    @Query('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fields') fieldsRaw?: string,
    @Query('stage') stage?: string,
    @Query('locationId') locationId?: string,
  ) {
    const validTypes = ['production', 'stages', 'wastage', 'workers', 'delays', 'inventory', 'financial'];
    if (!type || !validTypes.includes(type)) {
      throw new BadRequestException(`type must be one of: ${validTypes.join(', ')}`);
    }
    const fields = fieldsRaw ? fieldsRaw.split(',').map(f => f.trim()).filter(Boolean) : undefined;
    const query: ReportQuery = { type: type as ReportQuery['type'], from, to, fields, stage, locationId };
    return this.reportsService.getReportData(query);
  }

  /** Export as CSV / XLSX / PDF */
  @Get('export')
  async exportReport(
    @Query('type') type: string,
    @Query('format') format: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fields') fieldsRaw?: string,
    @Query('stage') stage?: string,
    @Query('locationId') locationId?: string,
    @Res() res?: Response,
  ) {
    const validTypes = ['production', 'stages', 'wastage', 'workers', 'delays', 'inventory', 'financial'];
    if (!type || !validTypes.includes(type)) {
      throw new BadRequestException(`type must be one of: ${validTypes.join(', ')}`);
    }
    const validFormats = ['csv', 'xlsx', 'pdf'];
    if (!format || !validFormats.includes(format)) {
      throw new BadRequestException(`format must be one of: ${validFormats.join(', ')}`);
    }
    const fields = fieldsRaw ? fieldsRaw.split(',').map(f => f.trim()).filter(Boolean) : undefined;
    const query: ReportQuery = { type: type as ReportQuery['type'], from, to, fields, stage, locationId };
    const data = await this.reportsService.getReportData(query);

    if (!res) throw new BadRequestException('Invalid response context');

    const fileName = `report-${type}-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'csv') {
      return this.exportCsv(res, data, fileName);
    }
    if (format === 'xlsx') {
      return this.exportXlsx(res, data, fileName);
    }
    if (format === 'pdf') {
      return this.exportPdf(res, data, fileName, type);
    }
  }

  private exportCsv(res: Response, data: { columns: string[]; rows: Record<string, unknown>[] }, fileName: string) {
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const header = data.columns.map(escape).join(',');
    const body = data.rows.map(row =>
      data.columns.map(col => escape(row[col])).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    res.send(`${header}\n${body}`);
  }

  private async exportXlsx(res: Response, data: { columns: string[]; rows: Record<string, unknown>[] }, fileName: string) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');

    sheet.columns = data.columns.map(col => ({
      header: col.replace(/([A-Z])/g, ' $1').trim(),
      key: col,
      width: 18,
    }));

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const row of data.rows) {
      const values: Record<string, unknown> = {};
      for (const col of data.columns) {
        values[col] = row[col] ?? '';
      }
      sheet.addRow(values);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }

  private async exportPdf(res: Response, data: { columns: string[]; rows: Record<string, unknown>[] }, fileName: string, reportType: string) {
    // Dynamic import for pdfkit (CommonJS compatibility)
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
    doc.pipe(res);

    // Header / letterhead
    doc.fontSize(18).font('Helvetica-Bold').text('TPPC Manufacturing', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(
      `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report — Generated ${new Date().toLocaleDateString()}`,
      { align: 'center' }
    );
    doc.moveDown();

    // Table
    const cols = data.columns.slice(0, 8); // limit columns to fit landscape A4
    const colWidth = (doc.page.width - 60) / cols.length;
    let y = doc.y;

    // Header row
    doc.fontSize(8).font('Helvetica-Bold');
    cols.forEach((col, i) => {
      doc.text(
        col.replace(/([A-Z])/g, ' $1').trim(),
        30 + i * colWidth,
        y,
        { width: colWidth - 4, align: 'left' }
      );
    });
    y += 15;
    doc.moveTo(30, y).lineTo(doc.page.width - 30, y).stroke();
    y += 5;

    // Data rows
    doc.font('Helvetica').fontSize(7);
    for (const row of data.rows) {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 30;
      }
      cols.forEach((col, i) => {
        const val = row[col] ?? '';
        const display = val instanceof Date ? val.toLocaleDateString() : String(val);
        doc.text(
          display.substring(0, 30),
          30 + i * colWidth,
          y,
          { width: colWidth - 4, align: 'left' }
        );
      });
      y += 12;
    }

    // Footer
    doc.fontSize(8).text(
      `Total records: ${data.rows.length}`,
      30,
      doc.page.height - 40,
      { align: 'right', width: doc.page.width - 60 }
    );

    doc.end();
  }
}
