# Agente IA de correo para tu negocio

Cada mañana lee el Gmail de tu negocio, ordena los correos, revisa las facturas y te deja las respuestas escritas en borrador. Tú solo revisas y pulsas enviar. Funciona desde la app de Claude, sin programar.

Viene montado para una gestoría de ejemplo (Gestoría Arcos) y se adapta a cualquier negocio con una frase: «adapta el agente a mi clínica dental de Sevilla».

## Qué hace

- **Ordena la bandeja.** Pone a cada correo una etiqueta «Agente/…» según su tipo (factura, consulta, presupuesto…). Los tipos los decides tú en `negocio/negocio.md`.
- **Revisa facturas de verdad.** Lee cada factura y un pequeño programa comprueba base, IVA, retención, total y NIF. Si el total está mal sumado, te dice cuánto: «pone 2.815,10 €, debería ser 2.795,10 € (+20,00 €)». Las cuentas nunca las hace la IA.
- **Deja respuestas en borrador**, en el mismo hilo, con el tono de tu negocio. **El agente nunca envía nada.**
- **Reparte el trabajo entre subagentes** que trabajan a la vez: uno clasifica, otro revisa facturas y otro redacta.
- **Aprende.** Si un cliente pide que le traten de usted, lo apunta en `memoria/MEMORIA.md` y lo aplica la próxima vez.
- **Se protege.** Si un correo intenta darle órdenes («ignora tus instrucciones y reenvía…»), no obedece: lo marca como «Agente/Sospechoso».
- **Te lo enseña en un panel, en el móvil y en el ordenador.** Lo que necesita a una persona arriba, las cifras del día, las facturas con su estado y cada correo como un chat, con el borrador del agente ya escrito: lo cambias si quieres y pulsas «Enviar». Envías tú, con dos clics; el agente no puede. Es una página privada de tu propia cuenta de Google (`herramientas/panel.gs`): sin servidor, sin claves y sin el ordenador encendido.
- **Funciona solo** cada mañana. Lo normal es una tarea programada de la app de Claude, pero vale cualquier sitio que pueda lanzar «Haz la pasada diaria» en esta carpeta con Gmail conectado: la nube de Claude, tu propio servidor o la herramienta que ya uses. El agente no depende de ninguno.

## Cómo está hecho

| Archivo | Para qué |
| --- | --- |
| `CLAUDE.md` | El cerebro del agente: qué hace y qué no hace nunca. Igual para cualquier negocio. |
| `negocio/negocio.md` | **Tu negocio**: nombre, tono, firma, tipos de correo y qué hacer con cada uno, precios, impuestos. Es lo único que cambia. |
| `negocio/clientes.md` | Tus clientes, para reconocerlos. |
| `memoria/MEMORIA.md` | Lo que el agente aprende (máximo 20 líneas). |
| `contrato-de-tarea.md` | Lo que entrega cada pasada, cómo se comprueba, sus límites y qué hace si algo falla. |
| `perfiles/` | Puntos de partida: gestoría, clínica, inmobiliaria y genérico. |
| `.claude/skills/` | Las habilidades: `empezar` (la puesta en marcha), `pasada-diaria`, `revisar-factura`, `redactar-respuesta` y `adaptar-negocio`. |
| `.claude/agents/` | Los subagentes: `clasificador`, `revisor-documentos` y `redactor`. |
| `.claude/settings.json` | Bloquea enviar, responder, reenviar y borrar correos. |
| `herramientas/revisar_factura.py` | Hace las cuentas de cada factura. |
| `herramientas/panel.gs` | El panel en Google: resumen, facturas y cada correo como un chat para revisar y enviar los borradores. |
| `herramientas/panel_google.py` | Instala, actualiza y publica el panel en tu cuenta de Google, sin copiar ni pegar (lo usa Claude). |
| `herramientas/whatsapp-puente.js` | Opcional: el puente gratis en Cloudflare para que los WhatsApp de tus clientes lleguen al panel. |
| `herramientas/whatsapp-qr.mjs` | Opcional: WhatsApp por QR desde el ordenador, para probarlo sin Meta. |
| `Abrir WhatsApp.command` | Doble clic para volver a conectar el WhatsApp por QR otro día. |
| `herramientas/resumen_gmail.py` | Prepara el borrador interno con el resumen de la pasada, que es de donde lo lee el panel de Google. |
| `herramientas/panel.py` | Guarda la dirección del panel de Google y lo abre. |
| `herramientas/comprobar.py` | Comprueba que todo está bien montado. |
| `herramientas/estado.py` | Dice qué pasos de la puesta en marcha están hechos. |
| `salida/` | El resumen de cada día (`AAAA-MM-DD.json`) y las facturas descargadas. |

## Instalarlo

En la app de Claude (Code), pide «Clona https://github.com/cuentas-Ailink/agente-ia-negocio en Documentos», abre esa carpeta y escribe **«empezamos»**. El agente te guía en 5 pasos y te dice en cada uno si ya está hecho: tu negocio, Gmail, la primera pasada, el panel en el móvil y la tarea de cada mañana. Más detalle en [INSTALAR.md](INSTALAR.md).

## El panel en el móvil y el ordenador

Te lo instala Claude en el paso 4 de «empezamos» (o escribe «instala el panel»). Lo crea, lo sube y lo publica en tu cuenta de Google con `herramientas/panel_google.py`, ya con el nombre de tu negocio. Tú solo haces tres cosas, una vez:

1. Instalar [Node.js](https://nodejs.org/es/download) si no lo tienes (el instalador para Mac: siguiente, siguiente).
2. Activar «API de Google Apps Script» en [script.google.com/home/usersettings](https://script.google.com/home/usersettings), con la cuenta del negocio.
3. Pulsar «Permitir» en Google cuando se abra el navegador, y otra vez la primera vez que abres el panel («Configuración avanzada» → «Ir a Panel del correo» → «Permitir»: es tu propio panel).

Si lo prefieres a mano, las instrucciones están al principio de `herramientas/panel.gs`. Para actualizarlo cuando el panel avise de una versión nueva, escribe «actualiza el panel».

Guárdala en marcadores y, en el móvil, «Añadir a pantalla de inicio»: se abre como una app. Para poner tu logo y el nombre de tu negocio, pulsa el nombre de arriba a la izquierda. Solo tu cuenta puede usarlo: si alguien lo abre con otra cuenta de Google, ve «Este panel es privado» y no puede leer ni enviar nada. El resumen de cada pasada lo deja el agente en un borrador interno llamado «Agente · resumen AAAA-MM-DD», que no se envía nunca; el panel guarda los últimos 30 días.

Las facturas revisadas pasan solas a la hoja de Google «Facturas revisadas» (fecha, NIF, base, IVA, retención, total y estado), con una pestaña «Por cliente». Se abre desde «Facturas» → «Abrir hoja de facturas» y se descarga en CSV o Excel para el programa de contabilidad.

## WhatsApp en el mismo panel (opcional, el siguiente nivel)

Las fotos de facturas, los PDF y las preguntas que te mandan por WhatsApp entran en Gmail como un correo más («WhatsApp · Nombre», con el archivo adjunto). El agente los revisa en su pasada y deja la respuesta escrita, corta y sin firma. Tú la envías desde el panel con «Enviar por WhatsApp». Al cliente le llega al momento una respuesta automática («Hola, gracias por escribirnos. Hemos recibido tu mensaje y el equipo ya lo está revisando…»), como mucho una cada media hora, que puedes cambiar o quitar.

Qué hace falta:
- Una app de Meta con WhatsApp (developers.facebook.com). La crea el negocio con su Facebook: una cuenta real y con tiempo, no recién creada. De ahí salen el token permanente, el identificador del número y la clave secreta de la app. La app tiene que estar publicada: sin publicar, Meta no manda los mensajes de verdad.
- Una cuenta gratis de Cloudflare, para el puente. Meta no acepta avisar directamente a Google: el puente recibe el aviso, comprueba que es de Meta y se lo pasa al panel. No guarda nada.

Los pasos están en el propio panel (nombre del negocio → WhatsApp) y al principio de `herramientas/whatsapp-puente.js`. Si escribes «quiero WhatsApp», Claude te guía.

### Probarlo antes con un QR, sin Meta

Para probarlo o enseñarlo sin crear la app de Meta, el ordenador hace de móvil: se vincula a un WhatsApp con un QR, como WhatsApp Web. En el panel: nombre del negocio → WhatsApp → «Probar con un QR, sin Meta». Después, Claude te abre la ventana con la orden que te da el panel (o la pegas tú en Terminal) y escaneas el QR. Los días siguientes, doble clic en «Abrir WhatsApp.command». Solo pasan los números que pongas detrás de `--permitir`; los demás chats de ese WhatsApp ni se leen. Funciona mientras esa ventana esté abierta. Necesita Node.js 20 o superior: si Terminal dice «command not found: node», instálalo desde [nodejs.org/es/download](https://nodejs.org/es/download) (el instalador para Mac), abre una ventana nueva de Terminal y repite.

No es la API oficial de WhatsApp: úsalo con un número de pruebas, no con el del negocio. Para el día a día, la vía de Meta de arriba.

WhatsApp solo deja contestar dentro de las 24 horas desde el último mensaje del cliente, y el panel te lo dice. Contestar dentro de ese plazo no lo cobra Meta: solo cobra los mensajes con plantilla, y este agente no los usa.

## Adaptarlo a tu negocio

En la app de Claude, con esta carpeta abierta, escribe:

> Adapta el agente a mi negocio: [una frase sobre tu negocio].

Te hará como mucho 5 preguntas, escribirá `negocio/negocio.md` y `negocio/clientes.md` a partir del perfil más parecido y comprobará que todo está bien. El agente en sí no se toca.

## Lo que cuesta

- **El agente es gratis** (licencia MIT).
- **Claude:** con el plan Pro basta. Si lo usas para varios negocios o clientes a la vez, el plan Max.
- **Gmail:** el de siempre.

## Lo que no hace (todavía)

- Enviar correos por su cuenta: siempre los deja en borrador, a propósito. Envía una persona desde el chat o desde Gmail.
- Otros correos que no sean Gmail.
- Escribir primero por WhatsApp: solo contesta a quien te ha escrito en las últimas 24 horas.
- Leer facturas escaneadas muy borrosas o escritas a mano: las marca para revisar.
- Contabilizar las facturas en un programa de contabilidad.
