#!/usr/bin/env node
/**
 * WhatsApp por QR para el panel del correo: el modo prueba, sin Meta.
 *
 * Este ordenador se vincula a un WhatsApp con un QR, como WhatsApp Web. Lo que te escriben los números
 * permitidos entra en el panel (y en Gmail) como «WhatsApp · Nombre», y lo que envías desde el panel sale
 * por ese WhatsApp. Funciona mientras esta ventana esté abierta.
 *
 * No es la API oficial de WhatsApp: úsalo para probar y para enseñarlo, con un número de pruebas. Para el
 * negocio de verdad, la vía de Meta (token e identificador en el panel, y el puente de Cloudflare).
 *
 * Cómo se usa (en la carpeta del agente):
 *   1. En el panel: nombre del negocio → WhatsApp → «Probar con un QR, sin Meta», y guarda la dirección
 *      de la implementación «Cualquier usuario» (paso 1). El panel te da la orden entera.
 *   2. node herramientas/whatsapp-qr.mjs --panel "https://script.google.com/macros/s/…/exec?clave=…" --permitir 34600111222
 *      Se abre una página con el QR: escanéalo con el WhatsApp de pruebas → Dispositivos vinculados.
 *   La segunda vez basta con «node herramientas/whatsapp-qr.mjs»: recuerda el panel, los números y la sesión.
 *   --permitir añade números (con prefijo, sin +); --quitar los quita; --desvincular cierra la sesión.
 *
 * Solo pasan los números permitidos: los demás chats de ese WhatsApp ni se leen ni salen de aquí.
 * La primera vez instala Baileys (la pieza que habla con WhatsApp Web) en .herramientas/, fuera del repo.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, '.herramientas', 'whatsapp-qr');
const AJUSTES = path.join(CARPETA, 'ajustes.json');
const SESION = path.join(CARPETA, 'sesion');
const PAGINA_QR = path.join(RAIZ, 'salida', 'whatsapp-qr.html');
const PIEZAS = ['baileys@7.0.0-rc14', 'qrcode@1.5.4'];
const CADA_MS = 3000;
const MAX_ARCHIVO = 15 * 1024 * 1024;

// ---------------------------------------------------------------- el núcleo (sin WhatsApp: se prueba solo)

/** Solo cifras; un móvil español sin prefijo (9 cifras) se queda con el 34 delante. */
export function normalizar(numero) {
  const n = String(numero || '').replace(/\D/g, '');
  return /^[6789]\d{8}$/.test(n) ? '34' + n : n;
}

/**
 * Une un WhatsApp (`crearConexion`) con el panel: pasa lo que llega de los números permitidos y envía lo
 * que el panel deja en su cola. `crearConexion(eventos)` devuelve { enviar(tel, texto), parar() }.
 */
export async function arrancarPuente({ panel, permitidos, crearConexion, log = console.log, cadaMs = CADA_MS }) {
  const deja = new Set(permitidos.map(normalizar));
  let numero = '';
  let parado = false;
  let avisoCola = '';

  async function alPanel(cuerpo) {
    for (let intento = 0; intento < 3; intento++) {
      try {
        // Apps Script contesta con una redirección cuando ya lo ha procesado: con eso basta.
        const r = await fetch(panel, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origen: 'qr', ...cuerpo }), redirect: 'manual', signal: AbortSignal.timeout(30000) });
        if (r.status < 400) return true;
        log(`El panel ha contestado ${r.status}.`);
      } catch (e) {
        log(`No llego al panel: ${e.message}`);
      }
      await new Promise(ok => setTimeout(ok, 2000 * (intento + 1)));
    }
    return false;
  }

  const conexion = await crearConexion({
    alConectar(n) { numero = normalizar(n); log(`Vinculado: +${numero}. Esperando mensajes de ${[...deja].map(t => '+' + t).join(', ')}.`); },
    alQR(qr) { return qr; },
    async alMensaje(m) {
      const tel = normalizar(m.tel);
      if (!deja.has(tel)) return false;
      const ok = await alPanel({ mensajes: [{ ...m, tel }] });
      log(ok ? `Entra en el panel: ${m.nombre || '+' + tel}${m.archivo ? ' (con archivo)' : ''}.` : 'No se ha podido pasar un mensaje al panel.');
      return ok;
    }
  });

  async function vuelta() {
    if (parado) return;
    try {
      const u = new URL(panel);
      u.searchParams.set('cola', '1');
      if (numero) u.searchParams.set('numero', numero);
      const r = await fetch(u, { signal: AbortSignal.timeout(30000) });
      const d = await r.json().catch(() => ({}));
      if (d.error) {
        const t = 'El panel no reconoce esta dirección o no está en modo QR: copia otra vez la orden del panel.';
        if (avisoCola !== t) log(avisoCola = t);
      } else {
        avisoCola = '';
        const hechos = [];
        for (const m of d.cola || []) {
          const tel = normalizar(m.tel);
          if (!deja.has(tel)) { log(`No se envía a +${tel}: no está en --permitir.`); hechos.push(m.id); continue; }
          try {
            await conexion.enviar(tel, m.texto);
            hechos.push(m.id);
            log(`Enviado a +${tel}.`);
          } catch (e) {
            log(`No se ha podido enviar a +${tel}: ${e.message}`);
          }
        }
        if (hechos.length) await alPanel({ enviados: hechos });
      }
    } catch (e) {
      const t = `No llego al panel: ${e.message}`;
      if (avisoCola !== t) log(avisoCola = t);
    }
    if (!parado) setTimeout(vuelta, cadaMs);
  }
  setTimeout(vuelta, 0);

  return { async parar() { parado = true; await conexion.parar?.(); } };
}

// ---------------------------------------------------------------- WhatsApp de verdad (Baileys)

function instalarPiezas() {
  if (existsSync(path.join(CARPETA, 'node_modules', 'baileys', 'package.json')) &&
      existsSync(path.join(CARPETA, 'node_modules', 'qrcode', 'package.json'))) return;
  mkdirSync(CARPETA, { recursive: true });
  if (!existsSync(path.join(CARPETA, 'package.json'))) writeFileSync(path.join(CARPETA, 'package.json'), '{"private":true}\n');
  console.log('Primera vez: instalo la pieza que habla con WhatsApp Web (un minuto)…');
  const npmJunto = path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const [orden, previos] = existsSync(npmJunto) ? [process.execPath, [npmJunto]] : ['npm', []];
  const r = spawnSync(orden, [...previos, 'install', ...PIEZAS, '--save-exact', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: CARPETA, stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('No se ha podido instalar. ¿Tienes Node.js 20 o más nuevo y conexión a internet?');
}

function entradaDe(raiz) {
  const paquete = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  const elegir = e => (typeof e === 'string' ? e : e && typeof e === 'object' ? elegir(e.import ?? e.default ?? e['.']) : null);
  return path.join(raiz, elegir(paquete.exports) ?? paquete.main ?? 'lib/index.js');
}

/** La página con el QR: se recarga sola y, al vincular, lo dice. Se abre una vez. */
function pintarPagina(cuerpo) {
  mkdirSync(path.dirname(PAGINA_QR), { recursive: true });
  writeFileSync(PAGINA_QR, `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>WhatsApp por QR</title>
<body style="font-family:-apple-system,Helvetica,sans-serif;display:grid;place-items:center;min-height:90vh;color:#1c1c1c;text-align:center">
<div>${cuerpo}</div></body>`);
}

function crearConexionBaileys(qrcode) {
  return async eventos => {
    const baileys = await import(pathToFileURL(entradaDe(path.join(CARPETA, 'node_modules', 'baileys'))).href);
    let registro;
    try { registro = createRequire(path.join(CARPETA, 'package.json'))('pino')({ level: 'silent' }); } catch { registro = undefined; }
    const makeWASocket = baileys.default?.default ?? baileys.default ?? baileys.makeWASocket;
    const { DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion, fetchLatestWaWebVersion, isLidUser, jidNormalizedUser, useMultiFileAuthState } = baileys;
    const inicio = Math.floor(Date.now() / 1000) - 5;
    let sock = null, parando = false, paginaAbierta = false, version = null, ultimoCierre = '';
    const telDeJid = jid => (String(jid || '').match(/^(\d{6,15})(?::\d+)?@(s\.whatsapp\.net|c\.us)$/) || [])[1] || null;

    async function telefonoDe(clave) {
      const jid = clave.remoteJid;
      if (!isLidUser?.(jid)) return telDeJid(jidNormalizedUser(jid));
      const alt = clave.remoteJidAlt || clave.senderPn;
      if (alt) return telDeJid(jidNormalizedUser(alt));
      const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid).catch(() => null);
      return pn ? telDeJid(jidNormalizedUser(pn)) : null;
    }

    function contenido(m) {
      const x = m.message || {};
      const texto = x.conversation || x.extendedTextMessage?.text || x.imageMessage?.caption || x.documentMessage?.caption ||
        x.documentWithCaptionMessage?.message?.documentMessage?.caption || '';
      const doc = x.documentMessage || x.documentWithCaptionMessage?.message?.documentMessage;
      if (x.imageMessage) return { texto: texto || '(Foto por WhatsApp)', tipo: 'foto', mime: x.imageMessage.mimetype || 'image/jpeg' };
      if (doc) return { texto: texto || `(Documento por WhatsApp: ${doc.fileName || 'documento'})`, tipo: 'doc', mime: doc.mimetype, nombre: doc.fileName };
      if (x.audioMessage) return { texto: '(Nota de voz por WhatsApp: escúchala en el móvil o pide que lo escriba)' };
      if (texto) return { texto };
      return null;
    }

    // La versión de WhatsApp Web que se anuncia: la que sirve hoy web.whatsapp.com. La que trae Baileys
    // se queda atrás y, con una vieja, el QR sale pero el móvil dice «Revisa tu conexión y vuelve a
    // intentarlo». Si un reintento no llega a web.whatsapp.com, se sigue con la última buena.
    async function versionAnunciada() {
      const web = await fetchLatestWaWebVersion?.().catch(() => null);
      if (web?.isLatest && Array.isArray(web.version)) {
        if (version?.join('.') !== web.version.join('.')) console.log(`WhatsApp Web ${web.version.join('.')}`);
        version = web.version;
      }
      if (version) return version;
      const repo = await fetchLatestBaileysVersion?.().catch(() => null);
      if (repo?.isLatest && Array.isArray(repo.version)) return repo.version;
      console.log('No he podido saber la versión de WhatsApp Web: si el móvil no vincula, revisa la conexión a internet.');
      return undefined;
    }

    async function conectar() {
      if (parando) return;
      if (!sock) console.log('Conectando con WhatsApp…');
      const { state, saveCreds } = await useMultiFileAuthState(SESION);
      const anunciada = await versionAnunciada();
      sock = makeWASocket({ ...(anunciada ? { version: anunciada } : {}), auth: state, ...(registro ? { logger: registro } : {}),
        syncFullHistory: false, markOnlineOnConnect: false });
      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          console.log('\n' + await qrcode.toString(qr, { type: 'terminal', small: true }));
          console.log('Escanéalo con WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo.');
          pintarPagina(`<h2 style="font-weight:600">Escanea con WhatsApp</h2><img alt="QR" width="320" height="320" src="${await qrcode.toDataURL(qr, { margin: 1, width: 640 })}">
<p style="color:#666">WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo</p>`);
          if (!paginaAbierta && process.platform === 'darwin') { paginaAbierta = true; spawn('open', [PAGINA_QR], { stdio: 'ignore', detached: true }).unref(); }
        }
        if (connection === 'open') {
          const n = telDeJid(jidNormalizedUser(sock.user.id));
          pintarPagina(`<h2 style="font-weight:600">WhatsApp vinculado</h2><p style="color:#666">+${n}. Ya puedes cerrar esta página; deja abierta la ventana de la orden.</p>`);
          eventos.alConectar(n);
        }
        if (connection === 'close' && !parando) {
          const motivo = lastDisconnect?.error?.message || 'sin motivo';
          if (motivo !== ultimoCierre) { ultimoCierre = motivo; console.log(`WhatsApp ha cortado la conexión (${motivo}). Reintento…`); }
          if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
            console.log('El móvil ha desvinculado este ordenador: sale un QR nuevo.');
            rmSync(SESION, { recursive: true, force: true });
          }
          setTimeout(() => void conectar().catch(e => console.log(e.message)), 1500);
        }
      });
      sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages ?? []) {
          try {
            const jid = m.key?.remoteJid;
            if (!m.message || m.key.fromMe || !jid || /@(g\.us|broadcast|newsletter)$/.test(jid)) continue;
            if (Number(m.messageTimestamp) < inicio) continue;
            const tel = await telefonoDe(m.key);
            if (!tel) continue;
            const c = contenido(m);
            if (!c) continue;
            const mensaje = { id: 'qr.' + m.key.id, tel, nombre: m.pushName || '', fecha: Number(m.messageTimestamp), texto: c.texto };
            // Solo se descarga el archivo de los números permitidos (lo decide alMensaje antes de pasarlo).
            mensaje.cargar = async () => {
              if (!c.tipo) return;
              const datos = await downloadMediaMessage(m, 'buffer', {}, { ...(registro ? { logger: registro } : {}), reuploadRequest: sock.updateMediaMessage });
              if (datos.length > MAX_ARCHIVO) { mensaje.texto += ' (archivo demasiado grande para pasarlo)'; return; }
              const ext = (c.mime || '').split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'bin';
              mensaje.archivo = { base64: datos.toString('base64'), mime: c.mime || 'application/octet-stream',
                nombre: c.nombre || `${c.tipo === 'foto' ? 'foto' : 'documento'}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.${ext}` };
            };
            // Doble check azul en cuanto el panel lo tiene: el cliente ve que se ha leído.
            if (await eventos.alMensaje(mensaje)) await sock.readMessages([m.key]).catch(() => undefined);
          } catch (e) {
            console.log(`No se ha podido leer un mensaje: ${e.message}`);
          }
        }
      });
    }
    await conectar();

    return {
      async enviar(tel, texto) { await sock.sendMessage(`${tel}@s.whatsapp.net`, { text: texto }); },
      async desvincular() { parando = true; await sock?.logout().catch(() => undefined); rmSync(SESION, { recursive: true, force: true }); },
      async parar() { parando = true; try { sock?.end(undefined); } catch { /* ya estaba cerrado */ } }
    };
  };
}

// ---------------------------------------------------------------- la orden

function leerAjustes() { try { return JSON.parse(readFileSync(AJUSTES, 'utf8')); } catch { return { panel: '', permitidos: [] }; } }

function leerArgumentos(argv) {
  const o = { permitir: [], quitar: [] };
  let lista = null;
  for (const a of argv) {
    if (a === '--panel') { lista = 'panel'; continue; }
    if (a === '--permitir') { lista = 'permitir'; continue; }
    if (a === '--quitar') { lista = 'quitar'; continue; }
    if (a === '--desvincular') { o.desvincular = true; lista = null; continue; }
    if (lista === 'panel') { o.panel = a; lista = null; } else if (lista) o[lista].push(...a.split(',')); else o.otro = a;
  }
  return o;
}

async function main() {
  const [mayor] = process.versions.node.split('.').map(Number);
  if (mayor < 20) throw new Error(`Hace falta Node.js 20 o más nuevo (tienes ${process.versions.node}).`);
  const arg = leerArgumentos(process.argv.slice(2));
  if (arg.otro) throw new Error(`No entiendo «${arg.otro}». Mira las instrucciones al principio de este archivo.`);
  const aj = leerAjustes();
  if (arg.panel) aj.panel = arg.panel.trim();
  aj.permitidos = [...new Set([...(aj.permitidos || []), ...arg.permitir.map(normalizar).filter(Boolean)])]
    .filter(n => !arg.quitar.map(normalizar).includes(n));
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(AJUSTES, JSON.stringify(aj, null, 2));

  if (arg.desvincular) {
    rmSync(SESION, { recursive: true, force: true });
    console.log('Sesión borrada. Quita también «Dispositivos vinculados» en el móvil si sigue apareciendo.');
    return;
  }
  let u;
  try { u = new URL(aj.panel); } catch { u = null; }
  if (!u || u.hostname !== 'script.google.com' || !/\/exec$/.test(u.pathname) || !u.searchParams.get('clave')) {
    throw new Error('Falta --panel con la dirección que da el panel (acaba en «/exec?clave=…»): nombre del negocio → WhatsApp.');
  }
  if (!aj.permitidos.length) throw new Error('Falta --permitir con al menos un número (con prefijo, sin +), por ejemplo --permitir 34600111222.');
  instalarPiezas();
  const qrcode = createRequire(path.join(CARPETA, 'package.json'))('qrcode');
  console.log(`WhatsApp por QR (modo prueba). Números permitidos: ${aj.permitidos.map(n => '+' + n).join(', ')}.`);
  const crear = crearConexionBaileys(qrcode);
  const puente = await arrancarPuente({
    panel: aj.panel, permitidos: aj.permitidos,
    crearConexion: async eventos => crear({
      ...eventos,
      // El archivo se baja solo si el número está permitido.
      async alMensaje(m) {
        if (!aj.permitidos.includes(normalizar(m.tel))) return false;
        await m.cargar();
        delete m.cargar;
        return eventos.alMensaje(m);
      }
    })
  });
  const salir = async () => { console.log('\nCerrado. Para volver: node herramientas/whatsapp-qr.mjs'); await puente.parar(); process.exit(0); };
  process.on('SIGINT', salir);
  process.on('SIGTERM', salir);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
