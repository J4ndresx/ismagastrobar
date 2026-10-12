@echo off
rem Asistente de la impresora del mostrador (Tio Nacho).
rem   1. Instala lo necesario (la primera vez)
rem   2. Elige la impresora, la comparte y guarda config.json
rem   3. Revisa la clave del usuario impresora
rem   4. Imprime un ticket de prueba
rem Si no logra compartir la impresora: clic derecho en este archivo -> Ejecutar como administrador.
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where node >nul 2>nul || ( echo Falta Node.js 20 LTS: descargalo de https://nodejs.org e instalalo. & pause & exit /b 1 )
if not exist shared\comandas.js ( echo Falta la carpeta shared: copia la carpeta puente-impresion completa del proyecto. & pause & exit /b 1 )
if not exist node_modules (
  echo === Instalando dependencias - solo la primera vez ===
  call npm install || ( pause & exit /b 1 )
)

echo.
call node configurar-impresora.mjs
if errorlevel 1 ( pause & exit /b 1 )

echo.
echo === Revisando la clave del usuario impresora ===
call node puente.js --verificar || ( echo Revisa la clave y vuelve a correr este asistente. & pause & exit /b 1 )

echo.
echo === Estado de la impresora en Windows ===
call node puente.js --estado

echo.
echo === Imprimiendo ticket de prueba ===
call node puente.js --prueba
if errorlevel 1 (
  echo.
  echo No salio el ticket. Revisa que la impresora este encendida, con papel y conectada.
  pause & exit /b 1
)

echo.
echo Si salio el ticket con tildes y corte, todo esta listo.
echo  - Para dejarla funcionando: abre iniciar-puente.bat ^(dejar la ventana abierta^).
echo  - Para que arranque sola: Win + R, escribe shell:startup y pega ahi un acceso directo a iniciar-puente.bat.
echo  - Si las tildes salen raras: en config.json cambia "codepage" a "cp858" y vuelve a probar.
pause
