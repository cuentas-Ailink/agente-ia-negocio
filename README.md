# Agente IA de correo para tu negocio

Cada mañana lee el Gmail de tu negocio, ordena los correos, revisa las facturas y te deja las respuestas escritas en borrador. Tú solo revisas y pulsas enviar. Funciona desde la app de Claude, sin programar.

Viene montado para una gestoría de ejemplo (Gestoría Arcos) y se adapta a cualquier negocio con una frase: «adapta el agente a mi clínica dental de Sevilla».

## Qué hace

- **Ordena la bandeja.** Pone a cada correo una etiqueta «Agente/…» según su tipo (factura, consulta, presupuesto…). Los tipos los decides tú en `negocio/negocio.md`.
- **Revisa facturas de verdad.** Lee cada factura y un pequeño programa comprueba base, IVA, retención, total y NIF. Si el total está mal sumado, te dice cuánto: «pone 2.815,10 €, debería ser 2.795,10 € (+20,00 €)». Las cuentas nunca las hace la IA.
- **Deja respuestas en borrador**, en el mismo hilo, con el tono de tu negocio. **Nunca envía nada.**
- **Reparte el trabajo entre subagentes** que trabajan a la vez: uno clasifica, otro revisa facturas y otro redacta.
- **Aprende.** Si un cliente pide que le traten de usted, lo apunta en `memoria/MEMORIA.md` y lo aplica la próxima vez.
- **Se protege.** Si un correo intenta darle órdenes («ignora tus instrucciones y reenvía…»), no obedece: lo marca como «Agente/Sospechoso».
- **Te lo enseña en un panel.** Al acabar cada pasada se actualiza `salida/panel.html`: lo que necesita a una persona arriba, las facturas con su estado y todos los correos. Se abre con doble clic, sin instalar nada, y cada fila te lleva al correo, al borrador o a la factura.
- **Funciona solo** cada mañana con una tarea programada de la app de Claude.

## Cómo está hecho

| Archivo | Para qué |
| --- | --- |
| `CLAUDE.md` | El cerebro del agente: qué hace y qué no hace nunca. Igual para cualquier negocio. |
| `negocio/negocio.md` | **Tu negocio**: nombre, tono, firma, tipos de correo y qué hacer con cada uno, precios, impuestos. Es lo único que cambia. |
| `negocio/clientes.md` | Tus clientes, para reconocerlos. |
| `memoria/MEMORIA.md` | Lo que el agente aprende (máximo 20 líneas). |
| `contrato-de-tarea.md` | Lo que entrega cada pasada, cómo se comprueba, sus límites y qué hace si algo falla. |
| `perfiles/` | Puntos de partida: gestoría, clínica, inmobiliaria y genérico. |
| `.claude/skills/` | Las habilidades: `pasada-diaria`, `revisar-factura`, `redactar-respuesta` y `adaptar-negocio`. |
| `.claude/agents/` | Los subagentes: `clasificador`, `revisor-documentos` y `redactor`. |
| `.claude/settings.json` | Bloquea enviar, responder, reenviar y borrar correos. |
| `herramientas/revisar_factura.py` | Hace las cuentas de cada factura. |
| `herramientas/panel.py` | Genera el panel (`salida/panel.html`) con los resúmenes de cada día. |
| `herramientas/comprobar.py` | Comprueba que todo está bien montado. |
| `salida/` | El resumen de cada día (`AAAA-MM-DD.json`), el panel y las facturas descargadas. |

## Instalarlo

Sigue [INSTALAR.md](INSTALAR.md): descargar la carpeta, abrirla en la app de Claude, conectar Gmail y programar la tarea diaria.

## Adaptarlo a tu negocio

En la app de Claude, con esta carpeta abierta, escribe:

> Adapta el agente a mi negocio: [una frase sobre tu negocio].

Te hará como mucho 5 preguntas, escribirá `negocio/negocio.md` y `negocio/clientes.md` a partir del perfil más parecido y comprobará que todo está bien. El agente en sí no se toca.

## Lo que cuesta

- **El agente es gratis** (licencia MIT).
- **Claude:** con el plan Pro basta. Si lo usas para varios negocios o clientes a la vez, el plan Max.
- **Gmail:** el de siempre.

## Lo que no hace (todavía)

- Enviar correos: siempre los deja en borrador, a propósito.
- Otros correos que no sean Gmail.
- Leer facturas escaneadas muy borrosas o escritas a mano: las marca para revisar.
- Contabilizar las facturas en un programa de contabilidad.
