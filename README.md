# Lexis

Lexis is an AI study workspace for turning trusted source material into grounded understanding. Upload PDFs, notes, documents, markdown, slides, or image-based material, then ask questions and generate summaries, flashcards, quizzes, and key concepts without losing sight of the source.

The project is inspired by the source-first study flow of NotebookLM, but the product direction is warmer, calmer, and more glass-like: a focused workspace where chat, sources, and study tools live side by side instead of becoming scattered across tabs.

## Mission

Students often study from dense, fragmented material: lecture PDFs, research papers, slides, exported notes, screenshots, and quick summaries from different tools. Lexis is built around one core idea:

> Keep the source, the reasoning, and the review loop together.

Lexis does not try to be a general chatbot first. It starts from the material the user uploads, builds a searchable knowledge layer over it, and creates active study surfaces from that material. The goal is to make difficult content easier to approach while keeping answers verifiable, calm, and connected to the original document.

## Core Experience

- **Source-grounded chat**: ask questions about a selected document and receive answers based on retrieved source chunks.
- **Document processing**: upload a source, extract text, split it into chunks, embed it, and mark the document ready for study.
- **Study generation**: create summaries, flashcards, quizzes, and key concepts from the selected source.
- **Notebook-style workspace**: sources stay on the left, chat stays in the center, and generated study tools live in the studio panel.
- **Expandable artifacts**: when a user opens flashcards, quizzes, summaries, or concepts, the chat column becomes narrower and the artifact receives more space, similar to NotebookLM's workspace behavior.
- **Active review controls**: flashcards and quizzes include navigation, answer reveal, correctness feedback, and progress indicators.

## Design Implementation

Lexis uses a custom React/CSS interface rather than a component framework. The visual system is built around:

- **Glass panels** with translucent surfaces, soft borders, blur, and layered shadows.
- **Warm neutral gradients** with orange accents, instead of a cold dashboard palette.
- **Three-panel workspace layout** for sources, chat, and studio tools.
- **Responsive artifact mode** that rebalances the layout when study tools are opened.
- **Interactive loading states** with shimmer, animated dots, and contextual loading cards.
- **Landing page storytelling** with a compact header, hero product mockup, workflow section, feature cards, testimonials, FAQ, and footer.

The main frontend implementation lives in:

- `frontend/src/App.jsx`
- `frontend/src/App.css`
- `frontend/src/data.js`
- `frontend/src/utils.js`

## Tech Stack

### Frontend

- React 19
- Vite 8
- Custom CSS
- Browser `fetch` API
- Local storage token persistence

### Node API

- Express 5
- Supabase JavaScript client
- Multer for in-memory file uploads
- Axios for internal service calls
- CORS and dotenv

### Python AI Service

- FastAPI
- Uvicorn
- Pydantic
- Supabase Python client
- Anthropic SDK using `claude-sonnet-4-5`
- Hugging Face Inference Client for embeddings
- PyMuPDF and pypdf for PDF extraction
- Pillow for image compression and OCR-style image extraction
- NumPy for embedding normalization

### Data Layer

- Supabase Auth
- Supabase Storage bucket: `documents`
- Supabase Postgres tables used by the app:
  - `documents`
  - `chunks`
  - `conversations`
  - `summaries`
  - `flashcards`
  - `quiz_questions`
  - `key_concepts`
- Supabase RPC function used for vector search:
  - `match_chunks`

## Architecture

```text
Frontend (React + Vite)
        |
        | HTTP requests with Supabase auth token
        v
Node API (Express)
        |
        | verifies user, stores files, reads/writes app data
        v
Supabase Auth / Postgres / Storage
        ^
        |
        | internal API calls protected by x-internal-secret
        |
Python AI Service (FastAPI)
        |
        | Claude generation + Hugging Face embeddings
        v
Processing, retrieval, Q&A, summaries, flashcards, quizzes, concepts
```

The Express backend is the public API for the frontend. It handles authentication, document upload, document listing, deletion, status checks, and user-scoped reads from Supabase. For AI-heavy work, it calls the FastAPI service using a shared `INTERNAL_SECRET`.

The Python service processes uploaded documents by reading the file from Supabase Storage, extracting text, chunking the content, generating embeddings, saving chunks, and updating the document status. It also powers Q&A and generated study artifacts.

## API Overview

### Express API

Default base URL:

```text
http://localhost:3001/api
```

Auth routes:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Document routes:

- `GET /documents`
- `POST /documents/upload`
- `GET /documents/:id`
- `GET /documents/:id/status`
- `DELETE /documents/:id`

Study routes:

- `GET /documents/:id/qa`
- `POST /documents/:id/qa`
- `GET /documents/:id/summary`
- `POST /documents/:id/summary`
- `GET /documents/:id/flashcards`
- `POST /documents/:id/flashcards`
- `DELETE /documents/:id/flashcards`
- `GET /documents/:id/quiz`
- `POST /documents/:id/quiz`
- `POST /documents/:id/quiz/submit`
- `GET /documents/:id/concepts`
- `POST /documents/:id/concepts`

### FastAPI Service

Default base URL:

```text
http://127.0.0.1:8000
```

Routes:

- `GET /health`
- `POST /process`
- `POST /qa`
- `POST /generate/summary`
- `POST /generate/flashcards`
- `POST /generate/quiz`
- `POST /generate/concepts`

Internal routes require the `x-internal-secret` header.

## Project Structure

```text
Lexis/
  backend/
    app.js
    index.js
    db.js
    controllers/
      auth.js
      documents.js
      review.js
  frontend/
    src/
      App.jsx
      App.css
      data.js
      main.jsx
      utils.js
  python-backend/
    app/
      main.py
      db.py
      model.py
      routes/
        process.py
        qa.py
        generate.py
      services/
        text.py
        pdf.py
        qa_prompt.py
        summary.py
        flashcards.py
        quiz.py
        concepts.py
```

## Environment Variables

### Frontend

Create `frontend/.env` if you need to override the API URL.

```bash
VITE_API_URL=http://localhost:3001/api
```

### Node API

Create `backend/.env`.

```bash
PORT=3001
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_or_service_key
BASE_URL=http://127.0.0.1:8000
INTERNAL_SECRET=shared_internal_secret
```

### Python AI Service

Create `python-backend/.env`.

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
INTERNAL_SECRET=shared_internal_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
HF_TOKEN=your_huggingface_token
EMBEDDING_MODEL=ibm-granite/granite-embedding-97m-multilingual-r2
```

`INTERNAL_SECRET` must match between `backend/.env` and `python-backend/.env`.

## Running Locally

Install and start the Python AI service:

```bash
cd python-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Install and start the Express API:

```bash
cd backend
npm install
npm start
```

Install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Express API: `http://localhost:3001/api`
- FastAPI service: `http://127.0.0.1:8000`

## Verification

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

Python import check:

```bash
cd python-backend
python3 -m py_compile app/main.py app/db.py app/model.py app/routes/*.py app/services/*.py
```

The backend currently has a placeholder `npm test` script, so automated backend tests still need to be added.

## Current Notes

- Supabase schema, storage bucket, and vector RPC must exist before document processing and retrieval work end to end.
- The Python AI service must be running for uploads to finish processing and for generated study tools to work.
- Q&A uses recent conversation history plus vector-retrieved document chunks.
- Generated summaries, flashcards, quizzes, and concepts are persisted back into Supabase for later review.
- The frontend is intentionally custom-styled to keep the Lexis product identity lightweight and distinct from a stock dashboard.

## Product Direction

Lexis is moving toward a study environment that feels less like "ask AI a question" and more like "build a living notebook from material I trust." The long-term direction is to make the workspace more verifiable, more interactive, and more adaptive to how students actually review: reading, asking, checking the source, practicing recall, and returning to weak areas.
