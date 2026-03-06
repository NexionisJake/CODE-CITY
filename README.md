# CodeCity

A 3D GitHub repository visualizer that transforms code repositories into interactive 3D cities in the browser. Files become buildings with dimensions representing code metrics, imports become roads connecting buildings, and AI provides intelligent summaries of each file.

## Tech Stack

**Backend** — Python 3.11+, FastAPI, tree-sitter, Radon, boto3 (AWS Bedrock)
**Frontend** — Next.js 14, React 18, React Three Fiber, TypeScript
**Infrastructure** — Docker, AWS App Runner (backend), AWS Amplify (frontend)

## Project Structure

```
codecity/
├── backend/       Python FastAPI service for repository analysis
├── frontend/      Next.js app for 3D visualization (coming soon)
└── README.md
```

## Local Dev Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Check health at `GET /health`.

### API Endpoints

- `GET /health` — Returns `{"status": "ok"}`
- `POST /api/build-city` — Accepts `{"repo_url": "https://github.com/user/repo"}`, returns city data
