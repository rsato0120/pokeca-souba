@echo off
chcp 65001 > nul
echo =====================================
echo  相場 (SOUBA) 毎日予想更新
echo =====================================
cd /d %~dp0

:: .env.local から環境変数を読み込む
for /f "tokens=1,* delims==" %%a in ('findstr /v "^#" .env.local 2^>nul') do (
  set "%%a=%%b"
)

if "%GEMINI_API_KEY%"=="" (
  echo エラー: GEMINI_API_KEY が .env.local に設定されていません
  pause
  exit /b 1
)

echo.
echo [1/3] カード予想を生成中...
npx tsx --tsconfig tsconfig.json scripts/update-forecasts.ts
if errorlevel 1 (
  echo.
  echo エラー: 予想生成に失敗しました。処理を中断します。
  pause
  exit /b 1
)

echo.
echo [2/3] 変更を確認中...
git add data\forecasts\
git diff --cached --quiet
if not errorlevel 1 (
  echo 変更なし。プッシュをスキップします。
  goto done
)

echo [3/3] GitHubにプッシュ中...
git commit -m "update forecasts"
git push origin main
if errorlevel 1 (
  echo エラー: プッシュに失敗しました
  pause
  exit /b 1
)

:done
echo.
echo =====================================
echo  完了！Vercelが自動デプロイします
echo =====================================
pause
