#!/bin/bash
# Doble clic para conectar el WhatsApp de prueba (por QR) al panel. Deja esta ventana abierta mientras lo uses.
# La primera vez, mejor desde «empezamos» → «quiero WhatsApp»: Claude te da la orden con la dirección del panel.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
clear
if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js. Instálalo desde https://nodejs.org/es/download (el instalador para Mac) y vuelve a abrir esto."
  read -r -p "Pulsa Intro para cerrar." _; exit 1
fi
echo "WhatsApp del negocio (modo prueba con QR)"
echo
echo "Si va a escribir un número nuevo, ponlo con el prefijo y sin + (por ejemplo 34600111222)."
read -r -p "Si no, pulsa Intro: " NUM
echo
NUM="$(echo "$NUM" | tr -cd '0-9')"
if [ -n "$NUM" ]; then node herramientas/whatsapp-qr.mjs --permitir "$NUM"; else node herramientas/whatsapp-qr.mjs; fi
echo
read -r -p "Se ha parado. Pulsa Intro para cerrar." _
