---
name: revisar-factura
description: Comprueba una factura (base, IVA, retención, total y NIF) con un programa que hace las cuentas. Úsala con cualquier factura o ticket que llegue por correo.
---

# Revisar una factura

Las cuentas no las haces tú: las hace `herramientas/revisar_factura.py`. Tu trabajo es leer bien la factura y copiar lo que pone.

1. **Consigue la factura.** Si viene adjunta, descárgala (guárdala en `salida/facturas/`) y léela. Si viene en el cuerpo del correo, léela de ahí.
2. **Copia lo que pone, sin corregir nada**, en un JSON como este (un elemento por factura):

```json
{"numero": "F05-2026", "fecha": "2026-11-12", "emisor": "Recambios Mena SL", "nif_emisor": "B46777890",
 "lineas": [{"base": 2310.00, "tipo_iva": 21}], "cuota_iva": 485.10,
 "tipo_irpf": 0, "retencion": 0, "total": 2815.10, "motivo_exencion": ""}
```

   - Una línea en `lineas` por cada tipo de IVA distinto, con su base.
   - Si la factura pone una cuota de IVA por cada tipo (por ejemplo, un albarán con 10 % y 21 %), copia cada cuota en su línea como `"cuota"` y no pongas `cuota_iva`: `"lineas": [{"base": 58.00, "tipo_iva": 10, "cuota": 5.80}, {"base": 613.00, "tipo_iva": 21, "cuota": 128.73}]`.
   - Si un dato no aparece, déjalo vacío (`""`) o quítalo. Nunca lo inventes ni lo calcules tú.
   - Si no puedes leer la factura, no adivines: estado «revisar», motivo «No se puede leer la factura».
3. **Ejecuta la herramienta** con los tipos de la sección «Impuestos» de `negocio/negocio.md`:

```bash
python3 herramientas/revisar_factura.py factura.json --iva 21,10,4,0 --irpf 0,1,2,7,15,19
```

   (Usa un archivo temporal en `salida/` o pásalo por la entrada con `-`.)
4. **Usa lo que devuelve tal cual**: `estado` (correcta, error o revisar), `motivos` y `diferencia`. Si es «error» o «revisar», el correo necesita «Agente/Revisar».
5. **El borrador** (con la skill `redactar-respuesta`):
   - Correcta: acuse de recibo breve.
   - Error: explica el problema con las cifras que da la herramienta (por ejemplo «el total pone 2.815,10 € y la suma correcta es 2.795,10 €») y pide la factura corregida.
   - Revisar: pide el dato que falta (por ejemplo, el NIF del emisor).
