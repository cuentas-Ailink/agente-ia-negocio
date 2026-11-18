---
name: adaptar-negocio
description: Adapta el agente a otro negocio escribiendo negocio/negocio.md y negocio/clientes.md a partir del perfil más parecido. Úsala cuando digan «adapta el agente a mi …», «cambia de negocio» o falte negocio/negocio.md.
---

# Adaptar el agente a un negocio

El agente no se toca: solo cambia la carpeta `negocio/`.

1. **Entiende el negocio.** Si la persona solo ha dado una frase («una clínica dental en Sevilla»), pregúntale lo que falte, como mucho 5 preguntas y de una en una (cuando haya opciones, como tú o usted, con la herramienta de preguntas con botones):
   1. Nombre del negocio y ciudad.
   2. Qué correos le llegan más (y qué le gustaría que se hiciera con cada uno).
   3. Cómo quiere sonar (tú o usted, cercano o formal) y la firma.
   4. Precios o datos que el agente puede dar tal cual.
   5. País (para los impuestos) y quién revisa los borradores.
2. **Parte del perfil más parecido** de `perfiles/` (gestoria, clinica, inmobiliaria o generico). Cópialo a `negocio/negocio.md`, cambia el título a `# Negocio · <Nombre>` y rellena todos los `{{…}}`. No copies la línea `<!-- Ejemplo … -->`: ya no es el ejemplo. Ajusta la tabla «Tipos de correo» a lo que de verdad le llega: cada fila con su etiqueta, cómo reconocerla, qué hacer, si lleva borrador y qué subagente lo hace (clasificador, revisor-documentos o redactor).
3. **Si no es España**, cambia la sección «Impuestos» por los tipos de su país (por ejemplo, México: IVA 16, 8, 0) y añade `--sin-nif` si no usa NIF español.
4. **Escribe `negocio/clientes.md`** con los clientes que te dé (o vacío, con la cabecera de la tabla).
5. **Vacía `memoria/MEMORIA.md`** (deja el título y la explicación) si era de otro negocio.
6. **Comprueba**: `python3 herramientas/comprobar.py`, y arregla hasta que salga «Sin errores».
7. **Resume** en 4 líneas qué tipos de correo va a gestionar y qué hará con cada uno. Las etiquetas de Gmail se crean solas en la siguiente pasada.
