import os
import json
import re
from groq import Groq, RateLimitError
from sqlalchemy.orm import Session
from database import SessionLocal, Task, Memory
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# --- Tools Implementation ---

def add_task(content: str):
    db = SessionLocal()
    task = Task(content=content)
    db.add(task)
    db.commit()
    db.refresh(task)
    db.close()
    return f"Successfully added task: {content}"

def update_task(task_id: int, content: str = None, status: str = None):
    db = SessionLocal()
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        db.close()
        return f"Task with ID {task_id} not found."
    if content:
        task.content = content
    if status:
        task.status = status
    db.commit()
    db.close()
    return f"Successfully updated task {task_id}."

def delete_task(task_id: int):
    db = SessionLocal()
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        db.close()
        return f"Task with ID {task_id} not found."
    db.delete(task)
    db.commit()
    db.close()
    return f"Successfully deleted task {task_id}."

def store_memory(key: str, value: str):
    db = SessionLocal()
    memory = db.query(Memory).filter(Memory.key == key).first()
    if memory:
        memory.value = value
    else:
        memory = Memory(key=key, value=value)
        db.add(memory)
    db.commit()
    db.close()
    return f"I've remembered that {key} is {value}."

# --- Multi-Step Agent Logic ---

MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-8b-8192"]

SYSTEM_PROMPT = """You are a professional Voice Assistant.
- To perform actions, output one or more FLAT JSON blocks.
- NEVER explain reasoning in the same block as JSON.
- If the user refers to a task that is slightly different from the ones in CONTEXT (e.g. transcription errors), assume they mean the existing task and use its ID.
- Use the MEMORIES context below to personalize your actions. You do NOT need a tool to retrieve memories; they are already provided to you.
- You can perform multiple actions at once by outputting multiple JSON blocks.
- If a user's request requires information from a memory (e.g., "Add a task for my sister's birthday"), check the MEMORIES context first.
- You can update or delete tasks regardless of their current status (pending/completed).
- ALWAYS confirm exactly what you did in natural language (e.g., "I've updated the meeting time to 6 PM").

Format Examples:
{"tool": "add_task", "content": "buy milk"}
{"tool": "delete_task", "task_id": 5}
{"tool": "update_task", "task_id": 5, "status": "completed"}
{"tool": "store_memory", "key": "office", "value": "Room 501"}

Tools:
- add_task(content)
- update_task(task_id, content, status)
- delete_task(task_id)
- store_memory(key, value)

For info/questions, just speak naturally using the provided CONTEXT."""

def call_groq(messages, temperature=0):
    for model in MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content, model
        except RateLimitError:
            print(f"Rate limit hit for {model}, falling back...")
            continue
        except Exception as e:
            if "decommissioned" in str(e).lower():
                continue
            raise e
    return "I'm currently over capacity. Please try again in a few minutes.", "error"

def clean_json_from_text(text: str):
    # Aggressively remove anything inside curly braces, even if malformed
    return re.sub(r'\{[^{}]*\}?', '', text, flags=re.DOTALL).strip()

def run_agent(user_input: str):
    db = SessionLocal()
    current_tasks = db.query(Task).all()
    all_memories = db.query(Memory).all()
    db.close()
    
    task_context = "TASKS: " + ", ".join([f"ID {t.id}: {t.content} [{t.status}]" for t in current_tasks])
    memory_context = "MEMORIES: " + ", ".join([f"{m.key}: {m.value}" for m in all_memories if m.value])

    messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nCONTEXT:\n{task_context}\n{memory_context}"},
        {"role": "user", "content": user_input}
    ]
    
    print(f"Calling Groq with messages: {messages}")
    response_text, model_used = call_groq(messages, temperature=0)
    print(f"Raw Groq response ({model_used}): {response_text}")
    
    # MULTI-STEP FLAT PARSER
    json_blocks = re.findall(r'\{[^{}]*\}', response_text, re.DOTALL)
    
    if json_blocks:
        results = []
        for block in json_blocks:
            try:
                clean_block = block.replace(", }", "}").replace(": }", ": null}")
                data = json.loads(clean_block)
                tool_name = data.get("tool")
                
                res = None
                if tool_name == "add_task":
                    res = add_task(content=data.get("content"))
                elif tool_name == "update_task":
                    res = update_task(task_id=int(data.get("task_id", 0)), content=data.get("content"), status=data.get("status"))
                elif tool_name == "delete_task":
                    res = delete_task(task_id=int(data.get("task_id", 0)))
                elif tool_name == "store_memory":
                    res = store_memory(key=data.get("key"), value=data.get("value"))
                
                if res:
                    results.append(res)
            except Exception as e:
                print(f"Block parse failed: {e}")
                continue
        
        if results:
            assistant_initial_text = clean_json_from_text(response_text)
            messages.append({"role": "assistant", "content": response_text})
            messages.append({"role": "system", "content": f"TOOL_RESULTS: {', '.join(results)}. Now, provide a final natural language response to the user. Confirm what you did and answer any questions they asked."})
            
            final_response, _ = call_groq(messages, temperature=0.7)
            final_result = clean_json_from_text(final_response)
            
            # If the second pass is empty, fall back to the first pass's text or a default
            if not final_result:
                return assistant_initial_text if assistant_initial_text else "I've updated your workspace."
            return final_result

    final_output = clean_json_from_text(response_text)
    return final_output if final_output else "I've updated your workspace."
