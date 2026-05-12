import PDFDocument from 'pdfkit';
import { marked, type Token, type Tokens } from 'marked';

// ── Constants ────────────────────────────────────────────────────────

const PAGE_MARGIN = 50;
const FONT_BODY = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const FONT_SIZE_H1 = 22;
const FONT_SIZE_H2 = 17;
const FONT_SIZE_H3 = 14;
const FONT_SIZE_BODY = 11;
const LINE_GAP = 3;
const TABLE_CELL_PAD = 6;
const TABLE_ROW_HEIGHT = 22;
const LIST_INDENT = 16;

/**
 * Renders a Markdown string to a PDF Buffer using pdfkit + marked.
 * Fully deterministic — no LLM calls, no network requests.
 */
export class PdfReportRenderer {
  async render(markdown: string): Promise<Buffer> {
    const tokens = marked.lexer(markdown);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
      info: {
        Title: 'Workspace Report',
        Creator: 'ContextOS',
      },
    });

    // Collect output into a Buffer
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.renderTokens(doc, tokens);
    doc.end();

    return finished;
  }

  // ── Token walker ─────────────────────────────────────────────────

  private renderTokens(doc: PDFKit.PDFDocument, tokens: Token[]): void {
    for (const token of tokens) {
      switch (token.type) {
        case 'heading':
          this.renderHeading(doc, token as Tokens.Heading);
          break;
        case 'paragraph':
          this.renderParagraph(doc, token as Tokens.Paragraph);
          break;
        case 'table':
          this.renderTable(doc, token as Tokens.Table);
          break;
        case 'list':
          this.renderList(doc, token as Tokens.List);
          break;
        case 'hr':
          this.renderHr(doc);
          break;
        case 'space':
          doc.moveDown(0.3);
          break;
        default:
          // code blocks, html, etc. — render as plain text fallback
          if ('text' in token && typeof token.text === 'string') {
            doc.font(FONT_BODY).fontSize(FONT_SIZE_BODY).text(token.text, { lineGap: LINE_GAP });
          }
          break;
      }
    }
  }

  // ── Headings ─────────────────────────────────────────────────────

  private renderHeading(doc: PDFKit.PDFDocument, token: Tokens.Heading): void {
    const sizes: Record<number, number> = { 1: FONT_SIZE_H1, 2: FONT_SIZE_H2, 3: FONT_SIZE_H3 };
    const size = sizes[token.depth] ?? FONT_SIZE_H3;

    doc.moveDown(0.6);
    doc.font(FONT_BOLD).fontSize(size).text(token.text, { lineGap: LINE_GAP });
    doc.moveDown(0.3);
  }

  // ── Paragraphs (with inline formatting) ──────────────────────────

  private renderParagraph(doc: PDFKit.PDFDocument, token: Tokens.Paragraph): void {
    if (token.tokens && token.tokens.length > 0) {
      this.renderInlineTokens(doc, token.tokens);
    } else {
      doc.font(FONT_BODY).fontSize(FONT_SIZE_BODY).text(token.text, { lineGap: LINE_GAP });
    }
    doc.moveDown(0.4);
  }

  private renderInlineTokens(doc: PDFKit.PDFDocument, tokens: Token[]): void {
    // Build text segments then render in one flow
    doc.fontSize(FONT_SIZE_BODY);

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      const continued = i < tokens.length - 1;

      switch (t.type) {
        case 'strong':
          doc.font(FONT_BOLD).text((t as Tokens.Strong).text, { continued, lineGap: LINE_GAP });
          doc.font(FONT_BODY);
          break;
        case 'em':
          doc.font(FONT_ITALIC).text((t as Tokens.Em).text, { continued, lineGap: LINE_GAP });
          doc.font(FONT_BODY);
          break;
        case 'text':
          doc.font(FONT_BODY).text((t as Tokens.Text).text, { continued, lineGap: LINE_GAP });
          break;
        case 'link':
          doc.font(FONT_BODY).text((t as Tokens.Link).text, { continued, lineGap: LINE_GAP });
          break;
        default:
          if ('text' in t && typeof t.text === 'string') {
            doc.font(FONT_BODY).text(t.text, { continued, lineGap: LINE_GAP });
          }
          break;
      }
    }
  }

  // ── Lists ────────────────────────────────────────────────────────

  private renderList(doc: PDFKit.PDFDocument, token: Tokens.List): void {
    for (let i = 0; i < token.items.length; i++) {
      const item = token.items[i]!;
      const prefix = token.ordered ? `${i + 1}. ` : '• ';
      doc
        .font(FONT_BODY)
        .fontSize(FONT_SIZE_BODY)
        .text(`${prefix}${item.text}`, doc.x + LIST_INDENT, undefined, {
          width: doc.page.width - PAGE_MARGIN * 2 - LIST_INDENT,
          lineGap: LINE_GAP,
          indent: 0,
        });
    }
    // Reset x position after indented list
    doc.x = PAGE_MARGIN;
    doc.moveDown(0.3);
  }

  // ── Tables ───────────────────────────────────────────────────────

  private renderTable(doc: PDFKit.PDFDocument, token: Tokens.Table): void {
    const colCount = token.header.length;
    if (colCount === 0) return;

    const usableWidth = doc.page.width - PAGE_MARGIN * 2;
    const colWidth = usableWidth / colCount;

    // Header row
    const headerY = doc.y;
    doc.font(FONT_BOLD).fontSize(FONT_SIZE_BODY);
    for (let c = 0; c < colCount; c++) {
      const cell = token.header[c]!;
      doc.text(cell.text, PAGE_MARGIN + c * colWidth + TABLE_CELL_PAD, headerY, {
        width: colWidth - TABLE_CELL_PAD * 2,
        lineGap: 0,
      });
    }
    doc.y = headerY + TABLE_ROW_HEIGHT;

    // Header underline
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + usableWidth, doc.y)
      .lineWidth(0.5)
      .stroke();
    doc.y += 4;

    // Data rows
    doc.font(FONT_BODY).fontSize(FONT_SIZE_BODY);
    for (const row of token.rows) {
      const rowY = doc.y;

      // Check page break
      if (rowY + TABLE_ROW_HEIGHT > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
      }

      const cellY = doc.y;
      for (let c = 0; c < colCount; c++) {
        const cell = row[c];
        const text = cell?.text ?? '';
        doc.text(text, PAGE_MARGIN + c * colWidth + TABLE_CELL_PAD, cellY, {
          width: colWidth - TABLE_CELL_PAD * 2,
          lineGap: 0,
        });
      }
      doc.y = cellY + TABLE_ROW_HEIGHT;
    }

    doc.moveDown(0.5);
  }

  // ── Horizontal rule ──────────────────────────────────────────────

  private renderHr(doc: PDFKit.PDFDocument): void {
    doc.moveDown(0.5);
    const y = doc.y;
    doc
      .moveTo(PAGE_MARGIN, y)
      .lineTo(doc.page.width - PAGE_MARGIN, y)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);
  }
}
