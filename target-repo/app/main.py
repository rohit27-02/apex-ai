"""FastAPI todo service.

BASE VERSION: ``GET /todos`` returns the full list as a JSON array and
ignores any query parameters. The objective (see OBJECTIVE.md) is to add
pagination and status filtering while keeping this array response shape
backward compatible.
"""

from fastapi import FastAPI, HTTPException, Response

from app import store
from app.schemas import Todo, TodoIn

app = FastAPI(title="Todo Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/todos", response_model=list[Todo])
def list_todos(response: Response) -> list[Todo]:
    items = store.list_all()
    response.headers["X-Total-Count"] = str(len(items))
    return items


@app.post("/todos", response_model=Todo, status_code=201)
def create_todo(payload: TodoIn) -> Todo:
    return store.add(title=payload.title, done=payload.done)


@app.get("/todos/{todo_id}", response_model=Todo)
def get_todo(todo_id: int) -> Todo:
    todo = store.get(todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="todo not found")
    return todo


@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int) -> Response:
    if not store.delete(todo_id):
        raise HTTPException(status_code=404, detail="todo not found")
    return Response(status_code=204)
