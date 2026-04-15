const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const PDFDocument = require('pdfkit');

const outDir = path.join(process.cwd(), 'manuales');
fs.mkdirSync(outDir, { recursive: true });

const reportDateIso = process.argv[2] || '2026-03-17';

const reportDataByDate = {
  '2026-03-17': {
    reportDate: '17/03/2026',
    reportDay: 'Martes',
    sections: {
      done: [
        'Refuerzo de seguridad en backend (CORS allowlist, cabeceras de seguridad y rate limit).',
        'Proteccion de Swagger en produccion con clave de acceso.',
        'Implementacion anti-fraude de geolocalizacion: Workplace por empresa y nuevos campos de riesgo en Shift.',
        'Nueva logica de riesgo en clock-in/clock-out (precision GPS, geofence y desplazamientos anomales).',
        'Nuevos endpoints admin para configurar geofence y listar fichajes sospechosos.',
        'Integracion en frontend admin de formulario geofence y tabla de fichajes sospechosos.',
        'Validaciones tecnicas ejecutadas: prisma generate, prisma validate, npm run build y chequeo de app.js.',
      ],
      pending: [
        'Aplicar migracion en todos los entornos y validar datos historicos.',
        'Completar pruebas funcionales de casos fuera de geofence y baja precision.',
        'Ajustar umbrales de riesgo para operativa real.',
      ],
      next: [
        'Completar testeo end-to-end del flujo de geolocalizacion anti-fraude.',
        'Definir politica final de alertas y revision de fichajes sospechosos.',
        'Preparar checklist de cierre para entrega final.',
      ],
      needs: [
        'Coordenadas reales del centro de trabajo y radio operativo.',
        'Definicion final de umbrales de precision y score de sospecha.',
        'Usuarios de prueba (admin, empleado e intern) para validacion final.',
      ],
      attachments: [
        'src/main.ts',
        'prisma/schema.prisma',
        'prisma/migrations/20260317120000_add_workplace_and_shift_risk/migration.sql',
        'src/shifts/shifts.service.ts',
        'src/shifts/shifts.controller.ts',
        'src/admin/admin.controller.ts',
        'src/admin/admin.service.ts',
        'src/admin/dto/set-workplace.dto.ts',
        'public/index.html',
        'public/app.js',
      ],
    },
  },
  '2026-03-18': {
    reportDate: '18/03/2026',
    reportDay: 'Miercoles',
    sections: {
      done: [
        'Implementacion del historial de ultimos fichajes en pantalla de inicio.',
        'Nuevo endpoint de usuario autenticado para historial: GET /shifts/me?limit=10.',
        'Integracion frontend de tabla "Ultimos fichajes" y recarga manual.',
        'Actualizacion automatica del historial tras fichar entrada y salida.',
        'Refactor completo de tipado: eliminacion de req:any en controladores y guards.',
        'Creacion de tipo comun RequestWithUser y uso con import type en firmas decoradas.',
        'Correcciones de tipado en servicios y tests (AdminService, ReportsService, UsersController y spec de seguridad).',
        'Validaciones tecnicas ejecutadas: npm run lint, npm run build, npm test y npm run test:e2e.',
      ],
      pending: [
        'Prueba funcional manual final del flujo completo admin/empleado/intern en navegador.',
        'Revision final de checklist de pre-entrega y despliegue.',
        'Empaquetado de documentacion final para entrega.',
      ],
      next: [
        'Ejecutar demo end-to-end con evidencias para tutoria.',
        'Cerrar informe final y paquete de entrega.',
        'Congelar version estable para entrega del dia 23.',
      ],
      needs: [
        'Entorno de preproduccion para validacion final de despliegue.',
        'Confirmacion final del formato de entrega por parte del tutor.',
        'Tiempo de prueba con usuarios de ejemplo (admin, empleado, intern).',
      ],
      attachments: [
        'src/auth/request-with-user.ts',
        'src/auth/firebase-auth.guard.ts',
        'src/auth/admin.guard.ts',
        'src/shifts/shifts.service.ts',
        'src/shifts/shifts.controller.ts',
        'src/admin/admin.controller.ts',
        'src/requests/requests.controller.ts',
        'src/documents/documents.controller.ts',
        'src/reports/reports.controller.ts',
        'src/onboarding/onboarding.controller.ts',
        'src/notifications/notifications.controller.ts',
        'src/exports/exports.controller.ts',
        'src/exports/user-exports.controller.ts',
        'src/users/users.controller.ts',
        'src/admin/admin.service.ts',
        'src/reports/reports.service.ts',
        'src/main.ts',
        'src/admin/admin.service.security.spec.ts',
        'public/index.html',
        'public/app.js',
      ],
    },
  },
};

const selectedReport =
  reportDataByDate[reportDateIso] || reportDataByDate['2026-03-17'];
const reportDate = selectedReport.reportDate;
const reportDay = selectedReport.reportDay;

const docxPath = path.join(outDir, `Parte_Trabajo_Diario_${reportDateIso}.docx`);
const pdfPath = path.join(outDir, `Parte_Trabajo_Diario_${reportDateIso}.pdf`);
const txtPath = path.join(outDir, `Parte_Trabajo_Diario_${reportDateIso}.txt`);
const sections = selectedReport.sections;

function buildPlainText() {
  const lines = [
    'PARTE DE PRACTICAS DIARIAS',
    `PROYECTO: API Fichar${' '.repeat(44)}DIA: ${reportDay}`,
    'ALUMNO: Alberto                         TEL:',
    'EMAIL:',
    `CENTRO DOCENTE:${' '.repeat(24)}FECHA DE ENTREGA: ${reportDate}`,
    '',
    'QUE HEMOS HECHO:',
    ...sections.done.map((item) => `- ${item}`),
    '',
    'QUE QUEDA PENDIENTE:',
    ...sections.pending.map((item) => `- ${item}`),
    '',
    'CUAL ES NUESTRO SIGUIENTE:',
    ...sections.next.map((item) => `- ${item}`),
    '',
    'QUE NECESITAMOS:',
    ...sections.needs.map((item) => `- ${item}`),
    '',
    'ARCHIVOS ADJUNTOS:',
    ...sections.attachments.map((item) => `- ${item}`),
    '',
  ];

  return `${lines.join('\n')}`;
}

function buildDocx() {
  fs.writeFileSync(txtPath, buildPlainText(), 'utf8');
  execFileSync('textutil', ['-convert', 'docx', '-output', docxPath, txtPath], {
    stdio: 'inherit',
  });
}

function writeBullets(doc, items) {
  doc.font('Helvetica').fontSize(11).fillColor('#111827');
  for (const item of items) {
    doc.text(`- ${item}`, { indent: 10, lineGap: 3 });
    doc.moveDown(0.2);
  }
}

function writeSection(doc, title, items) {
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(title);
  doc.moveDown(0.3);
  writeBullets(doc, items);
}

function buildPdf() {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, left: 50, right: 50, bottom: 50 },
    bufferPages: true,
  });

  doc.pipe(fs.createWriteStream(pdfPath));

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('PARTE DE PRACTICAS DIARIAS', {
    align: 'center',
  });
  doc.moveDown(1.2);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('PROYECTO: ', { continued: true });
  doc.font('Helvetica').text('API Fichar', { continued: true });
  doc.font('Helvetica-Bold').text('       DIA: ', { continued: true });
  doc.font('Helvetica').text(reportDay);

  doc.font('Helvetica-Bold').text('ALUMNO: ', { continued: true });
  doc.font('Helvetica').text('Alberto', { continued: true });
  doc.font('Helvetica-Bold').text('       TEL: ', { continued: true });
  doc.font('Helvetica').text('');

  doc.font('Helvetica-Bold').text('EMAIL: ', { continued: true });
  doc.font('Helvetica').text('');

  doc.font('Helvetica-Bold').text('CENTRO DOCENTE: ', { continued: true });
  doc.font('Helvetica').text('', { continued: true });
  doc.font('Helvetica-Bold').text('       FECHA DE ENTREGA: ', { continued: true });
  doc.font('Helvetica').text(reportDate);

  writeSection(doc, 'QUE HEMOS HECHO:', sections.done);
  writeSection(doc, 'QUE QUEDA PENDIENTE:', sections.pending);
  writeSection(doc, 'CUAL ES NUESTRO SIGUIENTE:', sections.next);
  writeSection(doc, 'QUE NECESITAMOS:', sections.needs);
  writeSection(doc, 'ARCHIVOS ADJUNTOS:', sections.attachments);

  doc.end();
}

buildDocx();
buildPdf();

console.log('Archivos generados:');
console.log(docxPath);
console.log(pdfPath);
