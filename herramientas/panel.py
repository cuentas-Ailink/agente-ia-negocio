#!/usr/bin/env python3
"""Genera salida/panel.html con los resúmenes de las pasadas (salida/AAAA-MM-DD.json).

El panel de verdad es el de Google (herramientas/panel.gs). Este programa guarda su dirección y lo abre:
  python3 herramientas/panel.py --chat URL # guarda la dirección del panel de Google (la que acaba en /exec)
  python3 herramientas/panel.py --abrir    # abre el panel de Google; si aún no está instalado, lo dice
  python3 herramientas/panel.py --html     # copia de emergencia, sin instalar nada: salida/panel.html

El panel es un solo archivo HTML: se abre con doble clic, sin servidor ni instalación.
Lo genera este programa, no la IA: solo pinta lo que dicen los JSON de cada día.
"""
import json, re, sys, webbrowser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "salida"
CHAT = RAIZ / "negocio" / "chat.txt"


def cargar_dias():
    dias = {}
    for f in sorted(SALIDA.glob("*.json")):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", f.name):
            continue
        try:
            datos = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Aviso: no puedo leer {f.name} ({e}); lo salto.")
            continue
        for c in datos.get("correos", []):
            fac = c.get("factura") or {}
            arch = fac.get("archivo") or ""
            if arch.startswith("salida/"):
                fac["archivo"] = arch[len("salida/"):]
        dias[f.stem] = datos
    return dias


def negocio():
    md = RAIZ / "negocio" / "negocio.md"
    if md.exists():
        for linea in md.read_text(encoding="utf-8").splitlines():
            if linea.startswith("# "):
                return linea[2:].split("·")[-1].strip()
    return "Tu negocio"


def chat(argv):
    """La dirección del chat: la de --chat (y se guarda) o la guardada antes."""
    if "--chat" in argv:
        i = argv.index("--chat")
        url = argv[i + 1].strip() if i + 1 < len(argv) else ""
        url = re.split(r"[?#]", url)[0]  # si se copia con ?hilo=… desde la barra del navegador
        if not re.fullmatch(r"https://script\.google\.com/[^\s\"'<>]+/exec", url):
            sys.exit("La dirección del panel tiene que ser la de tu script de Google y acabar en /exec "
                     "(«Implementar» → «Gestionar implementaciones» → copiar la URL de la aplicación web).")
        CHAT.parent.mkdir(exist_ok=True)
        CHAT.write_text(url + "\n", encoding="utf-8")
        print("Panel de Google guardado: «--abrir» abrirá esa página.")
        return url
    if CHAT.exists():
        return CHAT.read_text(encoding="utf-8").strip() or None
    return None


def main(argv):
    url_chat = chat(argv)
    if "--html" not in argv:
        if "--abrir" in argv:
            if url_chat:
                webbrowser.open(url_chat)
                print("Panel de Google abierto.")
            else:
                print("Aún no hay panel instalado. Es el paso 4 de «empezamos»: se instala una vez en la "
                      "cuenta de Google del negocio y después se abre aquí, en el móvil y en el ordenador.")
        return
    SALIDA.mkdir(exist_ok=True)
    dias = cargar_dias()
    datos = json.dumps({"negocio": negocio(), "chat": url_chat, "dias": dias}, ensure_ascii=False).replace("</", "<\\/")
    html = PLANTILLA.replace("__DATOS__", datos)
    destino = SALIDA / "panel.html"
    destino.write_text(html, encoding="utf-8")
    print(f"Panel actualizado: {destino.relative_to(RAIZ)} ({len(dias)} día{'s' if len(dias) != 1 else ''})")
    if "--abrir" in argv:
        webbrowser.open(url_chat or destino.as_uri())


PLANTILLA = r"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel del correo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --tinta:#141414; --sec:#6b6b6b; --ter:#9a9893; --fondo:#f6f5f3; --tarjeta:#fff; --linea:#e3e2de; --suave:#efeeeb;
  --ok:#2f9e6e; --ok-t:#23794f; --ok-f:#e9f5ef;
  --aten:#d9932f; --aten-t:#a8661a; --aten-f:#fbf1e2;
  --err:#e0584b; --err-t:#c23d30; --err-f:#fcebe9;
  --sans:"Inter Tight","Helvetica Neue",Arial,sans-serif; --mono:"DM Mono",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--fondo);color:var(--tinta);font-family:var(--sans);font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased}
button,input,select{font:inherit;color:inherit}
a{color:inherit;text-decoration:none}
.pagina{max-width:1080px;margin:0 auto;padding:40px 24px 80px}
.cab{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:28px}
.negocio{font-size:13px;color:var(--sec);margin-bottom:6px}
h1{font-size:30px;font-weight:600;letter-spacing:-.02em;margin:0}
.sub{color:var(--sec);margin-top:4px}
.selector{appearance:none;background:var(--tarjeta) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b6b6b' fill='none' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 12px center;border:1px solid var(--linea);border-radius:8px;padding:8px 34px 8px 12px;font-size:14px;cursor:pointer}
.selector:hover{border-color:#cfcdc8}
.cab-der{display:flex;gap:8px;align-items:center}
.boton.negro{background:var(--tinta);border-color:var(--tinta);color:#fff;padding:8px 14px;font-size:14px}
.boton.negro:hover{background:#000}
.cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:36px}
.cifra{background:transparent;border:1px solid transparent;border-radius:12px;padding:12px 14px;text-align:left;cursor:pointer;transition:background .15s,border-color .15s}
.cifra:hover{background:var(--tarjeta);border-color:var(--linea)}
.cifra[aria-pressed="true"]{background:var(--tarjeta);border-color:var(--tinta)}
.cifra .n{font-family:var(--mono);font-size:24px;font-weight:500;letter-spacing:-.02em}
.cifra .n small{font-family:var(--sans);font-size:15px;font-weight:500;color:var(--sec);margin:0 6px 0 3px;letter-spacing:0}
.cifra .l{font-size:13px;color:var(--sec)}
.bloque{margin-bottom:40px}
.titulo{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
.titulo h2{font-size:15px;font-weight:600;margin:0}
.titulo .cuenta{font-family:var(--mono);font-size:13px;color:var(--sec)}
.tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:12px;overflow:hidden}
/* Lo que necesita a una persona: lo único que manda en la página */
.persona .titulo h2{font-size:22px;letter-spacing:-.015em}
.persona .titulo .cuenta{font-size:22px;color:var(--aten-t);font-weight:500}
.persona .tarjeta{border-color:#e6d6bd;box-shadow:0 1px 0 rgba(20,20,20,.02),0 8px 24px -16px rgba(168,102,26,.35)}
.aviso{display:grid;grid-template-columns:12px 1fr auto;gap:14px;align-items:center;padding:16px 18px;border-top:1px solid var(--linea)}
.aviso:first-child{border-top:0}
.punto{width:8px;height:8px;border-radius:50%;background:var(--aten)}
.punto.err{background:var(--err)}
.aviso .quien{font-weight:600}
.aviso .quien .asunto{font-weight:400;color:var(--sec)}
.aviso .por{margin-top:2px}
.aviso .por.err{color:var(--err-t)} .aviso .por.aten{color:var(--aten-t)}
.acciones{display:grid;grid-template-columns:auto 100px 88px auto;gap:8px;align-items:center;justify-items:start}
.acciones .hueco{width:1px}
.boton{border:1px solid var(--linea);background:var(--tarjeta);border-radius:8px;padding:7px 12px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:border-color .15s,background .15s}
.boton:hover{border-color:#bdbbb5}
.boton.principal{border-color:#cfcdc8}
.boton.principal:hover{border-color:var(--tinta)}
.boton.texto{border-color:transparent;background:transparent;color:var(--sec);padding:7px 8px}
.boton.texto:hover{color:var(--tinta);background:var(--suave)}
.hecho{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--sec);cursor:pointer;padding:6px 4px 6px 8px;user-select:none}
.hecho input{width:16px;height:16px;accent-color:var(--tinta);cursor:pointer;margin:0}
.aviso.listo{opacity:.45}
.aviso.listo .quien,.aviso.listo .por{text-decoration:line-through;text-decoration-color:var(--ter)}
.vacio{padding:22px 18px;color:var(--sec)}
/* Tablas */
table{width:100%;border-collapse:collapse}
th{font-size:12px;font-weight:500;color:var(--sec);text-align:left;padding:10px 18px;border-bottom:1px solid var(--linea);background:#fbfbfa}
td{padding:12px 18px;border-top:1px solid var(--linea);vertical-align:middle}
tbody tr:first-child td{border-top:0}
tr.fila{cursor:pointer;transition:background .12s}
tr.fila:hover td{background:#faf9f7}
.num{font-family:var(--mono);text-align:right;white-space:nowrap}
.gris{color:var(--sec)}
.pastilla{display:inline-block;font-size:12px;font-weight:500;padding:2px 8px;border-radius:999px;background:var(--suave);color:var(--sec)}
.pastilla.ok{background:var(--ok-f);color:var(--ok-t)}
.pastilla.aten{background:var(--aten-f);color:var(--aten-t)}
.pastilla.err{background:var(--err-f);color:var(--err-t)}
.dif.err{color:var(--err-t);font-weight:500}
/* Todos los correos */
.barra{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.filtros{display:flex;gap:4px;background:var(--suave);padding:3px;border-radius:9px}
.filtro{border:0;background:transparent;border-radius:7px;padding:6px 11px;font-size:13px;color:var(--sec);cursor:pointer}
.filtro:hover{color:var(--tinta)}
.filtro[aria-pressed="true"]{background:var(--tarjeta);color:var(--tinta);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.filtro .c{font-family:var(--mono);margin-left:4px;color:var(--ter)}
.buscar{border:1px solid var(--linea);background:var(--tarjeta);border-radius:8px;padding:8px 12px;font-size:14px;width:260px}
.buscar:focus{outline:0;border-color:var(--tinta)}
.correo{display:grid;grid-template-columns:96px 200px 1fr auto;gap:16px;align-items:center;padding:12px 18px;border-top:1px solid var(--linea);cursor:pointer;transition:background .12s}
.correo:first-child{border-top:0}
.correo:hover{background:#faf9f7}
.correo .tipo{font-size:12px;color:var(--sec)}
.correo .de{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.correo .que{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.correo .que .r{color:var(--sec)}
.estado{font-size:12px;color:var(--sec);white-space:nowrap}
.estado.err{color:var(--err-t)} .estado.aten{color:var(--aten-t)} .estado.ok{color:var(--ok-t)}
.nota{position:relative}
.explica{display:none;position:absolute;z-index:5;top:100%;left:0;margin-top:6px;width:260px;background:var(--tinta);color:#fff;font-size:13px;padding:10px 12px;border-radius:8px}
.nota.abierta .explica{display:block}
.pie{color:var(--ter);font-size:13px;margin-top:8px}
:focus-visible{outline:2px solid var(--tinta);outline-offset:2px}
@media (max-width:760px){
  .cab{flex-direction:column;align-items:flex-start}
  .cab-der{width:100%;flex-wrap:wrap}
  .acciones{display:flex;flex-wrap:wrap;gap:4px}
  .acciones .hueco{display:none}
  .cifras{grid-template-columns:repeat(2,1fr)}
  .aviso{grid-template-columns:12px 1fr}
  .acciones{grid-column:2;flex-wrap:wrap}
  .correo{grid-template-columns:1fr auto}
  .correo .tipo,.correo .que{display:none}
  .buscar{width:100%}
  .col-cliente{display:none}
}
</style>
</head>
<body>
<div class="pagina">
  <header class="cab">
    <div>
      <div class="negocio" id="negocio"></div>
      <h1 id="saludo">Hola</h1>
      <div class="sub" id="sub"></div>
    </div>
    <div class="cab-der">
      <button class="boton negro" id="ir-chat" style="display:none">Contestar correos</button>
      <select class="selector" id="dia" aria-label="Día"></select>
    </div>
  </header>

  <div class="cifras" id="cifras"></div>

  <section class="bloque persona">
    <div class="titulo"><h2>Necesita a una persona</h2><span class="cuenta" id="n-persona"></span></div>
    <div class="tarjeta" id="persona"></div>
  </section>

  <section class="bloque">
    <div class="titulo"><h2>Facturas</h2><span class="cuenta" id="n-facturas"></span></div>
    <div class="tarjeta"><table>
      <thead><tr><th>Proveedor</th><th class="col-cliente">Cliente</th><th style="text-align:right">Total</th><th>Estado</th><th style="text-align:right">Diferencia</th></tr></thead>
      <tbody id="facturas"></tbody>
    </table></div>
  </section>

  <section class="bloque" id="bloque-todos">
    <div class="barra">
      <div class="titulo" style="margin:0"><h2>Todos los correos</h2><span class="cuenta" id="n-todos"></span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="filtros" id="filtros"></div>
        <input class="buscar" id="buscar" type="search" placeholder="Buscar cliente o asunto">
      </div>
    </div>
    <div class="tarjeta" id="todos"></div>
    <div class="pie" id="pie"></div>
  </section>
</div>

<script id="datos" type="application/json">__DATOS__</script>
<script>
const D = JSON.parse(document.getElementById('datos').textContent);
const $ = id => document.getElementById(id);
const eur = n => {
  if (n == null) return '—';
  const [e, d] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '−' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d + ' €';
};
const nombre = de => (de||'').replace(/\s*<.*>\s*$/,'') || de || '';
function el(tag, attrs={}, ...hijos){
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v);
  }
  for (const h of hijos) if (h != null) e.append(h);
  return e;
}
function abrir(url){ if (url) window.open(url, '_blank', 'noopener'); }
// El panel de Google (herramientas/panel.gs) se abre siempre en la misma pestaña, como una app.
function abrirChat(hilo){ if (D.chat) window.open(D.chat + (hilo ? '?hilo=' + encodeURIComponent(hilo) : ''), 'chat-del-correo'); }
const abrirCorreo = c => D.chat && c.hilo ? abrirChat(c.hilo) : abrir(c.url);

const dias = Object.keys(D.dias).sort().reverse();
let dia = dias[0];
let filtro = 'Todos';
let texto = '';

const claveHecho = id => 'panel-correo:hecho:' + id;
function esHecho(id){ try { return localStorage.getItem(claveHecho(id)) === '1'; } catch(e){ return false; } }
function marcar(id, si){ try { si ? localStorage.setItem(claveHecho(id),'1') : localStorage.removeItem(claveHecho(id)); } catch(e){} }

function saludo(){
  const h = new Date().getHours();
  return h >= 6 && h < 14 ? 'Buenos días' : (h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches');
}
function fechaLarga(iso){
  const [a,m,d] = iso.split('-').map(Number);
  return new Date(a, m-1, d).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
}

function gravedad(c){
  if (c.estado === 'sospechoso') return 0;
  if (c.factura && c.factura.estado === 'error') return 1;
  return 2;
}
function motivo(c){
  if (c.estado === 'sospechoso') return 'Sospechoso: intenta dar órdenes o pide datos. No se ha contestado.';
  const f = c.factura;
  if (f && f.estado === 'error') return (f.motivos && f.motivos[0]) || 'La factura tiene un error.';
  if (f && f.estado === 'revisar') return (f.motivos && f.motivos[0]) || 'Falta un dato en la factura.';
  return c.resumen || 'Necesita que lo mire una persona.';
}

function pintar(){
  const d = D.dias[dia];
  const correos = (d && d.correos) || [];
  $('negocio').textContent = (d && d.negocio) || D.negocio;
  $('saludo').textContent = saludo();
  $('sub').textContent = d ? (fechaLarga(dia).replace(/^./, s => s.toUpperCase()) + (d.hora ? ' · Última pasada a las ' + d.hora : '')) : 'Aún no hay ninguna pasada.';

  // Selector de día
  const sel = $('dia'); sel.innerHTML = '';
  for (const x of dias) sel.append(el('option', {value:x, ...(x===dia?{selected:''}:{})}, x === dias[0] ? 'Hoy · ' + fechaLarga(x) : fechaLarga(x)));
  sel.style.display = dias.length ? '' : 'none';

  // Cifras
  const t = (d && d.totales) || {};
  const facturas = correos.filter(c => c.tipo === 'Factura');
  const borradores = correos.filter(c => c.borrador);
  const cif = $('cifras'); cif.innerHTML = '';
  const tiles = [
    ['Todos', correos.length, 'correos procesados'],
    ['Factura', facturas.length, 'facturas revisadas'],
    ['Borrador', borradores.length, 'borradores listos'],
  ];
  for (const [f, n, l] of tiles){
    cif.append(el('button', {class:'cifra', 'aria-pressed': String(filtro===f && f!=='Todos'), onclick(){ filtro = (filtro===f && f!=='Todos') ? 'Todos' : f; pintar(); $('bloque-todos').scrollIntoView({behavior:'smooth', block:'start'}); }},
      el('div',{class:'n'}, String(n)), el('div',{class:'l'}, l)));
  }
  const mins = t.minutos_ahorrados || 0;
  const tiempo = el('div',{class:'n'});
  if (mins >= 60) tiempo.append(String(Math.floor(mins/60)), el('small',{},'h'), String(mins%60).padStart(2,'0'), el('small',{},'min'));
  else tiempo.append(String(mins), el('small',{},'min'));
  const nota = el('div', {class:'cifra nota', role:'button', tabindex:'0', 'aria-pressed':'false'},
    tiempo, el('div',{class:'l'}, 'de trabajo ahorrado'),
    el('div',{class:'explica'}, 'Estimación: 4 min por factura revisada, 3 por borrador y 1 por correo solo etiquetado.'));
  const alternar = () => nota.classList.toggle('abierta');
  nota.addEventListener('click', alternar); nota.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){ e.preventDefault(); alternar(); } });
  cif.append(nota);

  // Necesita a una persona
  const pers = correos.filter(c => c.estado === 'revisar' || c.estado === 'sospechoso')
    .sort((a,b) => (esHecho(a.id)-esHecho(b.id)) || (gravedad(a)-gravedad(b)));
  const pendientes = pers.filter(c => !esHecho(c.id)).length;
  $('n-persona').textContent = pers.length ? String(pendientes) : '';
  const caja = $('persona'); caja.innerHTML = '';
  if (!pers.length) caja.append(el('div',{class:'vacio'}, borradores.length ? 'Nada urgente. Lo demás tiene su borrador listo para revisar y enviar.' : 'Nada urgente.'));
  for (const c of pers){
    const g = gravedad(c), err = g <= 1;
    const hecho = esHecho(c.id);
    const acciones = el('div',{class:'acciones'},
      D.chat && c.hilo
        ? el('button',{class:'boton principal', onclick(){ abrirChat(c.hilo); }}, 'Abrir chat')
        : el('button',{class:'boton principal', onclick(){ abrir(c.url); }}, 'Abrir en Gmail'),
      D.chat && c.hilo
        ? el('button',{class:'boton texto', onclick(){ abrir(c.url); }}, 'Ver en Gmail')
        : (c.borrador ? el('button',{class:'boton texto', onclick(){ abrir(c.borrador.url); }}, 'Ver borrador') : el('span',{class:'hueco'})),
      (c.factura && c.factura.archivo) ? el('button',{class:'boton texto', onclick(){ abrir(c.factura.archivo); }}, 'Ver factura') : el('span',{class:'hueco'}),
      el('label',{class:'hecho', title:'Se guarda en este navegador'},
        el('input',{type:'checkbox', ...(hecho?{checked:''}:{}), onchange(e){ marcar(c.id, e.target.checked); pintar(); }}), 'Hecho'));
    caja.append(el('div',{class:'aviso' + (hecho?' listo':'')},
      el('span',{class:'punto' + (err?' err':'')}),
      el('div',{}, el('div',{class:'quien'}, nombre(c.de), el('span',{class:'asunto'}, c.asunto ? ' · ' + c.asunto : '')),
                   el('div',{class:'por ' + (err?'err':'aten')}, motivo(c))),
      acciones));
  }

  // Facturas
  $('n-facturas').textContent = facturas.length ? String(facturas.length) : '';
  const tb = $('facturas'); tb.innerHTML = '';
  if (!facturas.length) tb.append(el('tr',{}, el('td',{colspan:'5', class:'gris'}, 'Hoy no ha llegado ninguna factura.')));
  const orden = {error:0, revisar:1, correcta:2};
  for (const c of [...facturas].sort((a,b) => (orden[(a.factura||{}).estado]??3) - (orden[(b.factura||{}).estado]??3))){
    const f = c.factura || {};
    const cls = f.estado === 'correcta' ? 'ok' : (f.estado === 'error' ? 'err' : 'aten');
    const etiqueta = {correcta:'Correcta', error:'Error', revisar:'Revisar'}[f.estado] || 'Sin revisar';
    const dif = f.diferencia ? (f.diferencia > 0 ? '+' : '') + eur(f.diferencia) : '';
    tb.append(el('tr',{class:'fila', tabindex:'0', title: f.archivo ? 'Abrir la factura' : 'Abrir el correo',
        onclick(){ abrir(f.archivo || c.url); }, onkeydown(e){ if (e.key==='Enter') abrir(f.archivo || c.url); }},
      el('td',{}, el('div',{style:'font-weight:500'}, f.emisor || 'No se lee'), el('div',{class:'gris', style:'font-size:13px'}, f.numero ? 'N.º ' + f.numero : (f.archivo ? '' : 'Escrita en el correo'))),
      el('td',{class:'col-cliente gris'}, c.cliente || nombre(c.de)),
      el('td',{class:'num'}, eur(f.total_factura)),
      el('td',{}, el('span',{class:'pastilla ' + cls}, etiqueta)),
      el('td',{class:'num dif' + (dif ? ' err' : '')}, dif || el('span',{class:'gris'}, '—'))));
  }

  // Todos los correos
  const base = ['Factura','Consulta','Presupuesto'];
  const vistos = [...new Set(correos.map(c => c.tipo))];
  const tipos = ['Todos', ...base.filter(x => vistos.includes(x)), ...vistos.filter(x => !base.includes(x) && x !== 'Otros'), ...(vistos.includes('Otros') ? ['Otros'] : [])];
  if (!tipos.includes(filtro) && filtro !== 'Borrador') filtro = 'Todos';
  const fl = $('filtros'); fl.innerHTML = '';
  for (const x of tipos){
    const n = x === 'Todos' ? correos.length : correos.filter(c => c.tipo === x).length;
    fl.append(el('button',{class:'filtro', 'aria-pressed': String(filtro===x), onclick(){ filtro = x; pintar(); }}, x === 'Todos' ? 'Todos' : x + (x.endsWith('a')||x.endsWith('o')?'s':'') , el('span',{class:'c'}, String(n))));
  }
  const q = texto.trim().toLowerCase();
  const lista = correos.filter(c =>
    (filtro === 'Todos' || (filtro === 'Borrador' ? !!c.borrador : c.tipo === filtro)) &&
    (!q || [c.de, c.asunto, c.cliente, c.resumen].join(' ').toLowerCase().includes(q)));
  $('n-todos').textContent = String(lista.length);
  const todos = $('todos'); todos.innerHTML = '';
  if (!lista.length) todos.append(el('div',{class:'vacio'}, q ? 'Nada coincide con «' + texto.trim() + '».' : 'No hay correos.'));
  for (const c of lista){
    const est = {revisar:['Revisar','aten'], sospechoso:['Sospechoso','err'], listo:['Borrador listo','ok'], 'sin borrador':['Solo etiquetado','']}[c.estado] || [c.estado||'',''];
    todos.append(el('div',{class:'correo', role:'link', tabindex:'0', title: D.chat ? 'Abrir el chat' : 'Abrir en Gmail',
        onclick(){ abrirCorreo(c); }, onkeydown(e){ if (e.key==='Enter') abrirCorreo(c); }},
      el('div',{class:'tipo'}, c.tipo),
      el('div',{class:'de'}, nombre(c.de)),
      el('div',{class:'que'}, c.asunto || '(sin asunto)', el('span',{class:'r'}, c.resumen ? ' · ' + c.resumen : '')),
      el('div',{class:'estado ' + est[1]}, est[0])));
  }
  $('pie').textContent = filtro === 'Borrador' ? 'Mostrando solo los correos con borrador. Pulsa «borradores listos» otra vez para verlos todos.' : '';
}

if (D.chat){ $('ir-chat').style.display = ''; $('ir-chat').addEventListener('click', () => abrirChat()); }
$('dia').addEventListener('change', e => { dia = e.target.value; filtro = 'Todos'; pintar(); });
$('buscar').addEventListener('input', e => { texto = e.target.value; pintar(); });
document.addEventListener('click', e => { if (!e.target.closest('.nota')) document.querySelectorAll('.nota.abierta').forEach(n => n.classList.remove('abierta')); });
pintar();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main(sys.argv[1:])
