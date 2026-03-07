<div align="center">
  <h1>🏙️ CodeCity</h1>
  <p><b>Transform any GitHub repository into an interactive, AI-powered 3D city in your browser.</b></p>
</div>

CodeCity is a next-generation 3D code visualizer designed to make exploring, understanding, and onboarding onto codebases intuitive and engaging. By representing code structure as a physical 3D environment, developers can instantly grasp architectural patterns, complexity, and dependencies.

---

## 🌟 Key Features

### 🏢 3D Interactive Visualization
* **Buildings as Files:** Code files are rendered as 3D buildings. Height represents the number of Lines of Code (LOC), and width/color represents cyclomatic complexity.
* **Districts as Directories:** A custom Treemap layout groups files into distinct neighborhood districts representing folder structure.
* **Roads as Dependencies:** Import statements and module dependencies are mapped as physical roads connecting buildings, complete with animated directional traffic pulses.
* **Atmospherics:** Beautiful glassmorphism UI overlays and an interactive Day/Night toggle (`N` shortcut) for premium aesthetics.

### 🧠 Ask the City (AI Integration)
* **Natural Language Queries:** Chat directly with your codebase using the integrated LangChain + Anthropic Claude 3 Haiku model.
* **Semantic Highlighting:** Ask questions like "Where is the authentication logic?" and watch the camera automatically pan to and highlight the relevant files in the 3D city.
* **AI Summaries:** Hover over any building to read an AI-generated explanation of the file's exact purpose and responsibilities in plain English.

### 🗺️ Sherpa Quests (Gamified Onboarding)
* **Interactive Tutorials:** Dynamically generated quests act as a guided tour for new developers based on the actual repository architecture.
* **Guided Completion:** Read explanations, follow clues, and travel to specific files/buildings to understand the critical paths of the codebase.

### ⚡ Performance & Caching
* **Redis Caching Layer:** Processed repository layouts and AST abstractions are cached to ensure instant loading on subsequent visits.
* **Neo4j Graph Database:** Code dependencies are stored natively in a graph structure for advanced querying and dependency resolution.

### 🔒 Authentication
* **GitHub OAuth:** Securely sign in using your GitHub account to access features, persist sessions, and manage api limits.

---

## 🛠️ Tech Stack Architecture

CodeCity is built for scale, modularity, and rapid AI iteration:

* **Frontend:** Next.js 14, React 18, TailwindCSS
* **3D Engine:** React Three Fiber, Three.js, Drei
* **Backend:** Python 3.11, FastAPI, Uvicorn
* **Code Parsing:** `tree-sitter` (AST analysis), `radon` (complexity metrics)
* **AI Orchestration:** LangChain, AWS Bedrock (Anthropic Claude 3 Haiku)
* **Databases:** Redis (State caching), Neo4j (Graph relations)
* **Authentication:** GitHub OAuth with JWT/Sessions
* **Cloud/Deployment:** AWS Lambda (Mangum adapter), Serverless-ready

---

## 🚀 Setup & Installation

Follow these steps to run CodeCity on your local machine. 

### Prerequisites
* Python 3.11+
* Node.js 18+
* (Optional) Docker for running Redis & Neo4j locally 

### 1. Clone the repository
```bash
git clone https://github.com/YourUsername/codecity.git
cd codecity
```

### 2. Backend Configuration
Navigate to the backend and install dependencies in a virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory using `.env.example` as a template:
```env
# AWS Bedrock (Anthropic Claude)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_DEFAULT_REGION=us-east-1

# Caching & Graph (Can use local Docker or cloud providers)
REDIS_URL=redis://localhost:6379/0
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=codecity123

# Authentication
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
FRONTEND_URL=http://localhost:3000
```
> **Note:** The backend has graceful fallbacks. If Redis or Neo4j are not running or configured, it will fall back to in-memory dictionaries automatically so development isn't blocked.

### 3. Frontend Configuration
Navigate to the frontend and install Node modules:
```bash
cd ../frontend
npm install
```

Create a `.env.local` file in the `frontend/` directory (if needing custom api paths):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Running the application
You can run both servers simultaneously using the provided bash script at the root:
```bash
./run.sh
```

Alternatively, run them separately:
* **Backend:** `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000`
* **Frontend:** `cd frontend && npm run dev`

The application will be accessible at [http://localhost:3000](http://localhost:3000). The FastAPI interactive docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## ☁️ AWS Lambda Deployment

The backend is entirely serverless-compatible via the `Mangum` ASGI adapter.
Deploying to AWS Lambda requires the execution role to have the following IAM permissions:

- `bedrock:InvokeModel` (for LangChain & Claude summaries/chats)
- `s3:GetObject`, `s3:PutObject` (if using S3 for repo archive storage)
- `elasticache:Connect` (for production Redis caching)

See `backend/lambda_handler.py` for Lambda-specific deployment entrypoints and zip packaging notes.
