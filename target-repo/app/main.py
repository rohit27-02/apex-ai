"""FastAPI todo service.

NAIVE VERSION (intentionally incomplete): implements pagination and status
filtering by slicing the list, but does NOT validate the paging parameters.
Invalid input therefore returns HTTP 200 instead of 422, so the edge-case
acceptance criterion fails while every other criterion passes. This branch
exists to demonstrate a red check the agent must fix on attempt 2.
"""

from fastapi import FastAPI, HTTPException, Response

from app import store
from app.schemas import Todo, TodoIn

app = FastAPI(title="Todo Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/todos", response_model=list[Todo])
def list_todos(
    response: Response,
    page: int = 1,
    page_size: int = 10,
    status: str | None = None,
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
