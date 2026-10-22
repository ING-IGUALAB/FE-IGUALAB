"""Falla si el reporte JSON de OWASP ZAP tiene alertas de riesgo Alto o Medio.

Uso: python3 zap-verificar.py <reporte.json> [excepciones.json]
Se ejecuta en Jenkins (stage «OWASP ZAP - Frontend») con el Python de la imagen de ZAP.

- Las alertas que el propio ZAP marca como falso positivo (confianza 0) no cuentan.
- excepciones.json: lista de {"regla": "<pluginid>", "motivo": "..."} para hallazgos que no
  dependen del frontend (p. ej. la infraestructura). Se informan igual, pero no bloquean.
"""
import json
import os
import sys

RIESGOS_BLOQUEANTES = {"3": "Alto", "2": "Medio"}


def cargar_excepciones(ruta):
    if not ruta or not os.path.exists(ruta):
        return {}
    with open(ruta, encoding="utf-8") as f:
        return {str(e["regla"]): e["motivo"] for e in json.load(f)}


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
