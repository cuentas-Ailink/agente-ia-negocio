#!/usr/bin/env python3
"""Dice en qué punto de la puesta en marcha está el agente. Uso: python3 herramientas/estado.py

Lo usa la skill «empezar»: cada paso sale como «Hecho» o «Falta», con lo que hay que hacer.
Lo que solo se puede comprobar desde la app de Claude (Gmail conectado, la tarea de cada mañana)
lo comprueba Claude, no este programa.
"""
import json, re, subprocess, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def leer(ruta):
    p = RAIZ / ruta
    return p.read_text(encoding="utf-8") if p.exists() else None


def negocio():
    texto = leer("negocio/negocio.md")
    if texto is None:
        return "falta", "Aún no hay negocio. Dime a qué se dedica en una frase y lo preparo."
    m = re.search(r"^# .*?·\s*(.+)$", texto, re.M)
    nombre = m.group(1).strip() if m else "tu negocio"
    if "{{" in texto:
        return "falta", f"{nombre}: quedan datos por rellenar."
    if "<!-- ejemplo" in texto.lower():
        return "ejemplo", f"{nombre} (el negocio de ejemplo). Falta elegir: probar con él o adaptarlo al tuyo."
    return "hecho", nombre


def comprobar():
    r = subprocess.run([sys.executable, str(RAIZ / "herramientas" / "comprobar.py")], capture_output=True, text=True)
    return "Sin errores" in r.stdout


def pasadas():
    dias = sorted(p for p in (RAIZ / "salida").glob("*.json") if re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", p.name))
    if not dias:
        return "falta", "Aún no se ha hecho ninguna pasada."
    try:
        d = json.loads(dias[-1].read_text(encoding="utf-8"))
        t = d.get("totales", {})
        return "hecho", (f"Última: {dias[-1].stem}{' a las ' + d['hora'] if d.get('hora') else ''} · "
                         f"{t.get('procesados', len(d.get('correos', [])))} correos, {t.get('borradores', 0)} borradores.")
    except Exception:
        return "hecho", f"Última: {dias[-1].stem}."


def chat():
    url = (leer("negocio/chat.txt") or "").strip()
    return ("hecho", "Instalado en tu cuenta de Google.") if url else ("falta", "Te lo instalo yo y te lo abro; tú solo pulsas «Permitir» en Google. El resumen del día y enviar con un clic.")


def rutina():
    hora = (leer("negocio/rutina.txt") or "").strip()
    return ("hecho", f"Cada día a las {hora}, con la app de Claude abierta.") if hora else ("falta", "Se crea en la app de Claude (o te la creo yo).")


def main():
    viejo = RAIZ / "salida" / "panel.html"  # el panel de archivo de versiones antiguas: ya no existe
    if viejo.exists():
        viejo.unlink()
    pasos = [
        ("Tu negocio", *negocio()),
        ("Gmail conectado", "claude", "Lo compruebo yo desde la app."),
        ("Primera pasada", *pasadas()),
        ("Tu panel", *chat()),
        ("Cada mañana, solo", *rutina()),
    ]
    marca = {"hecho": "\033[32mHecho\033[0m  ", "ejemplo": "\033[33mEjemplo\033[0m", "falta": "\033[33mFalta\033[0m  ", "claude": "·      "}
    for i, (nombre, estado, detalle) in enumerate(pasos, 1):
        print(f"{i}. {marca[estado]} {nombre}: {detalle}")
    print()
    print("Todo bien montado." if comprobar() else "Hay algo mal montado: ejecuta python3 herramientas/comprobar.py.")


if __name__ == "__main__":
    main()
