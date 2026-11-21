@echo off
rem Double-clic sur ce fichier pour lancer le serveur local et ouvrir l'appli.
rem "-ExecutionPolicy Bypass" autorise ce script-la uniquement, pour cette fois, sans changer les reglages de Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serveur.ps1" -page index.html
pause
