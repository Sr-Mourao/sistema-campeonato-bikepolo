#!/usr/bin/env bash
# Inicia o servidor de streaming para celular (Termux / Linux / macOS)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "Iniciando servidor de streaming na porta 8787..."
python3 scripts/servidor_streaming.py 8787
