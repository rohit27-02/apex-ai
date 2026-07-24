"""FastAPI todo service.

SOLUTION VERSION: ``GET /todos`` supports pagination and status filtering
while keeping the response body a JSON array (backward compatible). Paging
parameters are validated by FastAPI ``Query`` constraints, so invalid input
yields HTTP 422 rather than 200 or 500.
"""

from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Response

from app import store
from app.schemas import Todo, TodoIn

app = FastAPI(title="Todo Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/todos", response_model=list[Todo])
def list_todos(
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Literal["active", "done"] | None = Query(None),
) -> list[Todo]:
    items = store.list_all()
    if status == "active":
        items = [t for t in items if not t.done]
    elif status == "done":
        items = [t for t in items if t.done]

    response.headers["X-Total-Count"] = str(len(items))

    start = (page - 1) * page_size
    return items[start : start + page_size]


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
