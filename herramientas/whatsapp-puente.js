/**
 * Puente de WhatsApp para el panel del correo (Cloudflare Workers, plan gratis).
 *
 * Meta avisa de cada WhatsApp nuevo a una dirección de internet. Apps Script no le vale (Google contesta con
 * una redirección y Meta la da por fallida), así que Meta avisa a este puente y el puente se lo pasa al panel.
 * El puente no guarda nada ni lee los mensajes: comprueba que el aviso viene de Meta y lo reenvía tal cual.
 *
 * Cómo se pone (10 minutos, sin terminal):
 * 1. Entra en dash.cloudflare.com (cuenta gratis) → Workers → Crear → plantilla «Hello World».
 *    Ponle un nombre, por ejemplo «whatsapp-negocio», e implementa.
 * 2. «Editar código»: borra lo que hay, pega este archivo entero e implementa.
 * 3. En el Worker → Configuración → Variables y secretos, añade dos:
 *    - PANEL (texto): el valor que te da el panel en «WhatsApp → paso 2». Acaba en «/exec?clave=…».
 *    - APP_SECRET (secreto): en Meta → tu app → Configuración de la app → Básica → «Clave secreta de la app».
 * 4. Abre la dirección del Worker (https://whatsapp-negocio.<tu-cuenta>.workers.dev). Tiene que decir «Todo listo».
 * 5. En Meta → WhatsApp → Configuración → Webhook: esa dirección y el token de verificación que te da el panel.
 *    «Verificar y guardar» y, en «Campos del webhook», suscríbete a «messages».
 * 6. Publica la app de Meta. Sin publicar, Meta solo manda los avisos de prueba del panel de Meta,
 *    nunca los mensajes de verdad (ni los del dueño de la app).
 */

const ESPERA_MAX_MS = 15000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const panel = leerPanel(env.PANEL);

    if (request.method === 'GET') {
      // Meta comprueba la dirección una vez, al guardarla: hay que devolverle su número si el token coincide.
      if (url.searchParams.has('hub.mode')) {
        const vale = panel && url.searchParams.get('hub.mode') === 'subscribe' &&
          url.searchParams.get('hub.verify_token') === panel.clave;
        return vale ? texto(url.searchParams.get('hub.challenge') || '') : texto('Token de verificación incorrecto', 403);
      }
      return texto(await estado(panel, env));
    }

    if (request.method !== 'POST') return texto('No', 405);
    if (!panel || !env.APP_SECRET) return texto('Falta configurar el puente', 500);

    const cuerpo = await request.text();
    if (!(await firmaDeMeta(cuerpo, request.headers.get('x-hub-signature-256'), env.APP_SECRET))) {
      return texto('Firma incorrecta', 401);
    }

    // Apps Script procesa el aviso y luego contesta con una redirección: con eso ya ha llegado.
    const envio = fetch(panel.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, redirect: 'manual'
    }).then(r => r.status < 400, () => false);
    ctx.waitUntil(envio);
    // Si el panel tarda (una foto grande), se contesta a Meta igual: el panel no mete dos veces el mismo mensaje.
    const llego = await Promise.race([envio, new Promise(ok => setTimeout(() => ok(true), ESPERA_MAX_MS))]);
    // Si no ha llegado, Meta lo vuelve a intentar más tarde.
    return llego ? texto('OK') : texto('El panel no contesta', 502);
  }
};

function texto(t, status = 200) {
  return new Response(t, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** PANEL es la dirección /exec del panel con «?clave=…»: la clave también es el token de verificación de Meta. */
function leerPanel(valor) {
  try {
    const u = new URL(String(valor || '').trim());
    const clave = u.searchParams.get('clave');
    if (u.protocol !== 'https:' || u.hostname !== 'script.google.com' || !/\/exec$/.test(u.pathname) || !clave) return null;
    return { url: u.toString(), clave };
  } catch (e) {
    return null;
  }
}

/** La página que ves al abrir la dirección del puente: dice qué falta o que todo está listo. */
async function estado(panel, env) {
  if (!env.PANEL) return 'Falta la variable PANEL. Cópiala del panel: WhatsApp → paso 2.';
  if (!panel) return 'La variable PANEL no está bien: tiene que acabar en «/exec?clave=…». Cópiala otra vez del panel.';
  if (!env.APP_SECRET) return 'Falta la variable APP_SECRET: la clave secreta de tu app de Meta (Configuración de la app → Básica).';
  let respuesta = '';
  try {
    const u = new URL(panel.url);
    u.searchParams.set('ping', '1');
    respuesta = (await (await fetch(u.toString())).text()).trim();
  } catch (e) {
    return 'El puente no llega al panel. Comprueba la variable PANEL.';
  }
  if (respuesta === 'ok') return 'Todo listo. Pon esta dirección en Meta → WhatsApp → Configuración → Webhook, con el token de verificación que te da el panel.';
  if (respuesta === 'sin-conectar') return 'El puente llega al panel, pero falta conectar WhatsApp en el panel (token y número).';
  if (respuesta === 'no') return 'El puente llega al panel, pero la clave no coincide. Copia otra vez PANEL del panel.';
  return 'El panel no deja pasar al puente: la implementación tiene que tener acceso «Cualquier usuario».';
}

/** Meta firma cada aviso con la clave secreta de la app. Sin firma buena, no pasa. */
async function firmaDeMeta(cuerpo, cabecera, secreto) {
  const m = /^sha256=([0-9a-f]{64})$/i.exec(String(cabecera || '').trim());
  if (!m) return false;
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(cuerpo)));
  const esperada = Array.from(firma, b => b.toString(16).padStart(2, '0')).join('');
  const recibida = m[1].toLowerCase();
  let diferencia = 0;
  for (let i = 0; i < esperada.length; i++) diferencia |= esperada.charCodeAt(i) ^ recibida.charCodeAt(i);
  return diferencia === 0;
}
