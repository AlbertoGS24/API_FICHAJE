const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'public', 'downloads');
fs.mkdirSync(outDir, { recursive: true });

function paintPageWhite(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
  doc.restore();
  doc.fillColor('#111111');
}

function addFooter(doc) {
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i += 1) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text(`Pagina ${i + 1} de ${pageRange.count}`, 50, doc.page.height - 40, {
        width: doc.page.width - 100,
        align: 'center',
      });
  }
  doc.fillColor('#111111');
}

function ensureSpace(doc, neededHeight = 24) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight <= bottomLimit) return;
  doc.addPage();
}

function writeHeading(doc, text, level) {
  ensureSpace(doc, 34);
  if (level === 1) {
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(text);
    doc.moveDown(0.4);
    return;
  }
  if (level === 2) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(text);
    doc.moveDown(0.2);
    return;
  }
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1f2937').text(text);
  doc.moveDown(0.15);
}

function writeParagraph(doc, text) {
  ensureSpace(doc, 20);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text(text, {
      lineGap: 2,
    });
  doc.moveDown(0.2);
}

function writeBullet(doc, text) {
  ensureSpace(doc, 18);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text(`• ${text}`, {
      indent: 12,
      lineGap: 2,
    });
  doc.moveDown(0.15);
}

function writeNumbered(doc, text) {
  ensureSpace(doc, 18);
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text(text, {
      indent: 8,
      lineGap: 2,
    });
  doc.moveDown(0.15);
}

function renderMarkdownIntoPdf(doc, markdownContent) {
  const lines = markdownContent.replace(/\r\n/g, '\n').split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith('# ')) {
      writeHeading(doc, line.slice(2).trim(), 1);
      continue;
    }

    if (line.startsWith('## ')) {
      writeHeading(doc, line.slice(3).trim(), 2);
      continue;
    }

    if (line.startsWith('### ')) {
      writeHeading(doc, line.slice(4).trim(), 3);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      writeBullet(doc, line.replace(/^[-*]\s+/, ''));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      writeNumbered(doc, line);
      continue;
    }

    writeParagraph(doc, line);
  }
}

function generatePdfFromMarkdown(inputPath, outputPath) {
  const content = fs.readFileSync(inputPath, 'utf8');

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, left: 50, right: 50, bottom: 55 },
    bufferPages: true,
  });
  doc.on('pageAdded', () => paintPageWhite(doc));
  doc.pipe(fs.createWriteStream(outputPath));
  paintPageWhite(doc);

  renderMarkdownIntoPdf(doc, content);
  addFooter(doc);
  doc.end();
}

const jobs = [
  {
    input: path.join(rootDir, 'docs', 'checklist-hardening-lopd-despliegue.md'),
    output: path.join(outDir, 'Checklist_Hardening_LOPD_Despliegue.pdf'),
  },
  {
    input: path.join(rootDir, 'docs', 'firebase-password-policy-fuerte.md'),
    output: path.join(outDir, 'Guia_Firebase_Password_Policy_Fuerte.pdf'),
  },
  {
    input: path.join(
      rootDir,
      'docs',
      'reports',
      'informe-semanal-2026-03-09-a-2026-03-13.md',
    ),
    output: path.join(outDir, 'Informe_Semanal_2026-03-09_a_2026-03-13.pdf'),
  },
  {
    input: path.join(rootDir, 'docs', 'reports', 'informe-diario-2026-03-13.md'),
    output: path.join(outDir, 'Informe_Diario_2026-03-13.pdf'),
  },
  {
    input: path.join(rootDir, 'docs', 'reports', 'informe-diario-2026-03-16.md'),
    output: path.join(outDir, 'Informe_Diario_2026-03-16.pdf'),
  },
  {
    input: path.join(rootDir, 'docs', 'reports', 'informe-diario-2026-03-18.md'),
    output: path.join(outDir, 'Informe_Diario_2026-03-18.pdf'),
  },
];

for (const job of jobs) {
  if (!fs.existsSync(job.input)) {
    throw new Error(`No existe el archivo de entrada: ${job.input}`);
  }
  generatePdfFromMarkdown(job.input, job.output);
  console.log(job.output);
}
