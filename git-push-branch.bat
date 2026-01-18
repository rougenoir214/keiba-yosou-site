@echo off
cd /d C:\Users\rouge\OneDrive\keiba-yosou-site

echo ====================================
echo Git Branch and Merge
echo ====================================
echo.

REM Get branch name from argument or use default
set BRANCH_NAME=%1
if "%BRANCH_NAME%"=="" set BRANCH_NAME=feature/update-%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BRANCH_NAME=%BRANCH_NAME: =0%

echo Branch: %BRANCH_NAME%
echo.

REM 1. Create and switch to new branch
echo [1/6] Creating branch...
git checkout -b %BRANCH_NAME%
if errorlevel 1 (
    echo Error: Failed to create branch
    pause
    exit /b 1
)
echo.

REM 2. Stage changes
echo [2/6] Staging changes...
git add .
echo.

REM 3. Commit
echo [3/6] Committing...
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
echo [4/6] Pushing branch...
git push -u origin %BRANCH_NAME%
if errorlevel 1 (
    echo Error: Failed to push
    pause
    exit /b 1
)
echo.

REM 5. Switch to main
echo [5/6] Switching to main...
git checkout main
echo.

REM 6. Merge branch into main
echo [6/6] Merging %BRANCH_NAME% into main...
git merge %BRANCH_NAME% --no-ff -m "Merge %BRANCH_NAME% into main"
if errorlevel 1 (
    echo Error: Failed to merge
    pause
    exit /b 1
)
echo.

REM 7. Push main
echo [7/7] Pushing main...
git push origin main
if errorlevel 1 (
    echo Error: Failed to push
    pause
    exit /b 1
)
echo.

echo ====================================
echo Success!
echo ====================================
echo Branch: %BRANCH_NAME%
echo Merged to: main
echo.
echo You can now:
echo - Revert this merge on GitHub
echo - Delete the branch
echo ====================================
pause
