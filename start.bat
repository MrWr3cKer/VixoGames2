@echo off

setlocal EnableExtensions

cd /d "%~dp0"



set PORT=5500



echo.

echo  ============================================

echo    VixoGames - Starting local server

echo  ============================================

echo.



echo Stopping other apps on port %PORT% (Live Server, etc.)...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (

  taskkill /F /PID %%a >nul 2>&1

)

timeout /t 1 /nobreak >nul



set PYTHON=

where py >nul 2>&1

if %errorlevel% equ 0 set PYTHON=py

if not defined PYTHON where python >nul 2>&1

if %errorlevel% equ 0 set PYTHON=python



if not defined PYTHON (

  echo.

  echo  ERROR: Python not found.

  echo  Install from https://www.python.org/downloads/

  echo  Enable "Add python.exe to PATH" during setup.

  echo.

  pause

  exit /b 1

)



echo Starting server in a new window...

start "VixoGames Server" /D "%~dp0" cmd /k "%PYTHON% server.py %PORT%"



echo Waiting for server...

timeout /t 2 /nobreak >nul



echo Opening browser (use a wide window — ad needs 1024px+ width)...
echo If the ad is blank, try disabling ad blocker for localhost.
echo If the moving thumbnail background is missing: Ctrl+F5 hard refresh.
echo.

start "" "http://localhost:%PORT%/index.html?fresh=thumb7"



echo.

echo  ============================================

echo  Keep the "VixoGames Server" window open.

echo.

echo  Click games from the homepage. Links use:

echo    games/index.html?game=slug

echo

echo  /games/slug URLs need that server window.

echo  Do NOT use VS Code "Go Live" on port %PORT%.

echo  ============================================

echo.

pause

