import os
import shutil
from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal, Task
from agent import run_agent, client
from pydantic import BaseModel

app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ChatRequest(BaseModel):
    text: str

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    # Save temporary audio file in a dedicated dir to avoid uvicorn reload loops
    temp_dir = "temp_audio"
    os.makedirs(temp_dir, exist_ok=True)
    temp_file = os.path.join(temp_dir, f"temp_{file.filename}")
    
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        with open(temp_file, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(temp_file, audio_file.read()),
                model="whisper-large-v3",
                response_format="json",
            )
        return {"text": transcription.text}
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

@app.post("/chat")
async def chat(request: ChatRequest):
    print(f"Received chat request: {request.text}")
    try:
        response_text = run_agent(request.text)
        print(f"Agent response: {response_text}")
        return {"response": response_text}
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        import traceback
        traceback.print_exc()
        return {"response": "I encountered an internal error. Please try again."}

@app.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    return tasks

class TaskUpdate(BaseModel):
    content: str = None
    status: str = None

@app.put("/tasks/{task_id}")
def update_task_endpoint(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return {"error": "Task not found"}
    if task_update.content is not None:
        task.content = task_update.content
    if task_update.status is not None:
        task.status = task_update.status
    db.commit()
    return task

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
