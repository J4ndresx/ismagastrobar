@echo off
rem Despliega Panzzerotty en Firebase: pruebas, compila las dos apps y publica todo.
rem   desplegar.bat               -> reglas, funciones y los dos sitios
rem   desplegar.bat hosting       -> solo los sitios (cambios de pantallas o menu en la app)
rem   desplegar.bat functions     -> solo Cloud Functions
setlocal
cd /d "%~dp0"
rem Windows tarda en cargar firebase-admin la primera vez: 60 s en vez de 10 para analizar las funciones.
set FUNCTIONS_DISCOVERY_TIMEOUT=60

if not exist cliente\.env.local ( echo Falta cliente\.env.local: corre primero node scripts\configurar-proyecto.mjs config-web.txt & exit /b 1 )
if not exist web\.env.local ( echo Falta web\.env.local: corre primero node scripts\configurar-proyecto.mjs config-web.txt & exit /b 1 )

echo === Proyecto de Firebase activo ===
call firebase use || exit /b 1

echo === Pruebas de la logica (functions) ===
pushd functions
call npm install || exit /b 1
call npm test || ( echo Las pruebas fallaron: no se despliega. & popd & exit /b 1 )
popd

echo === Compilando app del cliente ===
pushd cliente
call npm install || exit /b 1
call npm run build || ( popd & exit /b 1 )
popd

echo === Compilando POS ===
pushd web
call npm install || exit /b 1
call npm run build || ( popd & exit /b 1 )
popd

if "%~1"=="" (
  call firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
) else (
  call firebase deploy --only %~1
)
if errorlevel 1 ( echo. & echo El despliegue fallo. Si es el primer despliegue de funciones, espera 2-3 minutos y vuelve a correrlo. & exit /b 1 )
echo. & echo Listo.
