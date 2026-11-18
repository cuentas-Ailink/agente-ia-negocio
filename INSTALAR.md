# Instalar el agente

Son tres pasos. No hace falta programar ni abrir ningún archivo: a partir del tercero te guía el propio agente.

## 1. Clónalo con Claude

Abre la app de Claude, ve a **Code**, elige tu carpeta **Documentos** y pega esto:

> Clona https://github.com/cuentas-Ailink/agente-ia-negocio aquí, en Documentos.

Claude lo descarga en la carpeta `agente-ia-negocio`, igual que lo tenemos nosotros. Si el Mac te pide instalar las herramientas de desarrollo, acepta (es de Apple y tarda unos minutos) y vuelve a pegarlo. Con el plan Pro basta: no hace falta ninguna clave ni pagar aparte.

¿Prefieres no clonar? En GitHub, **Code → Download ZIP** y descomprímelo en Documentos.

## 2. Ábrelo en la app de Claude

En **Code**, abre una sesión nueva y elige la carpeta `agente-ia-negocio`. Tiene que ser esa carpeta, no Documentos: es la que trae las instrucciones del agente.

## 3. Escribe «empezamos»

El agente te lleva paso a paso y te dice en cada uno si ya está hecho:

1. **Tu negocio.** Viene preparado con una gestoría de ejemplo. Si quieres el tuyo, le dices a qué se dedica en una frase y te hace como mucho 5 preguntas.
2. **Gmail.** Comprueba que está conectado. Si no, te dice dónde: **Ajustes → Conectores → Gmail → Conectar**, con la cuenta del negocio (para probar, mejor una cuenta de pruebas).
3. **La primera pasada.** Ordena la bandeja, revisa las facturas, deja las respuestas en borrador No envía ni borra nada.
4. **El panel en el móvil y el ordenador** (recomendado, 3 minutos). Te da los pasos para instalarlo en tu cuenta de Google: el resumen del día, las facturas y cada correo como un chat para enviar los borradores.
5. **Cada mañana, solo.** Te dice cómo crear la tarea programada en la app de Claude, con el texto «Haz la pasada diaria».

¿Quieres que la pasada se haga aunque el ordenador esté apagado? Escribe «quiero la pasada en la nube» (hace falta una cuenta de GitHub), o úsalo en tu propio servidor: basta con lanzar «Haz la pasada diaria» en esta carpeta cada mañana. ¿Quieres WhatsApp? Escribe «quiero WhatsApp». Para probarlo, un QR en 5 minutos con un WhatsApp de pruebas; para el día a día con clientes, la vía oficial de Meta. En los dos casos los mensajes llegan al mismo panel.

¿Lo dejas a medias? Otro día escribe «empezamos» y sigue donde lo dejaste.

**Para actualizarlo** cuando saquemos mejoras, escribe en la carpeta «actualiza el agente». Si lo clonaste, Claude trae los cambios con git y respeta lo tuyo (tu negocio, tu memoria y tus pasadas).

## Si algo no va

| Lo que pasa | Qué hacer |
| --- | --- |
| El Mac pide instalar las herramientas de desarrollo | Acepta: es un aviso de Apple para usar Python y tarda unos minutos. |
| Terminal dice «command not found: node» (WhatsApp por QR) | Instala Node.js desde [nodejs.org/es/download](https://nodejs.org/es/download), cierra Terminal y vuelve a abrirlo. |
| El agente dice que no ve Gmail | Conecta Gmail en Ajustes → Conectores y abre una conversación nueva en la carpeta. |
| Quieres cambiar algo (precios, tono, un tipo de correo) | Díselo al agente con tus palabras: lo cambia él. |
| Algo falla sin explicación | Escribe «comprueba que todo está bien»: ejecuta `herramientas/comprobar.py` y te dice qué arreglar. |
