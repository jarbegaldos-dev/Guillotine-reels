@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No encuentro Node.js. Abre el proyecto desde Codex o instala Node.js.
  pause
  exit /b 1
)

echo.
echo OSSUARY REELS
echo Servidor local: http://127.0.0.1:8000/
echo.
echo No cierres esta ventana mientras pruebes el juego.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8000/"
node local-server.js
pause
