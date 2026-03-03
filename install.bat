@echo off
setlocal enabledelayedexpansion

:: ─── Switch to script directory ───────────────────────────────────────────────
cd /d "%~dp0"

echo.
echo   summariser -- install from source
echo.

:: ─── Node.js check ────────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Node.js is not installed. Download from https://nodejs.org ^(v18+^)
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODE_VER=%%v
echo   [OK] Node.js %NODE_VER% found

:: ─── npm check ────────────────────────────────────────────────────────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] npm is not installed
    exit /b 1
)

for /f "delims=" %%v in ('npm --version') do set NPM_VER=%%v
echo   [OK] npm %NPM_VER% found

:: ─── Install dependencies ─────────────────────────────────────────────────────
echo   [-] Installing dependencies...
call npm install
echo   [OK] Dependencies installed

:: ─── Clean previous build ─────────────────────────────────────────────────────
echo   [-] Cleaning previous build...
if exist dist rmdir /s /q dist
echo   [OK] dist/ removed

:: ─── Build ────────────────────────────────────────────────────────────────────
echo   [-] Compiling TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo   [ERROR] Build failed
    exit /b 1
)
echo   [OK] Build complete ^(dist/^)

:: ─── Global install ───────────────────────────────────────────────────────────
echo   [-] Relinking globally...
call npm unlink -g summariser >nul 2>&1
call npm link
if %errorlevel% neq 0 (
    echo   [ERROR] npm link failed. Try running as Administrator.
    exit /b 1
)
echo   [OK] 'sumr' and 'summariser' commands are now available globally

echo.
echo   Done! Run the setup wizard to configure your API key:
echo.
echo     sumr config init
echo.
pause
