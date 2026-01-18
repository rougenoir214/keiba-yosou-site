@echo off
cd /d C:\Users\rouge\OneDrive\keiba-yosou-site

echo Current status...
git status

echo.
echo Checking out feature branch...
git checkout feature/fix-payout-and-validation

echo.
echo Adding actual changes...
git add .
git commit -m "Fix: payout extraction and race time validation"

echo.
echo Pushing feature branch...
git push origin feature/fix-payout-and-validation

echo.
echo Switching to main...
git checkout main

echo.
echo Merging feature branch...
git merge feature/fix-payout-and-validation --no-ff -m "Merge feature/fix-payout-and-validation into main"

echo.
echo Pushing main...
git push origin main

echo.
echo Done!
pause
