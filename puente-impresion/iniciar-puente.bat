@echo off
REM Arranca el puente de impresión y lo reinicia si se cae.
cd /d "%~dp0"
:loop
node puente.js
echo El puente se detuvo. Reiniciando en 5 segundos...
timeout /t 5 /nobreak >nul
goto loop
