@echo off
cd /d C:\Users\rouge\OneDrive\keiba-yosou-site
git add routes/admin.js
git commit -m "Fix scraping based on working Python code: correct race_id structure and column extraction"
git push origin main
pause
