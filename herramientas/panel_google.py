#!/usr/bin/env python3
"""Crea, sube y publica el panel (herramientas/panel.gs) en la cuenta de Google del negocio, sin copiar ni pegar.

Lo hace con clasp, la herramienta oficial de Google para Apps Script (se descarga sola con npx; hace falta Node.js).

Uso:
  python3 herramientas/panel_google.py instalar     # la primera vez: inicia sesión, crea el panel y lo publica
  python3 herramientas/panel_google.py actualizar   # sube la versión nueva de panel.gs; la dirección no cambia
  python3 herramientas/panel_google.py whatsapp     # publica la dirección pública que necesita WhatsApp

La persona solo hace dos cosas, una vez: activar «API de Google Apps Script» en
https://script.google.com/home/usersettings y pulsar «Permitir» con la cuenta del negocio.
Las credenciales de clasp se guardan en .herramientas/clasp/ (no se suben a ningún sitio).

Junto a panel.gs sube instalacion.gs, con el nombre del negocio (sale en el panel desde el primer momento) y la
dirección pública de WhatsApp (el panel la guarda sola al conectar WhatsApp: no hay que pegar nada).
El panel se publica para «Cualquier usuario con una cuenta de Google»: así, quien lo abre con otra cuenta ve una
página clara que dice con qué cuenta abrirlo, en vez de un error de Google. Leer y enviar sigue siendo solo de la
cuenta del negocio (cada función del panel lo comprueba).
"""
import json, re, shutil, subprocess, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GS = RAIZ / "herramientas" / "panel.gs"
TRABAJO = RAIZ / ".herramientas" / "panel"          # la copia que se sube a Google
AUTH = RAIZ / ".herramientas" / "clasp"             # el inicio de sesión de clasp
DATOS = RAIZ / "negocio" / "panel.json"             # identificadores del proyecto y de sus publicaciones
CHAT = RAIZ / "negocio" / "chat.txt"                # la dirección del panel (la lee panel.py)
NEGOCIO = RAIZ / "negocio" / "negocio.md"
CLASP = ["npx", "-y", "@google/clasp@3.4.1", "-A", str(AUTH / ".clasprc.json")]
AJUSTES = "https://script.google.com/home/usersettings"
ACCESO_PANEL = "ANYONE"  # cualquier cuenta de Google; el propio panel solo deja entrar a la del negocio


def manifiesto(acceso):
    return {
        "timeZone": "Europe/Madrid",
        "runtimeVersion": "V8",
        "exceptionLogging": "STACKDRIVER",
        "dependencies": {"enabledAdvancedServices": [{"userSymbol": "Gmail", "serviceId": "gmail", "version": "v1"}]},
        "webapp": {"executeAs": "USER_DEPLOYING", "access": acceso},
    }


def clasp(*args, interactivo=False):
    cmd = CLASP + list(args)
    TRABAJO.mkdir(parents=True, exist_ok=True)
    if interactivo:
        return subprocess.run(cmd, cwd=TRABAJO).returncode, ""
    r = subprocess.run(cmd, cwd=TRABAJO, capture_output=True, text=True)
    salida = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        if re.search(r"Apps Script API|usersettings", salida, re.I):
            sys.exit("Falta un interruptor, una sola vez: abre " + AJUSTES + " con la cuenta del negocio, activa "
                     "«API de Google Apps Script» y vuelve a pedírmelo.")
        sys.exit("Google ha dicho que no:\n" + salida.strip()[-800:])
    return r.returncode, salida


def datos():
    try:
        return json.loads(DATOS.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def guardar(d):
    DATOS.parent.mkdir(exist_ok=True)
    DATOS.write_text(json.dumps(d, indent=2) + "\n", encoding="utf-8")


def comprobar_node():
    if not shutil.which("npx"):
        sys.exit("Falta Node.js. Instálalo desde https://nodejs.org/es/download (el instalador para Mac: siguiente, "
                 "siguiente) y vuelve a pedírmelo.")


def iniciar_sesion():
    if (AUTH / ".clasprc.json").exists():
        return
    AUTH.mkdir(parents=True, exist_ok=True)
    print("Se abre el navegador: elige la cuenta de Google del negocio y pulsa «Permitir».", flush=True)
    codigo, _ = clasp("login", interactivo=True)
    if codigo != 0 or not (AUTH / ".clasprc.json").exists():
        sys.exit("No se ha completado el inicio de sesión. Vuelve a pedírmelo y, en el navegador, pulsa «Permitir».")


def nombre_negocio():
    try:
        m = re.search(r"^# .*?·\s*(.+)$", NEGOCIO.read_text(encoding="utf-8"), re.M)
        return m.group(1).strip() if m and "{{" not in m.group(1) else ""
    except OSError:
        return ""


def preparar_copia(acceso):
    TRABAJO.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(GS, TRABAJO / "panel.gs")
    d = datos()
    inst = {"negocio": nombre_negocio(), "whatsapp": url(d["whatsapp"]) if d.get("whatsapp") else ""}
    (TRABAJO / "instalacion.gs").write_text(
        "// Lo escribe herramientas/panel_google.py al instalar o actualizar el panel. No lo cambies a mano.\n"
        "const INSTALACION = " + json.dumps(inst, ensure_ascii=False) + ";\n", encoding="utf-8")
    (TRABAJO / "appsscript.json").write_text(json.dumps(manifiesto(acceso), indent=2) + "\n", encoding="utf-8")


def subir(acceso):
    preparar_copia(acceso)
    clasp("push", "--force")


def publicar(id_actual, descripcion):
    if id_actual:
        clasp("update-deployment", id_actual, "-d", descripcion)
        return id_actual
    _, salida = clasp("create-deployment", "-d", descripcion)
    m = re.findall(r"AKfyc[\w-]{20,}", salida)
    if not m:
        sys.exit("No encuentro la dirección de la publicación en la respuesta de Google:\n" + salida[-600:])
    return m[-1]


def url(dep):
    return f"https://script.google.com/macros/s/{dep}/exec"


def instalar():
    comprobar_node()
    iniciar_sesion()
    d = datos()
    TRABAJO.mkdir(parents=True, exist_ok=True)
    if not (TRABAJO / ".clasp.json").exists():
        if d.get("script"):
            (TRABAJO / ".clasp.json").write_text(json.dumps({"scriptId": d["script"], "rootDir": "."}) + "\n", encoding="utf-8")
        else:
            clasp("create-script", "--type", "standalone", "--title", "Panel del correo", "--rootDir", ".")
            d["script"] = json.loads((TRABAJO / ".clasp.json").read_text(encoding="utf-8"))["scriptId"]
            guardar(d)
    actualizar(d, primera=not d.get("panel"))


def actualizar(d=None, primera=False):
    comprobar_node()
    d = d or datos()
    if not d.get("script"):
        sys.exit("El panel aún no está creado desde aquí. Pídeme «instala el panel».")
    if not (TRABAJO / ".clasp.json").exists():
        TRABAJO.mkdir(parents=True, exist_ok=True)
        (TRABAJO / ".clasp.json").write_text(json.dumps({"scriptId": d["script"], "rootDir": "."}) + "\n", encoding="utf-8")
    iniciar_sesion()
    version = re.search(r"const VERSION_PANEL = '([\d.-]+)'", GS.read_text(encoding="utf-8")).group(1)
    if d.get("whatsapp"):  # la dirección pública de WhatsApp lleva su propio acceso: se publica aparte
        subir("ANYONE_ANONYMOUS")
        publicar(d["whatsapp"], f"WhatsApp {version}")
    subir(ACCESO_PANEL)
    d["panel"] = publicar(d.get("panel"), f"Panel {version}")
    guardar(d)
    CHAT.write_text(url(d["panel"]) + "\n", encoding="utf-8")
    print(("Panel publicado" if primera else f"Panel actualizado a la versión {version}") + ": " + url(d["panel"]))
    if primera:
        print("La primera vez que lo abras, Google pide permiso: «Revisar permisos» → la cuenta del negocio → "
              "«Configuración avanzada» → «Ir a Panel del correo» → «Permitir». Es tu propio panel.")


def whatsapp():
    d = datos()
    if not d.get("panel"):
        sys.exit("Primero el panel: pídeme «instala el panel».")
    comprobar_node()
    iniciar_sesion()
    if not d.get("whatsapp"):  # se crea la dirección pública y después se publica todo con ella dentro
        subir("ANYONE_ANONYMOUS")
        d["whatsapp"] = publicar(None, "WhatsApp")
        guardar(d)
    actualizar(d)
    print("WhatsApp listo para conectar: en el panel, pulsa el nombre del negocio → WhatsApp → «Conectar». "
          "La dirección ya está puesta; no hay que pegar nada.")


if __name__ == "__main__":
    orden = sys.argv[1] if len(sys.argv) > 1 else ""
    {"instalar": instalar, "actualizar": actualizar, "whatsapp": whatsapp}.get(
        orden, lambda: sys.exit(__doc__))()
