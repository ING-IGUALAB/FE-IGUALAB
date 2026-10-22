"""Falla si el reporte JSON de OWASP ZAP tiene alertas de riesgo Alto o Medio.

Uso: python3 zap-verificar.py <reporte.json>
Se ejecuta en Jenkins (stage «OWASP ZAP - Frontend») con el Python de la imagen de ZAP.
Las alertas que el propio ZAP marca como falso positivo (confianza 0) no cuentan.
"""
import json
import sys

RIESGOS_BLOQUEANTES = {"3": "Alto", "2": "Medio"}


def main(ruta: str) -> int:
    with open(ruta, encoding="utf-8") as f:
        reporte = json.load(f)

    bloqueantes = []
    for sitio in reporte.get("site", []):
        for alerta in sitio.get("alerts", []):
            riesgo = str(alerta.get("riskcode"))
            if riesgo in RIESGOS_BLOQUEANTES and str(alerta.get("confidence")) != "0":
                bloqueantes.append((RIESGOS_BLOQUEANTES[riesgo], alerta.get("pluginid"), alerta.get("alert"), alerta.get("count")))

    if not bloqueantes:
        print("ZAP: sin alertas de riesgo Alto ni Medio.")
        return 0
    print(f"ZAP: {len(bloqueantes)} alerta(s) de riesgo Alto/Medio:")
    for riesgo, plugin, nombre, cantidad in bloqueantes:
        print(f"  [{riesgo}] {nombre} (regla {plugin}, {cantidad} URL)")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
