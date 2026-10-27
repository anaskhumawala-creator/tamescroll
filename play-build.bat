@echo off
rem Double-click to build the Google Play bundle (.aab). Runs
rem scripts\play-build.sh in Git Bash and waits at the end. Publishes
rem nothing: upload the file it prints in Play Console yourself.
cd /d "%~dp0"
set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%BASH%" (
  echo Git Bash was not found at "%BASH%".
  pause
  exit /b 1
)
"%BASH%" scripts/play-build.sh
echo.
pause
