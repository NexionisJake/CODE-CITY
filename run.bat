@echo off
echo Starting CodeCity Development Servers...

:: Start Backend in a new terminal window
echo =^> Starting FastAPI Backend...
start "CodeCity Backend" cmd /k "cd backend && call venv\Scripts\activate && uvicorn main:app --reload"

:: Start Frontend in a new terminal window
echo =^> Starting Next.js Frontend...
start "CodeCity Frontend" cmd /k "cd frontend && npm run dev"

echo Backend and Frontend are starting in separate terminal windows.
