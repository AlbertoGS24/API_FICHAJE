const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outDir = path.join(process.cwd(), 'manuales');
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
    const text = `Pagina ${i + 1} de ${pageRange.count}`;
    doc.fontSize(9).fillColor('#6b7280').text(text, 50, doc.page.height - 40, {
      width: doc.page.width - 100,
      align: 'center',
    });
  }
}

function writeTitle(doc, title, subtitle) {
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(title);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(12).fillColor('#334155').text(subtitle);
  doc.moveDown(1.2);
}

function writeSection(doc, title, bullets = []) {
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(title);
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(11).fillColor('#111827');

  for (const item of bullets) {
    doc.text(`- ${item}`, {
      indent: 10,
      lineGap: 3,
    });
    doc.moveDown(0.15);
  }

  doc.moveDown(0.7);
}

function buildAdminManual() {
  const filePath = path.join(outDir, 'Manual_Administrador_Fichar.pdf');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, left: 50, right: 50, bottom: 55 },
    bufferPages: true,
  });
  doc.on('pageAdded', () => paintPageWhite(doc));
  doc.pipe(fs.createWriteStream(filePath));
  paintPageWhite(doc);

  writeTitle(
    doc,
    'Manual Basico de Uso - Administrador',
    'Aplicacion de fichaje y gestion de horas | Fecha: 13/03/2026',
  );

  writeSection(doc, '1. Objetivo del manual', [
    'Explicar el uso diario del panel de administrador.',
    'Cubrir altas de usuarios, gestion de solicitudes e informes.',
    'Describir el alta de nuevas empresas con clave de activacion.',
  ]);

  writeSection(doc, '2. Acceso al sistema', [
    'Entrar en la URL de la aplicacion (por ejemplo: http://localhost:3000).',
    'Iniciar sesion con email y contrasena de administrador.',
    'Si es primer acceso, usar enlace de restablecer contrasena enviado por Firebase.',
  ]);

  writeSection(doc, '3. Panel administrador (vista general)', [
    'Dashboard con empleados, horas semanales, solicitudes pendientes y turnos abiertos.',
    'Tabla de solicitudes para aprobar o rechazar con comentario de revision.',
    'Gestion de personal para crear usuarios y editar rol/grupo/horas de practicas.',
    'Auditoria para ver que cambios se realizaron, quien y cuando.',
  ]);

  writeSection(doc, '4. Alta de nuevo trabajador o administrador', [
    'Ir a: Panel administrador > Gestion de personal > Alta de usuario.',
    'Rellenar email (obligatorio), nombre (opcional), rol y grupo.',
    'Si el grupo es INTERN, definir horas totales de practicas.',
    'Pulsar "Crear y enviar acceso" para crear usuario y generar acceso inicial.',
  ]);

  writeSection(doc, '5. Baja o cambio de datos de personal', [
    'En la tabla de usuarios, modificar rol/grupo/horas y pulsar "Guardar cambios".',
    'Se registra el cambio en auditoria.',
    'Regla de seguridad: siempre debe existir al menos un ADMIN por empresa.',
  ]);

  writeSection(doc, '6. Gestion de solicitudes', [
    'En solicitudes pendientes, revisar datos del empleado.',
    'Aprobar o rechazar y anadir comentario de revision opcional.',
    'El comentario queda visible para el empleado en su panel.',
  ]);

  writeSection(doc, '7. Informes y exportaciones', [
    'Exportacion Excel de empresa con resumen, detalle de turnos y resumen diario.',
    'Totales por trabajador y total global de empresa.',
    'Los datos estan aislados por empresa (multiempresa).',
  ]);

  writeSection(doc, '8. Alta de nueva empresa con clave de activacion', [
    'Ir a: Panel administrador > Clave de activacion para nuevo administrador.',
    'Completar: codigo empresa, nombre empresa, email admin inicial y caducidad.',
    'Pulsar "Generar clave de activacion" y guardar la clave.',
    'Compartir la clave solo con el email autorizado.',
    'La clave es de un solo uso y caduca automaticamente.',
  ]);

  writeSection(doc, '9. Seguridad y cumplimiento', [
    'Cada trabajador solo ve sus datos y sus horas.',
    'Solo administradores ven datos globales de su empresa.',
    'Se recomienda HTTPS, copias de seguridad y control de accesos.',
    'Para inspeccion de trabajo, exportar informes desde cuenta admin autorizada.',
  ]);

  writeSection(doc, '10. Buenas practicas operativas', [
    'Revisar solicitudes pendientes a diario.',
    'Comprobar alertas de limite semanal y practicas pendientes.',
    'Mantener datos de usuarios actualizados.',
    'Guardar registro de claves de activacion emitidas.',
  ]);

  addFooter(doc);
  doc.end();
  return filePath;
}

function buildWorkerManual() {
  const filePath = path.join(outDir, 'Manual_Trabajador_Fichar.pdf');
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, left: 50, right: 50, bottom: 55 },
    bufferPages: true,
  });
  doc.on('pageAdded', () => paintPageWhite(doc));
  doc.pipe(fs.createWriteStream(filePath));
  paintPageWhite(doc);

  writeTitle(
    doc,
    'Manual Basico de Uso - Trabajador',
    'Aplicacion de fichaje y consulta de horas | Fecha: 13/03/2026',
  );

  writeSection(doc, '1. Objetivo del manual', [
    'Explicar como acceder, fichar y consultar tus horas.',
    'Guiar el envio de solicitudes e informes personales.',
  ]);

  writeSection(doc, '2. Instalacion y acceso', [
    'Abre la URL de la aplicacion en navegador (movil o PC).',
    'Inicia sesion con tu email y contrasena.',
    'Si es primer acceso, usa el enlace de restablecer contrasena recibido.',
  ]);

  writeSection(doc, '3. Fichaje diario', [
    'Pulsa "Fichar entrada" al empezar la jornada.',
    'El sistema detecta ubicacion automaticamente (sin escribir coordenadas).',
    'Pulsa "Fichar salida" al terminar.',
    'Veras un contador con el tiempo trabajado del turno activo.',
  ]);

  writeSection(doc, '4. Solicitudes', [
    'Puedes crear solicitudes de vacaciones, horas extra o correcciones.',
    'Indica inicio, fin y comentario opcional.',
    'Si esta en estado PENDING, puedes cancelarla.',
    'Cuando el admin la revise, veras estado y comentario de revision.',
  ]);

  writeSection(doc, '5. Consulta de horas personales', [
    'Tienes acceso a tus horas acumuladas diarias, semanales y mensuales.',
    'Puedes solicitar y firmar tus documentos de horas (PDF).',
    'No puedes ver datos de otros trabajadores.',
  ]);

  writeSection(doc, '6. Horas extraordinarias', [
    'Si superas el limite semanal configurado, el sistema genera aviso.',
    'Podras ver alertas y el estado de horas extra pendientes de revision.',
    'El objetivo es que conozcas cuando entras en tramo de horas extra.',
  ]);

  writeSection(doc, '7. Alumnos en practicas / becarios', [
    'Si eres INTERN, el sistema muestra horas totales, consumidas y pendientes.',
    'Cuando quedan 40 horas pendientes, se genera aviso automatico.',
    'Mantente atento al panel de progreso y notificaciones.',
  ]);

  writeSection(doc, '8. Firma de documentos', [
    'Selecciona documento en estado DRAFT.',
    'Dibuja firma en el recuadro y pulsa "Firmar documento".',
    'Tras la firma, el documento queda sellado con hash y ya no editable.',
  ]);

  writeSection(doc, '9. Recomendaciones de uso', [
    'No compartas tu contrasena.',
    'Ficha siempre al inicio y al final de jornada.',
    'Revisa notificaciones y solicitudes con frecuencia.',
    'Si detectas un error, solicita correccion desde la app.',
  ]);

  writeSection(doc, '10. Soporte', [
    'Para incidencias de acceso o fichaje, contacta con tu administrador.',
    'Indica fecha, hora y captura de pantalla para acelerar la solucion.',
  ]);

  addFooter(doc);
  doc.end();
  return filePath;
}

const adminPath = buildAdminManual();
const workerPath = buildWorkerManual();

console.log('PDF generados:');
console.log(adminPath);
console.log(workerPath);
