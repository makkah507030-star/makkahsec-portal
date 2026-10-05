@echo off
:: Makkah Secondary School Portal - ZKTeco fingerprint bridge
:: Keep this file next to bridge.js. Run it by double-click, or as Administrator.
:: English text only on purpose: Arabic lines in a .bat make cmd treat them as commands.

:: Run from the folder of this file, even when started as Administrator
:: (Administrator mode starts in C:\Windows\System32, where bridge.js does not exist).
cd /d "%~dp0"
title Makkah Portal - ZKTeco Bridge

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

if not exist "bridge.js" (
  echo bridge.js was not found next to this file: %~dp0
  pause
  exit /b 1
)

echo Starting the bridge on port 8090 ... keep this window open.
node bridge.js
pause
