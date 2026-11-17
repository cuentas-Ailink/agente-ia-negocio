#!/usr/bin/env python3
"""Revisa las cuentas de una factura. Las cuentas las hace este programa, nunca la IA.

Uso:
  python3 herramientas/revisar_factura.py factura.json
  echo '{...}' | python3 herramientas/revisar_factura.py -

La IA lee la factura (PDF o imagen) y copia en un JSON lo que pone, sin corregir nada:
{
  "numero": "F05-2026",
  "fecha": "2026-11-12",
  "emisor": "Recambios Mena SL",
  "nif_emisor": "B46777890",
  "lineas": [{"base": 2310.00, "tipo_iva": 21, "cuota": 485.10}],
                                # una por cada tipo de IVA; «cuota» = la que pone la factura
                                # para ese tipo (opcional)
  "conceptos": [                # opcional: las filas de la factura tal cual
    {"cantidad": 12, "precio": 68.50, "importe": 822.00, "tipo_iva": 21}
  ],                            # el programa comprueba cantidad × precio = importe y que
                                # la suma de importes de cada tipo de IVA dé su base
  "cuota_iva": 485.10,          # la cuota TOTAL que pone la factura (opcional; si trae una
                                # por tipo, ponlas en cada línea y deja esta fuera)
  "tipo_irpf": 0,               # % de retención (0 si no hay)
  "retencion": 0,               # la que pone la factura (opcional)
  "total": 2815.10,             # el total que pone la factura
  "motivo_exencion": ""         # si hay IVA 0, el texto que lo justifica
}

Los tipos válidos salen de negocio/negocio.md (sección «Impuestos») y se pasan con
--iva 21,10,4,0 --irpf 0,7,15,19. Si no se pasan, se usan los de España.

Devuelve un JSON con estado: «correcta», «error» o «revisar», los motivos y la diferencia en euros.
"""
import json, re, sys
from decimal import Decimal, ROUND_HALF_UP

TOLERANCIA = Decimal("0.02")
IVA_ES = [21, 10, 4, 0]
IRPF_ES = [0, 1, 2, 7, 15, 19]

def d(x):
    return Decimal(str(x if x is not None else 0)).quantize(Decimal("0.01"), ROUND_HALF_UP)

def euros(x):
    s = f"{abs(x):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-" if x < 0 else "") + s + " €"

LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE"

def nif_valido(nif):
    """DNI, NIE o CIF español. Devuelve (válido, tipo)."""
    n = re.sub(r"[\s.-]", "", (nif or "")).upper()
    if not n:
        return False, "vacío"
    if re.fullmatch(r"\d{8}[A-Z]", n):
        return LETRAS_DNI[int(n[:8]) % 23] == n[8], "DNI"
    if re.fullmatch(r"[XYZ]\d{7}[A-Z]", n):
        num = "XYZ".index(n[0]) * 10**7 + int(n[1:8])
        return LETRAS_DNI[num % 23] == n[8], "NIE"
    if re.fullmatch(r"[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]", n):
        cifras = n[1:8]
        pares = sum(int(c) for c in cifras[1::2])
        impares = sum(sum(divmod(int(c) * 2, 10)) for c in cifras[0::2])
        control = (10 - (pares + impares) % 10) % 10
        ultimo = n[8]
        ok = ultimo == str(control) or ultimo == "JABCDEFGHI"[control]
        return ok, "CIF"
    return False, "formato desconocido"

def revisar(f, tipos_iva=None, tipos_irpf=None, comprobar_nif=True):
    tipos_iva = tipos_iva if tipos_iva is not None else IVA_ES
    tipos_irpf = tipos_irpf if tipos_irpf is not None else IRPF_ES
    errores, avisos = [], []

    lineas = f.get("lineas") or []
    if not lineas and f.get("base") is not None:
        lineas = [{"base": f["base"], "tipo_iva": f.get("tipo_iva", 0)}]
    if not lineas:
        return {"estado": "revisar", "motivos": ["No se ha podido leer la base imponible."], "diferencia": 0}

    base = sum(d(l.get("base")) for l in lineas)
    cuota_ok = sum(d(d(l.get("base")) * Decimal(str(l.get("tipo_iva", 0))) / 100) for l in lineas)
    tipo_irpf = Decimal(str(f.get("tipo_irpf") or 0))
    ret_ok = d(base * tipo_irpf / 100)
    total_ok = d(base + cuota_ok - ret_ok)

    for l in lineas:
        t = l.get("tipo_iva", 0)
        if t not in tipos_iva and float(t) not in [float(x) for x in tipos_iva]:
            errores.append(f"IVA del {t} %: no es un tipo válido ({', '.join(str(x) for x in tipos_iva)} %).")
        if float(t) == 0 and not (f.get("motivo_exencion") or "").strip():
            avisos.append("Factura sin IVA y sin motivo de exención escrito: confirmar que está exenta.")
    if float(tipo_irpf) not in [float(x) for x in tipos_irpf]:
        errores.append(f"Retención del {tipo_irpf} %: no es un tipo habitual.")

    conceptos = f.get("conceptos") or []
    for i, c in enumerate(conceptos, 1):
        if c.get("cantidad") is not None and c.get("precio") is not None and c.get("importe") is not None:
            imp_ok = d(Decimal(str(c["cantidad"])) * Decimal(str(c["precio"])))
            if abs(d(c["importe"]) - imp_ok) > TOLERANCIA:
                errores.append(f"Fila {i}: {c['cantidad']} × {euros(d(c['precio']))} = {euros(imp_ok)}, "
                               f"pero pone {euros(d(c['importe']))}.")
    if conceptos and all(c.get("importe") is not None for c in conceptos):
        for l in lineas:
            t = float(l.get("tipo_iva", 0))
            filas = [c for c in conceptos if float(c.get("tipo_iva", l.get("tipo_iva", 0))) == t]
            if filas:
                suma = sum(d(c["importe"]) for c in filas)
                if abs(suma - d(l.get("base"))) > TOLERANCIA:
                    errores.append(f"Las filas al {l.get('tipo_iva', 0)} % suman {euros(suma)}, "
                                   f"pero la base pone {euros(d(l.get('base')))}.")

    for l in lineas:
        if l.get("cuota") is not None:
            c_ok = d(d(l.get("base")) * Decimal(str(l.get("tipo_iva", 0))) / 100)
            if abs(d(l["cuota"]) - c_ok) > TOLERANCIA:
                errores.append(f"Cuota de IVA al {l.get('tipo_iva', 0)} %: pone {euros(d(l['cuota']))}, "
                               f"debería ser {euros(c_ok)}.")
    if f.get("cuota_iva") is not None and abs(d(f["cuota_iva"]) - cuota_ok) > TOLERANCIA:
        errores.append(f"Cuota de IVA: pone {euros(d(f['cuota_iva']))}, debería ser {euros(cuota_ok)}.")
    if f.get("retencion") is not None and abs(d(f["retencion"]) - ret_ok) > TOLERANCIA:
        errores.append(f"Retención: pone {euros(d(f['retencion']))}, debería ser {euros(ret_ok)}.")

    diferencia = Decimal("0")
    if f.get("total") is None:
        avisos.append("No se ha podido leer el total.")
    else:
        diferencia = d(f["total"]) - total_ok
        if abs(diferencia) > TOLERANCIA:
            errores.append(f"Total mal sumado: pone {euros(d(f['total']))}, debería ser {euros(total_ok)} "
                           f"({'+' if diferencia > 0 else ''}{euros(diferencia)}).")

    if comprobar_nif:
        ok, tipo = nif_valido(f.get("nif_emisor"))
        if tipo == "vacío":
            avisos.append("Falta el NIF del emisor: no es una factura completa, pedirla de nuevo.")
        elif not ok:
            avisos.append(f"El NIF del emisor ({f.get('nif_emisor')}) no es válido ({tipo}).")
    for campo, texto in (("numero", "el número de factura"), ("fecha", "la fecha")):
        if not (f.get(campo) or "").strip():
            avisos.append(f"Falta {texto}.")

    estado = "error" if errores else ("revisar" if avisos else "correcta")
    return {
        "estado": estado,
        "motivos": errores + avisos,
        "base": float(base),
        "cuota_iva_correcta": float(cuota_ok),
        "retencion_correcta": float(ret_ok),
        "total_correcto": float(total_ok),
        "total_factura": float(d(f["total"])) if f.get("total") is not None else None,
        "diferencia": float(diferencia),
    }

def lista(s):
    return [float(x) if "." in x else int(x) for x in s.split(",") if x.strip() != ""]

def main(argv):
    args = argv[1:]
    tipos_iva = tipos_irpf = None
    if "--iva" in args:
        i = args.index("--iva"); tipos_iva = lista(args[i + 1]); del args[i:i + 2]
    if "--irpf" in args:
        i = args.index("--irpf"); tipos_irpf = lista(args[i + 1]); del args[i:i + 2]
    sin_nif = "--sin-nif" in args
    args = [a for a in args if a != "--sin-nif"]
    fuente = args[0] if args else "-"
    datos = json.load(sys.stdin if fuente == "-" else open(fuente, encoding="utf-8"))
    facturas = datos if isinstance(datos, list) else [datos]
    salida = [dict(numero=f.get("numero"), emisor=f.get("emisor"),
                   **revisar(f, tipos_iva, tipos_irpf, not sin_nif)) for f in facturas]
    print(json.dumps(salida if isinstance(datos, list) else salida[0], ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main(sys.argv)
