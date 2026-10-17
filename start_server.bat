@echo off
title Image Slicing Tool Server

echo Starting local server...
start /B python -m http.server 8000

echo Opening browser...
timeout /t 2 /nobreak >nul
start "" http://localhost:8000

echo Server started at http://localhost:8000