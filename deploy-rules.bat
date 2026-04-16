@echo off
setlocal
set FIREBASE_EXE=C:\Users\lucia\AppData\Local\Temp\firebase.exe
set PROJECT_ID=micclub-59d39
set RULES_FILE=%~dp0firebase\database.rules.json

echo.
echo ========================================
echo   MIC CLUB - Publicar Reglas Firebase
echo ========================================
echo.

:: Verificar que el ejecutable de Firebase existe
if not exist "%FIREBASE_EXE%" (
  echo [ERROR] No se encontro firebase.exe en %FIREBASE_EXE%
  echo Descargandolo...
  powershell -Command "Invoke-WebRequest -Uri 'https://github.com/firebase/firebase-tools/releases/latest/download/firebase-tools-win.exe' -OutFile '%FIREBASE_EXE%' -UseBasicParsing"
)

echo [1/2] Iniciando sesion en Firebase...
echo       Se abrira el navegador. Inicia sesion con la cuenta del proyecto.
echo.
"%FIREBASE_EXE%" login

echo.
echo [2/2] Publicando reglas de la base de datos...
"%FIREBASE_EXE%" database:rules:set "%RULES_FILE%" --project %PROJECT_ID%

echo.
if %ERRORLEVEL% EQU 0 (
  echo [OK] Reglas publicadas exitosamente!
  echo      El registro de nuevos participantes ya deberia funcionar.
) else (
  echo [ERROR] Algo salio mal. Revisa el mensaje de arriba.
)

echo.
pause
