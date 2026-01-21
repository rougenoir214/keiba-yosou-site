@echo off
chcp 65001 > nul
cd /d "C:\Users\rouge\OneDrive\keiba-yosou-site"

echo ====================================
echo Git Sync: feature/split-ranking
echo ====================================
echo.

REM 1. Check current branch
echo [1/7] Checking current branch...
git branch --show-current
echo.

REM 2. Stage changes
echo [2/7] Staging changes...
git add .
echo.

REM 3. Show status
echo [3/7] Current status...
git status
echo.

REM 4. Commit
echo [4/7] Committing...
set /p COMMIT_MSG="Enter commit message: "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Implement split ranking feature
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo Error: Failed to commit
    pause
    exit /b 1
)
echo.

REM 5. Push branch
echo [5/7] Pushing feature/split-ranking...
git push -u origin feature/split-ranking
if errorlevel 1 (
    echo Error: Failed to push
    pause
    exit /b 1
)
echo.

REM 6. Switch to main
echo [6/7] Switching to main...
git checkout main
if errorlevel 1 (
    echo Error: Failed to switch to main
    pause
    exit /b 1
)
echo.

REM 7. Merge branch into main
echo [7/7] Merging feature/split-ranking into main...
git merge feature/split-ranking --no-ff -m "Merge feature/split-ranking"
if errorlevel 1 (
    echo Error: Failed to merge
    pause
    exit /b 1
)
echo.

REM 8. Push main
echo [8/8] Pushing main...
git push origin main
if errorlevel 1 (
    echo Error: Failed to push main
    pause
    exit /b 1
)
echo.

echo ====================================
echo Success!
echo ====================================
echo.
pause
