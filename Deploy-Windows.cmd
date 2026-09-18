@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js LTS from https://nodejs.org/ then run this file again.
 pause
 exit /b 1
)
call npm.cmd ci --no-fund --no-audit
if errorlevel 1 goto failed
call npm.cmd run login
if errorlevel 1 goto failed
echo This publishes Paintlight's public gallery to the paintlight Worker in your Cloudflare account.
echo Personal uploads remain locked until login and storage are configured.
call npm.cmd run deploy
if errorlevel 1 goto failed
echo Deployment finished. Use the URL printed above.
pause
exit /b 0
:failed
echo The last step failed. Copy the error message for troubleshooting.
pause
exit /b 1
