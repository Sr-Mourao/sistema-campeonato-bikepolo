@echo off
REM Inicia o servidor de streaming no Windows
cd /d "%~dp0\.."
echo Iniciando servidor de streaming na porta 8787...
python scripts\servidor_streaming.py 8787
pause
