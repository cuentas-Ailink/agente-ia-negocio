---
name: empezar
description: Puesta en marcha guiada del agente, paso a paso (negocio, Gmail, primera pasada, tu panel y tarea de cada mañana; WhatsApp y pasada en la nube, opcionales). Úsala cuando escriban «empezamos», «hola», «¿qué hago?», «configúralo», «ayúdame a instalarlo», «quiero WhatsApp», «quiero la pasada en la nube», o la primera vez que abren la carpeta.
---

# Puesta en marcha

La persona no sabe programar y no tiene que abrir ningún archivo. Tú haces el trabajo y le pides solo lo que no puedes hacer tú (conectar Gmail, pulsar «Permitir» en Google, crear la tarea en la app).

**Es una conversación guiada, no un informe.** Cada paso empieza con una pregunta o una acción de la persona. Nunca te saltes un paso en silencio ni hagas varios seguidos sin que la persona conteste.

**Cómo se ve (como la puesta en marcha del CRM):**
- **Lista de pasos visible.** Al empezar, crea la lista de tareas de la app (TodoWrite, o TaskCreate si es la que tienes) con los 5 pasos: «Tu negocio», «Gmail conectado», «Primera pasada», «Tu panel», «Cada mañana, solo». Marca los hechos y pon «en curso» el que toca. Actualízala al acabar cada paso: la persona ve el avance en la app.
- **Preguntas con botones.** Cada vez que la persona tenga que elegir o confirmar algo, usa la herramienta de preguntas con opciones (AskUserQuestion), con 2 o 3 opciones cortas y la recomendada primero. Solo si no la tienes, haz la pregunta en el chat con las opciones numeradas.
- Un paso cada vez. Una sola pregunta por mensaje. Mensajes cortos, sin jerga: nada de «repositorio», «skill», «script», «JSON», «terminal» ni rutas de archivos.
- Al acabar cada paso, di «Hecho» y cuál es el siguiente.
- Si la persona quiere dejarlo, dile que escriba «empezamos» otro día y seguís donde lo dejasteis.

## 0. Dónde estamos

Ejecuta `python3 herramientas/estado.py`. Saluda en una línea («Te dejo el correo de tu negocio ordenado cada mañana: facturas revisadas y respuestas escritas para que solo tengas que enviarlas»), crea la lista de pasos y enséñalos también en el chat como una lista corta de 5 líneas con su estado. Empieza por el primero que no esté «Hecho» («Ejemplo» no cuenta como hecho).

Si «estado.py» dice que hay algo mal montado, ejecuta `python3 herramientas/comprobar.py`, arréglalo tú y sigue.

## 1. Tu negocio

Si es el negocio de ejemplo (Gestoría Arcos), **pregunta siempre**, con botones: «¿Con qué empezamos?»
- «Probar con la gestoría de ejemplo» (recomendada si es una cuenta de Gmail de pruebas).
- «Adaptarlo a mi negocio».

Si elige adaptarlo, pregunta a qué se dedica en una frase y usa la skill `adaptar-negocio` (ella hace sus propias preguntas, también con botones). Al reescribir `negocio/negocio.md`, quita la línea `<!-- Ejemplo … -->`. Al acabar, resume en 3 líneas qué correos va a llevar y qué hará con cada uno, y pregunta con botones «¿Está bien así?» («Sí, sigue» / «Quiero cambiar algo»).

Si elige el ejemplo y su Gmail de pruebas está vacío, dile en una línea que se mande desde otra cuenta 2 o 3 correos (una pregunta de un cliente y una factura en PDF) para ver al agente trabajar.

## 2. Gmail conectado

- Prueba el conector: lista las etiquetas de Gmail.
- Si funciona, di con qué cuenta está conectado (la dirección) y pregunta con botones «¿Es la cuenta del negocio?» («Sí» / «No, es otra»).
- Si no hay herramientas de Gmail: «En la app de Claude, abre Ajustes → Conectores → Gmail → Conectar, con la cuenta del negocio. Después abre una conversación nueva en esta carpeta y escribe «empezamos»». Para probar, recomienda una cuenta de Gmail de pruebas.

## 3. Primera pasada

- Explica en una línea qué va a pasar: «Voy a leer los correos de la bandeja, etiquetarlos y dejar respuestas en borrador. No envío nada ni borro nada».
- Pide el OK con botones («Hazla ahora» / «Más tarde») y, con él, usa la skill `pasada-diaria`.
- Al acabar, si el panel ya está instalado (existe `negocio/chat.txt`), ábrelo con `python3 herramientas/panel.py --abrir` y di qué mirar primero: «Necesita a una persona». Si no, no abras nada: di que ya puede ver las etiquetas y los borradores en Gmail y pasa al paso 4, que es donde se monta el panel. No hay otro panel: no generes ni abras `salida/panel.html`.

## 4. Tu panel

Explica para qué sirve en 2 líneas: «Es tu panel, en tu cuenta de Google: ves el resumen del día y las facturas, y cada correo se abre como un chat para enviar el borrador con un clic. Lo instalo yo y te lo abro aquí; tú solo pulsas dos botones. Con el mismo enlace lo abres desde cualquier dispositivo».

Pregunta con botones: «¿Te lo instalo ahora?» («Sí, instálalo» / «Más tarde»). Si es más tarde, no insistas: el agente funciona igual con Gmail.

Si ya existe `negocio/panel.json`, el panel ya está instalado: ábrelo con `python3 herramientas/panel.py --abrir` y pasa al paso 5.

**Lo instalas tú, en este orden:**

1. **Node.js.** Comprueba `node -v` (hace falta 18 o superior). Si no está, ábrele la página con `open https://nodejs.org/es/download` y dile: «Descarga el instalador para Mac y dale a siguiente, siguiente. Cuando acabe, dime «hecho»». Pregunta con botones («Hecho» / «Me da un error»). No lo instales tú.
2. **Un interruptor de Google, una sola vez.** Ábrele `open https://script.google.com/home/usersettings` y dile: «Con la cuenta de Google del negocio, activa «API de Google Apps Script» y dime «hecho»». Si tiene varias cuentas abiertas, que mire arriba a la derecha que es la del negocio.
3. **Instalar.** Avisa: «Ahora se abre Google en el navegador: elige la cuenta del negocio y pulsa «Permitir»». Ejecuta `python3 herramientas/panel_google.py instalar` (con un tiempo de espera largo, unos 10 minutos: espera a que la persona pulse «Permitir»). El programa inicia sesión, crea el panel con el nombre del negocio, lo sube y lo publica, y guarda la dirección. Si dice que falta el interruptor, vuelve al punto 2. Si dice otra cosa, explícalo con palabras normales y vuelve a intentarlo una vez.
4. **Abrirlo.** `python3 herramientas/panel.py --abrir`. La primera vez Google pide permiso, porque es un panel suyo y nuevo. Dale estos pasos **como lista numerada, uno por línea**: «Revisar permisos» → elige la cuenta del negocio → «Configuración avanzada» → «Ir a Panel del correo» → «Permitir». Es su propio panel: Google avisa igual con todos.
5. Si al abrirlo sale «Este panel es privado», es que el navegador ha entrado con otra cuenta de Google: que lo abra en un perfil de Chrome (o una ventana privada) con solo la cuenta del negocio. La propia página lo explica.

Cuando lo vea, deja el borrador del resumen como dice el paso 6 de `pasada-diaria` si en esta conversación ya hiciste la pasada y aún no lo dejaste. Dile que lo guarde en marcadores. Con ese mismo enlace lo abre desde cualquier dispositivo; en el móvil, si quiere, «Añadir a pantalla de inicio» (es un extra, no un paso). El nombre del negocio ya sale arriba. Para poner su logo: que pulse el nombre de arriba a la izquierda (en el móvil, el icono de arriba), «Subir logo» y «Guardar». La hoja de facturas se crea sola y se abre desde «Facturas» → «Abrir hoja de facturas».

Si no puede usar Node.js o el programa falla dos veces, hay instalación a mano (las instrucciones están al principio de `herramientas/panel.gs`): ofrécete a copiar el archivo con `LC_ALL=en_US.UTF-8 pbcopy < herramientas/panel.gs` y dale esos pasos como lista numerada. Cuando pegue la dirección que acaba en /exec, ejecuta `python3 herramientas/panel.py --chat <URL>`.

## 5. Cada mañana, solo

- Pregunta a qué hora la quiere (propón las 8:00).
- Si tienes una herramienta para crear tareas programadas, créala tú: en esta carpeta, cada día a esa hora, con el texto «Haz la pasada diaria». Créala **una sola vez**: si da error, mira primero si se ha creado antes de volver a intentarlo, para no dejar dos tareas.
- Si no la tienes, dile dónde crearla en la app de Claude, con ese mismo texto.
- Cuando esté creada, escribe la hora en `negocio/rutina.txt` (por ejemplo `08:00`) para que el estado la marque como hecha.
- Recuérdale que el ordenador tiene que estar encendido y con la app de Claude abierta a esa hora.
- Dile en una línea que hay otra forma, en la nube, para que la pasada se haga con el ordenador apagado, y que se la explicas si la quiere (escribiendo «quiero la pasada en la nube»).

## En la nube (opcional, solo si lo pide)

Explícalo en 2 líneas: la pasada la hace Claude en sus servidores cada mañana, aunque el ordenador esté apagado. A cambio necesita una cuenta de GitHub, donde vive una copia privada de esta carpeta con su negocio.

Es una opción, no la única: si ya tiene un servidor propio u otra forma de lanzar tareas cada mañana, vale igual. Lo único que hace falta es lanzar «Haz la pasada diaria» en esta carpeta con Claude y Gmail conectado. No le empujes a GitHub si prefiere otra cosa: ayúdale con la que elija.

Los pasos **como lista numerada**:

1. En github.com, con su cuenta: «New repository», un nombre (por ejemplo agente-correo-minegocio), «Private» y «Create repository».
2. En ese repositorio: «uploading an existing file» (o «Add file» → «Upload files»). Que arrastre **todo el contenido** de esta carpeta, incluida `negocio/` con su negocio y `memoria/`, y pulse «Commit changes». La carpeta `.claude/` es oculta: en el Mac se ve en Finder con Cmd+Mayús+punto. Sin ella el agente no tiene sus instrucciones.
3. En claude.ai → «Ajustes» → «Conectores»: Gmail conectado con la cuenta del negocio (el mismo de antes).
4. En claude.ai/code, que dé acceso de GitHub a ese repositorio (lo pide la propia página la primera vez) y cree una tarea programada **en la nube** sobre ese repositorio, cada día a la hora elegida, con este texto: «Haz la pasada diaria. Al terminar, si has aprendido algo nuevo, guarda memoria/ con un commit en este repositorio y súbelo». Así no pierde lo que aprende.
5. Prueba: que la lance una vez a mano y mire que en Gmail aparecen las etiquetas y los borradores, y en el panel el resumen.

Si la monta en la nube, que pause la tarea del ordenador para no tener dos. Y recuérdale: el repositorio tiene que ser **privado**, porque la memoria y los resúmenes llevan datos de sus clientes.

## WhatsApp (opcional, solo si lo pide)

Si escribe «quiero WhatsApp» o pregunta por ello, explícalo en 2 líneas: los WhatsApp de sus clientes (texto, fotos de facturas, PDF) entran en Gmail como un correo más, el agente los revisa igual y la persona contesta desde el panel. Para probarlo basta un QR y Node.js en el ordenador. Para el día a día con clientes, la vía oficial: una app de Meta con WhatsApp, que el negocio crea con su propio Facebook (una cuenta real, no recién creada), y una cuenta gratis de Cloudflare para el puente.

Pregúntale antes cuál quiere, con botones:
- **Probarlo ya con un QR, sin Meta** (5 minutos): el ordenador se vincula a un WhatsApp de pruebas, como WhatsApp Web. Para probar o enseñar; no es la API oficial, así que nunca con el número del negocio.
- **La vía oficial de Meta**, para el día a día: la de abajo.

Si elige el QR, los pasos **como lista numerada**:

1. Antes, tú: `python3 herramientas/panel_google.py whatsapp`. Publica la dirección que usa WhatsApp y la deja puesta en el panel (no hay que pegar nada). Si el panel se instaló a mano (no existe `negocio/panel.json`), en su lugar dale el paso de «Nueva implementación» con acceso «Cualquier usuario» de las instrucciones de `herramientas/panel.gs`.
2. En el panel (recarga la página): nombre del negocio → WhatsApp → «Conectar» → «Probar con un QR, sin Meta». La dirección del paso 1 se comprueba sola; si sale «Ya está puesta: pulsa «Comprobar»», que pulse «Comprobar».
3. Comprueba antes `node -v` (hace falta 20 o superior). Si no está, que lo instale desde https://nodejs.org/es/download (el instalador para Mac, siguiente, siguiente) y espera a que diga «hecho»; no lo instales tú.
   Pídele la orden que sale en el panel (lleva la dirección y la clave) y el número (o números) que podrán escribir, con prefijo. La orden no termina nunca (se queda escuchando), así que en Mac ábresela tú en una ventana de Terminal, que sigue abierta aunque cierre esta conversación: `osascript -e 'tell application "Terminal" to do script "cd <esta carpeta, entre comillas escapadas> && node herramientas/whatsapp-qr.mjs --panel <la del panel, entre comillas escapadas> --permitir 34600111222"'`. Cuida las comillas: la ruta de la carpeta puede llevar espacios y «|». En otro sistema, ejecútala en segundo plano. La primera vez instala la pieza de WhatsApp Web (un minuto).
4. Se abre una página con el QR: que lo escanee con el WhatsApp de pruebas → Ajustes → Dispositivos vinculados → Vincular un dispositivo.
5. Prueba: desde uno de los números permitidos, un WhatsApp y una foto a ese WhatsApp. Al momento le llega la respuesta automática (se cambia en el panel, en WhatsApp) y el mensaje sale como leído. Entra en Gmail como «WhatsApp · Nombre»; después de «haz la pasada» aparece en el panel con su borrador. Lo que envíe desde el panel sale por ese WhatsApp.

Funciona mientras esa ventana de Terminal siga abierta y el ordenador encendido. Otro día, doble clic en «Abrir WhatsApp.command», en esta carpeta: recuerda el panel, los números y la sesión, y si hace falta pide un número nuevo. Si el móvil dice «Revisa tu conexión» al escanear, cierra la ventana, ejecuta `node herramientas/whatsapp-qr.mjs --desvincular` y vuelve a abrirla.

Si elige Meta: pídele antes estos 3 datos de su app de Meta, y que no te los pegue a ti: los pegará él en el panel y en Cloudflare. Son el token permanente, el identificador del número de teléfono y la clave secreta de la app (Configuración de la app → Básica).

Después, los pasos **como lista numerada, uno por línea**:

1. Antes, tú: `python3 herramientas/panel_google.py whatsapp` (publica la dirección que usa WhatsApp y la deja puesta en el panel). Si el panel se instaló a mano, en su lugar dale el paso de «Nueva implementación» con acceso «Cualquier usuario» de las instrucciones de `herramientas/panel.gs`.
2. En el panel (recarga la página): pulsa el nombre del negocio → WhatsApp → «Conectar». Pega el token y el identificador → «Conectar WhatsApp».
3. En el paso 1 de WhatsApp la dirección ya está comprobada (si no, «Comprobar»). Debajo aparecen PANEL y el token de verificación.
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
