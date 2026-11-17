/**
 * Chat del correo: lee cada conversación como un chat, cambia el borrador que dejó el agente
 * (o escribe tú) y envíalo. Envía siempre una persona, con dos clics; el agente nunca envía.
 *
 * Es una página privada de Google Apps Script: solo la abre la cuenta de Gmail del negocio.
 * No hace falta Google Cloud, ni servidor, ni permisos que caduquen.
 *
 * Cómo instalarlo (una vez, unos 3 minutos), con la cuenta de Gmail del negocio:
 * 1. Abre script.google.com → «Nuevo proyecto». Ponle de nombre «Chat del correo».
 *    Borra lo que haya y pega este archivo entero.
 * 2. A la izquierda, «Servicios» (+) → «Gmail API» → Añadir.
 * 3. Arriba a la derecha, «Implementar» → «Nueva implementación» → tipo «Aplicación web».
 *    - Ejecutar como: «Yo».
 *    - Quién tiene acceso: «Solo yo».
 *    Pulsa «Implementar» y acepta los permisos (es tu propio script).
 * 4. Copia la URL que termina en /exec y dásela al panel:
 *      python3 herramientas/panel.py --chat https://script.google.com/macros/s/…/exec
 *    Desde entonces, cada correo del panel tiene «Abrir chat».
 *
 * Si tienes varias cuentas de Google abiertas en el navegador, hazlo todo (y abre el chat) en una ventana
 * privada o un perfil con solo la cuenta del negocio: con varias cuentas, Google se lía con los permisos.
 * Truco: antes de implementar, elige la función «datosBandeja» y pulsa «Ejecutar» para aceptar los permisos.
 *
 * Si cambias este archivo, «Implementar» → «Gestionar implementaciones» → editar → «Nueva versión».
 */

const MAX_CONVERSACIONES = 80;

function doGet() {
  return HtmlService.createHtmlOutput(PAGINA)
    .setTitle('Chat del correo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------- lo que pide la página

/** Las conversaciones de la bandeja que ya tienen una etiqueta «Agente/…». */
function datosBandeja() {
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
      borrador: !!conBorrador[h.getId()]
    };
  }).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return { conversaciones: conversaciones };
}

/** Una conversación entera, con el borrador del agente si lo hay. */
function datosHilo(id) {
  const yo = Session.getEffectiveUser().getEmail().toLowerCase();
  const hilo = GmailApp.getThreadById(id);
  if (!hilo) throw new Error('No encuentro esta conversación. Puede que se haya borrado.');
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
  return {
    id: id,
    asunto: hilo.getFirstMessageSubject() || '(sin asunto)',
    nombre: ref ? nombre_(ref.getFrom()) : '',
    para: borrador ? borrador.para : (ref ? direcciones_(ref.getReplyTo() || ref.getFrom()) : ''),
    gmail: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(yo) + '#all/' + id,
    tipo: marcas.tipo, revisar: marcas.revisar, sospechoso: marcas.sospechoso,
    mensajes: mensajes,
    borrador: borrador
  };
}

/** Guarda el texto como borrador de respuesta en la conversación (sin enviar). */
function guardarBorrador(id, texto) {
  return { borradorId: escribirBorrador_(id, texto) };
}

/** Guarda y envía. Solo se llama cuando una persona ha pulsado «Enviar» y lo ha confirmado. */
function enviar(id, texto) {
  const borradorId = escribirBorrador_(id, texto);
  Gmail.Users.Drafts.send({ id: borradorId }, 'me');
  return { ok: true };
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
  return m ? m[1].trim() : s.replace(/[<>]/g, '');
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
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --tinta:#141414; --sec:#6b6b6b; --ter:#9a9893; --fondo:#f6f5f3; --tarjeta:#fff; --linea:#e3e2de; --suave:#efeeeb; --mio:#ecebe7;
  --ok-t:#23794f; --aten:#d9932f; --aten-t:#a8661a; --aten-f:#fbf1e2; --err:#e0584b; --err-t:#c23d30; --err-f:#fcebe9;
  --sans:"Inter Tight","Helvetica Neue",Arial,sans-serif; --mono:"DM Mono",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--fondo);color:var(--tinta);font-family:var(--sans);font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased}
button,textarea{font:inherit;color:inherit}
a{color:inherit}
.app{display:grid;grid-template-columns:340px minmax(0,1fr);height:100vh;height:100dvh}
/* Lista */
.lista{border-right:1px solid var(--linea);display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--fondo)}
.lista-cab{padding:22px 18px 12px}
.lista-cab h1{font-size:18px;font-weight:600;letter-spacing:-.01em;margin:0}
.lista-cab .sub{font-size:13px;color:var(--sec);margin-top:2px}
.filtros{display:flex;gap:4px;background:var(--suave);padding:3px;border-radius:9px;margin-top:14px}
.filtro{flex:1;border:0;background:transparent;border-radius:7px;padding:6px 10px;font-size:13px;color:var(--sec);cursor:pointer}
.filtro:hover{color:var(--tinta)}
.filtro[aria-pressed="true"]{background:var(--tarjeta);color:var(--tinta);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.filtro .c{font-family:var(--mono);margin-left:5px;color:var(--ter)}
.convs{overflow-y:auto;flex:1;padding:0 8px 16px}
.conv{display:block;width:100%;text-align:left;border:0;background:transparent;border-radius:10px;padding:11px 12px;cursor:pointer;transition:background .12s}
.conv:hover{background:var(--suave)}
.conv[aria-current="true"]{background:var(--tarjeta);box-shadow:0 0 0 1px var(--linea)}
.conv .fila1{display:flex;align-items:center;gap:8px}
.conv .quien{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.conv .hora{font-family:var(--mono);font-size:12px;color:var(--ter)}
.conv .asunto{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.conv .extracto{font-size:13px;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.conv .marcas{display:flex;gap:6px;margin-top:5px;font-size:12px;color:var(--sec)}
.punto{width:7px;height:7px;border-radius:50%;background:var(--aten);flex:none}
.punto.err{background:var(--err)}
.marca{display:inline-flex;align-items:center;gap:5px}
.marca.aten{color:var(--aten-t)} .marca.err{color:var(--err-t)} .marca.ok{color:var(--ok-t)}
.cargando{padding:18px;color:var(--sec);font-size:14px}
/* Chat */
.chat{display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--tarjeta)}
.chat-cab{display:flex;align-items:center;gap:14px;padding:16px 24px;border-bottom:1px solid var(--linea)}
.volver{display:none;border:0;background:transparent;font-size:22px;line-height:1;padding:4px 8px 4px 0;cursor:pointer;color:var(--sec)}
.chat-cab .titulo{flex:1;min-width:0}
.chat-cab .nombre{font-size:18px;font-weight:600;letter-spacing:-.01em}
.chat-cab .detalle{font-size:13px;color:var(--sec);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pastilla{display:inline-block;font-size:12px;font-weight:500;padding:2px 8px;border-radius:999px;background:var(--suave);color:var(--sec);margin-left:6px;vertical-align:1px}
.pastilla.aten{background:var(--aten-f);color:var(--aten-t)}
.pastilla.err{background:var(--err-f);color:var(--err-t)}
.boton{border:1px solid var(--linea);background:var(--tarjeta);border-radius:8px;padding:7px 12px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none;transition:border-color .15s,background .15s}
.boton:hover{border-color:#bdbbb5}
.boton.texto{border-color:transparent;background:transparent;color:var(--sec)}
.boton.texto:hover{color:var(--tinta);background:var(--suave)}
.boton.negro{background:var(--tinta);border-color:var(--tinta);color:#fff}
.boton.negro:hover{background:#000}
.boton:disabled{opacity:.45;cursor:default}
.aviso-sosp{margin:16px 24px 0;padding:10px 14px;border-radius:8px;background:var(--err-f);color:var(--err-t);font-size:14px}
.mensajes{flex:1;overflow-y:auto;padding:20px 24px;background:var(--fondo)}
.dia{text-align:center;margin:14px 0 10px}
.dia span{font-size:12px;color:var(--sec);background:var(--tarjeta);border:1px solid var(--linea);border-radius:999px;padding:2px 10px}
.dia.aviso span{color:var(--err-t);background:var(--err-f);border-color:var(--err-f)}
.msg{max-width:min(620px,78%);margin:0 0 10px}
.msg .quien{font-size:12px;color:var(--sec);margin:0 0 3px 2px}
.burbuja{background:var(--tarjeta);border:1px solid var(--linea);border-radius:12px;padding:10px 14px;white-space:pre-wrap;overflow-wrap:anywhere}
.burbuja .hora{display:block;text-align:right;font-family:var(--mono);font-size:11px;color:var(--ter);margin-top:4px}
.msg.mio{margin-left:auto}
.msg.mio .quien{text-align:right;margin-right:2px}
.msg.mio .burbuja{background:var(--mio);border-color:var(--mio)}
.adjuntos{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.adjunto{font-size:12px;color:var(--sec);background:var(--suave);border-radius:6px;padding:3px 8px;font-family:var(--mono)}
/* Escribir */
.escribir{border-top:1px solid var(--linea);padding:14px 24px 18px;background:var(--tarjeta)}
.escribir .etiq{display:flex;justify-content:space-between;align-items:baseline;gap:4px 12px;flex-wrap:wrap;font-size:13px;color:var(--sec);margin-bottom:8px}
.escribir .para{overflow-wrap:anywhere}
.escribir .etiq b{color:var(--tinta);font-weight:600}
textarea{width:100%;min-height:96px;max-height:42vh;resize:none;border:1px solid var(--linea);border-radius:10px;padding:12px 14px;background:var(--tarjeta);line-height:1.5}
textarea:focus{outline:0;border-color:var(--tinta)}
.botones{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:10px}
.botones .estado{flex:1;font-size:13px;color:var(--sec)}
.botones .estado.confirmar{font-size:14px;font-weight:500;color:var(--tinta);text-align:right}
.vacio{flex:1;display:flex;align-items:center;justify-content:center;color:var(--sec);background:var(--fondo)}
.error{color:var(--err-t)}
:focus-visible{outline:2px solid var(--tinta);outline-offset:2px}
@media (max-width:760px){
  .app{grid-template-columns:1fr}
  .app.con-hilo .lista{display:none}
  .app:not(.con-hilo) .chat{display:none}
  .volver{display:block}
  .chat-cab{padding:12px 16px}
  .mensajes{padding:16px}
  .escribir{padding:12px 16px 16px}
  .msg{max-width:88%}
  .chat-cab .boton{display:none}
  .pista{display:none}
}
</style>
</head>
<body>
<div class="app" id="app">
  <aside class="lista">
    <div class="lista-cab"><h1>Correos</h1><div class="sub" id="lista-sub">Cargando…</div>
      <div class="filtros" id="filtros"></div></div>
    <div class="convs" id="convs"></div>
  </aside>
  <main class="chat" id="chat"><div class="vacio">Elige un correo de la lista.</div></main>
</div>
<script>
var $ = function(id){ return document.getElementById(id); };
var actual = null, original = '', convs = [], verTodos = false;
function porContestar(c){ return c.borrador || (!c.ultimoMio && !c.sospechoso); }

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
function hora(iso){ return new Date(iso).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}); }
function cuando(iso){
  var d = new Date(iso), hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return hora(iso);
  return d.toLocaleDateString('es-ES',{day:'numeric',month:'short'});
}
function diaLargo(iso){ return new Date(iso).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}); }
function llamar(fn){
  var args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function(ok, mal){
    var r = google.script.run.withSuccessHandler(ok).withFailureHandler(mal);
    r[fn].apply(r, args);
  });
}

// ---- Lista
function pintarLista(){
  var caja = $('convs'); caja.innerHTML = '';
  var pend = convs.filter(porContestar);
  $('lista-sub').textContent = pend.length ? pend.length + ' por contestar' : 'Todo contestado';
  var fl = $('filtros'); fl.innerHTML = '';
  [[false, 'Por contestar', pend.length], [true, 'Todos', convs.length]].forEach(function(f){
    fl.append(el('button',{class:'filtro', 'aria-pressed': String(verTodos === f[0]), onclick: function(){ verTodos = f[0]; pintarLista(); }}, f[1], el('span',{class:'c'}, String(f[2]))));
  });
  // En «Por contestar», primero lo que necesita a una persona (sospechoso y revisar); después, del más nuevo al más viejo.
  var peso = function(c){ return c.sospechoso ? 0 : (c.revisar ? 1 : 2); };
  var lista = verTodos ? convs : convs.filter(function(c){ return porContestar(c) || c.id === actual; })
    .sort(function(x, y){ return (peso(x) - peso(y)) || (x.fecha < y.fecha ? 1 : -1); });
  if (!convs.length) caja.append(el('div',{class:'cargando'},'Todavía no hay correos etiquetados por el agente.'));
  else if (!lista.length) caja.append(el('div',{class:'cargando'},'No queda nada por contestar. Los demás están en «Todos».'));
  lista.forEach(function(c){
    var marcas = el('div',{class:'marcas'}, el('span',{}, c.tipo || 'Correo'));
    if (c.sospechoso) marcas.append(el('span',{class:'marca err'}, el('span',{class:'punto err'}), 'Sospechoso'));
    else if (c.revisar) marcas.append(el('span',{class:'marca aten'}, el('span',{class:'punto'}), 'Revisar'));
    if (c.noEntregado) marcas.append(el('span',{class:'marca err'}, '· No entregado'));
    else if (c.borrador) marcas.append(el('span',{class:'marca'}, '· Borrador listo'));
    else if (c.ultimoMio) marcas.append(el('span',{class:'marca ok'}, '· Contestado'));
    caja.append(el('button',{class:'conv', 'data-id': c.id, 'aria-current': String(actual === c.id), onclick: function(){ abrirHilo(c.id, true); }},
      el('div',{class:'fila1'}, el('span',{class:'quien'}, c.nombre), el('span',{class:'hora'}, c.fecha ? cuando(c.fecha) : '')),
      el('div',{class:'asunto'}, c.asunto),
      el('div',{class:'extracto'}, c.extracto),
      marcas));
  });
}
function cargarLista(){
  return llamar('datosBandeja').then(function(r){ convs = r.conversaciones; pintarLista(); })
    .catch(function(e){ $('lista-sub').textContent = ''; $('convs').innerHTML = ''; $('convs').append(el('div',{class:'cargando error'}, 'No he podido cargar la lista: ' + e.message)); });
}

// ---- Conversación
function abrirHilo(id, guardarEnUrl){
  recordar();
  actual = id;
  $('app').classList.add('con-hilo');
  if (guardarEnUrl) google.script.history.push({hilo:id}, {hilo:id});
  pintarLista();
  var chat = $('chat'); chat.innerHTML = '';
  chat.append(el('div',{class:'vacio'},'Abriendo la conversación…'));
  llamar('datosHilo', id).then(pintarHilo).catch(function(e){
    chat.innerHTML = ''; chat.append(el('div',{class:'vacio error'}, e.message));
  });
}
function cerrarHilo(){
  recordar();
  actual = null; $('app').classList.remove('con-hilo'); pintarLista();
  google.script.history.push(null, {});
}
function cambiado(){ var t = $('texto'); return !!(t && t.value.trim() !== original.trim()); }
// Lo que has escrito y no has guardado se queda aquí si cambias de conversación, y vuelve al regresar.
var sinGuardar = {};
function recordar(){ var t = $('texto'); if (actual && t && !t.disabled){ if (cambiado()) sinGuardar[actual] = t.value; else delete sinGuardar[actual]; } }

function pintarHilo(h){
  if (h.id !== actual) return;
  var chat = $('chat'); chat.innerHTML = '';
  var detalle = h.asunto;
  var cab = el('div',{class:'chat-cab'},
    el('button',{class:'volver', 'aria-label':'Volver a la lista', onclick: cerrarHilo}, '‹'),
    el('div',{class:'titulo'},
      el('div',{class:'nombre'}, h.nombre || 'Sin remitente',
        h.tipo ? el('span',{class:'pastilla'}, h.tipo) : null,
        h.sospechoso ? el('span',{class:'pastilla err'}, 'Sospechoso') : (h.revisar ? el('span',{class:'pastilla aten'}, 'Revisar') : null)),
      el('div',{class:'detalle'}, detalle)),
    el('a',{class:'boton texto', href:h.gmail, target:'_blank', rel:'noopener'}, 'Abrir en Gmail'));
  chat.append(cab);
  if (h.sospechoso) chat.append(el('div',{class:'aviso-sosp'}, 'El agente lo ha marcado como sospechoso y no lo ha contestado. Antes de responder, asegúrate de quién es.'));

  var lista = el('div',{class:'mensajes', id:'mensajes'});
  var ultimoDia = '';
  h.mensajes.forEach(function(m){
    if (m.aviso){ lista.append(el('div',{class:'dia aviso'}, el('span',{}, m.texto + ' · ' + hora(m.fecha)))); return; }
    var d = new Date(m.fecha).toDateString();
    if (d !== ultimoDia){ lista.append(el('div',{class:'dia'}, el('span',{}, diaLargo(m.fecha)))); ultimoDia = d; }
    var b = el('div',{class:'burbuja'}, m.texto || '(sin texto)');
    if (m.adjuntos.length){
      var a = el('div',{class:'adjuntos'});
      m.adjuntos.forEach(function(n){ a.append(el('span',{class:'adjunto', title:'Adjunto: ábrelo en Gmail'}, n)); });
      b.append(a);
    }
    b.append(el('span',{class:'hora'}, hora(m.fecha)));
    lista.append(el('div',{class:'msg' + (m.mio ? ' mio' : '')}, el('div',{class:'quien'}, m.mio ? 'Tú' : m.nombre), b));
  });
  chat.append(lista);

  original = h.borrador ? h.borrador.texto : '';
  var texto = el('textarea',{id:'texto', placeholder:'Escribe a ' + (h.nombre || 'el cliente'), 'aria-label':'Mensaje'});
  texto.value = sinGuardar[h.id] != null ? sinGuardar[h.id] : original;
  var estado = el('span',{class:'estado', id:'estado'});
  var guardar = el('button',{class:'boton texto', id:'guardar', disabled:true, onclick: function(){ guardarTexto(h); }}, 'Guardar borrador');
  var enviarB = el('button',{class:'boton negro', id:'enviar', onclick: function(){ pedirConfirmacion(h); }}, 'Enviar');
  var botones = el('div',{class:'botones', id:'botones'}, estado, guardar, enviarB);
  var etiq = h.borrador
    ? el('div',{class:'etiq'}, el('span',{}, el('b',{}, 'Borrador del agente'), el('span',{class:'pista'}, ' · revísalo, cámbialo si quieres y envíalo')), el('span',{class:'para'}, 'Para ' + h.para))
    : el('div',{class:'etiq'}, el('span',{}, el('b',{}, 'Tu respuesta')), el('span',{class:'para'}, h.para ? 'Para ' + h.para : ''));
  chat.append(el('div',{class:'escribir'}, etiq, texto, botones));

  function ajustar(){ texto.style.height = 'auto'; texto.style.height = Math.min(texto.scrollHeight + 2, window.innerHeight * .42) + 'px'; }
  texto.addEventListener('input', function(){ ajustar(); guardar.disabled = !cambiado(); estado.textContent = cambiado() ? 'Cambios sin guardar' : ''; estado.className = 'estado'; });
  ajustar();
  if (cambiado()){ guardar.disabled = false; estado.textContent = 'Cambios sin guardar'; }
  lista.scrollTop = lista.scrollHeight;
}

function ocupado(si){ ['guardar','enviar','texto'].forEach(function(id){ var e = $(id); if (e) e.disabled = si; }); }
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
  caja.append(el('span',{class:'estado confirmar'}, '¿Enviar a ' + (h.nombre || h.para) + '?'),
    el('button',{class:'boton texto', onclick: function(){ caja.innerHTML = ''; antes.forEach(function(n){ caja.append(n); }); }}, 'Cancelar'),
    el('button',{class:'boton negro', id:'si', onclick: function(){ enviarTexto(h, t, caja); }}, 'Sí, enviar'));
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
      el('button',{class:'boton', onclick: function(){ abrirHilo(h.id, false); }}, 'Volver a intentarlo'));
    $('texto').disabled = false;
  });
}

function marcarBorrador(id, si, contestado){
  convs.forEach(function(c){ if (c.id === id){ c.borrador = si; if (contestado){ c.ultimoMio = true; c.fecha = new Date().toISOString(); } } });
  pintarLista();
}

window.addEventListener('beforeunload', function(e){ if (cambiado()){ e.preventDefault(); e.returnValue = ''; } });
google.script.history.setChangeHandler(function(e){ var id = e.location.parameter.hilo; if (id && id !== actual) abrirHilo(id, false); });
google.script.url.getLocation(function(loc){
  var id = loc.parameter.hilo;
  if (id) abrirHilo(id, false);
  cargarLista();
});
</script>
</body>
</html>`;
