@echo off
rem Double-click to release the Android app. Runs scripts\release.sh
rem (THE RELEASE RECIPE in CLAUDE.md) in Git Bash and waits at the end.
cd /d "%~dp0"
set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%BASH%" (
  echo Git Bash was not found at "%BASH%".
  pause
  exit /b 1
)
rem Fetch the newest script first, so this file never runs a stale recipe.
git checkout -q main
git pull -q --ff-only --autostash origin main
"%BASH%" scripts/release.sh
echo.
pause
