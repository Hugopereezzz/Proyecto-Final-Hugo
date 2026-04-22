@echo off
echo ==========================================
echo   INICIANDO BASES DE DATOS (DOCKER)
echo ==========================================
docker-compose up -d
echo.
echo Las bases de datos MySQL y MongoDB se estan ejecutando en segundo plano.
echo.
pause
