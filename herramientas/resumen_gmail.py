#!/usr/bin/env python3
"""Prepara el borrador interno con el resumen de la pasada, que lee el panel de Google (herramientas/panel.gs)
y con el que el panel rellena la hoja «Facturas revisadas».

Uso:
  python3 herramientas/resumen_gmail.py            # del día de hoy
  python3 herramientas/resumen_gmail.py 2026-11-17 # de otro día
  python3 herramientas/resumen_gmail.py --base64   # el adjunto en base64, si la herramienta de Gmail
                                                   # no acepta la referencia de archivo

Escribe lo que hay que poner en create_draft de Gmail: para quién, asunto, texto y el adjunto.
El borrador va a la propia cuenta del negocio y no se envía nunca: es solo para que el panel lo lea.
"""
import base64, datetime, hashlib, json, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "salida"


def _num(v):
    try:
        return round(float(v), 2) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _copias(fecha):
    """Los datos copiados de las facturas que el agente dejó en salida/revision/ (por si faltan en el resumen)."""
    hay = []
    for f in sorted((SALIDA / "revision").glob(f"*{fecha}*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for x in (d if isinstance(d, list) else [d]):
            if isinstance(x, dict) and "lineas" in x:
                hay.append(x)
    return hay


def para_la_hoja(c, copias):
    """Lo que necesita la hoja de facturas: fecha, NIF, base, IVA, retención y total, tal como pone la factura."""
    f = c.get("factura") or {}
    d = f.get("datos") or next((x for x in copias if x.get("id") and x.get("id") == c.get("id")), None) \
        or next((x for x in copias if f.get("numero") and x.get("numero") == f.get("numero")
                 and (x.get("emisor") or "") == (f.get("emisor") or "")), None) or {}
    lineas = [l for l in (d.get("lineas") or []) if isinstance(l, dict)]
    bases = [_num(l.get("base")) for l in lineas]
    cuotas = [_num(l.get("cuota")) for l in lineas]
    tipos = sorted({_num(l.get("tipo_iva")) for l in lineas if _num(l.get("tipo_iva")) is not None}, reverse=True)
    cuota = _num(d.get("cuota_iva"))
    if cuota is None and cuotas and all(x is not None for x in cuotas):
        cuota = round(sum(cuotas), 2)
    # Si la factura no desglosa la cuota (o es exenta), la calcula este programa con su base y su tipo.
    if cuota is None and lineas and all(x is not None for x in bases) and all(_num(l.get("tipo_iva")) is not None for l in lineas):
        cuota = round(sum(round(b * _num(l.get("tipo_iva")) / 100, 2) for b, l in zip(bases, lineas)), 2)
    irpf, retencion = _num(d.get("tipo_irpf")), _num(d.get("retencion"))
    if retencion is None and lineas and all(x is not None for x in bases):
        retencion = round(sum(bases) * (irpf or 0) / 100, 2)
    return {
        "fecha_factura": d.get("fecha") or "",
        "nif": d.get("nif_emisor") or "",
        "base": round(sum(bases), 2) if bases and all(x is not None for x in bases) else None,
        "tipos_iva": [int(t) if float(t).is_integer() else t for t in tipos],
        "cuota_iva": cuota,
        "tipo_irpf": irpf,
        "retencion": retencion,
        "total": _num(d.get("total")) if d.get("total") not in (None, "") else _num(f.get("total_factura")),
    }


def main(argv):
    fecha = next((a for a in argv if re.fullmatch(r"\d{4}-\d{2}-\d{2}", a)), datetime.date.today().isoformat())
    origen = SALIDA / f"{fecha}.json"
    if not origen.exists():
        sys.exit(f"No hay resumen de {fecha} (falta salida/{fecha}.json). Guárdalo antes.")
    datos = json.loads(origen.read_text(encoding="utf-8"))
    cuenta = ""
    for c in datos.get("correos", []):
        m = re.search(r"authuser=([^&#\s]+@[^&#\s]+)", c.get("url") or "")
        if m:
            cuenta = m.group(1)
            break
    copias = _copias(fecha)
    # Solo lo que pinta el panel: más pequeño y sin rutas de este ordenador.
    corto = {
        "fecha": datos.get("fecha", fecha), "hora": datos.get("hora", ""), "negocio": datos.get("negocio", ""),
        "totales": datos.get("totales", {}),
        "correos": [{
            "id": c.get("id", ""), "hilo": c.get("hilo", ""), "de": c.get("de", ""), "cliente": c.get("cliente", ""),
            "asunto": c.get("asunto", ""), "tipo": c.get("tipo", ""), "estado": c.get("estado", ""),
            "resumen": c.get("resumen", ""), "borrador": bool(c.get("borrador")),
            "factura": ({**{k: v for k, v in c["factura"].items() if k not in ("archivo", "datos")},
                         **para_la_hoja(c, copias)} if c.get("factura") else None),
        } for c in datos.get("correos", [])],
    }
    destino = SALIDA / "resumen-gmail.json"
    destino.write_bytes(json.dumps(corto, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    contenido = destino.read_bytes()
    if "--base64" in argv:
        adjunto = base64.b64encode(contenido).decode()
    else:
        adjunto = f"sha256:{hashlib.sha256(contenido).hexdigest()}:{destino.resolve().as_posix()}"
    print(json.dumps({
        "to": [cuenta or "LA DIRECCIÓN DE LA CUENTA CONECTADA"],
        "subject": f"Agente · resumen {fecha}",
        "body": "Resumen interno del agente para el panel. No hace falta enviarlo ni tocarlo.",
        "attachments": [{"content": adjunto, "filename": f"resumen-{fecha}.json", "mimeType": "application/json"}],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
