"""Falla si el reporte JSON de OWASP ZAP tiene alertas de riesgo Alto o Medio.

Uso: python3 zap-verificar.py <reporte.json> [zap-reglas.conf]
Se ejecuta en Jenkins (stage «OWASP ZAP - Frontend») con el Python de la imagen de ZAP.

- Las alertas que el propio ZAP marca como falso positivo (confianza 0) no cuentan.
- zap-reglas.conf: el mismo archivo de reglas que recibe ZAP (-c). Las reglas en IGNORE se
  informan con su motivo, pero no bloquean.
"""
import json
import os
import sys

RIESGOS_BLOQUEANTES = {"3": "Alto", "2": "Medio"}


def cargar_excepciones(ruta):
    """Reglas en IGNORE del archivo de ZAP: id<TAB>IGNORE<TAB>(nombre)[<TAB>motivo]."""
    if not ruta or not os.path.exists(ruta):
        return {}
    excepciones = {}
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            if linea.startswith("#") or linea.count("\t") < 2:
                continue
            campos = linea.rstrip("\n").split("\t")
            if campos[1] == "IGNORE":
                excepciones[campos[0]] = campos[3] if len(campos) > 3 else campos[2]
    return excepciones


def main(ruta_reporte, ruta_excepciones=None):
    with open(ruta_reporte, encoding="utf-8") as f:
        reporte = json.load(f)
    excepciones = cargar_excepciones(ruta_excepciones)

    bloqueantes, aceptadas = [], []
    for sitio in reporte.get("site", []):
        for alerta in sitio.get("alerts", []):
            riesgo = str(alerta.get("riskcode"))
            if riesgo not in RIESGOS_BLOQUEANTES or str(alerta.get("confidence")) == "0":
                continue
            fila = (RIESGOS_BLOQUEANTES[riesgo], str(alerta.get("pluginid")), alerta.get("alert"), alerta.get("count"))
            (aceptadas if fila[1] in excepciones else bloqueantes).append(fila)

    for riesgo, regla, nombre, cantidad in aceptadas:
        print(f"ZAP: [{riesgo}] {nombre} (regla {regla}, {cantidad} URL) ACEPTADA: {excepciones[regla]}")
    if not bloqueantes:
        print("ZAP: sin alertas de riesgo Alto ni Medio atribuibles al frontend.")
        return 0
    print(f"ZAP: {len(bloqueantes)} alerta(s) de riesgo Alto/Medio:")
    for riesgo, regla, nombre, cantidad in bloqueantes:
        print(f"  [{riesgo}] {nombre} (regla {regla}, {cantidad} URL)")
    return 1


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:3]))
