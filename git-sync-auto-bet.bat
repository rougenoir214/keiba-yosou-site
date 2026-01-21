@echo off
chcp 65001 > nul
cd /d "C:\Users\rouge\OneDrive\keiba-yosou-site"

echo ====================================
echo Git Sync: feature/auto-bet-from-marks
echo ====================================
echo.

REM 1. Check current branch
echo [1/8] Checking current branch...
git branch --show-current
echo.

REM 2. Stage changes
echo [2/8] Staging changes...
git add .
echo.

REM 3. Show status
echo [3/8] Current status...
git status
echo.

REM 4. Commit
echo [4/8] Committing...
set /p COMMIT_MSG="Enter commit message: "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Add auto-bet feature from prediction marks and delete all bets button
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo Error: Failed to commit
    pause
    exit /b 1
)
echo.

REM 5. Push branch
echo [5/8] Pushing feature/auto-bet-from-marks...
git push -u origin feature/auto-bet-from-marks
if errorlevel 1 (
    echo Error: Failed to push
    pause
    exit /b 1
)
echo.

REM 6. Switch to main
echo [6/8] Switching to main...
git checkout main
if errorlevel 1 (
    echo Error: Failed to switch to main
    pause
    exit /b 1
)
echo.

REM 7. Merge branch into main
echo [7/8] Merging feature/auto-bet-from-marks into main...
git merge feature/auto-bet-from-marks --no-ff -m "Merge feature/auto-bet-from-marks"
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
echo 実装した機能:
echo - おまかせ購入機能（印から自動で馬券生成）
echo - 予想画面に「全て削除」ボタン追加
echo.
pause
