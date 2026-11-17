/**
 * Carga los correos de demo en la bandeja de una cuenta de Gmail de PRUEBAS, como si hubieran llegado.
 * No envía nada a nadie: los mete directamente en tu bandeja (Gmail API, messages.insert).
 *
 * Cómo usarlo (una vez, unos 5 minutos):
 * 1. Con la cuenta de Gmail de pruebas, sube a Google Drive la carpeta «datos-demo» entera
 *    (con correos.json y la carpeta facturas dentro).
 * 2. Abre script.google.com → Nuevo proyecto. Borra lo que haya y pega este archivo.
 * 3. A la izquierda, «Servicios» (+) → «Gmail API» → Añadir.
 * 4. Arriba, elige la función «cargarCorreos» y pulsa «Ejecutar». La primera vez pide permisos: acéptalos.
 *    Al terminar, el registro dice cuántos correos ha cargado.
 *
 * Para repetir la demo desde cero: ejecuta «limpiarDemo» (manda a la papelera los correos de demo,
 * borra sus borradores y los resúmenes del agente, las respuestas enviadas desde el chat con sus avisos de «dirección no encontrada»
 * y quita las etiquetas «Agente/…») y después otra vez «cargarCorreos».
 */

const CARPETA = 'datos-demo';

function cargarCorreos() {
  const carpeta = buscarCarpeta_(CARPETA);
  const correos = JSON.parse(leerArchivo_(carpeta, 'correos.json').getDataAsString('UTF-8'));
  const yo = Session.getActiveUser().getEmail();
  const ahora = new Date();
  // Del más antiguo al más reciente, para que la bandeja quede en orden.
  correos.sort((a, b) => b.minutos_antes - a.minutos_antes);
  let n = 0;
  correos.forEach(c => {
    const fecha = new Date(ahora.getTime() - c.minutos_antes * 60 * 1000);
    const adjuntos = (c.adjuntos || []).map(nombre => leerArchivo_(carpeta, nombre));
    const mime = construirMime_(c, yo, fecha, adjuntos);
    Gmail.Users.Messages.insert(
      { labelIds: ['INBOX', 'UNREAD'] }, 'me',
      Utilities.newBlob(mime, 'message/rfc822'),
      { internalDateSource: 'dateHeader' }
    );
    n++;
  });
  Logger.log('Cargados ' + n + ' correos en ' + yo + '. Ábrelos en Gmail.');
}

function limpiarDemo() {
  const carpeta = buscarCarpeta_(CARPETA);
  const correos = JSON.parse(leerArchivo_(carpeta, 'correos.json').getDataAsString('UTF-8'));
  const remitentes = [...new Set(correos.map(c => c.de_email))];
  const consulta = '{' + remitentes.map(e => 'from:' + e).join(' ') + '}';
  let hilos = 0;
  // Borradores del agente en esos hilos
  const ids = new Set();
  GmailApp.search(consulta).forEach(h => { ids.add(h.getId()); h.moveToTrash(); hilos++; });
  // Avisos de «dirección no encontrada» si se envió alguna respuesta de prueba (las direcciones .demo no existen)
  GmailApp.search('from:mailer-daemon ".demo"').forEach(h => { h.moveToTrash(); hilos++; });
  // Los WhatsApp de prueba («WhatsApp · Nombre», remitente con «+wa») y las alertas de seguridad de Google
  GmailApp.search('subject:WhatsApp').forEach(h => {
    if (h.getMessages().some(m => /\+wa\d+@/.test(m.getFrom()))) { ids.add(h.getId()); h.moveToTrash(); hilos++; }
  });
  GmailApp.search('from:no-reply@accounts.google.com').forEach(h => { h.moveToTrash(); hilos++; });
  GmailApp.getDrafts().forEach(d => {
    const m = d.getMessage();
    // Los del agente en esos hilos y sus resúmenes internos («Agente · resumen …»), para que el panel empiece limpio
    if (ids.has(m.getThread().getId()) || /^Agente · resumen /.test(m.getSubject())) d.deleteDraft();
  });
  // Etiquetas del agente
  GmailApp.getUserLabels().forEach(l => { if (l.getName().indexOf('Agente') === 0) l.deleteLabel(); });
  Logger.log('A la papelera: ' + hilos + ' hilos de demo (con los WhatsApp de prueba y las alertas de Google). Borradores, resúmenes del agente y etiquetas «Agente/…» quitados.');
}

// ---------------------------------------------------------------- ayudas

function buscarCarpeta_(nombre) {
  const it = DriveApp.getFoldersByName(nombre);
  if (!it.hasNext()) throw new Error('No encuentro la carpeta «' + nombre + '» en tu Drive. Súbela primero (paso 1).');
  return it.next();
}

function leerArchivo_(carpeta, nombre) {
  const pila = [carpeta];
  while (pila.length) {
    const c = pila.pop();
    const f = c.getFilesByName(nombre);
    if (f.hasNext()) return f.next().getBlob();
    const subs = c.getFolders();
    while (subs.hasNext()) pila.push(subs.next());
  }
  throw new Error('No encuentro «' + nombre + '» dentro de la carpeta ' + CARPETA + '.');
}

function cabecera_(texto) {
  return '=?UTF-8?B?' + Utilities.base64Encode(texto, Utilities.Charset.UTF_8) + '?=';
}

function partir_(b64) {
  return b64.replace(/.{1,76}/g, '$&\r\n');
}

function construirMime_(c, para, fecha, adjuntos) {
  const frontera = 'demo_' + Utilities.getUuid().replace(/-/g, '');
  const l = [];
  l.push('From: ' + cabecera_(c.de_nombre) + ' <' + c.de_email + '>');
  l.push('To: ' + para);
  l.push('Subject: ' + (c.asunto ? cabecera_(c.asunto) : ''));
  l.push('Date: ' + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "EEE, d MMM yyyy HH:mm:ss Z"));
  l.push('Message-ID: <' + Utilities.getUuid() + '@gestoria-demo>');
  l.push('MIME-Version: 1.0');
  l.push('Content-Type: multipart/mixed; boundary="' + frontera + '"');
  l.push('');
  l.push('--' + frontera);
  l.push('Content-Type: text/plain; charset=UTF-8');
  l.push('Content-Transfer-Encoding: base64');
  l.push('');
  l.push(partir_(Utilities.base64Encode(c.cuerpo, Utilities.Charset.UTF_8)));
  adjuntos.forEach(b => {
    const nombre = b.getName();
    l.push('--' + frontera);
    l.push('Content-Type: ' + b.getContentType() + '; name="' + cabecera_(nombre) + '"');
    l.push('Content-Disposition: attachment; filename="' + cabecera_(nombre) + '"');
    l.push('Content-Transfer-Encoding: base64');
    l.push('');
    l.push(partir_(Utilities.base64Encode(b.getBytes())));
  });
  l.push('--' + frontera + '--');
  return l.join('\r\n');
}
