#!/bin/bash

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting CodeCity Development Servers..."

# Start Backend in a new terminal tab/window
gnome-terminal --tab --title="CodeCity Backend" -- bash -c "
    echo '=> Starting FastAPI Backend...';
    cd '$PROJECT_ROOT/backend';
    source venv/bin/activate;
    uvicorn main:app --reload;
    exec bash
"

# Start Frontend in a new terminal tab/window
gnome-terminal --tab --title="CodeCity Frontend" -- bash -c "
    echo '=> Starting Next.js Frontend...';
    cd '$PROJECT_ROOT/frontend';
    npm run dev;
    exec bash
"

echo "Backend and Frontend are starting in separate terminal windows."
