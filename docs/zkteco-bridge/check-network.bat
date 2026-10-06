@echo off
:: Makkah Portal - fingerprint network check. English only on purpose (see start-bridge.bat).
:: Run it on the SAME computer that runs the bridge, then send a photo of the result.
cd /d "%~dp0"
title Makkah Portal - Network check
echo.
echo ===== 1. This computer =====
ipconfig | findstr /i "IPv4 Mask Gateway"
echo.
echo ===== 2. Is the bridge listening on port 8080? =====
netstat -an | findstr ":8080"
echo (A LISTENING line = bridge is running. Any other line with 192.168.8.x = a device is connected.)
echo.
echo ===== 3. Firewall rule for port 8080 =====
netsh advfirewall firewall show rule name="ZKTeco Bridge 8080" | findstr /i "Rule Enabled Direction LocalPort Action"
echo (If nothing is shown, the rule does not exist yet.)
echo.
echo ===== 4. Which addresses answer from 192.168.8.100 to .110 =====
for /L %%i in (100,1,110) do (ping -n 1 -w 400 192.168.8.%%i | find "TTL=" >nul && echo 192.168.8.%%i  ANSWERS)
echo.
echo ===== 5. Devices this computer has seen on the network =====
arp -a | findstr "192.168.8."
echo.
echo ===== 6. Router (gateway) =====
ping -n 1 -w 500 192.168.8.1 | find "TTL=" >nul && (echo Router 192.168.8.1 ANSWERS) || (echo Router 192.168.8.1 NO ANSWER)
echo.
pause
