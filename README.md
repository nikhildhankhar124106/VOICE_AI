# 🎙️ Llama Voice AI Workspace

A high-performance, voice-enabled intelligence layer for your daily tasks. Built with Next.js, FastAPI, and Llama 3.

---

## 🚀 Quick Start

### 1. Neural Engine (Backend)
```bash
cd backend
# Create and activate virtual environment (optional but recommended)
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env # Add your GROQ_API_KEY
python3 main.py
```
*Running on `http://localhost:8000`*

### 2. Interface (Frontend)
```bash
cd frontend
npm install
npm run dev
```
*Available at `http://localhost:3000`*

---

## ✨ Features

- **Neural Voice Processing**: Powered by Groq Whisper & Llama 3 for near-instant transcription and intent understanding.
- **Persistent Memory**: Remembers personal details and context across sessions.
- **Premium Interface**: 
  - Dark-mode optimized with a "Vantablack" aesthetic.
  - Multi-layer glassmorphism & mesh gradients.
  - Framer Motion animations for fluid workspace transitions.
  - Real-time neural waveform visualization.
- **Hybrid Controls**: Voice-first design with ⌘+L shortcut and manual touch overrides.

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, TypeScript, Framer Motion, Lucide React.
- **Backend**: FastAPI, SQLAlchemy, SQLite.
- **AI**: Groq API (Whisper-large-v3, Llama-3.3-70b).
- **Audio**: Web Speech API for TTS, MediaRecorder API for input.
