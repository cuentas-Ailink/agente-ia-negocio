#!/usr/bin/env python3
"""Prepara el borrador interno con el resumen de la pasada, que lee el panel de Google (herramientas/panel.gs).

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
    # Solo lo que pinta el panel: más pequeño y sin rutas de este ordenador.
    corto = {
        "fecha": datos.get("fecha", fecha), "hora": datos.get("hora", ""), "negocio": datos.get("negocio", ""),
        "totales": datos.get("totales", {}),
        "correos": [{
            "id": c.get("id", ""), "hilo": c.get("hilo", ""), "de": c.get("de", ""), "cliente": c.get("cliente", ""),
            "asunto": c.get("asunto", ""), "tipo": c.get("tipo", ""), "estado": c.get("estado", ""),
            "resumen": c.get("resumen", ""), "borrador": bool(c.get("borrador")),
            "factura": ({k: v for k, v in (c.get("factura") or {}).items() if k != "archivo"} or None),
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
