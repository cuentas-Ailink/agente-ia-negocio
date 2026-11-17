---
name: empezar
description: Puesta en marcha guiada del agente, paso a paso (negocio, Gmail, primera pasada, panel en el móvil y tarea de cada mañana; WhatsApp, opcional). Úsala cuando escriban «empezamos», «hola», «¿qué hago?», «configúralo», «ayúdame a instalarlo», «quiero WhatsApp», o la primera vez que abren la carpeta.
---

# Puesta en marcha

La persona no sabe programar y no tiene que abrir ningún archivo. Tú haces el trabajo y le pides solo lo que no puedes hacer tú (conectar Gmail, instalar el panel en su cuenta de Google, crear la tarea en la app).

**Cómo hablas en esta skill:**
- Un paso cada vez. Una sola pregunta por mensaje.
- Mensajes cortos, sin jerga: nada de «repositorio», «skill», «script», «JSON» ni rutas de archivos.
- Al acabar cada paso, di «Hecho» y cuál es el siguiente.
- Si la persona quiere dejarlo, dile que escriba «empezamos» otro día y seguís donde lo dejasteis.

## 0. Dónde estamos

Ejecuta `python3 herramientas/estado.py`. Saluda en una línea («Te dejo el correo de tu negocio ordenado cada mañana: facturas revisadas y respuestas escritas para que solo tengas que enviarlas») y enseña siempre los 5 pasos con su estado, como una lista corta de 5 líneas (así la persona ve desde el principio todo lo que falta). Empieza por el primero que no esté hecho.

Si «estado.py» dice que hay algo mal montado, ejecuta `python3 herramientas/comprobar.py`, arréglalo tú y sigue.

## 1. Tu negocio

- Si es el negocio de ejemplo (Gestoría Arcos), pregunta: «¿Lo pruebas primero con la gestoría de ejemplo o lo adaptamos ya a tu negocio? Si es lo segundo, dime a qué se dedica en una frase».
- Para adaptarlo, usa la skill `adaptar-negocio`. Al reescribir `negocio/negocio.md`, quita la línea `<!-- Ejemplo … -->`.
- Al acabar, resume en 3 líneas qué correos va a llevar y qué hará con cada uno.

## 2. Gmail conectado

- Prueba el conector: lista las etiquetas de Gmail.
- Si funciona, di con qué cuenta está conectado (la dirección) y pregunta solo si es la del negocio cuando no lo parezca.
- Si no hay herramientas de Gmail: «En la app de Claude, abre Ajustes → Conectores → Gmail → Conectar, con la cuenta del negocio. Después abre una conversación nueva en esta carpeta y escribe «empezamos»». Para probar, recomienda una cuenta de Gmail de pruebas.

## 3. Primera pasada

- Explica en una línea qué va a pasar: «Voy a leer los correos de la bandeja, etiquetarlos y dejar respuestas en borrador. No envío nada ni borro nada».
- Pide el OK y, con él, usa la skill `pasada-diaria`.
- Al acabar, abre el panel: `python3 herramientas/panel.py --abrir`. Di qué mirar primero: «Necesita a una persona».

## 4. Panel en el móvil y el ordenador (opcional)

Explica para qué sirve: «Es tu panel en una página privada de Google: ves el resumen del día y las facturas, y cada correo se abre como un chat para enviar el borrador con un clic. Además, las facturas revisadas van solas a una hoja de Google, lista para contabilidad. Funciona en el móvil, aunque el ordenador esté apagado». Pregunta si ya lo tiene instalado: si es así, solo pide la URL que acaba en /exec. Si lo instaló antes como «Chat del correo», basta con pegar el archivo nuevo encima, ejecutar una vez la función «prepararHoja» (acepta el permiso nuevo y crea la hoja de facturas) y crear una «Nueva versión» («Implementar» → «Gestionar implementaciones» → lápiz): la dirección no cambia.

Si lo quiere instalar, escribe estos pasos **como lista numerada, uno por línea, con los nombres de los botones entre comillas**. No los resumas en un párrafo: la persona los va siguiendo mientras mira la pantalla.

1. Con la cuenta de Gmail del negocio, entra en script.google.com → «Nuevo proyecto» y llámalo «Panel del correo».
2. Borra lo que haya y pega el contenido de `herramientas/panel.gs`. Para que no tenga que abrir el archivo, ofrécete a copiarlo al portapapeles con `LC_ALL=en_US.UTF-8 pbcopy < herramientas/panel.gs` (en Mac; sin `LC_ALL` el Mac estropea los acentos y el panel se queda en «Cargando»). Pídele que compruebe que las tildes se ven bien al pegar.
3. A la izquierda, «Servicios» (+) → «Gmail API» → «Añadir».
4. Arriba, en el desplegable de funciones, elige «prepararHoja» y pulsa «Ejecutar». Acepta los permisos: Google avisa de que la app no está verificada; es su propio script, «Configuración avanzada» → «Ir a Panel del correo». Esto crea la hoja «Facturas revisadas» en su Drive.
5. «Implementar» → «Nueva implementación» → engranaje → «Aplicación web». Ejecutar como «Yo»; quién tiene acceso «Solo yo».
6. «Pégame aquí la URL que acaba en /exec».

Antes del paso 1, pregunta si tiene varias cuentas de Google abiertas en el navegador. Si es así, que lo haga todo en una ventana privada con solo la cuenta del negocio: con varias cuentas, Google falla al dar los permisos («No se puede abrir el archivo en estos momentos»). 

Cuando la pegue, ejecuta `python3 herramientas/panel.py --chat <URL>` y, si aún no lo has hecho en esta pasada, deja el borrador del resumen como dice el paso 6 de `pasada-diaria`. Después `python3 herramientas/panel.py --abrir`, que ya abre el panel de Google. Dile que lo guarde en marcadores y, en el móvil, que lo abra con la misma cuenta y use «Añadir a pantalla de inicio». Para poner el logo y el nombre de su negocio: que pulse el nombre de arriba a la izquierda (en el móvil, el icono de arriba), «Subir logo» y «Guardar». La hoja de facturas se abre desde «Facturas» → «Abrir hoja de facturas».

## 5. Cada mañana, solo

- Pregunta a qué hora la quiere (propón las 8:00).
- Si tienes una herramienta para crear tareas programadas, créala tú: en esta carpeta, cada día a esa hora, con el texto «Haz la pasada diaria». Créala **una sola vez**: si da error, mira primero si se ha creado antes de volver a intentarlo, para no dejar dos tareas.
- Si no la tienes, dile dónde crearla en la app de Claude, con ese mismo texto.
- Cuando esté creada, escribe la hora en `negocio/rutina.txt` (por ejemplo `08:00`) para que el estado la marque como hecha.
- Recuérdale que el ordenador tiene que estar encendido y con la app de Claude abierta a esa hora.

## WhatsApp (opcional, solo si lo pide)

Si escribe «quiero WhatsApp» o pregunta por ello, explícalo en 2 líneas: los WhatsApp de sus clientes (texto, fotos de facturas, PDF) entran en Gmail como un correo más, el agente los revisa igual y la persona contesta desde el panel. Hace falta una app de Meta con WhatsApp, que el negocio crea con su propio Facebook (una cuenta real, no recién creada), y una cuenta gratis de Cloudflare para el puente.

Pregúntale antes cuál quiere:
- **Probarlo ya con un QR, sin Meta** (5 minutos): el ordenador se vincula a un WhatsApp de pruebas, como WhatsApp Web. Para probar o enseñar; no es la API oficial, así que nunca con el número del negocio.
- **La vía oficial de Meta**, para el día a día: la de abajo.

Si elige el QR, los pasos **como lista numerada**:

1. En el panel: nombre del negocio → WhatsApp → «Conectar» → «Probar con un QR, sin Meta».
2. En script.google.com, en «Panel del correo»: «Implementar» → «Nueva implementación» → engranaje → «Aplicación web». Ejecutar como «Yo»; quién tiene acceso: «Cualquier usuario». Copia la dirección que acaba en /exec y pégala en el panel, en el paso 1 → «Comprobar».
3. Pídele la orden que sale en el panel (lleva la dirección y la clave) y el número (o números) que podrán escribir, con prefijo. Ejecútala tú en esta carpeta, en segundo plano porque no termina: `node herramientas/whatsapp-qr.mjs --panel "<la del panel>" --permitir 34600111222`. La primera vez instala la pieza de WhatsApp Web (un minuto).
4. Se abre una página con el QR: que lo escanee con el WhatsApp de pruebas → Ajustes → Dispositivos vinculados → Vincular un dispositivo.
5. Prueba: desde uno de los números permitidos, un WhatsApp y una foto a ese WhatsApp. En unos segundos aparecen en el panel, en «Correos». Lo que envíe desde el panel sale por ese WhatsApp.

Funciona mientras la orden siga abierta. Otro día basta con `node herramientas/whatsapp-qr.mjs`: recuerda el panel, los números y la sesión.

Si elige Meta: pídele antes estos 3 datos de su app de Meta, y que no te los pegue a ti: los pegará él en el panel y en Cloudflare. Son el token permanente, el identificador del número de teléfono y la clave secreta de la app (Configuración de la app → Básica).

Después, los pasos **como lista numerada, uno por línea**:

1. En el panel: pulsa el nombre del negocio → WhatsApp → «Conectar». Pega el token y el identificador → «Conectar WhatsApp».
2. En script.google.com, en «Panel del correo»: «Implementar» → «Nueva implementación» → engranaje → «Aplicación web». Ejecutar como «Yo»; quién tiene acceso: «Cualquier usuario». Copia la dirección que acaba en /exec.
3. En el panel, en WhatsApp, pega esa dirección en el paso 1 → «Comprobar». Debajo aparecen PANEL y el token de verificación.
4. En dash.cloudflare.com (cuenta gratis): «Compute» → «Workers & Pages» → «Create» → «Hello World», con el nombre whatsapp-negocio → «Deploy». Deja apagado «Protect with Cloudflare Access».
5. «Edit code»: borra lo que hay y pega `herramientas/whatsapp-puente.js` (ofrécete a copiarlo con `LC_ALL=en_US.UTF-8 pbcopy < herramientas/whatsapp-puente.js`) → «Deploy».
6. En el Worker → «Settings» → «Variables and Secrets» → «Add». Crea PANEL (tipo «Text») con el valor del panel, y APP_SECRET (tipo «Secret») con la clave secreta de la app → «Deploy».
7. Abre la dirección del Worker (…workers.dev). Tiene que decir «Todo listo». Si dice otra cosa, el propio mensaje explica qué falta.
8. En Meta → WhatsApp → «Configuración» → «Webhook»: pon la dirección del Worker y el token de verificación del panel → «Verificar y guardar». En «Campos del webhook», suscríbete a «messages».
9. Publica la app de Meta («Publicar» arriba en la app; te pide una URL de política de privacidad, vale una página de Notion o de la web). Sin publicar, Meta verifica la dirección pero no manda ni un mensaje de verdad, ni siquiera del dueño de la app: es el fallo más habitual.
10. Prueba: que se mande un WhatsApp y una foto al número del negocio. En un minuto tienen que aparecer en el panel, en «Correos», con la etiqueta WhatsApp.

Si cualquiera de los pasos da error, pídele una captura.

## Al terminar

Ejecuta otra vez `python3 herramientas/estado.py` y cierra con 2 líneas: qué hará el agente cada mañana y que, para cambiar algo (precios, tono, un tipo de correo nuevo), basta con decírselo.
