@echo off
rem Instala y prueba el puente de impresion en el PC del mostrador.
rem Antes: llenar config.json (lo crea configurar.bat; falta la clave de la cuenta impresora
rem y el nombre con que se compartio la impresora en Windows, ej. POS80).
setlocal
cd /d "%~dp0"
where node >nul 2>nul || ( echo Falta Node.js 20 LTS: https://nodejs.org & exit /b 1 )
if not exist config.json ( echo Falta config.json: copia config.ejemplo.json y llenalo. & exit /b 1 )
if not exist shared\comandas.js ( echo Falta la carpeta shared: corre node ..\scripts\sync-shared.mjs & exit /b 1 )
call npm install || exit /b 1
echo === Imprimiendo ticket de prueba ===
call npm run prueba
echo.
echo Si salio el ticket, crea un acceso directo a iniciar-puente.bat en shell:startup (Win + R).
