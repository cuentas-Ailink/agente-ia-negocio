#!/usr/bin/env python3
"""Comprueba que el agente está bien montado. Uso: python3 herramientas/comprobar.py
Sale una lista de OK / ERROR. Cada ERROR dice qué hacer."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from revisar_factura import revisar, nif_valido

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fallos = 0

def ok(msg): print(f"\033[32mOK\033[0m     {msg}")
def error(msg, que_hacer):
    global fallos; fallos += 1
    print(f"\033[31mERROR\033[0m  {msg}\n       → {que_hacer}")

# 1. Archivos que el agente necesita
for ruta, que in [
    ("CLAUDE.md", "Vuelve a descargar el repositorio."),
    ("negocio/negocio.md", "Pide a Claude: «adapta el agente a mi negocio» (skill adaptar-negocio)."),
    ("negocio/clientes.md", "Crea el archivo aunque esté vacío, o pide a Claude que lo cree."),
    ("memoria/MEMORIA.md", "Crea el archivo con el título «# Memoria del agente»."),
    ("contrato-de-tarea.md", "Vuelve a descargar el repositorio."),
    (".claude/skills/pasada-diaria/SKILL.md", "Vuelve a descargar el repositorio."),
    ("herramientas/panel.py", "Vuelve a descargar el repositorio."),
    ("herramientas/chat.gs", "Vuelve a descargar el repositorio."),
]:
    (ok(f"Existe {ruta}") if os.path.exists(os.path.join(RAIZ, ruta)) else error(f"Falta {ruta}", que))

# 2. El perfil del negocio tiene lo que hace falta
p = os.path.join(RAIZ, "negocio/negocio.md")
if os.path.exists(p):
    texto = open(p, encoding="utf-8").read()
    for seccion in ["## El negocio", "## Cómo escribes", "## Tipos de correo", "## Lo que nunca haces", "## Cuándo avisar a una persona"]:
        (ok(f"negocio.md tiene «{seccion[3:]}»") if seccion in texto
         else error(f"A negocio.md le falta la sección «{seccion[3:]}»", "Cópiala del perfil más parecido de perfiles/."))
    if "{{" in texto:
        error("negocio.md tiene huecos sin rellenar ({{…}})", "Rellénalos o pide a Claude que lo haga con adaptar-negocio.")

# 3. Las cuentas de las facturas (casos conocidos)
casos = [
    ("factura correcta", {"numero": "1", "fecha": "2026-11-01", "nif_emisor": "B12345674",
      "lineas": [{"base": 100, "tipo_iva": 21}], "cuota_iva": 21, "total": 121}, "correcta"),
    ("total mal sumado", {"numero": "2", "fecha": "2026-11-01", "nif_emisor": "B12345674",
      "lineas": [{"base": 2310, "tipo_iva": 21}], "cuota_iva": 485.10, "total": 2815.10}, "error"),
    ("retención de IRPF", {"numero": "3", "fecha": "2026-11-01", "nif_emisor": "12345678Z",
      "lineas": [{"base": 1500, "tipo_iva": 21}], "tipo_irpf": 15, "retencion": 225, "total": 1590}, "correcta"),
    ("sin NIF", {"numero": "4", "fecha": "2026-11-01", "nif_emisor": "",
      "lineas": [{"base": 312, "tipo_iva": 4}], "total": 324.48}, "revisar"),
    ("exenta con motivo", {"numero": "5", "fecha": "2026-11-01", "nif_emisor": "A12345674",
      "lineas": [{"base": 642.75, "tipo_iva": 0}], "total": 642.75,
      "motivo_exencion": "Operación exenta de IVA, art. 20.1.16 Ley 37/1992"}, "correcta"),
    ("dos tipos de IVA", {"numero": "6", "fecha": "2026-11-01", "nif_emisor": "B12345674",
      "lineas": [{"base": 100, "tipo_iva": 21}, {"base": 50, "tipo_iva": 10}], "cuota_iva": 26, "total": 176}, "correcta"),
    ("cuota por tipo mal", {"numero": "7", "fecha": "2026-11-01", "nif_emisor": "B12345674",
      "lineas": [{"base": 100, "tipo_iva": 21, "cuota": 21}, {"base": 50, "tipo_iva": 10, "cuota": 6}],
      "total": 176}, "error"),
    ("fila mal leída", {"numero": "8", "fecha": "2026-11-01", "nif_emisor": "B12345674",
      "lineas": [{"base": 1240, "tipo_iva": 4}], "total": 1289.60,
      "conceptos": [{"cantidad": 40, "precio": 26, "importe": 1040}, {"cantidad": 3, "precio": 25, "importe": 200}]}, "error"),
    ("filas que cuadran", {"numero": "9", "fecha": "2026-11-01", "nif_emisor": "B12345674",
      "lineas": [{"base": 1240, "tipo_iva": 4}], "total": 1289.60,
      "conceptos": [{"cantidad": 40, "precio": 26, "importe": 1040}, {"cantidad": 8, "precio": 25, "importe": 200}]}, "correcta"),
]
for nombre, f, esperado in casos:
    r = revisar(f)
    (ok(f"Facturas: {nombre} → {r['estado']}") if r["estado"] == esperado
     else error(f"Facturas: {nombre} da «{r['estado']}» y debería dar «{esperado}»", "Revisa herramientas/revisar_factura.py."))
r = revisar(casos[1][1])
(ok("Facturas: la diferencia del total mal sumado es +20,00 €") if abs(r["diferencia"] - 20) < 0.001
 else error(f"Diferencia {r['diferencia']} en vez de 20", "Revisa herramientas/revisar_factura.py."))
for nif, esperado in [("12345678Z", True), ("12345678A", False), ("X1234567L", True), ("B12345674", True), ("B12345675", False)]:
    (ok(f"NIF {nif} → {'válido' if esperado else 'no válido'}") if nif_valido(nif)[0] == esperado
     else error(f"NIF {nif} mal comprobado", "Revisa nif_valido en herramientas/revisar_factura.py."))

# 4. Que nada pueda enviar correos
s = os.path.join(RAIZ, ".claude/settings.json")
if os.path.exists(s):
    deny = json.load(open(s)).get("permissions", {}).get("deny", [])
    (ok(f"Envío de correos bloqueado ({len(deny)} reglas)") if any("send" in x for x in deny)
     else error("settings.json no bloquea el envío", "Añade las reglas deny de send_message, reply y forward."))
else:
    error("Falta .claude/settings.json", "Vuelve a descargar el repositorio.")

print()
print("Sin errores." if not fallos else f"{fallos} error(es). Arregla lo que dice cada ERROR y vuelve a ejecutarlo.")
sys.exit(1 if fallos else 0)
