#!/usr/bin/env python3
"""El panel del correo en el ordenador, sin instalar nada: salida/panel.html.

Es el mismo panel que el de Google (herramientas/panel.gs), con el mismo diseño, pintado con lo que deja el agente
en cada pasada (salida/AAAA-MM-DD.json). Desde aquí no se envía: cada respuesta se abre en Gmail, ya escrita, y la
envías tú. Si además has instalado el panel de Google (para el móvil, enviar con un clic y WhatsApp), «--abrir»
abre ese.

Uso:
  python3 herramientas/panel.py             # crea o actualiza salida/panel.html
  python3 herramientas/panel.py --abrir     # y lo abre (o el de Google, si está instalado)
  python3 herramientas/panel.py --local     # abre el del ordenador aunque esté el de Google
  python3 herramientas/panel.py --chat URL  # guarda la dirección del panel de Google (la que acaba en /exec)
"""
import base64, csv, json, re, sys, webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resumen_gmail import _copias, para_la_hoja  # noqa: E402  (los mismos datos que la hoja de Google)

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "salida"
CHAT = RAIZ / "negocio" / "chat.txt"
GS = RAIZ / "herramientas" / "panel.gs"
DIAS_EN_PANEL = 14


def chat(argv):
    """La dirección del panel de Google: la de --chat (y se guarda) o la guardada antes."""
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


def negocio():
    md = RAIZ / "negocio" / "negocio.md"
    if md.exists():
        for linea in md.read_text(encoding="utf-8").splitlines():
            if linea.startswith("# "):
                return linea[2:].split("·")[-1].strip()
    return ""


def logo():
    for ext, tipo in (("png", "png"), ("jpg", "jpeg"), ("jpeg", "jpeg"), ("webp", "webp")):
        f = RAIZ / "negocio" / f"logo.{ext}"
        if f.exists() and f.stat().st_size < 90_000:
            return f"data:image/{tipo};base64," + base64.b64encode(f.read_bytes()).decode()
    return ""


def cargar_dias():
    dias = {}
    for f in sorted(SALIDA.glob("*.json"), reverse=True):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", f.name) or len(dias) >= DIAS_EN_PANEL:
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Aviso: no puedo leer {f.name} ({e}); lo salto.")
            continue
        copias = _copias(f.stem)
        for c in d.get("correos", []):
            if c.get("factura"):
                fac = {**c["factura"], **para_la_hoja(c, copias)}
                arch = fac.get("archivo") or ""
                fac["archivo"] = arch[len("salida/"):] if arch.startswith("salida/") else arch
                fac.pop("datos", None)
                c["factura"] = fac
        d["fecha"] = d.get("fecha") or f.stem
        dias[f.stem] = d
    return dias


def nombre_de(de):
    m = re.match(r'^\s*"?([^"<]+?)"?\s*<', de or "")
    return m.group(1).strip() if m else (de or "").strip()


def bandeja_e_hilos(dias):
    """Lo que el panel de Google lee de Gmail, sacado de los resúmenes: la lista y cada conversación."""
    convs, hilos = [], {}
    for fecha in sorted(dias, reverse=True):
        d = dias[fecha]
        for c in d.get("correos", []):
            hid = str(c.get("hilo") or c.get("id") or "")
            if not hid or hid in hilos:
                continue
            cuando = c.get("fecha") or f"{fecha}T{(d.get('hora') or '08:00')}:00"
            estado = c.get("estado") or ""
            b = c.get("borrador") if isinstance(c.get("borrador"), dict) else ({} if c.get("borrador") else None)
            wa = re.search(r"\+wa(\d{6,15})@", c.get("de") or "")
            nombre = nombre_de(c.get("de")) or c.get("cliente") or ""
            convs.append({
                "id": hid, "nombre": nombre, "asunto": c.get("asunto") or "(sin asunto)", "fecha": cuando,
                "extracto": (c.get("mensaje") or c.get("resumen") or "")[:140].replace("\n", " "),
                "ultimoMio": False, "noEntregado": False, "tipo": c.get("tipo") or "",
                "revisar": estado == "revisar", "sospechoso": estado == "sospechoso",
                "borrador": b is not None, "whatsapp": bool(wa),
            })
            adj = [Path(c["factura"]["archivo"]).name] if c.get("factura") and c["factura"].get("archivo") else []
            hilos[hid] = {
                "id": hid, "whatsapp": None, "asunto": c.get("asunto") or "(sin asunto)", "nombre": nombre,
                "para": ("WhatsApp +" + wa.group(1)) if wa else (c.get("de") or ""),
                "gmail": c.get("url") or "https://mail.google.com/",
                "tipo": c.get("tipo") or "", "revisar": estado == "revisar", "sospechoso": estado == "sospechoso",
                "mensajes": [{"mio": False, "nombre": nombre, "fecha": cuando,
                              "texto": c.get("mensaje") or c.get("resumen") or "", "adjuntos": adj}],
                "borrador": None if b is None else {"texto": b.get("texto") or "", "url": b.get("url") or c.get("url") or ""},
            }
    convs.sort(key=lambda x: x["fecha"], reverse=True)
    return convs, hilos


def csv_facturas(dias):
    """Todas las facturas en salida/facturas.csv, para abrirlo en Excel o Numbers."""
    filas = []
    for fecha in sorted(dias, reverse=True):
        for c in dias[fecha].get("correos", []):
            f = c.get("factura")
            if not f:
                continue
            filas.append([f.get("fecha_factura") or "", f.get("numero") or "", f.get("emisor") or "", f.get("nif") or "",
                          c.get("cliente") or "", f.get("base"), ", ".join(f"{t:g} %" for t in f.get("tipos_iva") or []),
                          f.get("cuota_iva"), f.get("retencion"), f.get("total_factura"),
                          {"correcta": "Correcta", "error": "Con error"}.get(f.get("estado"), "Revisar"),
                          " ".join(f.get("motivos") or []), fecha])
    num = lambda v: "" if v is None else f"{v:.2f}".replace(".", ",")
    destino = SALIDA / "facturas.csv"
    with destino.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(["Fecha factura", "N.º factura", "Proveedor", "NIF proveedor", "Cliente", "Base imponible", "IVA",
                    "Cuota IVA", "Retención IRPF", "Total factura", "Estado", "Observaciones", "Revisada"])
        for r in filas:
            w.writerow([num(x) if isinstance(x, (int, float)) else x for x in r])
    return len(filas)


def pagina(datos):
    t = GS.read_text(encoding="utf-8")
    ini = t.index("const PAGINA = String.raw`") + len("const PAGINA = String.raw`")
    html = t[ini:t.index("</html>`", ini) + len("</html>")]
    stub = """<script>
window.PANEL_LOCAL = true;
var DATOS = __DATOS__;
(function(){
  var copia = function(o){ return JSON.parse(JSON.stringify(o)); };
  var guardado = function(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
  var marca = guardado('marca') || DATOS.marca;
  var srv = {
    datosBandeja: function(){ return { conversaciones: copia(DATOS.bandeja) }; },
    datosResumenes: function(){ return { dias: copia(DATOS.dias), hechos: guardado('hechos') || [], marca: marca, hoja: DATOS.hoja }; },
    datosHilo: function(id){ if (!DATOS.hilos[id]) throw new Error('No encuentro esta conversación en el resumen.'); return copia(DATOS.hilos[id]); },
    marcarHecho: function(id, si){ var l = (guardado('hechos') || []).filter(function(x){ return x !== id; }); if (si) l.push(id); guardado('hechos', l); return { hechos: l }; },
    guardarMarca: function(n, l){ marca = { nombre: String(n || '').trim(), logo: l || '' }; guardado('marca', marca); return marca; },
    sincronizarHoja: function(){ return { url: DATOS.hoja }; },
    versionPanel: function(){ return { mia: '', nueva: '' }; },
    datosWhatsApp: function(){ throw new Error('WhatsApp va con el panel de Google.'); }
  };
  function corredor(){
    var ok = function(){}, mal = function(){};
    var r = { withSuccessHandler: function(f){ ok = f; return r; }, withFailureHandler: function(f){ mal = f; return r; } };
    Object.keys(srv).forEach(function(fn){ r[fn] = function(){ var a = arguments; setTimeout(function(){ try { ok(srv[fn].apply(null, a)); } catch (e) { mal(e); } }, 0); }; });
    return r;
  }
  window.google = { script: { get run(){ return corredor(); }, url: { getLocation: function(cb){ cb({ parameter: {} }); } }, history: { push: function(){}, setChangeHandler: function(){} } } };
})();
</script>
"""
    js = json.dumps(datos, ensure_ascii=False).replace("</", "<\\/")
    marcador = "<script>\nvar $ ="
    assert html.count(marcador) == 1, "No encuentro dónde empieza el código del panel en panel.gs"
    return html.replace(marcador, stub.replace("__DATOS__", js) + marcador)


def main(argv):
    url = chat(argv)
    SALIDA.mkdir(exist_ok=True)
    dias = cargar_dias()
    convs, hilos = bandeja_e_hilos(dias)
    n = csv_facturas(dias)
    datos = {"dias": dias, "bandeja": convs, "hilos": hilos, "hoja": "facturas.csv" if n else "",
             "marca": {"nombre": negocio(), "logo": logo()}}
    destino = SALIDA / "panel.html"
    destino.write_text(pagina(datos), encoding="utf-8")
    print(f"Panel actualizado: salida/panel.html ({len(dias)} día{'s' if len(dias) != 1 else ''}, "
          f"{len(convs)} correos, {n} facturas)")
    if "--abrir" in argv:
        if url and "--local" not in argv:
            webbrowser.open(url)
            print("Abierto el panel de Google.")
        else:
            webbrowser.open(destino.as_uri())


if __name__ == "__main__":
    main(sys.argv[1:])
