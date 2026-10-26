@echo off
title AXOS Relatorios - Servidor
echo ==========================================
echo  AXOS Relatorios - Iniciando...
echo ==========================================
echo.

cd /d "C:\END-AXOS-RELATORIOS\frontend"

echo Instalando dependencias (so na primeira vez)...
npm install > nul 2>&1

echo.
echo Iniciando o servidor na porta 5173...
echo.

start cmd /c "npm run dev -- --port 5173"

timeout /t 5 > nul

echo Abrindo o navegador...
start "" "http://localhost:5173"

echo.
echo ==========================================
echo  Sistema iniciado!
echo  Acesse: http://localhost:5173
echo ==========================================
echo.
echo Mantenha esta janela aberta enquanto usar o sistema.
echo Pressione qualquer tecla para fechar.
pause > nul
