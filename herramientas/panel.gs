/**
 * Panel del correo: el resumen de cada pasada del agente, las facturas revisadas y cada correo como un chat
 * para cambiar el borrador que dejó el agente (o escribir tú) y enviarlo. Se usa igual en el ordenador,
 * la tablet y el móvil. Envía siempre una persona, con dos clics; el agente nunca envía.
 *
 * Es una página privada de Google Apps Script: solo la abre la cuenta de Gmail del negocio.
 * No hace falta Google Cloud, ni servidor, ni permisos que caduquen.
 *
 * Lo normal es que lo instale Claude solo: escribe «empezamos» (o «instala el panel») en la carpeta del agente.
 * Lo crea, lo sube y lo publica en tu cuenta (herramientas/panel_google.py). Lo de abajo es por si lo haces a mano.
 *
 * Cómo instalarlo a mano (una vez, unos 3 minutos), con la cuenta de Gmail del negocio:
 * 1. Abre script.google.com → «Nuevo proyecto». Ponle de nombre «Panel del correo».
 *    Borra lo que haya y pega este archivo entero.
 * 2. A la izquierda, «Servicios» (+) → «Gmail API» → Añadir.
 * 3. Arriba a la derecha, «Implementar» → «Nueva implementación» → tipo «Aplicación web».
 *    - Ejecutar como: «Yo».
 *    - Quién tiene acceso: «Solo yo» (o «Cualquier usuario con una cuenta de Google»: el panel sigue siendo
 *      solo tuyo, a cualquier otra cuenta le sale «Este panel es privado» y no puede leer ni enviar nada).
 *    Pulsa «Implementar» y acepta los permisos (es tu propio script).
 * 4. Copia la URL que termina en /exec y dásela al agente (o: python3 herramientas/panel.py --chat <URL>).
 *    Guárdala en marcadores; en el móvil, «Añadir a pantalla de inicio» y se abre como una app.
 *
 * Si tienes varias cuentas de Google abiertas en el navegador, hazlo todo (y abre el panel) en una ventana
 * privada o un perfil con solo la cuenta del negocio: con varias cuentas, Google se lía con los permisos.
 * Truco: antes de implementar, elige la función «datosBandeja» y pulsa «Ejecutar» para aceptar los permisos.
 *
 * Si cambias este archivo, «Implementar» → «Gestionar implementaciones» → lápiz → «Nueva versión».
 *
 * De dónde sale cada cosa:
 * - La lista de correos y los chats se leen de Gmail en el momento (lo que tiene una etiqueta «Agente/…»).
 * - El resumen y las facturas los deja el agente al acabar cada pasada, en un borrador interno llamado
 *   «Agente · resumen AAAA-MM-DD» con el resumen adjunto. No se envía nunca. Este panel guarda los
 *   últimos 30 días y quita los repetidos (si hay dos pasadas el mismo día, vale la última).
 * - Lo que marcas como «Hecho» se guarda en tu cuenta, así que se ve igual en el móvil y en el ordenador.
 * - Las facturas revisadas van solas a la hoja de Google «Facturas revisadas» (en tu Drive), con fecha, NIF,
 *   base, IVA, retención, total y estado, lista para pasarla a contabilidad (Archivo → Descargar → CSV o Excel).
 *   Tiene una pestaña «Por cliente» con las sumas de cada cliente. Se rellena cada vez que abres el panel, sin repetir facturas.
 *   La primera vez, elige la función «prepararHoja» y pulsa «Ejecutar» (pide permiso para crear la hoja).
 * - El nombre y el logo del negocio se cambian en el propio panel: pulsa el nombre, arriba a la izquierda.
 *
 * WhatsApp (opcional, el siguiente nivel): las facturas y preguntas que os manden por WhatsApp entran en Gmail
 * como un correo más y se contestan desde este panel. Hace falta una app de Meta con WhatsApp (cuenta de Facebook).
 * Meta no acepta avisar a Apps Script directamente (Google contesta con una redirección), así que en medio va
 * un puente gratis en Cloudflare: herramientas/whatsapp-puente.js. Los pasos, en el propio panel:
 * 1. Pulsa el nombre del negocio → WhatsApp → «Conectar»: pega el token permanente y el identificador del número.
 * 2. Aquí, «Implementar» → «Nueva implementación» → «Aplicación web», Ejecutar como «Yo», acceso «Cualquier usuario»
 *    (solo para que el puente pueda pasar los mensajes; la página del panel sigue siendo solo tuya).
 *    Pega su dirección /exec en el panel: comprueba que funciona y te da el valor de PANEL para el puente.
 * 3. En Cloudflare, crea el puente con whatsapp-puente.js (instrucciones dentro) y en Meta pon su dirección.
 */

// La versión de este archivo. Si en el repositorio hay una más nueva, el panel lo avisa arriba.
const VERSION_PANEL = '2026-11-18.4';
const ORIGEN_PANEL = 'https://raw.githubusercontent.com/cuentas-Ailink/agente-ia-negocio/main/herramientas/panel.gs';

const MAX_CONVERSACIONES = 80;
const DIAS_EN_PANEL = 14;
const DIAS_GUARDADOS = 30;

function doGet(e) {
  const p = (e && e.parameter) || {};
  // El puente de WhatsApp comprobando que llega (ver «WhatsApp», más abajo).
  if (p.clave != null && p.cola != null) return colaQR_(String(p.clave), String(p.numero || ''));
  if (p.clave != null) return ContentService.createTextOutput(respuestaPuente_(String(p.clave)));
  // La implementación de WhatsApp está abierta a «Cualquier usuario»: el panel solo se enseña a la cuenta del negocio.
  if (!esLaCuenta_()) return paginaPrivada_();
  return HtmlService.createHtmlOutput(PAGINA)
    .setTitle('Panel del correo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Quien abre la página es la propia cuenta del negocio (en la implementación «Solo yo» siempre lo es). */
function esLaCuenta_() {
  const quien = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  return !!quien && quien === Session.getEffectiveUser().getEmail().toLowerCase();
}

/**
 * Todo lo que llama la página pasa por aquí: aunque la implementación esté abierta a «Cualquier usuario»,
 * otra cuenta no puede leer ni enviar nada. (Las tareas del editor, como prepararHoja, las ejecuta la propia cuenta.)
 */
function soloLaCuenta_() {
  if (!esLaCuenta_()) throw new Error('Este panel es privado: ábrelo con la cuenta de Google del negocio.');
}

/** Lo que ve quien abre el panel con otra cuenta (o sin iniciar sesión). Dice con qué cuenta abrirlo. */
function paginaPrivada_() {
  const suya = Session.getEffectiveUser().getEmail();
  const i = suya.indexOf('@');
  const pista = suya.slice(0, Math.min(3, i)) + '…' + suya.slice(i);
  const html = '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1d1d1f;max-width:440px;margin:12vh auto;padding:0 20px">' +
    '<h1 style="font-size:22px;margin:0 0 12px">Este panel es privado</h1>' +
    '<p style="margin:0 0 12px">Es el panel del correo de la cuenta <b>' + pista + '</b>. Ahora estás entrando con otra cuenta de Google (o sin iniciar sesión).</p>' +
    '<p style="margin:0 0 6px"><b>Si es tu panel</b>, ábrelo con esa cuenta:</p>' +
    '<ul style="margin:0 0 12px;padding-left:20px"><li>En el ordenador: en un perfil de Chrome (o una ventana privada) donde solo esté esa cuenta.</li>' +
    '<li>En el móvil: en Chrome o Safari, con esa cuenta iniciada.</li></ul>' +
    '<p style="margin:0;color:#6e6e73">Si no es tuyo, aquí no hay nada que ver: no se puede leer ni enviar nada desde otra cuenta.</p></div>';
  return HtmlService.createHtmlOutput(html).setTitle('Panel del correo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Lo que deja Claude al instalar el panel él solo (instalacion.gs): el nombre del negocio y la dirección de WhatsApp. */
function instalacion_() {
  return typeof INSTALACION !== 'undefined' && INSTALACION ? INSTALACION : {};
}

// ---------------------------------------------------------------- el resumen de cada pasada

/** Los resúmenes que deja el agente (uno por día, el más reciente primero) y lo marcado como hecho. */
function datosResumenes() {
  soloLaCuenta_();
  const porDia = {}, sobran = [];
  let pagina;
  do {
    const r = Gmail.Users.Drafts.list('me', { q: 'subject:resumen', maxResults: 100, pageToken: pagina });
    (r.drafts || []).forEach(d => {
      const m = GmailApp.getMessageById(d.message.id);
      const f = String(m.getSubject() || '').match(/^Agente · resumen (\d{4}-\d{2}-\d{2})/);
      if (!f) return;
      const adj = m.getAttachments().filter(a => /^resumen.*\.json$/i.test(a.getName()))[0];
      if (!adj) return;
      const e = { id: d.id, cuando: m.getDate().getTime(), adj: adj };
      const antes = porDia[f[1]];
      if (!antes) porDia[f[1]] = e;
      else if (antes.cuando < e.cuando) { sobran.push(antes.id); porDia[f[1]] = e; }
      else sobran.push(e.id);
    });
    pagina = r.nextPageToken;
  } while (pagina);
  const fechas = Object.keys(porDia).sort().reverse();
  fechas.slice(DIAS_GUARDADOS).forEach(k => sobran.push(porDia[k].id));
  // Solo se quitan borradores internos del agente, nunca un correo.
  sobran.forEach(id => { try { Gmail.Users.Drafts.remove('me', id); } catch (e) {} });
  const dias = {};
  fechas.slice(0, DIAS_EN_PANEL).forEach(k => {
    try { dias[k] = compactar_(JSON.parse(porDia[k].adj.getDataAsString('UTF-8')), k); } catch (e) {}
  });
  return { dias: dias, hechos: hechos_(), marca: marca_(), hoja: urlHoja_() };
}

/** La versión de este panel y la del repositorio (se mira como mucho cada 6 horas). Sin internet, solo la propia. */
function versionPanel() {
  soloLaCuenta_();
  const cache = CacheService.getScriptCache();
  let nueva = cache.get('version_repo');
  if (!nueva) {
    try {
      const r = UrlFetchApp.fetch(ORIGEN_PANEL, { muteHttpExceptions: true });
      const m = r.getResponseCode() === 200 && r.getContentText().match(/const VERSION_PANEL = '([\d.-]+)'/);
      nueva = m ? m[1] : '';
    } catch (e) { nueva = ''; }
    cache.put('version_repo', nueva || '-', 6 * 3600);
  }
  return { mia: VERSION_PANEL, nueva: nueva && nueva !== '-' && nueva > VERSION_PANEL ? nueva : '' };
}

/** Guarda el nombre y el logo del negocio que enseña el panel. Se guardan en la cuenta, en trozos. */
function guardarMarca(nombre, logo) {
  soloLaCuenta_();
  nombre = String(nombre || '').trim().slice(0, 60);
  logo = String(logo || '');
  if (logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(logo)) throw new Error('El logo tiene que ser una imagen PNG, JPG o WebP.');
  if (logo.length > 120000) throw new Error('El logo es demasiado grande. Prueba con una imagen más sencilla.');
  const p = PropertiesService.getUserProperties();
  const antes = Number(p.getProperty('marca_trozos') || 0);
  for (let i = 0; i < antes; i++) p.deleteProperty('marca_logo_' + i);
  const datos = { marca_nombre: nombre }, trozos = [];
  for (let i = 0; i < logo.length; i += 8000) trozos.push(logo.slice(i, i + 8000));
  trozos.forEach((t, i) => { datos['marca_logo_' + i] = t; });
  datos.marca_trozos = String(trozos.length);
  p.setProperties(datos);
  return marca_();
}

function marca_() {
  const p = PropertiesService.getUserProperties();
  const n = Number(p.getProperty('marca_trozos') || 0);
  let logo = '';
  for (let i = 0; i < n; i++) logo += p.getProperty('marca_logo_' + i) || '';
  return { nombre: p.getProperty('marca_nombre') || instalacion_().negocio || '', logo: logo };
}

/** Marca (o desmarca) como hecho algo de «Necesita a una persona». Se guarda en la cuenta. */
function marcarHecho(id, si) {
  soloLaCuenta_();
  const lista = hechos_().filter(x => x !== id);
  if (si) lista.push(String(id));
  PropertiesService.getUserProperties().setProperty('hechos', JSON.stringify(lista.slice(-400)));
  return { hechos: lista };
}

function hechos_() {
  try { return JSON.parse(PropertiesService.getUserProperties().getProperty('hechos') || '[]'); } catch (e) { return []; }
}

/** Solo lo que pinta el panel (el resumen completo trae enlaces y rutas del ordenador). */
function compactar_(d, fecha) {
  const num = n => (typeof n === 'number' && isFinite(n) ? n : null);
  return {
    fecha: d.fecha || fecha, hora: d.hora || '', negocio: d.negocio || '',
    totales: d.totales || {},
    correos: (d.correos || []).map(c => {
      const f = c.factura;
      return {
        id: String(c.id || c.hilo || ''), hilo: String(c.hilo || ''), de: c.de || '', cliente: c.cliente || '',
        asunto: c.asunto || '', tipo: c.tipo || '', estado: c.estado || '', resumen: c.resumen || '',
        borrador: !!c.borrador,
        factura: f ? {
          numero: f.numero || '', emisor: f.emisor || '', estado: f.estado || '', motivos: f.motivos || [],
          total_factura: num(f.total_factura), total_correcto: num(f.total_correcto), diferencia: num(f.diferencia),
          fecha_factura: f.fecha_factura || '', nif: f.nif || '', base: num(f.base), tipos_iva: f.tipos_iva || [],
          cuota_iva: num(f.cuota_iva), retencion: num(f.retencion), total: num(f.total)
        } : null
      };
    })
  };
}

// ---------------------------------------------------------------- la hoja de facturas

const COLUMNAS_HOJA = ['Fecha factura', 'N.º factura', 'Proveedor', 'NIF proveedor', 'Cliente', 'Base imponible',
  'IVA', 'Cuota IVA', 'Retención IRPF', 'Total factura', 'Estado', 'Observaciones', 'Revisada', 'Correo', 'clave'];
const COL_CORREO = 14, COL_CLAVE = 15;

/**
 * Pasa las facturas revisadas a la hoja «Facturas revisadas» de tu Google Drive (la crea la primera vez).
 * Solo añade las nuevas y actualiza las que han cambiado; lo que escribas tú en otras columnas no se toca.
 */
function sincronizarHoja(lista) {
  soloLaCuenta_();
  const hoja = hojaFacturas_();
  const yo = Session.getEffectiveUser().getEmail();
  const ultima = hoja.getLastRow();
  const antes = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, COL_CLAVE).getValues() : [];
  const filaDe = {};
  antes.forEach((f, i) => { if (f[COL_CLAVE - 1]) filaDe[f[COL_CLAVE - 1]] = i; });
  const nuevas = [], enlaces = [], vistas = {};
  let cambios = 0;
  (lista || []).forEach(x => {
    if (!x || !x.factura) return;
    const fila = filaHoja_(x);
    const clave = fila[COL_CLAVE - 1];
    if (vistas[clave]) return;
    vistas[clave] = true;
    if (clave in filaDe) {
      const i = filaDe[clave];
      const igual = fila.every((v, c) => c === COL_CORREO - 1 || comparable_(v) === comparable_(antes[i][c]));
      if (!igual) { hoja.getRange(i + 2, 1, 1, COL_CORREO - 1).setValues([fila.slice(0, COL_CORREO - 1)]); cambios++; }
    } else {
      nuevas.push(fila);
      enlaces.push([SpreadsheetApp.newRichTextValue().setText('Abrir')
        .setLinkUrl('https://mail.google.com/mail/?authuser=' + encodeURIComponent(yo) + '#all/' + (x.hilo || x.id)).build()]);
    }
  });
  if (nuevas.length) {
    const desde = Math.max(ultima, 1) + 1;
    hoja.getRange(desde, 1, nuevas.length, COL_CLAVE).setValues(nuevas);
    hoja.getRange(desde, COL_CORREO, nuevas.length, 1).setRichTextValues(enlaces);
  }
  const total = hoja.getLastRow() - 1;
  if ((nuevas.length || cambios) && total > 1) {
    hoja.getRange(2, 1, total, COL_CLAVE).sort([{ column: 13, ascending: false }, { column: 1, ascending: false }]);
  }
  if (nuevas.length || cambios || !hoja.getParent().getSheetByName('Por cliente')) {
    if (!hoja.getParent().getSheetByName('Por cliente')) darFormato_(hoja.getParent()); else sumarPorCliente_(hoja.getParent());
  }
  return { url: hoja.getParent().getUrl(), nuevas: nuevas.length, cambiadas: cambios, total: total };
}

/** Ejecútala una vez desde el editor: crea la hoja con las facturas que ya hay y acepta el permiso nuevo.
 *  Si la vuelves a ejecutar, pone al día las facturas y el aspecto de la hoja sin borrar nada. */
function prepararHoja() {
  const r = datosResumenes();
  const lista = [];
  Object.keys(r.dias).forEach(k => (r.dias[k].correos || []).forEach(c => {
    if (c.factura) lista.push({ id: c.id, hilo: c.hilo, dia: k, cliente: c.cliente, factura: c.factura });
  }));
  const s = sincronizarHoja(lista);
  darFormato_(SpreadsheetApp.openById(PropertiesService.getUserProperties().getProperty('hoja_facturas')));
  Logger.log('Hoja de facturas (' + s.total + ' facturas): ' + s.url);
  return s.url;
}

/** La dirección de la hoja, si ya existe. */
function urlHoja_() {
  const id = PropertiesService.getUserProperties().getProperty('hoja_facturas');
  return id ? 'https://docs.google.com/spreadsheets/d/' + id + '/edit' : '';
}

function hojaFacturas_() {
  const props = PropertiesService.getUserProperties();
  const id = props.getProperty('hoja_facturas');
  if (id) {
    try {
      const libro = SpreadsheetApp.openById(id);
      return libro.getSheetByName('Facturas') || libro.getSheets()[0];
    } catch (e) { /* la han borrado: se crea otra */ }
  }
  const nombre = (props.getProperty('marca_nombre') || '').trim();
  const libro = SpreadsheetApp.create('Facturas revisadas' + (nombre ? ' · ' + nombre : ''));
  libro.setSpreadsheetLocale('es_ES');
  libro.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  const hoja = libro.getSheets()[0];
  hoja.setName('Facturas');
  hoja.getRange(1, 1, 1, COLUMNAS_HOJA.length).setValues([COLUMNAS_HOJA]);
  darFormato_(libro);
  props.setProperty('hoja_facturas', libro.getId());
  return hoja;
}

/** El aspecto de la hoja. Se puede volver a aplicar sin perder nada (lo hace «prepararHoja»). */
function darFormato_(libro) {
  const hoja = libro.getSheetByName('Facturas') || libro.getSheets()[0];
  const n = COLUMNAS_HOJA.length;
  if (hoja.getMaxColumns() > n) hoja.deleteColumns(n + 1, hoja.getMaxColumns() - n);
  const filas = hoja.getMaxRows();
  // Letra Inter, filas con aire y solo líneas horizontales finas, como la tabla del panel.
  const todo = hoja.getRange(1, 1, filas, n);
  todo.setFontFamily('Inter').setFontSize(10).setVerticalAlignment('middle').setFontColor('#1a1a19')
    .setBorder(null, null, true, null, null, true, '#e7e7e3', SpreadsheetApp.BorderStyle.SOLID);
  hoja.getRange(1, 1, 1, n).setFontWeight('bold').setFontColor('#5f5f5a').setBackground('#f1f1ee').setWrap(false);
  hoja.setRowHeight(1, 36);
  if (filas > 1) hoja.setRowHeights(2, filas - 1, 30);
  hoja.setFrozenRows(1);
  hoja.setHiddenGridlines(true);
  hoja.getRange('A2:A').setNumberFormat('dd/mm/yyyy');
  hoja.getRange('M2:M').setNumberFormat('dd/mm/yyyy');
  hoja.getRange('F2:F').setNumberFormat('#,##0.00 "€"');
  hoja.getRange('H2:J').setNumberFormat('#,##0.00 "€"');
  hoja.getRange('B2:B').setNumberFormat('@');
  hoja.getRange('D2:D').setNumberFormat('@');
  hoja.getRange('C2:C').setFontWeight('bold');
  hoja.getRange('J2:J').setFontWeight('bold');
  hoja.getRange('F1:J').setHorizontalAlignment('right');
  hoja.getRange('N2:N').setHorizontalAlignment('center');
  hoja.getRange('C2:C').setWrap(true);
  hoja.getRange('L2:L').setWrap(true);
  // Anchos pensados para que se lea cada cabecera entera, con el botón del filtro.
  [112, 132, 250, 124, 210, 140, 92, 112, 140, 124, 100, 330, 108, 84].forEach((w, i) => hoja.setColumnWidth(i + 1, w));
  hoja.hideColumns(COL_CLAVE);
  const estado = hoja.getRange('K2:K');
  hoja.setConditionalFormatRules([
    ['Correcta', '#e3f6ea', '#1f8a5b'], ['Revisar', '#fdf3d0', '#8a6400'], ['Error', '#fcebe8', '#b8301f']
  ].map(r => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(r[0])
    .setBackground(r[1]).setFontColor(r[2]).setBold(true).setRanges([estado]).build()));
  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.getRange('A:N').createFilter();

  // Segunda pestaña: lo de cada cliente sumado (se actualiza sola).
  const porCliente = libro.getSheetByName('Por cliente') || libro.insertSheet('Por cliente');
  if (porCliente.getMaxColumns() > 7) porCliente.deleteColumns(8, porCliente.getMaxColumns() - 7);
  porCliente.getRange(1, 1, 1, 7).setValues([COLUMNAS_CLIENTE]);
  const fc = porCliente.getMaxRows();
  porCliente.getRange(1, 1, fc, 7).setFontFamily('Inter').setFontSize(10).setVerticalAlignment('middle').setFontColor('#1a1a19')
    .setBorder(null, null, true, null, null, true, '#e7e7e3', SpreadsheetApp.BorderStyle.SOLID);
  porCliente.getRange('A1:G1').setFontWeight('bold').setFontColor('#5f5f5a').setBackground('#f1f1ee');
  porCliente.getRange('A2:A').setFontWeight('bold');
  porCliente.getRange('D2:G').setNumberFormat('#,##0.00 "€"');
  porCliente.getRange('B2:C').setNumberFormat('0');
  porCliente.getRange('G2:G').setFontWeight('bold');
  porCliente.getRange('B1:G').setHorizontalAlignment('right');
  porCliente.setRowHeight(1, 36);
  if (fc > 1) porCliente.setRowHeights(2, fc - 1, 30);
  porCliente.setFrozenRows(1);
  porCliente.setHiddenGridlines(true);
  [250, 96, 110, 140, 120, 140, 130].forEach((w, i) => porCliente.setColumnWidth(i + 1, w));
  sumarPorCliente_(libro);
}

const COLUMNAS_CLIENTE = ['Cliente', 'Facturas', 'Por revisar', 'Base imponible', 'Cuota IVA', 'Retención IRPF', 'Total'];

/** La pestaña «Por cliente»: las sumas las hace el script (así no depende del idioma de la hoja). */
function sumarPorCliente_(libro) {
  const hoja = libro.getSheetByName('Facturas') || libro.getSheets()[0];
  const destino = libro.getSheetByName('Por cliente');
  if (!destino) return;
  const n = hoja.getLastRow() - 1;
  const filas = n > 0 ? hoja.getRange(2, 1, n, COL_CLAVE).getValues() : [];
  const num = v => (typeof v === 'number' ? v : 0);
  const por = {};
  filas.forEach(f => {
    const cliente = String(f[4] || '').trim() || 'Sin cliente';
    const c = por[cliente] = por[cliente] || [cliente, 0, 0, 0, 0, 0, 0];
    c[1] += 1; if (f[10] !== 'Correcta') c[2] += 1;
    c[3] += num(f[5]); c[4] += num(f[7]); c[5] += num(f[8]); c[6] += num(f[9]);
  });
  const redondea = c => c.map((v, i) => (i >= 3 ? Math.round(v * 100) / 100 : v));
  const lista = Object.keys(por).map(k => redondea(por[k])).sort((a, b) => b[6] - a[6]);
  const total = redondea(lista.reduce((t, c) => t.map((v, i) => (i ? v + c[i] : v)), ['Total', 0, 0, 0, 0, 0, 0]));
  const max = destino.getMaxRows();
  if (max > 1) destino.getRange(2, 1, max - 1, 7).clearContent().setFontWeight('normal').setBackground(null);
  destino.getRange('A2:A').setFontWeight('bold');
  destino.getRange('G2:G').setFontWeight('bold');
  if (!lista.length) return;
  destino.getRange(2, 1, lista.length + 1, 7).setValues(lista.concat([total]));
  destino.getRange(lista.length + 2, 1, 1, 7).setFontWeight('bold').setBackground('#f1f1ee');
}

/** Para empezar con una hoja vacía (por ejemplo, después de volver a cargar la demo): la próxima vez se crea otra. */
/** Para grabar o probar: que la respuesta automática de WhatsApp vuelva a salir ya a todos, sin esperar la media hora. */
function reiniciarRespuestasAutomaticas() {
  const props = PropertiesService.getScriptProperties();
  const claves = props.getKeys().filter(k => k.indexOf('wa_a_') === 0);
  claves.forEach(k => props.deleteProperty(k));
  Logger.log('Listo: la respuesta automática vuelve a salir a ' + claves.length + ' número(s) en su próximo mensaje.');
}

function empezarHojaDeCero() {
  PropertiesService.getUserProperties().deleteProperty('hoja_facturas');
  Logger.log('Listo. La próxima vez que abras el panel se crea una hoja nueva. La anterior sigue en tu Drive: bórrala si no la quieres.');
}

function filaHoja_(x) {
  const f = x.factura || {};
  const num = v => (typeof v === 'number' && isFinite(v) ? v : '');
  const fecha = s => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
  };
  const tipos = (f.tipos_iva || []).map(t => String(t).replace('.', ',') + ' %').join(' y ');
  const estado = { correcta: 'Correcta', error: 'Error', revisar: 'Revisar' }[f.estado] || 'Revisar';
  const clave = String(x.hilo || x.id || '') + '|' + String(f.numero || f.emisor || '');
  return [fecha(f.fecha_factura), f.numero || '', f.emisor || '', f.nif || '', x.cliente || '',
    num(f.base), tipos, num(f.cuota_iva), num(f.retencion), num(typeof f.total === 'number' ? f.total : f.total_factura),
    estado, (f.motivos || []).join(' '), fecha(x.dia), '', clave];
}

function comparable_(v) {
  if (v instanceof Date) return 'd' + v.getFullYear() + '-' + v.getMonth() + '-' + v.getDate();
  return String(v === null || v === undefined ? '' : v);
}

// ---------------------------------------------------------------- los correos

/** Las conversaciones de la bandeja que ya tienen una etiqueta «Agente/…». */
function datosBandeja() {
  soloLaCuenta_();
  const yo = Session.getEffectiveUser().getEmail().toLowerCase();
  const etiquetas = GmailApp.getUserLabels().map(l => l.getName()).filter(n => n.indexOf('Agente/') === 0);
  const hilos = {}, nombresPorHilo = {};
  etiquetas.forEach(nombre => {
    GmailApp.search('in:inbox label:' + slug_(nombre), 0, MAX_CONVERSACIONES).forEach(h => {
      hilos[h.getId()] = h;
      (nombresPorHilo[h.getId()] = nombresPorHilo[h.getId()] || []).push(nombre);
    });
  });
  const lista = Object.keys(hilos).map(id => hilos[id]);
  const conBorrador = hilosConBorrador_();
  const mensajes = lista.length ? GmailApp.getMessagesForThreads(lista) : [];
  const conversaciones = lista.map((h, i) => {
    const todosReales = mensajes[i].filter(m => !m.isDraft());
    const reales = todosReales.filter(m => !esAviso_(m));
    const suyo = reales.filter(m => !esMio_(m, yo))[0] || reales[0];
    const ultimo = reales[reales.length - 1] || suyo;
    const fin = todosReales[todosReales.length - 1];
    const marcas = resumirEtiquetas_(nombresPorHilo[h.getId()]);
    return {
      id: h.getId(),
      nombre: nombre_(suyo ? suyo.getFrom() : ''),
      asunto: h.getFirstMessageSubject() || '(sin asunto)',
      fecha: ultimo ? ultimo.getDate().toISOString() : '',
      extracto: ultimo ? textoDe_(ultimo).replace(/\s+/g, ' ').slice(0, 140) : '',
      ultimoMio: !!(ultimo && esMio_(ultimo, yo)),
      noEntregado: !!(fin && esAviso_(fin)),
      tipo: marcas.tipo, revisar: marcas.revisar, sospechoso: marcas.sospechoso,
      borrador: !!conBorrador[h.getId()],
      whatsapp: !!telefonoDeHilo_(todosReales)
    };
  }).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return { conversaciones: conversaciones };
}

/** Una conversación entera, con el borrador del agente si lo hay. */
function datosHilo(id) {
  soloLaCuenta_();
  const yo = Session.getEffectiveUser().getEmail().toLowerCase();
  const hilo = GmailApp.getThreadById(id);
  if (!hilo) throw new Error('No encuentro esta conversación. Puede que se haya borrado.');
  if (hilo.isInTrash()) throw new Error('Este correo está en la papelera. Puede que se haya vuelto a cargar o borrado.');
  const todos = hilo.getMessages();
  const enGmail = hilosConBorrador_()[id] || null;
  let borrador = null;
  const mensajes = [];
  todos.forEach(m => {
    if (m.isDraft()) {
      if (enGmail && m.getId() === enGmail.mensaje) borrador = { id: enGmail.id, texto: textoDe_(m), para: direcciones_(m.getTo()) };
      return;
    }
    if (esAviso_(m)) {
      mensajes.push({ aviso: true, fecha: m.getDate().toISOString(), texto: textoAviso_(m) });
      return;
    }
    mensajes.push({
      mio: esMio_(m, yo),
      nombre: nombre_(m.getFrom()),
      fecha: m.getDate().toISOString(),
      texto: textoDe_(m),
      adjuntos: m.getAttachments({ includeInlineImages: false }).map(a => a.getName())
    });
  });
  const ref = ultimoDelCliente_(todos, yo);
  const marcas = resumirEtiquetas_(hilo.getLabels().map(l => l.getName()));
  const tel = telefonoDeHilo_(todos);
  const delCliente = todos.filter(m => !m.isDraft() && !esMio_(m, yo) && !esAviso_(m));
  const whatsapp = tel ? {
    telefono: '+' + tel,
    conectado: conectado_(ajustesWhatsApp_()),
    qr: ajustesWhatsApp_().qr,
    // WhatsApp deja contestar hasta 24 h después del último mensaje del cliente.
    hasta: delCliente.length ? new Date(delCliente[delCliente.length - 1].getDate().getTime() + DIA_MS_).toISOString() : null
  } : null;
  return {
    id: id,
    whatsapp: whatsapp,
    asunto: hilo.getFirstMessageSubject() || '(sin asunto)',
    nombre: ref ? nombre_(ref.getFrom()) : '',
    para: tel ? 'WhatsApp +' + tel : (borrador ? borrador.para : (ref ? direcciones_(ref.getReplyTo() || ref.getFrom()) : '')),
    gmail: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(yo) + '#all/' + id,
    tipo: marcas.tipo, revisar: marcas.revisar, sospechoso: marcas.sospechoso,
    mensajes: mensajes,
    borrador: borrador
  };
}

/** Guarda el texto como borrador de respuesta en la conversación (sin enviar). */
function guardarBorrador(id, texto) {
  soloLaCuenta_();
  return { borradorId: escribirBorrador_(id, texto) };
}

/** Guarda y envía. Solo se llama cuando una persona ha pulsado «Enviar» y lo ha confirmado. */
function enviar(id, texto) {
  soloLaCuenta_();
  const hilo = GmailApp.getThreadById(id);
  const tel = hilo ? telefonoDeHilo_(hilo.getMessages()) : '';
  if (tel) return enviarPorWhatsApp_(id, tel, texto);
  const borradorId = escribirBorrador_(id, texto);
  Gmail.Users.Drafts.send({ id: borradorId }, 'me');
  return { ok: true };
}

// ---------------------------------------------------------------- WhatsApp (siguiente nivel)
//
// Los clientes mandan por WhatsApp sus facturas (foto o PDF) o una pregunta. Meta avisa al puente de Cloudflare
// (whatsapp-puente.js), que comprueba la firma de Meta y pasa el aviso a este mismo script (una segunda
// implementación, con acceso «Cualquier usuario»). Aquí:
// 1. Se comprueba la clave de la dirección y que el aviso es de vuestro número.
// 2. Deja el mensaje en vuestro Gmail como un correo más, con la foto o el PDF adjunto, en un hilo por cliente
//    («WhatsApp · Nombre»). Nada se envía: se inserta en la bandeja. Así la pasada del agente lo revisa igual.
// 3. Contesta por WhatsApp un acuse fijo («Recibido, gracias…»), como mucho uno cada media hora por cliente, para que una ráfaga de mensajes no reciba el mismo aviso varias veces.
//    Es un texto que escribe el negocio, no el agente, y se puede dejar vacío para no mandarlo.
// La respuesta de verdad la envía una persona desde este panel, con «Enviar», y sale por WhatsApp.
// WhatsApp solo deja contestar dentro de las 24 h desde el último mensaje del cliente: el panel lo enseña.

const GRAPH_ = 'https://graph.facebook.com/v26.0';
const ACUSE_POR_DEFECTO = 'Hola, gracias por escribirnos. Hemos recibido tu mensaje y el equipo ya lo está revisando. Te contestamos por aquí.';
const RE_WA_ = /\+wa(\d{6,15})@/i;
const MINUTOS_ENTRE_ACUSES = 30;
const DIA_MS_ = 24 * 3600 * 1000;

function ajustesWhatsApp_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return {
    token: p.wa_token || '', numero: p.wa_numero || '', clave: p.wa_clave || '',
    acuse: p.wa_acuse != null ? p.wa_acuse : ACUSE_POR_DEFECTO, mostrar: p.wa_mostrar || '', dir: p.wa_dir || '',
    qr: p.wa_modo === 'qr'
  };
}

/** Conectado con Meta (token y número) o en modo prueba por QR (el ordenador hace de móvil). */
function conectado_(a) { return a.qr ? !!a.clave : !!(a.token && a.numero); }

/** Lo que enseña «Tu negocio → WhatsApp». El token nunca sale de aquí. */
function datosWhatsApp() {
  soloLaCuenta_();
  const a = ajustesWhatsApp_();
  return {
    conectado: conectado_(a), qr: a.qr, numero: a.mostrar, id: a.numero, clave: a.clave, acuse: a.acuse,
    dir: a.dir, panel: a.dir && a.clave ? a.dir + '?clave=' + a.clave : '', sugerida: instalacion_().whatsapp || ''
  };
}

/** Comprueba el token y el número con Meta y los guarda. Sin token nuevo, deja el que había. */
function guardarWhatsApp(token, numero, acuse) {
  soloLaCuenta_();
  const props = PropertiesService.getScriptProperties();
  const a = ajustesWhatsApp_();
  token = String(token || '').trim() || a.token;
  numero = String(numero || '').replace(/\D/g, '') || a.numero;
  if (!token) throw new Error('Pega el token permanente de Meta.');
  if (!numero) throw new Error('Pega el identificador del número de teléfono (solo números).');
  const r = UrlFetchApp.fetch(GRAPH_ + '/' + numero + '?fields=display_phone_number,verified_name',
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  const d = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200) throw new Error(explicarMeta_(d.error));
  props.setProperties({
    wa_modo: 'meta', wa_token: token, wa_numero: numero, wa_acuse: String(acuse == null ? a.acuse : acuse).trim().slice(0, 500),
    wa_clave: a.clave || Utilities.getUuid().replace(/-/g, '').slice(0, 24),
    wa_mostrar: [d.display_phone_number, d.verified_name].filter(Boolean).join(' · ')
  });
  puenteInstalado_();
  return datosWhatsApp();
}

/**
 * Modo prueba por QR: sin Meta. Un ordenador con `node herramientas/whatsapp-qr.mjs` se vincula a un WhatsApp
 * con un QR (como WhatsApp Web), pasa aquí los mensajes de los números permitidos y recoge lo que envías.
 * No es la API oficial: solo para probar y enseñar, con un número de pruebas.
 */
function activarQR(acuse) {
  soloLaCuenta_();
  const a = ajustesWhatsApp_();
  PropertiesService.getScriptProperties().setProperties({
    wa_modo: 'qr', wa_acuse: String(acuse == null ? a.acuse : acuse).trim().slice(0, 500),
    wa_clave: a.clave || Utilities.getUuid().replace(/-/g, '').slice(0, 24),
    wa_mostrar: 'Modo prueba por QR'
  });
  puenteInstalado_();
  return datosWhatsApp();
}

function quitarWhatsApp() {
  soloLaCuenta_();
  ['wa_modo', 'wa_token', 'wa_numero', 'wa_mostrar', 'wa_dir', 'wa_cola'].forEach(k => PropertiesService.getScriptProperties().deleteProperty(k));
  return datosWhatsApp();
}

/** Si Claude ya publicó la dirección pública de WhatsApp al instalar, se guarda sola (sin pegar nada). */
function puenteInstalado_() {
  const dir = instalacion_().whatsapp;
  if (!dir || ajustesWhatsApp_().dir) return;
  try { guardarPuente(dir); } catch (e) { /* se queda para pegarla a mano */ }
}

/** Lo que contesta este script cuando el puente (o el panel) comprueba que llega. */
function respuestaPuente_(clave) {
  const a = ajustesWhatsApp_();
  if (!a.clave || clave !== a.clave) return 'no';
  return conectado_(a) ? 'ok' : 'sin-conectar';
}

/**
 * Guarda la dirección de la implementación «Cualquier usuario» después de comprobar que contesta sin iniciar
 * sesión (si es la del panel, «Solo yo», Google pide entrar y no vale).
 */
function guardarPuente(dir) {
  soloLaCuenta_();
  const a = ajustesWhatsApp_();
  if (!a.clave) throw new Error('Primero conecta WhatsApp, arriba.');
  dir = String(dir || '').trim().replace(/[?#].*$/, '');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|macros)\/s\/[\w-]+\/exec$/.test(dir)) {
    throw new Error('Pega la dirección de la implementación: empieza por https://script.google.com/macros/s/ y acaba en /exec.');
  }
  const r = UrlFetchApp.fetch(dir + '?clave=' + a.clave + '&ping=1', { muteHttpExceptions: true, followRedirects: true });
  const t = r.getContentText().trim();
  if (t !== 'ok' && t !== 'sin-conectar') {
    throw new Error('Esa dirección pide iniciar sesión o es de otro proyecto. En la implementación, «Quién tiene acceso» tiene que ser «Cualquier usuario».');
  }
  PropertiesService.getScriptProperties().setProperty('wa_dir', dir);
  return datosWhatsApp();
}

/** Los avisos de Meta: mensajes nuevos (y estados de entrega, que no se usan). */
function doPost(e) {
  const a = ajustesWhatsApp_();
  const p = (e && e.parameter) || {};
  if (!a.clave || !conectado_(a) || p.clave !== a.clave) return ContentService.createTextOutput('no');
  let datos;
  try { datos = JSON.parse(e.postData.contents); } catch (x) { return ContentService.createTextOutput('no'); }
  if (datos.origen === 'qr') return recibirQR_(datos, a);
  const cerrojo = LockService.getScriptLock();
  if (!cerrojo.tryLock(25000)) return ContentService.createTextOutput('ocupado');
  try {
    (datos.entry || []).forEach(en => (en.changes || []).forEach(c => {
      const v = c.value || {};
      // Solo lo que llega a vuestro número: un aviso con otro número no es vuestro.
      if (!v.metadata || String(v.metadata.phone_number_id) !== a.numero) return;
      (v.messages || []).forEach(m => {
        try { recibirWhatsApp_(m, v.contacts || [], a); } catch (err) { console.error('WhatsApp: ' + err.message); }
      });
    }));
  } finally {
    cerrojo.releaseLock();
  }
  return ContentService.createTextOutput('OK');
}

function recibirWhatsApp_(m, contactos, a) {
  if (!m || !m.id || !m.from || m.type === 'reaction' || m.type === 'unsupported') return;
  if (yaVisto_(m.id)) return;
  const tel = String(m.from).replace(/\D/g, '');
  const contacto = contactos.filter(c => c.wa_id === m.from)[0];
  const nombre = (contacto && contacto.profile && contacto.profile.name) || '+' + tel;
  const fecha = new Date(Number(m.timestamp) * 1000 || Date.now());
  let texto = '', adjunto = null;
  if (m.type === 'text') texto = (m.text && m.text.body) || '';
  else if (m.type === 'image' || m.type === 'document') {
    const info = m[m.type] || {};
    texto = info.caption || '';
    adjunto = bajarDeMeta_(info.id, a.token);
    const ext = (adjunto.getContentType() || '').split('/')[1] || 'bin';
    const nombreArchivo = (info.filename || (m.type === 'image' ? 'foto' : 'documento') + '-' +
      Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyyMMdd-HHmm') + '.' + ext.replace('jpeg', 'jpg')).replace(/[\\/\r\n"]/g, '');
    adjunto.setName(nombreArchivo);
    if (!texto) texto = m.type === 'image' ? '(Foto por WhatsApp)' : '(Documento por WhatsApp: ' + nombreArchivo + ')';
  } else if (m.type === 'audio') {
    texto = '(Nota de voz por WhatsApp: escúchala en el móvil o pide que lo escriba)';
  } else {
    texto = '(Mensaje de WhatsApp que no es texto: ' + m.type + ')';
  }
  insertarEnGmail_(tel, nombre, texto, adjunto, fecha, m.id);
  marcarVisto_(m.id);
  acusar_(tel, a);
}

/** Dos pasos: Meta da una dirección temporal para el id y esa dirección también pide el token. */
function bajarDeMeta_(id, token) {
  const cab = { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
  const r = UrlFetchApp.fetch(GRAPH_ + '/' + id, cab);
  const info = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200 || !info.url) throw new Error('Meta no da el archivo: ' + explicarMeta_(info.error));
  const archivo = UrlFetchApp.fetch(info.url, cab);
  if (archivo.getResponseCode() !== 200) throw new Error('No se ha podido descargar el archivo (' + archivo.getResponseCode() + ')');
  return archivo.getBlob().setContentType(info.mime_type || archivo.getBlob().getContentType());
}

/** La dirección con la que cada cliente de WhatsApp aparece en Gmail: vuestra cuenta + «+wa» y su número. */
function direccionWhatsApp_(tel) {
  const yo = Session.getEffectiveUser().getEmail();
  const i = yo.indexOf('@');
  return yo.slice(0, i) + '+wa' + tel + yo.slice(i);
}

function cabeceraUtf8_(t) { return '=?UTF-8?B?' + Utilities.base64Encode(t, Utilities.Charset.UTF_8) + '?='; }

/**
 * Mete un mensaje en el hilo de ese cliente (lo crea la primera vez). Con `o.enviado` lo pone como vuestro
 * y con `o.hilo` va a esa conversación de Gmail.
 */
function insertarEnGmail_(tel, nombre, texto, adjunto, fecha, idMeta, o) {
  o = o || {};
  const enviado = !!o.enviado;
  const props = PropertiesService.getScriptProperties();
  const yo = Session.getEffectiveUser().getEmail();
  const suya = direccionWhatsApp_(tel);
  const clave = 'wa_h_' + tel;
  let hilo = JSON.parse(props.getProperty(clave) || 'null');
  if (o.hilo && (!hilo || hilo.id !== o.hilo)) {
    const h = GmailApp.getThreadById(o.hilo);
    const ms = h.getMessages().filter(m => !m.isDraft());
    const ultimo = ms[ms.length - 1];
    hilo = { id: o.hilo, ultimo: (ultimo && ultimo.getHeader('Message-ID')) || '', nombre: (h.getFirstMessageSubject() || '').replace(/^WhatsApp · /, '') || nombre };
  }
  if (hilo) {
    let vale = false;
    try { const h = GmailApp.getThreadById(hilo.id); vale = !!h && !h.isInTrash(); } catch (x) { vale = false; }
    if (!vale) hilo = null;
  }
  const asunto = 'WhatsApp · ' + (hilo ? hilo.nombre : nombre);
  const msgId = '<wa.' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(idMeta))
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('').slice(0, 32) + '@whatsapp.invalid>';
  const corte = 'corte_' + Utilities.getUuid().replace(/-/g, '');
  const b64 = bytes => Utilities.base64Encode(bytes).replace(/(.{76})/g, '$1\r\n');
  const partes = [
    'From: ' + (enviado ? yo : cabeceraUtf8_(nombre + ' (WhatsApp)') + ' <' + suya + '>'),
    'To: ' + (enviado ? suya : yo),
    'Subject: ' + cabeceraUtf8_(hilo ? 'Re: ' + asunto : asunto),
    'Date: ' + Utilities.formatDate(fecha, 'GMT', "EEE, dd MMM yyyy HH:mm:ss Z"),
    'Message-ID: ' + msgId,
    hilo && hilo.ultimo ? 'In-Reply-To: ' + hilo.ultimo : null,
    hilo && hilo.ultimo ? 'References: ' + hilo.ultimo : null,
    'X-Canal: WhatsApp +' + tel,
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + corte + '"',
    '',
    '--' + corte,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(Utilities.newBlob(texto || ' ').getBytes())
  ];
  if (adjunto) {
    partes.push('--' + corte,
      'Content-Type: ' + adjunto.getContentType() + '; name="' + adjunto.getName() + '"',
      'Content-Disposition: attachment; filename="' + adjunto.getName() + '"',
      'Content-Transfer-Encoding: base64', '', b64(adjunto.getBytes()));
  }
  partes.push('--' + corte + '--', '');
  const mime = partes.filter(l => l !== null).join('\r\n');
  const recurso = { labelIds: enviado ? ['SENT'] : ['INBOX', 'UNREAD'] };
  if (hilo) recurso.threadId = hilo.id;
  const r = Gmail.Users.Messages.insert(recurso, 'me', Utilities.newBlob(mime, 'message/rfc822'));
  props.setProperty(clave, JSON.stringify({ id: r.threadId, ultimo: msgId, nombre: hilo ? hilo.nombre : nombre }));
  return r.threadId;
}

/** El acuse fijo, como mucho uno cada pocas horas por cliente. Si falla, no pasa nada: el mensaje ya está en Gmail. */
function acusar_(tel, a) {
  if (!a.acuse) return;
  const props = PropertiesService.getScriptProperties();
  const ultimo = Number(props.getProperty('wa_a_' + tel) || 0);
  if (Date.now() - ultimo < MINUTOS_ENTRE_ACUSES * 60 * 1000) return;
  try {
    enviarWhatsApp_(tel, a.acuse, a);
    props.setProperty('wa_a_' + tel, String(Date.now()));
  } catch (err) {
    console.error('WhatsApp, acuse: ' + err.message);
  }
}

/** Manda un texto por WhatsApp desde el número del negocio. Lanza el error de Meta explicado. */
function enviarWhatsApp_(tel, texto, a) {
  if (a.qr) return encolarQR_(tel, texto);
  const r = UrlFetchApp.fetch(GRAPH_ + '/' + a.numero + '/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + a.token },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: tel, type: 'text', text: { preview_url: false, body: texto } })
  });
  const d = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200) throw new Error(explicarMeta_(d.error));
  return d.messages && d.messages[0] ? d.messages[0].id : '';
}

function explicarMeta_(error) {
  const c = error && Number(error.code), msg = (error && error.message) || 'Meta no ha contestado';
  if (c === 190) return 'El token de WhatsApp no vale o ha caducado: pega uno permanente en «Tu negocio → WhatsApp».';
  if (c === 131047) return 'Han pasado más de 24 h desde su último mensaje: WhatsApp solo deja escribirle con un mensaje aprobado.';
  if (c === 131030) return 'Ese número no está en la lista de números de prueba de tu app de Meta.';
  if (c === 131026) return 'WhatsApp no ha podido entregarlo: puede que ese número no tenga WhatsApp.';
  if (c === 100) return 'Meta no reconoce el identificador del número. Cópialo de «Configuración de la API».';
  return msg;
}

function yaVisto_(id) { return !!PropertiesService.getScriptProperties().getProperty('wa_v_' + resumenId_(id)); }

/** Recuerda los mensajes ya metidos en Gmail (Meta puede avisar dos veces) y olvida los de hace más de 8 días. */
function marcarVisto_(id) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('wa_v_' + resumenId_(id), String(Date.now()));
  if (Math.random() < 0.05) {
    const todo = props.getProperties(), limite = Date.now() - 8 * DIA_MS_;
    Object.keys(todo).forEach(k => { if (k.indexOf('wa_v_') === 0 && Number(todo[k]) < limite) props.deleteProperty(k); });
  }
}

// ---------------------------------------------------------------- WhatsApp por QR (modo prueba)

const COLA_MAX_ = 50;
const QR_SIN_SENAL_MS_ = 2 * 60 * 1000;

/** Lo que pasa el ordenador vinculado: mensajes nuevos de los números permitidos, o lo que ya ha enviado. */
function recibirQR_(datos, a) {
  if (!a.qr) return ContentService.createTextOutput('no');
  PropertiesService.getScriptProperties().setProperty('wa_qr_visto', String(Date.now()));
  const cerrojo = LockService.getScriptLock();
  if (!cerrojo.tryLock(25000)) return ContentService.createTextOutput('ocupado');
  try {
    if (Array.isArray(datos.enviados) && datos.enviados.length) {
      const fuera = {};
      datos.enviados.forEach(id => { fuera[String(id)] = true; });
      guardarCola_(leerCola_().filter(m => !fuera[m.id]));
    }
    (datos.mensajes || []).forEach(m => {
      try {
        const tel = String(m.tel || '').replace(/\D/g, '');
        if (!m.id || !tel || yaVisto_(m.id)) return;
        let adjunto = null;
        if (m.archivo && m.archivo.base64) {
          adjunto = Utilities.newBlob(Utilities.base64Decode(m.archivo.base64), m.archivo.mime || 'application/octet-stream',
            String(m.archivo.nombre || 'archivo').replace(/[\\/\r\n"]/g, ''));
        }
        const fecha = new Date(Number(m.fecha) * 1000 || Date.now());
        insertarEnGmail_(tel, String(m.nombre || '+' + tel).slice(0, 80), String(m.texto || '').slice(0, 20000), adjunto, fecha, m.id);
        marcarVisto_(m.id);
        acusar_(tel, a);
      } catch (err) { console.error('WhatsApp por QR: ' + err.message); }
    });
  } finally {
    cerrojo.releaseLock();
  }
  return ContentService.createTextOutput('OK');
}

/** Lo que el ordenador vinculado tiene que enviar. Lo quita de la cola cuando avisa de que ya ha salido. */
function colaQR_(clave, numero) {
  const a = ajustesWhatsApp_();
  if (!a.clave || clave !== a.clave || !a.qr) return ContentService.createTextOutput(JSON.stringify({ error: 'no' })).setMimeType(ContentService.MimeType.JSON);
  const props = PropertiesService.getScriptProperties();
  const tel = numero.replace(/\D/g, '');
  if (tel && a.mostrar !== '+' + tel + ' · por QR') props.setProperty('wa_mostrar', '+' + tel + ' · por QR');
  props.setProperty('wa_qr_visto', String(Date.now()));
  return ContentService.createTextOutput(JSON.stringify({ cola: leerCola_() })).setMimeType(ContentService.MimeType.JSON);
}

function encolarQR_(tel, texto) {
  const visto = Number(PropertiesService.getScriptProperties().getProperty('wa_qr_visto') || 0);
  if (Date.now() - visto > QR_SIN_SENAL_MS_) {
    throw new Error('El ordenador con el WhatsApp por QR no está conectado: ábrelo con «node herramientas/whatsapp-qr.mjs».');
  }
  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(20000);
  try {
    const cola = leerCola_();
    if (cola.length >= COLA_MAX_) throw new Error('Hay demasiados mensajes esperando al ordenador del QR.');
    const id = 'qr.' + Utilities.getUuid();
    cola.push({ id: id, tel: tel, texto: texto });
    guardarCola_(cola);
    return id;
  } finally {
    cerrojo.releaseLock();
  }
}

function leerCola_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty('wa_cola') || '[]'); }
function guardarCola_(cola) { PropertiesService.getScriptProperties().setProperty('wa_cola', JSON.stringify(cola)); }

function resumenId_(id) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(id)).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/** El número de WhatsApp de una conversación, si viene de WhatsApp. */
function telefonoDeHilo_(mensajes) {
  for (let i = 0; i < mensajes.length; i++) {
    const t = (mensajes[i].getFrom() + ' ' + mensajes[i].getTo()).match(RE_WA_);
    if (t) return t[1];
  }
  return '';
}

/** Lo envía una persona desde el panel: sale por WhatsApp, queda en la conversación y el borrador se quita. */
function enviarPorWhatsApp_(id, tel, texto) {
  texto = String(texto || '').replace(/\r\n/g, '\n').trim();
  if (!texto) throw new Error('El mensaje está vacío.');
  if (texto.length > 4096) throw new Error('WhatsApp no deja enviar más de 4.096 caracteres.');
  const a = ajustesWhatsApp_();
  if (!conectado_(a)) throw new Error('WhatsApp no está conectado: pulsa el nombre del negocio, arriba a la izquierda → WhatsApp.');
  const idMeta = enviarWhatsApp_(tel, texto, a);
  insertarEnGmail_(tel, '', texto, null, new Date(), idMeta || Utilities.getUuid(), { enviado: true, hilo: id });
  const b = hilosConBorrador_()[id];
  if (b) Gmail.Users.Drafts.remove('me', b.id);
  return { ok: true, whatsapp: true };
}

// ---------------------------------------------------------------- ayudas

function escribirBorrador_(id, texto) {
  texto = String(texto || '').replace(/\r\n/g, '\n').trim();
  if (!texto) throw new Error('El mensaje está vacío.');
  if (texto.length > 20000) throw new Error('El mensaje es demasiado largo.');
  const yo = Session.getEffectiveUser().getEmail().toLowerCase();
  const hilo = GmailApp.getThreadById(id);
  if (!hilo) throw new Error('No encuentro esta conversación.');
  const todos = hilo.getMessages();
  const ref = ultimoDelCliente_(todos, yo);
  if (!ref) throw new Error('No hay ningún mensaje del cliente al que contestar.');
  const enGmail = hilosConBorrador_()[id] || null;
  const borradorId = enGmail ? enGmail.id : null;
  const enBorrador = enGmail ? todos.filter(m => m.getId() === enGmail.mensaje)[0] : null;
  const para = (enBorrador && direcciones_(enBorrador.getTo())) || direcciones_(ref.getReplyTo() || ref.getFrom());
  if (!para) throw new Error('No sé a quién contestar en esta conversación.');
  let asunto = ref.getSubject() || '';
  if (!/^re:/i.test(asunto)) asunto = 'Re: ' + asunto;
  const msgId = ref.getHeader('Message-ID') || ref.getHeader('Message-Id');
  const refs = [ref.getHeader('References'), msgId].filter(Boolean).join(' ');
  const cuando = Utilities.formatDate(ref.getDate(), Session.getScriptTimeZone(), "d/MM/yyyy 'a las' HH:mm");
  const original = textoDe_(ref);
  const textoPlano = texto + '\n\nEl ' + cuando + ', ' + ref.getFrom() + ' escribió:\n' +
    original.split('\n').map(l => '> ' + l).join('\n') + '\n';
  const html = '<div dir="auto">' + aHtml_(texto) + '</div><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">El ' +
    aHtml_(cuando + ', ' + ref.getFrom()) + ' escribió:<br></div><blockquote class="gmail_quote" ' +
    'style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">' + aHtml_(original) + '</blockquote></div>';
  const corte = 'corte_' + Utilities.getUuid().replace(/-/g, '');
  const b64 = t => Utilities.base64Encode(t, Utilities.Charset.UTF_8).replace(/(.{76})/g, '$1\r\n');
  const mime = [
    'To: ' + para,
    'Subject: =?UTF-8?B?' + Utilities.base64Encode(asunto, Utilities.Charset.UTF_8) + '?=',
    msgId ? 'In-Reply-To: ' + msgId : null,
    refs ? 'References: ' + refs : null,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + corte + '"',
    '',
    '--' + corte,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(textoPlano),
    '--' + corte,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html),
    '--' + corte + '--',
    ''
  ].filter(l => l !== null).join('\r\n');
  const recurso = { message: { raw: Utilities.base64EncodeWebSafe(mime, Utilities.Charset.UTF_8), threadId: id } };
  if (borradorId) return Gmail.Users.Drafts.update(recurso, 'me', borradorId).id;
  return Gmail.Users.Drafts.create(recurso, 'me').id;
}

/** { idDelHilo: {id, mensaje} } con un borrador por conversación (Gmail los da del más reciente al más antiguo). */
function hilosConBorrador_() {
  const mapa = {};
  let pagina;
  do {
    const r = Gmail.Users.Drafts.list('me', { maxResults: 500, pageToken: pagina });
    (r.drafts || []).forEach(d => { if (d.message && !mapa[d.message.threadId]) mapa[d.message.threadId] = { id: d.id, mensaje: d.message.id }; });
    pagina = r.nextPageToken;
  } while (pagina);
  return mapa;
}

function ultimoDelCliente_(mensajes, yo) {
  const reales = mensajes.filter(m => !m.isDraft() && !esAviso_(m));
  const suyos = reales.filter(m => !esMio_(m, yo));
  return suyos[suyos.length - 1] || reales[reales.length - 1] || null;
}

/** Los avisos automáticos de Gmail («No se ha encontrado la dirección»): no son del cliente ni se contestan. */
function esAviso_(m) { return /mailer-daemon@|postmaster@/i.test(m.getFrom()); }

function textoAviso_(m) {
  const t = m.getPlainBody() || '';
  const a = t.match(/(?:entregado a|delivered to)\s+(\S+@[^\s.]+(?:\.[^\s.]+)+?)(?=[\s,.]|$)/i);
  return 'No se ha podido entregar' + (a ? ' a ' + a[1] : '') + '. Revisa la dirección.';
}

function esMio_(m, yo) { return direcciones_(m.getFrom()).toLowerCase().indexOf(yo) !== -1; }

function direcciones_(cabecera) {
  return (String(cabecera || '').match(/[^\s<>,;"']+@[^\s<>,;"']+/g) || []).join(', ');
}

function nombre_(de) {
  const s = String(de || '').trim();
  const m = s.match(/^"?([^"<]+?)"?\s*</);
  return (m ? m[1].trim() : s.replace(/[<>]/g, '')).replace(/ \(WhatsApp\)$/, '');
}

/** Gmail escribe «Agente/Factura» como label:agente-factura. */
function slug_(nombre) { return nombre.toLowerCase().replace(/[\s\/]+/g, '-'); }

function resumirEtiquetas_(nombres) {
  const r = { tipo: '', revisar: false, sospechoso: false };
  (nombres || []).forEach(n => {
    if (n.indexOf('Agente/') !== 0) return;
    const t = n.slice(7);
    if (t === 'Revisar') r.revisar = true;
    else if (t === 'Sospechoso') r.sospechoso = true;
    else if (!r.tipo) r.tipo = t;
  });
  return r;
}

/** El texto de un mensaje, sin lo citado. Si el mensaje es HTML (como los borradores del agente), lo pasa a texto. */
function textoDe_(m) {
  const html = m.getBody() || '';
  if (/<(div|br|p|blockquote|span|table)[\s>\/]/i.test(html)) {
    const sinCitaHtml = html.split(/<div[^>]*class="?gmail_(extra|quote)|<blockquote|<div[^>]*id="?appendonsend/i)[0];
    return sinCita_(htmlATexto_(sinCitaHtml));
  }
  return sinCita_(m.getPlainBody() || html);
}

function htmlATexto_(html) {
  return String(html)
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function aHtml_(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

/** Quita el texto citado de los mensajes anteriores («On … wrote:», «El … escribió:», líneas con «>»). */
function sinCita_(texto) {
  let t = '\n' + String(texto || '').replace(/\r\n/g, '\n');
  const cortes = [
    t.search(/\n[ \t]*(On|El)[ \t][^\n]*\d[^\n]*(\n[^\n]*)?\s(wrote|escribió):[ \t]*(\n|$)/),
    t.search(/\n>/),
    t.search(/\n-{2,}[ \t]*(Mensaje reenviado|Forwarded message)/)
  ].filter(i => i !== -1);
  if (cortes.length) t = t.slice(0, Math.min.apply(null, cortes));
  return t.replace(/\n{3,}/g, '\n\n').trim();
}


// ---------------------------------------------------------------- la página

const PAGINA = String.raw`<!doctype html>
<html lang="es">
<head>
<base target="_top">
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --lienzo:#e8e8e5; --app:#f5f5f3; --tarjeta:#fff; --linea:#e9e9e6; --linea-f:#dcdcd8; --suave:#f0f0ee; --hover:#f7f7f5;
  --tinta:#161616; --sec:#6c6c68; --ter:#a2a29d; --barra:#e3e3df;
  --ok:#1f8a5b; --ok-f:#e7f4ed; --aten:#c47a16; --aten-t:#9f5f0c; --aten-f:#fbf0de; --err:#d23c2f; --err-t:#b8301f; --err-f:#fcebe8; --ok-p:#34c47c; --aten-p:#f5c518;
  --sans:"Geist","Helvetica Neue",Arial,sans-serif; --mono:var(--sans);
  --r:16px; --sombra:0 1px 2px rgba(20,20,20,.04),0 1px 1px rgba(20,20,20,.02);
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;font-variant-numeric:tabular-nums;background:var(--lienzo);color:var(--tinta);font-family:var(--sans);font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased;font-feature-settings:"ss01","cv11"}
button,textarea,input,select{font:inherit;color:inherit}
button{cursor:pointer}
a{color:inherit;text-decoration:none}
svg.i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.marco{height:100vh;height:100dvh;padding:12px}
.app{height:100%;display:grid;grid-template-columns:236px minmax(0,1fr);background:var(--app);border-radius:22px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.04),0 12px 40px -20px rgba(0,0,0,.18)}

/* ---- Barra lateral */
.lado{display:flex;flex-direction:column;padding:20px 14px 16px;min-height:0}
.marca{display:flex;align-items:center;gap:10px;padding:8px;margin:-6px 0 14px;border:0;background:transparent;border-radius:12px;text-align:left;width:100%;min-width:0;transition:background .15s}
.marca:hover{background:var(--suave)}
.marca .txt{min-width:0}
.marca-img{display:block;max-width:100%;max-height:56px;object-fit:contain;object-position:left center}
.marca.con-logo{flex-direction:column;align-items:flex-start;gap:6px}
.mini{display:none}
/* Personalizar */
.capa{position:fixed;inset:0;z-index:50;background:rgba(20,20,20,.32);display:grid;place-items:center;padding:16px}
.capa[hidden]{display:none}
.dialogo{width:min(440px,100%);background:var(--tarjeta);border-radius:18px;box-shadow:0 24px 60px -20px rgba(0,0,0,.35);padding:20px}
.dialogo h2{font-size:17px;margin:0 0 4px;letter-spacing:-.01em}
.dialogo .sub{color:var(--sec);font-size:13px;margin-bottom:16px}
.campo{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;font-size:13px;font-weight:500}
.campo input[type=text]{border:1px solid var(--linea-f);border-radius:10px;padding:9px 12px;font-size:14px;font-weight:400}
.campo input[type=text]:focus{outline:0;border-color:var(--tinta)}
.vista-logo{height:110px;border:1px dashed var(--linea-f);border-radius:12px;display:grid;place-items:center;background:var(--app);color:var(--ter);font-weight:400;padding:14px}
.vista-logo img{max-width:100%;max-height:80px;object-fit:contain}
.fila-b{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fila-b .estado{flex:1;font-size:12.5px;color:var(--sec);font-weight:400}
.dialogo .pie-d{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.dialogo{max-height:calc(100dvh - 32px);overflow:auto}
.wa{border-top:1px solid var(--linea);margin:4px 0 14px;padding-top:14px}
.wa .fila{display:flex;align-items:center;gap:10px;font-size:13px}
.wa .fila .t{flex:1;min-width:0}
.wa .fila b{font-weight:600}
.wa .fila .e{color:var(--sec)}
.wa .campos{margin-top:12px}
.wa textarea,.campo input[type=password]{border:1px solid var(--linea-f);border-radius:10px;padding:9px 12px;font:inherit;font-size:14px;font-weight:400;resize:vertical}
.wa textarea:focus,.campo input[type=password]:focus{outline:0;border-color:var(--tinta)}
.wa .ayuda{font-size:12px;color:var(--sec);font-weight:400}
.wa .meta{background:var(--app);border-radius:12px;padding:10px 12px;margin-top:12px;font-size:12.5px;color:var(--sec)}
.wa .meta code{display:block;margin:3px 0 8px;color:var(--tinta);font:500 12.5px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.wa .meta code:last-child{margin-bottom:0}
.wa .meta code{user-select:all;-webkit-user-select:all}
.wa .meta b{color:var(--tinta);font-weight:600}
.wa .meta ol{margin:8px 0 0;padding-left:18px}
.wa .meta li{margin-bottom:10px}
.wa .meta li:last-child{margin-bottom:0}
.wa .meta .fila-b{margin-top:6px}
.wa .meta input{flex:1;min-width:0;border:1px solid var(--linea-f);border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;color:var(--tinta);background:var(--tarjeta)}
.wa .meta input:focus{outline:0;border-color:var(--tinta)}
.ventana{font-size:12px;color:var(--sec)}
.ventana.cerrada{color:var(--err-t)}
.logo{width:34px;height:34px;border-radius:10px;background:var(--tinta);color:#fff;display:grid;place-items:center;font-weight:600;font-size:13px;letter-spacing:.02em;flex:none}
.marca .n{font-weight:600;font-size:15px;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.marca .s{font-size:12px;color:var(--sec)}
.nav{display:flex;flex-direction:column;gap:2px}
.nav button{display:flex;align-items:center;gap:11px;border:0;background:transparent;border-radius:10px;padding:9px 10px;font-size:14px;color:var(--sec);text-align:left;transition:background .15s,color .15s}
.nav button:hover{background:var(--suave);color:var(--tinta)}
.nav button[aria-current="page"]{background:var(--tarjeta);color:var(--tinta);font-weight:500;box-shadow:var(--sombra),0 0 0 1px var(--linea)}
.nav .t{flex:1}
.nav .c{font-family:var(--mono);font-size:12px;color:var(--ter)}
.nav .c.on{background:var(--tinta);color:#fff;border-radius:999px;padding:1px 7px}
.lado .pie{margin-top:auto;padding:14px;border-radius:14px;background:var(--tarjeta);box-shadow:var(--sombra),0 0 0 1px var(--linea)}
.lado .pie .k{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500}
.lado .pie .k .v{width:8px;height:8px;border-radius:50%;background:var(--ok-p);box-shadow:0 0 0 3px var(--ok-f)}
.lado .pie p{margin:6px 0 0;font-size:12px;color:var(--sec)}

/* ---- Zona principal */
.principal{display:flex;flex-direction:column;min-width:0;min-height:0;border-left:1px solid var(--linea);background:var(--app)}
.top{display:flex;align-items:center;gap:12px;padding:14px 28px;border-bottom:1px solid var(--linea);min-height:62px}
.migas{flex:1;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sec);min-width:0}
.migas b{color:var(--tinta);font-weight:500}
.migas .sep{color:var(--ter)}
.vista{flex:1;min-height:0;overflow-y:auto}
.vista[hidden]{display:none}
.boton{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--linea-f);background:var(--tarjeta);border-radius:10px;padding:8px 13px;font-size:13px;font-weight:500;white-space:nowrap;transition:border-color .15s,background .15s,color .15s}
.boton:hover{border-color:#bdbdb8}
.boton .i{width:16px;height:16px}
.boton.negro{background:var(--tinta);border-color:var(--tinta);color:#fff}
.boton.negro:hover{background:#000}
.boton.negro .c{font-family:var(--mono);font-size:12px;background:rgba(255,255,255,.16);border-radius:999px;padding:1px 7px;margin-left:2px}
.boton.fantasma{border-color:transparent;background:transparent;color:var(--sec)}
.boton.fantasma:hover{background:var(--suave);color:var(--tinta)}
.boton:disabled{opacity:.45;cursor:default}
.selector{position:relative;display:inline-flex}
.selector .i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--sec);pointer-events:none;width:16px;height:16px}
.selector select{appearance:none;-webkit-appearance:none;border:1px solid var(--linea-f);background:var(--tarjeta) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236c6c68' fill='none' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 12px center;border-radius:10px;padding:8px 34px 8px 36px;font-size:13px;font-weight:500;cursor:pointer}
.selector select:hover{border-color:#bdbdb8}
.cuerpo{padding:28px 32px 40px;max-width:1680px}

/* ---- Resumen */
.cabeza{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px}
.hola{font-size:14px;color:var(--sec);margin-bottom:4px}
.cabeza h1{font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-.025em;margin:0}
.cabeza .sub{color:var(--sec);margin-top:6px}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}
.kpi{position:relative;text-align:left;background:var(--tarjeta);border:0;border-radius:var(--r);padding:16px 16px 14px;box-shadow:var(--sombra),0 0 0 1px var(--linea);transition:box-shadow .15s}
button.kpi:hover{box-shadow:var(--sombra),0 0 0 1px #cfcfca}
.kpi .l{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--sec);font-weight:500}
.kpi .ic{width:30px;height:30px;border-radius:50%;border:1px solid var(--linea);display:grid;place-items:center;color:var(--tinta)}
.kpi .ic .i{width:15px;height:15px}
.kpi .v{font-size:34px;font-weight:500;letter-spacing:-.03em;line-height:1;margin:14px 0 12px;font-variant-numeric:tabular-nums}
.kpi .v small{font-size:16px;color:var(--sec);margin:0 6px 0 2px;letter-spacing:0;font-weight:500}
.kpi .pie{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--sec)}
.kpi .pie b{color:var(--tinta);font-weight:500}
.metro{display:flex;gap:3px;height:22px;align-items:stretch;flex:none}
.metro span{width:3px;border-radius:2px;background:var(--barra)}
.metro span.on{background:var(--tinta)}
.explica{display:none;position:absolute;z-index:5;top:calc(100% + 8px);right:0;width:250px;background:var(--tinta);color:#fff;font-size:12.5px;line-height:1.5;padding:10px 12px;border-radius:10px}
.kpi.abierta .explica{display:block}
.rejilla{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:14px;align-items:start}
.columna{display:flex;flex-direction:column;gap:14px;min-width:0}
.tarjeta{background:var(--tarjeta);border-radius:var(--r);box-shadow:var(--sombra),0 0 0 1px var(--linea);min-width:0}
.t-cab{display:flex;align-items:center;gap:10px;padding:16px 18px 6px}
.t-cab h2{font-size:15px;font-weight:600;margin:0;letter-spacing:-.01em}
.t-cab .sub{font-size:12.5px;color:var(--sec)}
.t-cab .der{margin-left:auto}
.t-ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;background:var(--suave);color:var(--tinta)}
.t-ic .i{width:16px;height:16px}
.cuenta{font-size:12.5px;font-weight:500;border-radius:999px;padding:3px 10px;white-space:nowrap;background:var(--suave);color:var(--sec)}
.cuenta.aten{background:var(--aten-f);color:var(--aten-t)}
/* Necesita a una persona: lo que manda en la página */
.persona{box-shadow:0 1px 2px rgba(20,20,20,.04),0 0 0 1px #ecdcc3,0 14px 30px -22px rgba(196,122,22,.55)}
.persona .t-ic{background:var(--aten-f);color:var(--aten-t)}
.avisos{padding:6px 8px 8px}
.actualizar{margin:12px 20px 0;padding:12px 14px;border-radius:12px;background:var(--aten-f);color:var(--aten-t);font-weight:500}
.actualizar b{color:var(--tinta)}
.aviso{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 10px;border-radius:12px;transition:background .12s;cursor:pointer}
.aviso:hover{background:var(--hover)}
.aviso + .aviso{box-shadow:0 -1px 0 var(--linea)}
.aviso:hover + .aviso,.aviso + .aviso:hover{box-shadow:none}
.cuad{width:36px;height:36px;border-radius:10px;display:grid;place-items:center}
.cuad .i{width:17px;height:17px}
.cuad.err{background:var(--err-f);color:var(--err-t)}
.cuad.aten{background:var(--aten-f);color:var(--aten-t)}
.cuad.ok{background:var(--ok-f);color:var(--ok)}
.aviso .quien{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aviso .quien span{font-weight:400;color:var(--sec)}
.aviso .por{font-size:13px;margin-top:1px}
.aviso .por.err{color:var(--err-t)} .aviso .por.aten{color:var(--aten-t)}
.aviso .acc{display:flex;align-items:center;gap:6px}
.check{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--linea-f);background:var(--tarjeta);display:grid;place-items:center;color:#cfcfca;transition:all .15s;padding:0}
.check .i{width:15px;height:15px;stroke-width:2.2}
.check:hover{border-color:var(--tinta);color:var(--tinta)}
.check[aria-pressed="true"]{background:var(--tinta);border-color:var(--tinta);color:#fff}
.aviso.listo .cuad{background:var(--suave);color:var(--ter)}
.aviso.listo .quien,.aviso.listo .por{color:var(--ter)}
.aviso.listo .quien span{color:var(--ter)}
.aviso.listo .por{text-decoration:line-through;text-decoration-color:var(--linea-f)}
.hecho-txt{font-size:12px;color:var(--ok);font-weight:500;display:inline-flex;align-items:center;gap:4px}
.hecho-txt .i{width:14px;height:14px}
.vacio{padding:18px 18px 22px;color:var(--sec)}
.primera{padding:20px 22px;margin-top:18px;max-width:640px}
.primera ol{margin:0 0 16px;padding-left:20px;display:grid;gap:8px;font-size:15px}
.primera .fila-b{display:flex;gap:8px;flex-wrap:wrap}
.vacio.grande{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;height:100%;padding:40px}
.vacio.grande .t-ic{width:44px;height:44px;border-radius:12px}
/* Donut de facturas */
.estados{display:grid;grid-template-columns:132px minmax(0,1fr);gap:18px;align-items:center;padding:10px 18px 18px}
.donut{position:relative;width:132px;height:132px}
.donut svg{width:132px;height:132px;transform:rotate(-90deg)}
.donut .centro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.donut .centro b{font-size:28px;font-weight:500;letter-spacing:-.03em;line-height:1}
.donut .centro span{font-size:12px;color:var(--sec);margin-top:3px}
.leyenda{display:flex;flex-direction:column;gap:2px}
.leyenda button{display:grid;grid-template-columns:10px 1fr auto 38px;gap:9px;align-items:center;border:0;background:transparent;border-radius:8px;padding:6px 8px;text-align:left;font-size:13px}
.leyenda button:hover{background:var(--suave)}
.leyenda .p{width:8px;height:8px;border-radius:50%}
.leyenda .n{font-family:var(--mono);font-weight:500}
.leyenda .pc{font-family:var(--mono);color:var(--ter);text-align:right;font-size:12px}
/* Últimos correos */
.ultimos{padding:4px 8px 10px}
.fila-c{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;border:0;background:transparent;text-align:left;border-radius:10px;padding:8px 10px}
.fila-c:hover{background:var(--hover)}
.av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:600;background:var(--suave);color:var(--sec);position:relative;flex:none}
.av .est{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;border:2px solid var(--tarjeta)}
.av .est.err{background:var(--err)} .av .est.aten{background:var(--aten-p)}
.fila-c .q{font-weight:500;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fila-c .a{font-size:12.5px;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fila-c .h{font-family:var(--mono);font-size:11.5px;color:var(--ter)}
.pild{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;padding:3px 9px;border-radius:999px;background:var(--suave);color:var(--sec);white-space:nowrap}
.pild::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.pild.ok{background:var(--ok-f);color:var(--ok)}
.pild.aten{background:var(--aten-f);color:var(--aten-t)}
.pild.err{background:var(--err-f);color:var(--err-t)}
.pild.neutra::before{display:none}
.punto{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--ter);vertical-align:middle;flex:none}
.punto.ok{background:var(--ok-p)} .punto.aten{background:var(--aten-p)} .punto.err{background:var(--err)}
.segm .punto{width:7px;height:7px;margin-right:6px;position:relative;top:-1px}
.solo-lector{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.facturas-tabla td.col-estado{text-align:center}

/* ---- Facturas */
.segm{display:inline-flex;gap:3px;background:var(--suave);padding:3px;border-radius:11px;flex-wrap:wrap}
.segm button{border:0;background:transparent;border-radius:8px;padding:6px 11px;font-size:13px;color:var(--sec);white-space:nowrap}
.segm button:hover{color:var(--tinta)}
.segm button[aria-pressed="true"]{background:var(--tarjeta);color:var(--tinta);font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,.07)}
.segm .c{font-family:var(--mono);margin-left:5px;color:var(--ter);font-size:12px}
.barra-f{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th{font-size:12px;font-weight:500;color:var(--sec);text-align:left;padding:11px 16px;background:#fafaf8;border-bottom:1px solid var(--linea)}
th:first-child{border-top-left-radius:var(--r)} th:last-child{border-top-right-radius:var(--r)}
td{padding:12px 16px;border-top:1px solid var(--linea);vertical-align:middle}
tbody tr:first-child td{border-top:0}
tr.fila{cursor:pointer;transition:background .12s}
tr.fila:hover td{background:var(--hover)}
tbody tr:last-child td:first-child{border-bottom-left-radius:var(--r)} tbody tr:last-child td:last-child{border-bottom-right-radius:var(--r)}
.prov{display:flex;align-items:center;gap:11px;min-width:0}
.prov .ini{width:34px;height:34px;border-radius:9px;background:var(--suave);display:grid;place-items:center;font-size:12px;font-weight:600;color:var(--sec);flex:none}
.prov .nm{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prov .nr{font-family:var(--mono);font-size:12px;color:var(--ter)}
.num{font-family:var(--mono);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.gris{color:var(--sec)}
.dif.err{color:var(--err-t);font-weight:500}
.flecha{color:var(--ter);width:16px}

/* ---- Correos */
.correos{display:grid;grid-template-columns:360px minmax(0,1fr);height:100%;min-height:0}
.lista{display:flex;flex-direction:column;min-height:0;min-width:0;border-right:1px solid var(--linea);background:var(--app)}
.lista-cab{padding:18px 16px 10px;display:flex;flex-direction:column;gap:10px}
.buscar{position:relative}
.buscar .i{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--ter)}
.buscar input{width:100%;border:1px solid var(--linea-f);background:var(--tarjeta);border-radius:10px;padding:8px 12px 8px 34px;font-size:13.5px}
.buscar input:focus{outline:0;border-color:var(--tinta)}
.lista .segm{display:flex}
.lista .segm button{flex:1}
.convs{overflow-y:auto;flex:1;padding:2px 10px 16px}
.conv{display:grid;grid-template-columns:38px minmax(0,1fr);gap:11px;width:100%;text-align:left;border:0;background:transparent;border-radius:12px;padding:11px 10px;transition:background .12s}
.conv .av{width:38px;height:38px;background:var(--tarjeta);box-shadow:0 0 0 1px var(--linea)}
.conv .av .est{border-color:var(--app)}
.conv:hover{background:var(--suave)}
.conv[aria-current="true"]{background:var(--tarjeta);box-shadow:var(--sombra),0 0 0 1px var(--linea)}
.conv[aria-current="true"] .av{background:var(--suave);box-shadow:none}
.conv[aria-current="true"] .av .est{border-color:var(--tarjeta)}
.conv .f1{display:flex;align-items:baseline;gap:8px}
.conv .q{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.conv .h{font-family:var(--mono);font-size:11.5px;color:var(--ter)}
.conv .as{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.conv .ex{font-size:12.5px;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.conv .mm{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.chip{font-size:11.5px;font-weight:500;padding:2px 8px;border-radius:6px;background:var(--suave);color:var(--sec);white-space:nowrap}
.conv:hover .chip,.conv[aria-current="true"] .chip{background:#e9e9e6}
.chip.ok{background:var(--ok-f);color:var(--ok)} .chip.aten{background:var(--aten-f);color:var(--aten-t)} .chip.err{background:var(--err-f);color:var(--err-t)}
.nota-lista{padding:14px 12px;color:var(--sec);font-size:13.5px}
.error{color:var(--err-t)}
.chat{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--tarjeta)}
.chat-cab{display:flex;align-items:center;gap:12px;padding:14px 22px;border-bottom:1px solid var(--linea)}
.volver{display:none;border:0;background:transparent;padding:6px 6px 6px 0;color:var(--sec)}
.volver .i{width:22px;height:22px}
.chat-cab .av{width:40px;height:40px;font-size:13px}
.chat-cab .tit{flex:1;min-width:0}
.chat-cab .nombre{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;letter-spacing:-.01em;flex-wrap:wrap}
.chat-cab .detalle{font-size:13px;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.alerta{margin:0 auto 12px;max-width:720px;padding:11px 14px;border-radius:12px;background:var(--err-f);color:var(--err-t);font-size:13.5px;display:flex;gap:10px;align-items:flex-start}
.alerta .i{margin-top:1px}
.revision{margin:0 auto 12px;max-width:720px;background:var(--tarjeta);border-radius:14px;box-shadow:var(--sombra),0 0 0 1px var(--linea);padding:12px 14px;display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:center}
.revision .cab{grid-column:1/-1;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-bottom:4px}
.revision .cab .pild{margin-left:auto}
.revision dt{font-size:12.5px;color:var(--sec)}
.revision dd{margin:0;font-size:13px;font-family:var(--mono);text-align:right}
.revision .mot{grid-column:1/-1;font-size:13px;margin-top:4px}
.revision .mot.err{color:var(--err-t)} .revision .mot.aten{color:var(--aten-t)}
.mensajes{flex:1;overflow-y:auto;padding:18px 22px;background:var(--app)}
.dia{text-align:center;margin:12px 0 10px}
.dia span{font-size:11.5px;font-weight:500;color:var(--sec);background:var(--tarjeta);box-shadow:0 0 0 1px var(--linea);border-radius:999px;padding:3px 10px}
.dia.aviso span{color:var(--err-t);background:var(--err-f);box-shadow:none}
.msg{max-width:min(620px,80%);margin:0 0 12px}
.msg .quien{font-size:12px;color:var(--sec);margin:0 0 4px 4px}
.burbuja{background:var(--tarjeta);box-shadow:var(--sombra),0 0 0 1px var(--linea);border-radius:16px 16px 16px 6px;padding:11px 14px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}
.burbuja .hora{display:block;text-align:right;font-family:var(--mono);font-size:11px;color:var(--ter);margin-top:5px}
.msg.mio{margin-left:auto}
.msg.mio .quien{text-align:right;margin-right:4px}
.msg.mio .burbuja{background:var(--tinta);color:#fff;box-shadow:none;border-radius:16px 16px 6px 16px}
.msg.mio .burbuja .hora{color:rgba(255,255,255,.55)}
.adjuntos{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.adjunto{display:inline-flex;align-items:center;gap:6px;font-size:12px;background:var(--suave);border-radius:8px;padding:5px 9px;color:var(--tinta)}
.adjunto:hover{background:#e7e7e4}
.adjunto .i{width:14px;height:14px;color:var(--sec)}
.escribir{padding:12px 22px 16px;background:var(--app)}
.caja{background:var(--tarjeta);border-radius:16px;box-shadow:var(--sombra),0 0 0 1px var(--linea-f);transition:box-shadow .15s}
.caja:focus-within{box-shadow:var(--sombra),0 0 0 1.5px var(--tinta)}
.caja .etiq{display:flex;justify-content:space-between;align-items:center;gap:4px 12px;flex-wrap:wrap;padding:10px 14px 0;font-size:12.5px;color:var(--sec)}
.caja .etiq .chip{font-size:12px}
.caja .para{overflow-wrap:anywhere}
textarea{display:block;width:100%;min-height:92px;max-height:40vh;resize:none;border:0;padding:8px 14px 4px;background:transparent;line-height:1.55;font-size:14px}
textarea:focus{outline:0}
.botones{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:6px 10px 10px 14px}
.botones .estado{flex:1;font-size:12.5px;color:var(--sec)}
.botones .estado.confirmar{font-size:13.5px;font-weight:500;color:var(--tinta);text-align:right}

/* ---- Barra de abajo (móvil) */
.pestanas{display:none}
:focus-visible{outline:2px solid var(--tinta);outline-offset:2px}

/* Tablet: la barra lateral se queda en iconos */
@media (max-width:1180px){
  .app{grid-template-columns:76px minmax(0,1fr)}
  .lado{padding:18px 12px;align-items:center}
  .marca{padding:4px;justify-content:center}
  .marca .txt,.nav .t,.nav .c,.lado .pie{display:none}
  .marca-img{max-width:52px;max-height:40px;object-position:center}
  .nav button{position:relative;width:44px;height:44px;justify-content:center;padding:0}
  .nav button .c.on{display:block;position:absolute;top:3px;right:1px;font-size:10px;padding:0 5px}
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rejilla{grid-template-columns:minmax(0,1fr)}
  .columna.der{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}
  .correos{grid-template-columns:320px minmax(0,1fr)}
}
@media (max-width:900px){
  .correos{grid-template-columns:minmax(0,1fr)}
  .correos.con-hilo .lista{display:none}
  .correos:not(.con-hilo) .chat{display:none}
  .volver{display:block}
}
/* Móvil: sin marco, pestañas abajo; primero lo que necesita a una persona */
@media (max-width:760px){
  html,body{background:var(--app)}
  .marco{padding:0}
  .app{grid-template-columns:minmax(0,1fr);border-radius:0;box-shadow:none}
  .lado{display:none}
  .principal{border-left:0}
  .top{padding:12px 16px;min-height:56px;padding-top:max(12px,env(safe-area-inset-top))}
  .migas .ruta{display:none}
  .mini{display:inline-flex;align-items:center;border:0;background:transparent;padding:0;margin-right:4px}
  .mini img{max-height:26px;max-width:110px;object-fit:contain}
  .mini .logo{width:28px;height:28px;border-radius:8px;font-size:11px}
  .cuerpo{padding:18px 16px 28px}
  .cabeza{flex-direction:column;align-items:stretch;gap:14px;margin-bottom:16px}
  .cabeza h1{font-size:25px}
  .cabeza .acciones-cab{display:flex;gap:8px}
  .cabeza .acciones-cab .boton{flex:1}
  .resumen-orden{display:flex;flex-direction:column;gap:14px}
  .resumen-orden .kpis{order:2;margin:0;gap:10px}
  .resumen-orden .rejilla{display:contents}
  .resumen-orden .persona{order:1}
  .resumen-orden .columna.der{order:3;display:flex;align-items:stretch}
  .kpi{padding:14px 14px 12px}
  .kpi .v{font-size:28px;margin:12px 0 10px}
  .kpi .metro{display:none}
  .aviso{align-items:start}
  .aviso .acc .boton{display:none}
  .cuenta .larga,.kpi .larga,.segm .corta-no{display:none}
  .estados{grid-template-columns:110px minmax(0,1fr);gap:12px;padding:8px 12px 14px}
  .donut,.donut svg{width:110px;height:110px}
  .vista{padding-bottom:calc(68px + env(safe-area-inset-bottom))}
  .vista.sin-pestanas{padding-bottom:0}
  .pestanas{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:10;background:rgba(255,255,255,.96);border-top:1px solid var(--linea);padding:6px 8px calc(6px + env(safe-area-inset-bottom))}
  .pestanas.oculta{display:none}
  .pestanas button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:transparent;font-size:11.5px;color:var(--ter);padding:6px 0;position:relative}
  .pestanas button .i{width:21px;height:21px}
  .pestanas button[aria-current="page"]{color:var(--tinta);font-weight:500}
  .pestanas .c{position:absolute;top:1px;left:calc(50% + 6px);font-family:var(--mono);font-size:10px;background:var(--tinta);color:#fff;border-radius:999px;padding:0 5px}
  .facturas-tabla thead{display:none}
  .facturas-tabla tr.fila{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:12px 14px;border-top:1px solid var(--linea)}
  .facturas-tabla td:first-child{grid-row:1;grid-column:1}
  .facturas-tabla td.col-estado{grid-row:1;grid-column:2;text-align:right}
  .facturas-tabla td.col-total{grid-row:2;grid-column:1}
  .facturas-tabla td.col-dif{grid-row:2;grid-column:2}
  .facturas-tabla td.col-dif .gris{display:none}
  .barra-f .segm{flex-wrap:nowrap;overflow-x:auto;max-width:100%;scrollbar-width:none}
  .barra-f .segm{display:flex;width:100%}
  .barra-f .segm button{flex:1;text-transform:capitalize;padding:6px 6px}
  .chat-cab .nombre .chip{display:none}
  .facturas-tabla tbody tr:first-child{border-top:0}
  .facturas-tabla td{padding:0;border:0;background:transparent!important}
  .facturas-tabla td.col-cliente,.facturas-tabla td.col-flecha{display:none}
  .facturas-tabla td.col-total{text-align:left;padding-left:45px;color:var(--sec)}
  .chat-cab{padding:10px 14px;padding-top:max(10px,env(safe-area-inset-top))}
  .chat-cab .boton .t{display:none}
  .mensajes{padding:14px}
  .msg{max-width:88%}
  .escribir{padding:10px 12px calc(12px + env(safe-area-inset-bottom))}
  .pista{display:none}
}
</style>
</head>
<body>
<div class="marco"><div class="app" id="app">
  <aside class="lado">
    <button class="marca" id="marca" title="Cambiar el nombre y el logo"></button>
    <nav class="nav" id="nav"></nav>
    <div class="pie" id="lado-pie"></div>
  </aside>
  <section class="principal">
    <div class="actualizar" id="actualizar" hidden></div>
    <header class="top" id="top"></header>
    <div class="vista" id="v-resumen"></div>
    <div class="vista" id="v-correos" hidden>
      <div class="correos" id="correos">
        <div class="lista">
          <div class="lista-cab">
            <label class="buscar"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="buscar" type="search" placeholder="Buscar cliente o asunto" aria-label="Buscar"></label>
            <div class="segm" id="filtros"></div>
          </div>
          <div class="convs" id="convs"><div class="nota-lista">Cargando…</div></div>
        </div>
        <main class="chat" id="chat"></main>
      </div>
    </div>
    <div class="vista" id="v-facturas" hidden></div>
  </section>
</div></div>
<nav class="pestanas" id="pestanas"></nav>
<div class="capa" id="capa" hidden>
  <form class="dialogo" id="dialogo" role="dialog" aria-modal="true" aria-labelledby="d-titulo">
    <h2 id="d-titulo">Tu negocio en el panel</h2>
    <div class="sub">El nombre y el logo que ves arriba. Se guardan en tu cuenta.</div>
    <label class="campo">Nombre<input type="text" id="d-nombre" maxlength="60" placeholder="Gestoría Arcos"></label>
    <div class="campo">Logo
      <div class="vista-logo" id="d-vista">Sin logo</div>
      <div class="fila-b"><label class="boton" for="d-archivo">Subir logo</label><input type="file" id="d-archivo" accept="image/png,image/jpeg,image/webp" hidden>
        <button type="button" class="boton fantasma" id="d-quitar">Quitar</button><span class="estado" id="d-estado">PNG o JPG. El blanco de los bordes se recorta solo.</span></div>
    </div>
    <div class="wa" id="wa">
      <div class="fila"><span class="t"><b>WhatsApp</b> <span class="e" id="wa-estado">No conectado</span></span>
        <button type="button" class="boton" id="wa-abrir">Conectar</button></div>
      <div class="campos" id="wa-campos" hidden>
        <label class="campo">Token permanente de Meta<input type="password" id="wa-token" autocomplete="off" placeholder="EAAG…"><span class="ayuda">El del usuario del sistema, que no caduca. No se vuelve a enseñar.</span></label>
        <label class="campo">Identificador del número de teléfono<input type="text" id="wa-numero" inputmode="numeric" placeholder="Lo ves en Meta → WhatsApp → Configuración de la API"></label>
        <label class="campo">Respuesta automática al recibir algo<textarea id="wa-acuse" rows="2" maxlength="500"></textarea><span class="ayuda">Un texto fijo, como mucho uno cada media hora por cliente. Déjalo vacío para no mandar nada.</span></label>
        <div class="fila-b"><button type="button" class="boton negro" id="wa-guardar">Conectar WhatsApp</button><button type="button" class="boton" id="wa-qr">Probar con un QR, sin Meta</button><button type="button" class="boton fantasma" id="wa-quitar" hidden>Desconectar</button><span class="estado" id="wa-aviso"></span></div>
      </div>
      <div class="meta" id="wa-meta" hidden>
        <b>Para que lleguen los mensajes</b>
        <ol>
          <li>En Apps Script: Implementar → Nueva implementación → Aplicación web, acceso «Cualquier usuario». Pega su dirección:
            <div class="fila-b"><input type="text" id="wa-dir" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec"><button type="button" class="boton" id="wa-dir-g">Comprobar</button></div>
            <span class="estado" id="wa-dir-aviso"></span></li>
          <li class="solo-meta">En Cloudflare, el puente (whatsapp-puente.js). Variable PANEL:<code id="wa-panel"></code></li>
          <li class="solo-meta">En Meta → WhatsApp → Configuración → Webhook: la dirección del puente y este token de verificación:<code id="wa-clave"></code></li>
          <li class="solo-meta">En «Campos del webhook», suscríbete a «messages» y publica la app de Meta: sin publicar no llega ningún mensaje de verdad.</li>
          <li class="solo-qr" hidden>En el ordenador, en la carpeta del agente (o pídeselo a Claude):<code id="wa-orden"></code>Escanea el QR con el WhatsApp de pruebas (Dispositivos vinculados) y deja la ventana abierta. Solo pasan los números que pongas detrás de --permitir.</li>
        </ol>
      </div>
    </div>
    <div class="pie-d"><button type="button" class="boton fantasma" id="d-cancelar">Cancelar</button><button type="submit" class="boton negro" id="d-guardar">Guardar</button></div>
  </form>
</div>
<script>
var $ = function(id){ return document.getElementById(id); };
var ICONOS = {
  resumen:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  correos:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  facturas:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  calendario:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  hoja:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  externo:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  enviar:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  atras:'<path d="m15 18-6-6 6-6"/>',
  flecha:'<path d="m9 18 6-6-6-6"/>',
  alerta:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  escudo:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4M12 16h.01"/>',
  reloj:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sobre:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  lapiz:'<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
  clip:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  persona:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
};
function ico(n){ var s = document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('class','i'); s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('aria-hidden','true'); s.innerHTML = ICONOS[n]; return s; }
function el(tag, attrs){
  var e = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(function(k){
    var v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) e.setAttribute(k, v);
  });
  for (var i = 2; i < arguments.length; i++){ var h = arguments[i]; if (h != null && h !== false) e.append(h); }
  return e;
}
function llamar(fn){
  var args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function(ok, mal){
    var r = google.script.run.withSuccessHandler(ok).withFailureHandler(mal);
    r[fn].apply(r, args);
  });
}

// ---- Formatos
function eur(n){
  if (n == null) return '—';
  var p = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '−' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1] + ' €';
}
function hora(iso){ return new Date(iso).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}); }
function cuando(iso){
  var d = new Date(iso), hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return hora(iso);
  return d.toLocaleDateString('es-ES',{day:'numeric',month:'short'}).replace('.', '');
}
function diaLargo(iso){ return new Date(iso).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}); }
function fechaDia(f){ var p = f.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]); }
function fechaLarga(f){ var t = fechaDia(f).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}); return t.charAt(0).toUpperCase() + t.slice(1); }
function esHoy(f){ return fechaDia(f).toDateString() === new Date().toDateString(); }
function nombreDe(de){ var s = String(de || '').trim(); var m = s.match(/^"?([^"<]+?)"?\s*</); return m ? m[1].trim() : s.replace(/[<>]/g, ''); }
var NO_CUENTAN = /^(s|l|sl|sa|slu|sll|scp|cb|sc|y|e|de|del|la|las|los|el|i|d)$/i;
function iniciales(n){
  var p = String(n || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  var q = p.filter(function(w){ return !NO_CUENTAN.test(w); });
  if (q.length) p = q;
  if (!p.length) return '·';
  return ((p[0][0] || '') + (p.length > 1 ? p[1][0] : (p[0][1] || ''))).toUpperCase();
}
function saludo(){ var h = new Date().getHours(); return h >= 6 && h < 14 ? 'Buenos días' : (h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches'); }

// ---- Estado
var vista = 'resumen', actual = null, original = '';
var convs = null, dias = {}, fechas = [], dia = null, hechos = {};
var verTodos = false, busqueda = '', filtroFact = 'todas', marca = { nombre:'', logo:'' }, hojaUrl = '';
var porId = {};
function porContestar(c){ return c.borrador || (!c.ultimoMio && !c.sospechoso); }
function pendientes(){ return (convs || []).filter(porContestar).length; }
function conv(hilo){ return porId[hilo] || null; }

// Si el agente aún no ha dejado ningún resumen, el panel se monta con las etiquetas de Gmail.
function diaDesdeEtiquetas(){
  var correos = (convs || []).map(function(c){
    return { id:c.id, hilo:c.id, de:c.nombre, cliente:'', asunto:c.asunto, tipo:c.tipo || 'Otros', resumen:c.extracto,
      estado: c.sospechoso ? 'sospechoso' : (c.revisar ? 'revisar' : (c.borrador ? 'listo' : 'sin borrador')), borrador:c.borrador, factura:null };
  });
  var fac = correos.filter(function(c){ return c.tipo === 'Factura'; }).length, bor = correos.filter(function(c){ return c.borrador; }).length;
  return { fecha:null, hora:'', negocio:'', provisional:true, correos:correos,
    totales:{ procesados:correos.length, facturas:fac, borradores:bor, minutos_ahorrados: fac*4 + bor*3 + Math.max(0, correos.length - fac - bor) } };
}
function diaActual(){ return dia && dias[dia] ? dias[dia] : (convs ? diaDesdeEtiquetas() : null); }
// El logo de la gestoría de ejemplo, para que la demo salga completa sin subir nada. Con tu negocio, el tuyo (o tus iniciales).
var LOGO_EJEMPLO = 'data:image/png;base64,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';
function logo(){ return marca.logo || (negocio() === 'Gestoría Arcos' ? LOGO_EJEMPLO : ''); }
function negocio(){ if (marca.nombre) return marca.nombre; for (var i = 0; i < fechas.length; i++) if (dias[fechas[i]].negocio) return dias[fechas[i]].negocio; return ''; }
function revisionDe(hilo){
  for (var i = 0; i < fechas.length; i++){
    var cs = dias[fechas[i]].correos;
    for (var j = 0; j < cs.length; j++) if (cs[j].hilo === hilo) return cs[j];
  }
  return null;
}
function contestado(c){ var v = conv(c.hilo); return !!(v && v.ultimoMio && !v.borrador); }
function estaHecho(c){ return !!hechos[c.id] || contestado(c); }

// ---- Navegación
function ir(v, hilo, guardar){
  if (v !== 'correos' || hilo !== actual) recordar();
  vista = v;
  if (v === 'correos') actual = hilo || (window.innerWidth > 900 ? actual : null);
  ['resumen','correos','facturas'].forEach(function(x){ $('v-' + x).hidden = x !== v; });
  if (guardar !== false) google.script.history.push({vista:v, hilo:actual}, v === 'correos' && actual ? {hilo:actual} : (v === 'resumen' ? {} : {vista:v}));
  pintarMarco();
  if (v === 'resumen') pintarResumen();
  if (v === 'facturas') pintarFacturas();
  if (v === 'correos'){ pintarLista(); if (actual) abrirHilo(actual); else pintarChatVacio(); }
  $('v-' + v).scrollTop = 0;
}
var NAV = [['resumen','Resumen'],['correos','Correos'],['facturas','Facturas']];
function pintarMarco(){
  var neg = negocio();
  var m = $('marca'); m.innerHTML = ''; m.classList.toggle('con-logo', !!logo());
  if (logo()) m.append(el('img',{class:'marca-img', src:logo(), alt:neg || 'Logo'}), el('div',{class:'txt'}, el('div',{class:'s'}, 'Correo con agente')));
  else m.append(el('div',{class:'logo'}, neg ? iniciales(neg) : ico('sobre')), el('div',{class:'txt'}, el('div',{class:'n'}, neg || 'Tu negocio'), el('div',{class:'s'}, 'Correo con agente')));
  document.title = neg ? 'Correo · ' + neg : 'Panel del correo';
  var n = pendientes(), d = diaActual(), nf = d ? d.correos.filter(function(c){ return c.tipo === 'Factura'; }).length : 0;
  var cuentas = { correos: convs ? n : null, facturas: nf || null };
  var nav = $('nav'); nav.innerHTML = '';
  var tabs = $('pestanas'); tabs.innerHTML = '';
  NAV.forEach(function(x){
    var c = cuentas[x[0]];
    nav.append(el('button',{'aria-current': vista === x[0] ? 'page' : null, title:x[1], onclick:function(){ ir(x[0]); }},
      ico(x[0]), el('span',{class:'t'}, x[1]), c != null ? el('span',{class:'c' + (x[0] === 'correos' && c ? ' on' : '')}, String(c)) : null));
    tabs.append(el('button',{'aria-current': vista === x[0] ? 'page' : null, onclick:function(){ ir(x[0]); }},
      ico(x[0]), x[1], x[0] === 'correos' && c ? el('span',{class:'c'}, String(c)) : null));
  });
  var pie = $('lado-pie'); pie.innerHTML = '';
  if (d && !d.provisional) pie.append(el('div',{class:'k'}, el('span',{class:'v'}), 'Agente activo'),
    el('p',{}, 'Última pasada: ' + (esHoy(fechas[0]) ? 'hoy' : fechaLarga(fechas[0]).toLowerCase()) + (dias[fechas[0]].hora ? ' a las ' + dias[fechas[0]].hora : '') + '. Nunca envía: envías tú.'));
  else pie.append(el('div',{class:'k'}, 'Envías tú'), el('p',{}, 'El agente deja los borradores; tú los revisas y los envías desde aquí.'));
  // Barra de arriba
  var top = $('top'); top.innerHTML = '';
  var titulo = {resumen:'Resumen', correos:'Correos', facturas:'Facturas'}[vista];
  top.append(el('button',{class:'mini', title:'Cambiar el nombre y el logo', onclick:abrirPersonalizar}, logo() ? el('img',{src:logo(), alt:neg || 'Logo'}) : el('span',{class:'logo'}, neg ? iniciales(neg) : ico('sobre'))));
  top.append(el('div',{class:'migas'}, el('span',{class:'ruta'}, neg || 'Correo'), el('span',{class:'sep ruta'}, '/'), el('b',{}, titulo)));
  if ((vista === 'resumen' || vista === 'facturas') && fechas.length) top.append(selectorDia());
  else if (vista === 'correos') top.append(el('span',{class:'gris', style:'font-size:13px'}, convs ? (n ? n + ' por contestar' : 'Todo contestado') : ''));
  var enChat = vista === 'correos' && actual && window.innerWidth <= 900;
  $('pestanas').classList.toggle('oculta', !!enChat);
  $('v-correos').classList.toggle('sin-pestanas', !!enChat);
  top.style.display = enChat ? 'none' : '';
}
function selectorDia(){
  var s = el('select',{'aria-label':'Día', onchange:function(e){ dia = e.target.value; filtroFact = 'todas'; pintarMarco(); vista === 'resumen' ? pintarResumen() : pintarFacturas(); }});
  var corto = window.innerWidth <= 760;
  fechas.forEach(function(f){
    var t = corto ? fechaDia(f).toLocaleDateString('es-ES',{day:'numeric',month:'short'}).replace('.', '') : fechaLarga(f);
    s.append(el('option',{value:f, selected: f === dia ? '' : null}, (esHoy(f) ? 'Hoy · ' : '') + t));
  });
  return el('label',{class:'selector'}, ico('calendario'), s);
}

// ---- Resumen
function metro(parte, total){
  var m = el('div',{class:'metro', 'aria-hidden':'true'}), on = total ? Math.round(18 * parte / total) : 0;
  for (var i = 0; i < 18; i++) m.append(el('span',{class: i < on ? 'on' : ''}));
  return m;
}
function gravedad(c){ if (c.estado === 'sospechoso') return 0; if (c.factura && c.factura.estado === 'error') return 1; return 2; }
function motivo(c){
  if (c.estado === 'sospechoso') return 'Sospechoso: intenta dar órdenes o pide datos. No se ha contestado.';
  var f = c.factura;
  if (f && (f.estado === 'error' || f.estado === 'revisar') && f.motivos && f.motivos[0]) return f.motivos[0];
  return c.resumen || 'Necesita que lo mire una persona.';
}
// Recién instalado: aún no hay ninguna pasada. Se dice qué hacer, en vez de enseñar todo a cero.
function pintarPrimeraVez(cuerpo){
  cuerpo.append(el('div',{class:'cabeza'}, el('div',{},
    el('div',{class:'hola'}, saludo()), el('h1',{}, 'Tu panel ya está listo'),
    el('div',{class:'sub'}, 'Falta la primera pasada del agente. Cuando la haga, aquí verás el resumen, las facturas y cada correo con su respuesta escrita.'))));
  cuerpo.append(el('div',{class:'tarjeta primera'},
    el('ol',{},
      el('li',{}, 'En la app de Claude, pestaña Code, abre la carpeta del agente.'),
      el('li',{}, 'Escribe ', el('b',{}, '«haz la pasada»'), '. Tarda unos minutos y no envía nada.'),
      el('li',{}, 'Cuando termine, vuelve aquí y pulsa «Ya está».')),
    el('div',{class:'fila-b'},
      el('button',{class:'boton negro', onclick:function(){ cargar(); }}, 'Ya está'),
      el('button',{class:'boton', onclick:abrirPersonalizar}, 'Poner mi logo'))));
}
function pintarResumen(){
  var caja = $('v-resumen'); caja.innerHTML = '';
  var d = diaActual();
  var cuerpo = el('div',{class:'cuerpo'});
  caja.append(cuerpo);
  if (!d){ cuerpo.append(el('div',{class:'vacio'}, 'Cargando…')); return; }
  if (!fechas.length && convs && !convs.length){ pintarPrimeraVez(cuerpo); return; }
  var correos = d.correos;
  var n = pendientes();
  var sub = d.provisional ? 'El agente aún no ha dejado su resumen: esto sale de las etiquetas de Gmail.'
    : fechaLarga(dia) + (d.hora ? ' · última pasada a las ' + d.hora : '');
  cuerpo.append(el('div',{class:'cabeza'},
    el('div',{}, el('div',{class:'hola'}, saludo()), el('h1',{}, esHoy(dia || '') || d.provisional ? 'Así está tu correo hoy' : 'Así quedó el correo'), el('div',{class:'sub'}, sub)),
    el('div',{class:'acciones-cab'}, el('button',{class:'boton negro', onclick:function(){ verTodos = false; ir('correos'); }}, ico('lapiz'), 'Contestar correos', n ? el('span',{class:'c'}, String(n)) : null))));

  var orden = el('div',{class:'resumen-orden'});
  cuerpo.append(orden);

  // Cifras
  var t = d.totales || {};
  var facturas = correos.filter(function(c){ return c.tipo === 'Factura'; });
  var correctas = facturas.filter(function(c){ return c.factura && c.factura.estado === 'correcta'; }).length;
  var conBorr = correos.filter(function(c){ return c.borrador; });
  var enviados = conBorr.filter(contestado).length;
  var kpis = el('div',{class:'kpis'});
  kpis.append(
    el('button',{class:'kpi', onclick:function(){ verTodos = true; ir('correos'); }},
      el('div',{class:'l'}, el('span',{}, 'Correos', el('span',{class:'larga'}, ' procesados')), el('span',{class:'ic'}, ico('sobre'))),
      el('div',{class:'v'}, String(t.procesados != null ? t.procesados : correos.length)),
      el('div',{class:'pie'}, el('span',{}, el('b',{}, String(conBorr.length)), ' con borrador'), metro(conBorr.length, correos.length))),
    el('button',{class:'kpi', onclick:function(){ filtroFact = 'todas'; ir('facturas'); }},
      el('div',{class:'l'}, el('span',{}, 'Facturas', el('span',{class:'larga'}, ' revisadas')), el('span',{class:'ic'}, ico('facturas'))),
      el('div',{class:'v'}, String(facturas.length)),
      el('div',{class:'pie'}, el('span',{}, el('b',{}, String(correctas)), ' correctas'), metro(correctas, facturas.length))),
    el('button',{class:'kpi', onclick:function(){ verTodos = false; ir('correos'); }},
      el('div',{class:'l'}, el('span',{}, 'Borradores', el('span',{class:'larga'}, ' listos')), el('span',{class:'ic'}, ico('lapiz'))),
      el('div',{class:'v'}, String(conBorr.length)),
      el('div',{class:'pie'}, el('span',{}, el('b',{}, String(enviados)), ' ya enviados'), metro(enviados, conBorr.length))));
  var mins = t.minutos_ahorrados || 0;
  var v = el('div',{class:'v'});
  if (mins >= 60) v.append(String(Math.floor(mins/60)), el('small',{},'h'), String(mins % 60).padStart(2,'0'), el('small',{},'min'));
  else v.append(String(mins), el('small',{},'min'));
  var tiempo = el('button',{class:'kpi', 'aria-expanded':'false'},
    el('div',{class:'l'}, 'Tiempo ahorrado', el('span',{class:'ic'}, ico('reloj'))), v,
    el('div',{class:'pie'}, el('span',{}, 'Estimación. ', el('b',{}, 'Ver cálculo'))),
    el('div',{class:'explica'}, 'Cuenta 4 minutos por factura revisada, 3 por borrador escrito y 1 por correo que solo se etiqueta.'));
  tiempo.addEventListener('click', function(e){ e.stopPropagation(); var a = tiempo.classList.toggle('abierta'); tiempo.setAttribute('aria-expanded', String(a)); });
  kpis.append(tiempo);
  orden.append(kpis);

  var rejilla = el('div',{class:'rejilla'});
  orden.append(rejilla);

  // Necesita a una persona
  var pers = correos.filter(function(c){ return c.estado === 'revisar' || c.estado === 'sospechoso'; })
    .sort(function(a, b){ return (estaHecho(a) - estaHecho(b)) || (gravedad(a) - gravedad(b)); });
  var quedan = pers.filter(function(c){ return !estaHecho(c); }).length;
  var tp = el('div',{class:'tarjeta persona'},
    el('div',{class:'t-cab'}, el('span',{class:'t-ic'}, ico('persona')),
      el('div',{}, el('h2',{}, 'Necesita a una persona'), el('div',{class:'sub'}, pers.length ? (quedan ? 'Lo demás ya tiene su respuesta escrita.' : 'Todo atendido.') : 'Nada urgente.')),
      pers.length ? el('span',{class:'cuenta der' + (quedan ? ' aten' : '')}, quedan ? String(quedan) : 'Hecho', quedan ? el('span',{class:'larga'}, ' pendientes') : null) : null));
  var lista = el('div',{class:'avisos'});
  if (!pers.length) lista.append(el('div',{class:'vacio'}, conBorr.length ? 'Lo demás tiene su borrador listo para revisar y enviar.' : 'No hay nada que mirar.'));
  pers.forEach(function(c){
    var g = gravedad(c), hecho = estaHecho(c), cls = g <= 1 ? 'err' : 'aten';
    var acc = el('div',{class:'acc'});
    if (contestado(c) && !hechos[c.id]) acc.append(el('span',{class:'hecho-txt'}, ico('check'), 'Contestado'));
    acc.append(el('button',{class:'boton', tabindex:'-1'}, 'Abrir'));
    if (!contestado(c)) acc.append(el('button',{class:'check', title: hecho ? 'Marcar como pendiente' : 'Marcar como hecho', 'aria-label':'Hecho', 'aria-pressed': String(!!hechos[c.id]), onclick:function(e){ e.stopPropagation(); alternarHecho(c.id); }}, ico('check')));
    lista.append(el('div',{class:'aviso' + (hecho ? ' listo' : ''), role:'link', tabindex:'0', title:'Abrir la conversación', onclick:function(){ ir('correos', c.hilo); }, onkeydown:function(e){ if (e.key === 'Enter') ir('correos', c.hilo); }},
      el('span',{class:'cuad ' + cls}, ico(c.estado === 'sospechoso' ? 'escudo' : (c.factura ? 'facturas' : 'alerta'))),
      el('div',{style:'min-width:0'}, el('div',{class:'quien'}, nombreDe(c.de), el('span',{}, c.asunto ? ' · ' + c.asunto : '')), el('div',{class:'por ' + cls}, motivo(c))),
      acc));
  });
  tp.append(lista);
  rejilla.append(tp);

  // Facturas por estado + últimos correos
  var der = el('div',{class:'columna der'});
  rejilla.append(der);
  var cuentaF = {correcta:0, revisar:0, error:0};
  facturas.forEach(function(c){ var e = (c.factura && c.factura.estado) || 'revisar'; cuentaF[e] = (cuentaF[e] || 0) + 1; });
  var tf = el('div',{class:'tarjeta'}, el('div',{class:'t-cab'}, el('span',{class:'t-ic'}, ico('facturas')),
    el('div',{}, el('h2',{}, 'Facturas'), el('div',{class:'sub'}, 'Las cuentas las hace un programa')),
    el('button',{class:'boton fantasma der', onclick:function(){ filtroFact = 'todas'; ir('facturas'); }}, 'Ver todas')));
  if (!facturas.length) tf.append(el('div',{class:'vacio'}, d.provisional ? 'Aparecen cuando el agente deja su resumen.' : 'Hoy no ha llegado ninguna factura.'));
  else tf.append(donut(cuentaF, facturas.length));
  der.append(tf);
  var tu = el('div',{class:'tarjeta'}, el('div',{class:'t-cab'}, el('span',{class:'t-ic'}, ico('sobre')),
    el('div',{}, el('h2',{}, 'Últimos correos')),
    el('button',{class:'boton fantasma der', onclick:function(){ verTodos = true; ir('correos'); }}, 'Ver todos')));
  var ul = el('div',{class:'ultimos'});
  var recientes = (convs || []).slice().sort(function(a, b){ return a.fecha < b.fecha ? 1 : -1; }).slice(0, 5);
  if (!convs) ul.append(el('div',{class:'vacio'}, 'Cargando…'));
  else if (!recientes.length) ul.append(el('div',{class:'vacio'}, 'Todavía no hay correos etiquetados por el agente.'));
  recientes.forEach(function(c){
    ul.append(el('button',{class:'fila-c', onclick:function(){ ir('correos', c.id); }},
      avatar(c.nombre, c), el('div',{style:'min-width:0'}, el('div',{class:'q'}, c.nombre), el('div',{class:'a'}, c.asunto)),
      el('span',{class:'h'}, c.fecha ? cuando(c.fecha) : '')));
  });
  tu.append(ul);
  der.append(tu);
}
var COLOR = {correcta:'var(--ok-p)', revisar:'var(--aten-p)', error:'var(--err)'};
var NOMBRE_F = {correcta:'Correctas', revisar:'Por revisar', error:'Con error'};
var ESTADO_F = {correcta:'Correcta', revisar:'Revisar', error:'Error'};
function donut(cuenta, total){
  var r = 52, cir = 2 * Math.PI * r, ini = 0, hueco = total > 1 ? 3 : 0;
  var svg = '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="#f0f0ee" stroke-width="14"/>';
  ['error','revisar','correcta'].forEach(function(k){
    var n = cuenta[k] || 0; if (!n) return;
    var largo = cir * n / total;
    svg += '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="' + COLOR[k] + '" stroke-width="14" stroke-dasharray="' + Math.max(largo - hueco, 1) + ' ' + cir + '" stroke-dashoffset="' + (-ini) + '"/>';
    ini += largo;
  });
  var d = el('div',{class:'donut'}); d.innerHTML = '<svg viewBox="0 0 132 132" aria-hidden="true">' + svg + '</svg>';
  d.append(el('div',{class:'centro'}, el('b',{}, String(total)), el('span',{}, total === 1 ? 'factura' : 'facturas')));
  var ley = el('div',{class:'leyenda'});
  ['error','revisar','correcta'].forEach(function(k){
    var n = cuenta[k] || 0;
    ley.append(el('button',{onclick:function(){ filtroFact = k; ir('facturas'); }},
      el('span',{class:'p', style:'background:' + COLOR[k]}), NOMBRE_F[k], el('span',{class:'n'}, String(n)), el('span',{class:'pc'}, Math.round(100 * n / total) + '%')));
  });
  return el('div',{class:'estados'}, d, ley);
}
function avatar(nombre, c){
  var a = el('span',{class:'av'}, iniciales(nombre));
  if (c && c.sospechoso) a.append(el('span',{class:'est err'}));
  else if (c && c.revisar) a.append(el('span',{class:'est aten'}));
  return a;
}
function alternarHecho(id){
  var si = !hechos[id];
  if (si) hechos[id] = true; else delete hechos[id];
  pintarResumen();
  llamar('marcarHecho', id, si).catch(function(){ if (si) delete hechos[id]; else hechos[id] = true; pintarResumen(); });
}

// ---- Facturas
function pintarFacturas(){
  var caja = $('v-facturas'); caja.innerHTML = '';
  var cuerpo = el('div',{class:'cuerpo'}); caja.append(cuerpo);
  var d = diaActual();
  var todas = d ? d.correos.filter(function(c){ return c.tipo === 'Factura'; }) : [];
  cuerpo.append(el('div',{class:'cabeza'}, el('div',{},
    el('h1',{}, 'Facturas'),
    el('div',{class:'sub'}, d && !d.provisional ? fechaLarga(dia) + ' · revisadas con un programa que hace las cuentas' : 'Aparecen cuando el agente deja el resumen de su pasada.')),
    hojaUrl ? el('div',{class:'acciones-cab'}, el('a',{class:'boton', href:hojaUrl, target:'_blank', rel:'noopener', title:'Todas las facturas en una hoja de Google, lista para contabilidad'}, ico('hoja'), 'Abrir hoja de facturas')) : null));
  var est = function(c){ return (c.factura && c.factura.estado) || 'revisar'; };
  var segm = el('div',{class:'segm'});
  [['todas','Todas'],['error','Error','Con '],['revisar','Revisar','Por '],['correcta','Correctas']].forEach(function(x){
    var n = x[0] === 'todas' ? todas.length : todas.filter(function(c){ return est(c) === x[0]; }).length;
    var pc = {error:'err', revisar:'aten', correcta:'ok'}[x[0]];
    segm.append(el('button',{'aria-pressed': String(filtroFact === x[0]), onclick:function(){ filtroFact = x[0]; google.script.history.push({vista:'facturas'}, {vista:'facturas'}); pintarFacturas(); }}, pc ? el('span',{class:'punto ' + pc}) : null, x[2] ? el('span',{class:'corta-no'}, x[2]) : null, x[2] ? x[1].toLowerCase() : x[1], el('span',{class:'c'}, String(n))));
  });
  cuerpo.append(el('div',{class:'barra-f'}, segm));
  var orden = {error:0, revisar:1, correcta:2};
  var lista = todas.filter(function(c){ return filtroFact === 'todas' || est(c) === filtroFact; })
    .sort(function(a, b){ return orden[est(a)] - orden[est(b)]; });
  var tb = el('tbody');
  var tabla = el('div',{class:'tarjeta'}, el('table',{class:'facturas-tabla'},
    el('thead',{}, el('tr',{}, el('th',{}, 'Proveedor'), el('th',{class:'col-cliente'}, 'Cliente'), el('th',{style:'text-align:right'}, 'Total'), el('th',{class:'col-estado', style:'width:72px;text-align:center'}, 'Estado'), el('th',{style:'text-align:right'}, 'Diferencia'), el('th',{class:'col-flecha'}))),
    tb));
  if (!lista.length) tb.append(el('tr',{}, el('td',{colspan:'6', class:'gris', style:'padding:22px 16px'}, todas.length ? 'Ninguna en este grupo.' : 'No hay facturas este día.')));
  lista.forEach(function(c){
    var f = c.factura || {}, e = est(c);
    var cls = e === 'correcta' ? 'ok' : (e === 'error' ? 'err' : 'aten');
    var dif = f.diferencia ? (f.diferencia > 0 ? '+' : '') + eur(f.diferencia) : '';
    tb.append(el('tr',{class:'fila', tabindex:'0', title:'Abrir el correo', onclick:function(){ ir('correos', c.hilo); }, onkeydown:function(ev){ if (ev.key === 'Enter') ir('correos', c.hilo); }},
      el('td',{}, el('div',{class:'prov'}, el('span',{class:'ini'}, iniciales(f.emisor || nombreDe(c.de))),
        el('div',{style:'min-width:0'}, el('div',{class:'nm'}, f.emisor || nombreDe(c.de)), el('div',{class:'nr'}, f.numero ? 'N.º ' + f.numero : (f.emisor ? 'Sin número' : 'No se lee'))))),
      el('td',{class:'col-cliente gris'}, c.cliente || nombreDe(c.de)),
      el('td',{class:'num col-total'}, eur(f.total_factura)),
      el('td',{class:'col-estado', title: ESTADO_F[e] || 'Revisar'}, el('span',{class:'punto ' + cls}), el('span',{class:'solo-lector'}, ESTADO_F[e] || 'Revisar')),
      el('td',{class:'num dif col-dif' + (dif ? ' err' : '')}, dif || el('span',{class:'gris'}, '—')),
      el('td',{class:'col-flecha'}, ico('flecha'))));
  });
  cuerpo.append(tabla);
}

// ---- Lista de correos
function pintarLista(){
  var caja = $('convs'); caja.innerHTML = '';
  if (!convs){ caja.append(el('div',{class:'nota-lista'}, 'Cargando…')); return; }
  var pend = convs.filter(porContestar);
  var fl = $('filtros'); fl.innerHTML = '';
  [[false, 'Por contestar', pend.length], [true, 'Todos', convs.length]].forEach(function(f){
    fl.append(el('button',{'aria-pressed': String(verTodos === f[0]), onclick:function(){ verTodos = f[0]; pintarLista(); }}, f[1], el('span',{class:'c'}, String(f[2]))));
  });
  var peso = function(c){ return c.sospechoso ? 0 : (c.revisar ? 1 : 2); };
  var q = busqueda.trim().toLowerCase();
  var lista = (verTodos ? convs.slice() : convs.filter(function(c){ return porContestar(c) || c.id === actual; })
    .sort(function(x, y){ return (peso(x) - peso(y)) || (x.fecha < y.fecha ? 1 : -1); }))
    .filter(function(c){ return !q || [c.nombre, c.asunto, c.extracto, c.tipo].join(' ').toLowerCase().indexOf(q) !== -1; });
  if (!convs.length) caja.append(el('div',{class:'nota-lista'}, 'Todavía no hay correos etiquetados por el agente.'));
  else if (!lista.length) caja.append(el('div',{class:'nota-lista'}, q ? 'Nada coincide con «' + busqueda.trim() + '».' : 'No queda nada por contestar. Los demás están en «Todos».'));
  lista.forEach(function(c){
    var mm = el('div',{class:'mm'}, el('span',{class:'chip'}, c.tipo || 'Correo'));
    if (c.whatsapp) mm.prepend(el('span',{class:'chip'}, 'WhatsApp'));
    if (c.sospechoso) mm.append(el('span',{class:'chip err'}, 'Sospechoso'));
    else if (c.revisar) mm.append(el('span',{class:'chip aten'}, 'Revisar'));
    if (c.noEntregado) mm.append(el('span',{class:'chip err'}, 'No entregado'));
    else if (c.borrador) mm.append(el('span',{class:'chip ok'}, 'Borrador listo'));
    else if (c.ultimoMio) mm.append(el('span',{class:'chip'}, 'Contestado'));
    caja.append(el('button',{class:'conv', 'data-id': c.id, 'aria-current': String(actual === c.id), onclick:function(){ ir('correos', c.id); }},
      avatar(c.nombre, c),
      el('div',{style:'min-width:0'},
        el('div',{class:'f1'}, el('span',{class:'q'}, c.nombre), el('span',{class:'h'}, c.fecha ? cuando(c.fecha) : '')),
        el('div',{class:'as'}, c.asunto), el('div',{class:'ex'}, c.extracto), mm)));
  });
}
function pintarChatVacio(){
  $('correos').classList.remove('con-hilo');
  var chat = $('chat'); chat.innerHTML = '';
  chat.append(el('div',{class:'vacio grande', style:'background:var(--app)'}, el('span',{class:'t-ic'}, ico('correos')),
    el('div',{style:'font-weight:500;color:var(--tinta)'}, 'Elige un correo'), el('div',{}, 'Los que tienen borrador listo solo hay que revisarlos y enviarlos.')));
}

// ---- Conversación
var pedido = 0;
function abrirHilo(id){
  actual = id;
  $('correos').classList.add('con-hilo');
  pintarLista(); pintarMarco();
  var chat = $('chat'); chat.innerHTML = '';
  chat.append(el('div',{class:'vacio grande', style:'background:var(--app)'}, 'Abriendo la conversación…'));
  var yo = ++pedido;
  llamar('datosHilo', id).then(function(h){ if (yo === pedido) pintarHilo(h); }).catch(function(e){
    if (yo !== pedido) return;
    chat.innerHTML = ''; chat.append(el('div',{class:'vacio grande error'}, e.message));
  });
}
function cerrarHilo(){ recordar(); actual = null; ir('correos'); }
function cambiado(){ var t = $('texto'); return !!(t && t.value.trim() !== original.trim()); }
// Lo que has escrito y no has guardado se queda aquí si cambias de conversación, y vuelve al regresar.
var sinGuardar = {};
function recordar(){ var t = $('texto'); if (actual && t && !t.disabled){ if (cambiado()) sinGuardar[actual] = t.value; else delete sinGuardar[actual]; } }

function pintarHilo(h){
  if (h.id !== actual) return;
  var chat = $('chat'); chat.innerHTML = '';
  var c = conv(h.id);
  chat.append(el('div',{class:'chat-cab'},
    el('button',{class:'volver', 'aria-label':'Volver a la lista', onclick: cerrarHilo}, ico('atras')),
    avatar(h.nombre, null),
    el('div',{class:'tit'},
      el('div',{class:'nombre'}, h.nombre || 'Sin remitente',
        h.whatsapp ? el('span',{class:'chip'}, 'WhatsApp') : null,
        h.tipo ? el('span',{class:'chip'}, h.tipo) : null,
        h.sospechoso ? el('span',{class:'chip err'}, 'Sospechoso') : (h.revisar ? el('span',{class:'chip aten'}, 'Revisar') : null)),
      el('div',{class:'detalle'}, h.asunto)),
    el('a',{class:'boton', href:h.gmail, target:'_blank', rel:'noopener', title:'Abrir en Gmail'}, ico('externo'), el('span',{class:'t'}, 'Abrir en Gmail'))));
  var lista = el('div',{class:'mensajes'});
  if (h.sospechoso) lista.append(el('div',{class:'alerta'}, ico('escudo'), el('span',{}, 'El agente lo ha marcado como sospechoso y no lo ha contestado. Antes de responder, asegúrate de quién es.')));
  var r = revisionDe(h.id);
  if (r && r.factura) lista.append(revision(r));
  var ultimoDia = '';
  h.mensajes.forEach(function(m){
    if (m.aviso){ lista.append(el('div',{class:'dia aviso'}, el('span',{}, m.texto + ' · ' + hora(m.fecha)))); return; }
    var d = new Date(m.fecha).toDateString();
    if (d !== ultimoDia){ lista.append(el('div',{class:'dia'}, el('span',{}, diaLargo(m.fecha)))); ultimoDia = d; }
    var b = el('div',{class:'burbuja'}, m.texto || '(sin texto)');
    if (m.adjuntos.length){
      var a = el('div',{class:'adjuntos'});
      m.adjuntos.forEach(function(n){ a.append(el('a',{class:'adjunto', href:h.gmail, target:'_blank', rel:'noopener', title:'Ver el adjunto en Gmail'}, ico('clip'), n)); });
      b.append(a);
    }
    b.append(el('span',{class:'hora'}, hora(m.fecha)));
    lista.append(el('div',{class:'msg' + (m.mio ? ' mio' : '')}, el('div',{class:'quien'}, m.mio ? 'Tú' : m.nombre), b));
  });
  chat.append(lista);

  original = h.borrador ? h.borrador.texto : '';
  var texto = el('textarea',{id:'texto', placeholder:'Escribe a ' + (h.nombre || 'el cliente') + '…', 'aria-label':'Mensaje'});
  texto.value = sinGuardar[h.id] != null ? sinGuardar[h.id] : original;
  var estado = el('span',{class:'estado', id:'estado'});
  var guardar = el('button',{class:'boton fantasma', id:'guardar', disabled:true, onclick:function(){ guardarTexto(h); }}, 'Guardar borrador');
  var enviarB = el('button',{class:'boton negro', id:'enviar', onclick:function(){ pedirConfirmacion(h); }}, ico('enviar'), h.whatsapp ? 'Enviar por WhatsApp' : 'Enviar');
  var nota = null;
  if (h.whatsapp){
    var cerrada = !h.whatsapp.qr && (!h.whatsapp.hasta || new Date(h.whatsapp.hasta) <= new Date());
    nota = el('span',{class:'ventana' + (cerrada || !h.whatsapp.conectado ? ' cerrada' : '')},
      !h.whatsapp.conectado ? 'WhatsApp no está conectado: pulsa el nombre del negocio, arriba.' :
      h.whatsapp.qr ? 'Modo prueba por QR: sale desde el WhatsApp vinculado en el ordenador.' :
      cerrada ? 'Han pasado 24 h desde su último mensaje: WhatsApp no deja contestarle sin un mensaje aprobado.' :
      'Puedes contestar hasta el ' + diaLargo(h.whatsapp.hasta) + ' a las ' + hora(h.whatsapp.hasta) + '.');
    if (cerrada || !h.whatsapp.conectado){ enviarB.disabled = true; enviarB.dataset.bloqueado = '1'; }
  }
  var etiq = el('div',{class:'etiq'},
    h.borrador ? el('span',{}, el('span',{class:'chip ok'}, 'Borrador del agente'), el('span',{class:'pista'}, ' revísalo, cámbialo si quieres y envíalo')) : el('span',{}, el('span',{class:'chip'}, 'Tu respuesta')),
    el('span',{class:'para'}, h.para ? 'Para ' + h.para : ''), nota);
  chat.append(el('div',{class:'escribir'}, el('div',{class:'caja'}, etiq, texto, el('div',{class:'botones', id:'botones'}, estado, guardar, enviarB))));

  function ajustar(){ texto.style.height = 'auto'; texto.style.height = Math.min(texto.scrollHeight + 2, window.innerHeight * .4) + 'px'; }
  texto.addEventListener('input', function(){ ajustar(); guardar.disabled = !cambiado(); estado.textContent = cambiado() ? 'Cambios sin guardar' : ''; estado.className = 'estado'; });
  ajustar();
  if (cambiado()){ guardar.disabled = false; estado.textContent = 'Cambios sin guardar'; }
  lista.scrollTop = lista.scrollHeight;
  if (c && c.borrador !== !!h.borrador){ c.borrador = !!h.borrador; pintarLista(); }
}
function revision(r){
  var f = r.factura, e = f.estado || 'revisar', cls = e === 'correcta' ? 'ok' : (e === 'error' ? 'err' : 'aten');
  var caja = el('dl',{class:'revision'},
    el('div',{class:'cab'}, ico('facturas'), 'Revisión del agente', el('span',{class:'pild ' + cls}, ESTADO_F[e] || 'Revisar')),
    (f.emisor || f.total_factura != null) ? el('dt',{}, (f.emisor || 'Proveedor') + (f.numero ? ' · N.º ' + f.numero : '')) : null,
    (f.emisor || f.total_factura != null) ? el('dd',{}, eur(f.total_factura)) : null);
  if (f.diferencia){ caja.append(el('dt',{}, 'Total correcto'), el('dd',{}, eur(f.total_correcto)), el('dt',{}, 'Diferencia'), el('dd',{class:'dif err'}, (f.diferencia > 0 ? '+' : '') + eur(f.diferencia))); }
  if (e !== 'correcta' && f.motivos && f.motivos.length) caja.append(el('div',{class:'mot ' + cls}, f.motivos.join(' ')));
  return caja;
}

function ocupado(si){ ['guardar','enviar','texto'].forEach(function(id){ var e = $(id); if (e && !(e.dataset && e.dataset.bloqueado)) e.disabled = si; }); }
function avisar(t, error){ var e = $('estado'); if (e){ e.textContent = t; e.className = 'estado' + (error ? ' error' : ''); } }
function guardarTexto(h){
  var t = $('texto').value;
  if (!t.trim()){ avisar('Escribe algo antes de guardar.', true); return; }
  ocupado(true); avisar('Guardando…');
  llamar('guardarBorrador', h.id, t).then(function(){
    original = t; delete sinGuardar[h.id]; ocupado(false); $('guardar').disabled = true; avisar('Guardado en Gmail como borrador');
    marcarBorrador(h.id, true);
  }).catch(function(e){ ocupado(false); avisar(e.message, true); });
}
function pedirConfirmacion(h){
  var t = $('texto').value;
  if (!t.trim()){ avisar('Escribe algo antes de enviar.', true); return; }
  var caja = $('botones'); var antes = Array.prototype.slice.call(caja.childNodes);
  caja.innerHTML = '';
  caja.append(el('span',{class:'estado confirmar'}, '¿Enviar ' + (h.whatsapp ? 'por WhatsApp ' : '') + 'a ' + (h.nombre || h.para) + '?'),
    el('button',{class:'boton fantasma', onclick:function(){ caja.innerHTML = ''; antes.forEach(function(n){ caja.append(n); }); }}, 'Cancelar'),
    el('button',{class:'boton negro', id:'si', onclick:function(){ enviarTexto(h, t, caja); }}, ico('enviar'), 'Sí, enviar'));
  $('si').focus();
}
function enviarTexto(h, t, caja){
  caja.innerHTML = ''; caja.append(el('span',{class:'estado'}, 'Enviando…'));
  $('texto').disabled = true;
  llamar('enviar', h.id, t).then(function(){
    original = ''; delete sinGuardar[h.id];
    marcarBorrador(h.id, false, true);
    return llamar('datosHilo', h.id).then(function(n){ pintarHilo(n); avisar('Enviado a ' + (h.nombre || h.para) + '.'); });
  }).catch(function(e){
    caja.innerHTML = ''; caja.append(el('span',{class:'estado error'}, 'No se ha enviado: ' + e.message),
      el('button',{class:'boton', onclick:function(){ abrirHilo(h.id); }}, 'Volver a intentarlo'));
    $('texto').disabled = false;
  });
}
function marcarBorrador(id, si, enviado){
  var c = conv(id);
  if (c){ c.borrador = si; if (enviado){ c.ultimoMio = true; c.fecha = new Date().toISOString(); } }
  pintarLista(); pintarMarco();
}

// ---- Arranque
function cargar(){
  llamar('datosBandeja').then(function(r){
    convs = r.conversaciones; porId = {}; convs.forEach(function(c){ porId[c.id] = c; });
    pintarMarco();
    if (vista === 'correos') pintarLista(); else if (vista === 'resumen') pintarResumen(); else pintarFacturas();
  }).catch(function(e){ convs = []; $('convs').innerHTML = ''; $('convs').append(el('div',{class:'nota-lista error'}, 'No he podido cargar los correos: ' + e.message)); pintarMarco(); });
  llamar('datosResumenes').then(function(r){
    dias = r.dias || {}; fechas = Object.keys(dias).sort().reverse(); dia = fechas[0] || null;
    hechos = {}; (r.hechos || []).forEach(function(id){ hechos[id] = true; });
    if (r.marca) marca = r.marca;
    hojaUrl = r.hoja || '';
    pintarMarco();
    if (vista === 'resumen') pintarResumen(); else if (vista === 'facturas') pintarFacturas(); else if (actual && $('texto') == null) abrirHilo(actual);
    else if (actual && revisionDe(actual) && !document.querySelector('.revision')) abrirHilo(actual);
    pasarAHoja();
  }).catch(function(){ dias = {}; fechas = []; pintarMarco(); if (vista === 'resumen') pintarResumen(); });
}
// Las facturas de los resúmenes van también a la hoja de Google (solo las nuevas o las que han cambiado).
function pasarAHoja(){
  var lista = [];
  Object.keys(dias).forEach(function(k){ (dias[k].provisional ? [] : dias[k].correos).forEach(function(c){
    if (c.factura) lista.push({ id:c.id, hilo:c.hilo, dia:k, cliente:c.cliente, factura:c.factura });
  }); });
  if (!lista.length) return;
  llamar('sincronizarHoja', lista).then(function(r){
    var antes = hojaUrl; hojaUrl = r.url || hojaUrl;
    if (!antes && hojaUrl && vista === 'facturas') pintarFacturas();
  }).catch(function(){ /* sin permiso para hojas todavía: el panel sigue igual */ });
}
// Si el repositorio tiene un panel más nuevo, se dice arriba y cómo ponerlo.
function mirarVersion(){
  llamar('versionPanel').then(function(v){
    var caja = $('actualizar'); if (!v.nueva) return;
    caja.textContent = '';
    caja.append('Hay una versión nueva del panel. En la app de Claude, en la carpeta del agente, escribe ', el('b',{}, '«actualiza el panel»'), ' y te dice cómo ponerla (3 clics).');
    caja.hidden = false;
  }).catch(function(){});
}
$('buscar').addEventListener('input', function(e){ busqueda = e.target.value; pintarLista(); });

// ---- Personalizar: nombre y logo del negocio
var logoNuevo = '';
function abrirPersonalizar(){
  logoNuevo = marca.logo;
  $('d-nombre').value = negocio();
  $('d-estado').textContent = 'PNG o JPG. El blanco de los bordes se recorta solo.'; $('d-estado').className = 'estado';
  vistaLogo(); $('capa').hidden = false; $('d-nombre').focus();
  $('wa-campos').hidden = true; $('wa-aviso').textContent = ''; $('wa-token').value = '';
  llamar('datosWhatsApp').then(pintarWhatsApp).catch(function(){ $('wa').hidden = true; });
}
var whatsapp = null;
function pintarWhatsApp(w){
  whatsapp = w; $('wa').hidden = false;
  $('wa-estado').textContent = w.conectado ? '· ' + (w.numero || 'Conectado') : 'No conectado';
  $('wa-abrir').textContent = w.conectado ? 'Cambiar' : 'Conectar';
  $('wa-quitar').hidden = !w.conectado;
  $('wa-acuse').value = w.acuse || ''; $('wa-numero').value = w.id || '';
  $('wa-token').placeholder = w.conectado ? 'Guardado. Pega otro solo para cambiarlo' : 'EAAG…';
  $('wa-meta').hidden = !w.clave;
  $('wa-dir').value = w.dir || w.sugerida || ''; $('wa-dir-aviso').textContent = w.dir ? 'Comprobada.' : (w.sugerida ? 'Ya está puesta: pulsa «Comprobar».' : ''); $('wa-dir-aviso').className = 'estado';
  $('wa-panel').textContent = w.panel || 'Aparece cuando guardes la dirección del paso 1.';
  $('wa-clave').textContent = w.clave || '';
  $('wa-orden').textContent = w.panel ? 'node herramientas/whatsapp-qr.mjs --panel "' + w.panel + '" --permitir 34600000000' : 'Aparece cuando guardes la dirección del paso 1.';
  document.querySelectorAll('#wa-meta .solo-meta').forEach(function(li){ li.hidden = !!w.qr; });
  document.querySelectorAll('#wa-meta .solo-qr').forEach(function(li){ li.hidden = !w.qr; });
}
$('wa-dir-g').addEventListener('click', function(){
  var b = $('wa-dir-g'); b.disabled = true; $('wa-dir-aviso').textContent = 'Comprobando…'; $('wa-dir-aviso').className = 'estado';
  llamar('guardarPuente', $('wa-dir').value).then(function(w){ b.disabled = false; pintarWhatsApp(w); })
    .catch(function(e){ b.disabled = false; $('wa-dir-aviso').textContent = e.message; $('wa-dir-aviso').className = 'estado error'; });
});
$('wa-abrir').addEventListener('click', function(){ $('wa-campos').hidden = !$('wa-campos').hidden; if (!$('wa-campos').hidden) $('wa-token').focus(); });
$('wa-guardar').addEventListener('click', function(){
  var b = $('wa-guardar'); b.disabled = true; $('wa-aviso').textContent = 'Comprobando con Meta…'; $('wa-aviso').className = 'estado';
  llamar('guardarWhatsApp', $('wa-token').value, $('wa-numero').value, $('wa-acuse').value).then(function(w){
    b.disabled = false; $('wa-token').value = ''; pintarWhatsApp(w); $('wa-campos').hidden = true;
  }).catch(function(e){ b.disabled = false; $('wa-aviso').textContent = e.message; $('wa-aviso').className = 'estado error'; });
});
$('wa-qr').addEventListener('click', function(){
  var b = $('wa-qr'); b.disabled = true;
  llamar('activarQR', $('wa-acuse').value).then(function(w){ b.disabled = false; pintarWhatsApp(w); $('wa-campos').hidden = true; })
    .catch(function(e){ b.disabled = false; $('wa-aviso').textContent = e.message; $('wa-aviso').className = 'estado error'; });
});
$('wa-quitar').addEventListener('click', function(){
  llamar('quitarWhatsApp').then(function(w){ pintarWhatsApp(w); $('wa-campos').hidden = true; });
});
function cerrarPersonalizar(){ $('capa').hidden = true; $('d-archivo').value = ''; }
function vistaLogo(){ var v = $('d-vista'); v.innerHTML = ''; v.append(logoNuevo ? el('img',{src:logoNuevo, alt:'Logo'}) : 'Sin logo'); $('d-quitar').hidden = !logoNuevo; }
// Recorta el fondo blanco o transparente de los bordes y lo deja a un tamaño de logo.
function prepararLogo(img){
  var c = document.createElement('canvas'), w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1200 / Math.max(w, h));
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  var x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  var d = x.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (var y = 0; y < c.height; y++) for (var i = 0; i < c.width; i++){
    var o = (y * c.width + i) * 4;
    if (d[o+3] > 20 && Math.min(d[o], d[o+1], d[o+2]) < 225){ if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0){ x0 = 0; y0 = 0; x1 = c.width - 1; y1 = c.height - 1; }
  var cw = x1 - x0 + 1, ch = y1 - y0 + 1, f = Math.min(1, 360 / cw, 140 / ch);
  var s = document.createElement('canvas'); s.width = Math.max(1, Math.round(cw * f)); s.height = Math.max(1, Math.round(ch * f));
  var sx = s.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.drawImage(c, x0, y0, cw, ch, 0, 0, s.width, s.height);
  // Lo casi blanco pasa a transparente, para que el logo quede bien sobre cualquier fondo.
  var p = sx.getImageData(0, 0, s.width, s.height);
  for (var j = 0; j < p.data.length; j += 4){ var m = Math.min(p.data[j], p.data[j+1], p.data[j+2]); if (m > 240) p.data[j+3] = 0; else if (m > 215) p.data[j+3] = Math.round(p.data[j+3] * (240 - m) / 25); }
  sx.putImageData(p, 0, 0);
  var url = s.toDataURL('image/png');
  if (url.length > 110000){ var w2 = s.toDataURL('image/webp', .9); if (w2.indexOf('data:image/webp') === 0 && w2.length < url.length) url = w2; }
  return url;
}
$('d-archivo').addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0]; if (!f) return;
  if (!/^image\/(png|jpeg|webp)$/.test(f.type)){ $('d-estado').textContent = 'Tiene que ser una imagen PNG, JPG o WebP.'; $('d-estado').className = 'estado error'; return; }
  var lector = new FileReader();
  lector.onload = function(){
    var img = new Image();
    img.onload = function(){
      try { logoNuevo = prepararLogo(img); vistaLogo(); $('d-estado').textContent = logoNuevo.length > 110000 ? 'Es muy grande: prueba con una imagen más sencilla.' : 'Listo. Pulsa «Guardar».'; $('d-estado').className = 'estado' + (logoNuevo.length > 110000 ? ' error' : ''); }
      catch (err) { $('d-estado').textContent = 'No he podido leer esa imagen.'; $('d-estado').className = 'estado error'; }
    };
    img.onerror = function(){ $('d-estado').textContent = 'No he podido leer esa imagen.'; $('d-estado').className = 'estado error'; };
    img.src = lector.result;
  };
  lector.readAsDataURL(f);
});
$('d-quitar').addEventListener('click', function(){ logoNuevo = ''; vistaLogo(); });
$('d-cancelar').addEventListener('click', cerrarPersonalizar);
$('capa').addEventListener('click', function(e){ if (e.target === $('capa')) cerrarPersonalizar(); });
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !$('capa').hidden) cerrarPersonalizar(); });
$('dialogo').addEventListener('submit', function(e){
  e.preventDefault();
  var b = $('d-guardar'); b.disabled = true; $('d-estado').textContent = 'Guardando…'; $('d-estado').className = 'estado';
  llamar('guardarMarca', $('d-nombre').value, logoNuevo).then(function(m){ marca = m; b.disabled = false; cerrarPersonalizar(); pintarMarco(); if (vista === 'resumen') pintarResumen(); })
    .catch(function(err){ b.disabled = false; $('d-estado').textContent = err.message; $('d-estado').className = 'estado error'; });
});
$('marca').addEventListener('click', abrirPersonalizar);
document.addEventListener('click', function(){ document.querySelectorAll('.kpi.abierta').forEach(function(k){ k.classList.remove('abierta'); k.setAttribute('aria-expanded','false'); }); });
window.addEventListener('beforeunload', function(e){ if (cambiado()){ e.preventDefault(); e.returnValue = ''; } });
var ancho = window.innerWidth;
window.addEventListener('resize', function(){ var a = window.innerWidth; if ((a <= 900) !== (ancho <= 900) || (a <= 760) !== (ancho <= 760)){ ancho = a; pintarMarco(); } });
google.script.history.setChangeHandler(function(e){
  var p = e.location.parameter || {};
  if (p.hilo) ir('correos', p.hilo, false); else ir(p.vista || 'resumen', null, false);
});
google.script.url.getLocation(function(loc){
  var p = loc.parameter || {};
  if (p.hilo) ir('correos', p.hilo, false); else ir(p.vista === 'facturas' || p.vista === 'correos' ? p.vista : 'resumen', null, false);
  cargar();
  mirarVersion();
});
</script>
</body>
</html>`;
