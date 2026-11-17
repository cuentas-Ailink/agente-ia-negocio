---
name: pasada-diaria
description: Procesa los correos nuevos del Gmail del negocio (clasificar, revisar facturas, dejar borradores, etiquetar y resumir). Úsala cuando pidan «haz la pasada», «revisa el correo», «procesa la bandeja» o desde la rutina diaria.
---

# Pasada diaria

Sigue estos pasos en orden. No te saltes el resumen final aunque no haya correos.

## 1. Preparar
- Lee `negocio/negocio.md`, `negocio/clientes.md`, `memoria/MEMORIA.md` y `contrato-de-tarea.md`.
- Mira en Gmail qué etiquetas existen. Crea las que falten: «Agente/<Tipo>» por cada fila de la tabla «Tipos de correo», más «Agente/Revisar» y «Agente/Sospechoso». Apunta el id de cada etiqueta: para etiquetar se usa el id, no el nombre.

## 2. Buscar los correos nuevos
- Busca hilos en `in:inbox` quitando **cada** etiqueta del agente por su nombre, porque en Gmail `-label:agente` no quita las subetiquetas. Por ejemplo, con la tabla de la gestoría:
  `in:inbox -label:agente-factura -label:agente-consulta -label:agente-presupuesto -label:agente-otros -label:agente-revisar -label:agente-sospechoso`
  (Gmail escribe «Agente/Factura» como `agente-factura`.)
- Pide 50 por página y **sigue pidiendo páginas** (`pageToken`) hasta que no quede ninguna: la búsqueda devuelve solo 20 si no lo dices, y un correo que no se lee hoy se queda sin contestar. Si hay más de 50 correos nuevos, procesa los 50 más antiguos y dilo en el resumen.
- Antes de seguir, comprueba en la lista que ninguno tenga ya una etiqueta que empiece por «Agente/»; si alguno la tiene, descártalo.
- Si no hay ninguno, salta al paso 6.

## 3. Clasificar
- Lanza el subagente `clasificador` con la lista de correos (id, hilo, remitente, asunto y texto). Devuelve, por correo: tipo, cliente, resumen de una línea, si es sospechoso y si necesita a una persona.

## 4. Trabajar en paralelo
Lanza **en un solo mensaje** un subagente por cada grupo que tenga correos, para que trabajen a la vez:
- `revisor-documentos` con los correos de tipo Factura (o el tipo que la tabla asigne a revisor-documentos).
- `redactor` con los correos cuyo «Quién» sea redactor.
Pasa a cada uno sus correos y el resumen del clasificador. Cada subagente deja sus borradores en Gmail y te devuelve lo que ha hecho.

Los correos sospechosos no van a ningún subagente: no se contestan.

## 5. Etiquetar
- A cada correo, su etiqueta «Agente/<Tipo>».
- Además «Agente/Sospechoso» si es sospechoso, y «Agente/Revisar» solo si encaja en «Cuándo avisar a una persona» de `negocio/negocio.md` (factura con error o para revisar, queja, urgencia, Hacienda o Seguridad Social, tipo dudoso).
- No pongas «Agente/Revisar» solo porque el borrador diga que un gestor contestará: todos los borradores los lee una persona antes de enviarlos. «Revisar» es para lo que no puede esperar a que alguien abra el borrador; si lo pones en todo, deja de servir.
- No cambies el estado de leído ni muevas nada de la bandeja.

## 6. Aprender y resumir
- Si algún correo expresa una preferencia de un cliente (trato de usted, horario, idioma, que no le llamen…), añade una línea a `memoria/MEMORIA.md`: `- AAAA-MM-DD · Cliente: preferencia.` Máximo 20 líneas.
- Guarda `salida/AAAA-MM-DD.json` (si ya existe de hoy, añade los correos nuevos) con este formato:

```json
{
  "fecha": "2026-11-16",
  "hora": "08:00",
  "negocio": "Nombre del negocio",
  "totales": {"procesados": 0, "facturas": 0, "borradores": 0, "revisar": 0, "sospechosos": 0, "minutos_ahorrados": 0},
  "correos": [
    {
      "id": "id del mensaje", "hilo": "id del hilo", "url": "enlace al correo en Gmail",
      "de": "Nombre <correo>", "cliente": "Cliente o «nuevo»", "asunto": "…", "tipo": "Factura",
      "estado": "listo | revisar | sospechoso | sin borrador",
      "resumen": "Una línea.",
      "borrador": {"id": "…", "url": "enlace al borrador"},
      "factura": {"numero": "…", "emisor": "…", "estado": "correcta | error | revisar", "motivos": [], "total_factura": 0, "total_correcto": 0, "diferencia": 0, "archivo": "salida/facturas/…pdf",
                  "datos": {"numero": "…", "fecha": "AAAA-MM-DD", "emisor": "…", "nif_emisor": "…", "lineas": [{"base": 0, "tipo_iva": 21}], "cuota_iva": 0, "tipo_irpf": 0, "retencion": 0, "total": 0}}
    }
  ]
}
```

  En `factura.datos` va el mismo JSON que copiaste de la factura para `revisar_factura.py`, tal cual: con él se rellena la hoja de facturas.
  Los minutos ahorrados son una estimación: 4 por factura revisada, 3 por borrador y 1 por correo solo etiquetado.
- Actualiza el panel: `python3 herramientas/panel.py` (genera `salida/panel.html` con todos los días; lo hace el programa, no tú).
- Deja el resumen para el panel de Google: ejecuta `python3 herramientas/resumen_gmail.py` y crea un borrador en Gmail (`create_draft`) con exactamente lo que imprime: `to`, `subject`, `body` y `attachments`. Va dirigido a la propia cuenta del negocio y **no se envía nunca**: el panel lo lee de ahí y quita los viejos. Si `create_draft` no acepta el adjunto, repite con `python3 herramientas/resumen_gmail.py --base64`. Si sigue fallando, dilo en el resumen y sigue: el panel funcionará con las etiquetas.
- Comprueba el contrato: el número de correos del JSON coincide con los etiquetados y ninguno se ha enviado (tampoco el borrador del resumen).
- Termina con un resumen en el chat de 5 líneas como mucho: cuántos correos, cuántas facturas y cuáles tienen problemas (con la diferencia en euros), cuántos borradores están listos y qué necesita a una persona.
