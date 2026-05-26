@echo off

set PORTS=4000 5173 6379

for %%p in (%PORTS%) do (
    echo Fechando porta %%p...

    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo Todas as portas foram liberadas.
pause