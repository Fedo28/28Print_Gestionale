@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Install-Startup.ps1"
if errorlevel 1 (
  echo Configurazione non completata. Leggi il messaggio sopra.
  pause
  exit /b 1
)
start "" powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0windows\Bridge-Control.ps1"
