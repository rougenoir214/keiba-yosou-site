@echo off
cd /d C:\Users\rouge\OneDrive\keiba-yosou-site

echo ====================================
echo Git Branch and Merge (Improved)
echo ====================================
echo.

REM Get branch name from argument
set BRANCH_NAME=%1
if "%BRANCH_NAME%"=="" (
    echo Error: Please specify branch name
    echo Usage: git-push-branch.bat branch-name
    pause
    exit /b 1
)

echo Branch: %BRANCH_NAME%
echo.

REM 1. Stage changes
echo [1/5] Staging changes...
git add .
echo.

REM 2. Create and switch to new branch
echo [2/5] Creating branch...
git checkout -b %BRANCH_NAME%
if errorlevel 1 (
    echo Error: Failed to create branch
    pause
    exit /b 1
)
echo.

REM 3. Commit
echo [3/5] Committing...
set /p COMMIT_MSG="Enter commit message: "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update: %BRANCH_NAME%
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo Error: Failed to commit
    pause
    exit /b 1
)
echo.

REM 4. Push branch
echo [4/5] Pushing branch...
git push -u origin %BRANCH_NAME%
if errorlevel 1 (
    echo Error: Failed to push
    pause
    exit /b 1
)
echo.

REM 5. Switch to main and merge
echo [5/5] Merging into main...
git checkout main
git merge %BRANCH_NAME% --no-ff -m "Merge %BRANCH_NAME% into main"
if errorlevel 1 (
    echo Error: Failed to merge
    pause
    exit /b 1
)
git push origin main
echo.

echo ====================================
echo Success!
echo ====================================
echo Branch: %BRANCH_NAME%
echo Merged to: main
echo.
echo You can now revert on GitHub if needed
echo ====================================
pause
