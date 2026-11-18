#!/usr/bin/env python3
"""El panel es uno solo: el de Google (herramientas/panel.gs). Este programa guarda su dirección y lo abre.

Uso:
  python3 herramientas/panel.py --chat URL   # guarda la dirección del panel de Google (la que acaba en /exec)
  python3 herramientas/panel.py --abrir      # abre el panel de Google; si aún no está instalado, lo dice

Si en salida/ queda un panel.html de una versión antigua, lo borra: ese panel ya no existe.
"""
import re, sys, webbrowser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CHAT = RAIZ / "negocio" / "chat.txt"
VIEJO = RAIZ / "salida" / "panel.html"


def chat(argv):
    """La dirección del panel: la de --chat (y se guarda) o la guardada antes."""
    if "--chat" in argv:
        i = argv.index("--chat")
        url = argv[i + 1].strip() if i + 1 < len(argv) else ""
        url = re.split(r"[?#]", url)[0]  # si se copia con ?hilo=… desde la barra del navegador
        if not re.fullmatch(r"https://script\.google\.com/[^\s\"'<>]+/exec", url):
            sys.exit("La dirección del panel tiene que ser la de tu script de Google y acabar en /exec "
                     "(«Implementar» → «Gestionar implementaciones» → copiar la URL de la aplicación web).")
        CHAT.parent.mkdir(exist_ok=True)
        CHAT.write_text(url + "\n", encoding="utf-8")
        print("Panel de Google guardado.")
        return url
    if CHAT.exists():
        return CHAT.read_text(encoding="utf-8").strip() or None
    return None


def main(argv):
    if VIEJO.exists():
        VIEJO.unlink()
    url = chat(argv)
    if "--abrir" in argv or "--chat" in argv:
        if url:
            webbrowser.open(url)
            print("Panel de Google abierto.")
        else:
            print("Aún no hay panel instalado. Es el paso 4 de «empezamos»: se instala una vez en la "
                  "cuenta de Google del negocio y después se abre aquí, en el móvil y en el ordenador.")


if __name__ == "__main__":
    main(sys.argv[1:])
