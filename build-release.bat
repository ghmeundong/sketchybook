@echo off
setlocal
cd /d "%~dp0"

set "BUILD_DIR=%TEMP%\Sketchybook-release-%RANDOM%"

echo Cleaning previous temporary build...
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"

echo Preparing icon...
call npm run prepare:icon
if errorlevel 1 goto :failed

echo Building Electron app...
call npm run build:electron
if errorlevel 1 goto :failed

echo Packaging Windows installer...
call npx electron-builder --win --config.directories.output="%BUILD_DIR%"
if errorlevel 1 goto :failed

if not exist "%BUILD_DIR%\Sketchybook-Setup-1.0.0.exe" goto :failed

echo Copying release files...
copy /y "%BUILD_DIR%\Sketchybook-Setup-1.0.0.exe" "%~dp0release\" >nul
copy /y "%BUILD_DIR%\Sketchybook-Setup-1.0.0.exe.blockmap" "%~dp0release\" >nul
copy /y "%BUILD_DIR%\latest.yml" "%~dp0release\" >nul

rmdir /s /q "%BUILD_DIR%"
echo.
echo Release build completed:
echo %~dp0release\Sketchybook-Setup-1.0.0.exe
pause
exit /b 0

:failed
echo.
echo Release build failed. Check the error above.
pause
exit /b 1