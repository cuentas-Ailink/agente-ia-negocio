---
name: empezar
description: Puesta en marcha guiada del agente, paso a paso (negocio, Gmail, primera pasada, chat y tarea de cada mañana). Úsala cuando escriban «empezamos», «hola», «¿qué hago?», «configúralo», «ayúdame a instalarlo», o la primera vez que abren la carpeta.
---

# Puesta en marcha

La persona no sabe programar y no tiene que abrir ningún archivo. Tú haces el trabajo y le pides solo lo que no puedes hacer tú (conectar Gmail, pegar el chat, crear la tarea en la app).

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

## 4. Chat para contestar (opcional)

Explica para qué sirve: «Para leer cada correo como un chat y enviar el borrador con un clic, sin buscarlo en Gmail». Si lo quiere, dale estos pasos, tal cual:

1. Con la cuenta de Gmail del negocio, entra en script.google.com → «Nuevo proyecto» y llámalo «Chat del correo».
2. Borra lo que haya y pega el contenido de `herramientas/chat.gs`. Para que no tenga que abrir el archivo, ofrécete a copiarlo al portapapeles con `pbcopy < herramientas/chat.gs` (en Mac).
3. A la izquierda, «Servicios» (+) → «Gmail API» → «Añadir».
4. «Implementar» → «Nueva implementación» → engranaje → «Aplicación web». Ejecutar como «Yo»; quién tiene acceso «Solo yo». Al aceptar los permisos, Google avisa de que la app no está verificada: es su propio script, «Configuración avanzada» → «Ir a Chat del correo».
5. «Pégame aquí la URL que acaba en /exec».

Antes del paso 1, pregunta si tiene varias cuentas de Google abiertas en el navegador. Si es así, que lo haga todo en una ventana privada con solo la cuenta del negocio: con varias cuentas, Google falla al dar los permisos («No se puede abrir el archivo en estos momentos»). Si aun así falla, que en el editor elija la función «datosBandeja» y pulse «Ejecutar» para aceptar los permisos, y después implemente.

Cuando la pegue, ejecuta `python3 herramientas/panel.py --chat <URL>` y `python3 herramientas/panel.py --abrir`. Dile que ahora tiene «Contestar correos» arriba del panel.

## 5. Cada mañana, solo

Dile cómo crear la tarea programada en la app de Claude, en esta carpeta, cada día a la hora que quiera (por ejemplo, las 8:00), con el texto «Haz la pasada diaria». Recuérdale que el ordenador tiene que estar encendido y con la app abierta a esa hora.

## Al terminar

Ejecuta otra vez `python3 herramientas/estado.py` y cierra con 2 líneas: qué hará el agente cada mañana y que, para cambiar algo (precios, tono, un tipo de correo nuevo), basta con decírselo.
