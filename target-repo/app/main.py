"""Simple FastAPI todo service — the target repo for the demo."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Todo Service")

# In-memory store
todos = [
    {"id": 1, "title": "Buy groceries", "done": False},
    {"id": 2, "title": "Walk the dog", "done": True},
    {"id": 3, "title": "Write code", "done": False},
]


class TodoCreate(BaseModel):
    title: str


@app.get("/todos")
def list_todos():
    return todos


@app.get("/todos/{todo_id}")
def get_todo(todo_id: int):
    for todo in todos:
        if todo["id"] == todo_id:
            return todo
    raise HTTPException(status_code=404, detail="Todo not found")


@app.post("/todos")
def create_todo(todo: TodoCreate):
    new_todo = {"id": len(todos) + 1, "title": todo.title, "done": False}
    todos.append(new_todo)
    return new_todo


@app.put("/todos/{todo_id}")
def update_todo(todo_id: int, todo: TodoCreate):
    for t in todos:
        if t["id"] == todo_id:
            t["title"] = todo.title
            return t
    raise HTTPException(status_code=404, detail="Todo not found")


@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: int):
    global todos
    todos = [t for t in todos if t["id"] != todo_id]
    return {"ok": True}
