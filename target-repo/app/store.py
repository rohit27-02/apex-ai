"""In-memory todo store.

A deliberately simple, process-local store so the service is trivially
testable and deterministic. The store is re-seeded on import and can be
reset via ``reset()`` from tests.
"""

from app.schemas import Todo

_TODOS: list[Todo] = []
_NEXT_ID: int = 1


def reset() -> None:
    """Reset the store to a deterministic seed of 25 todos."""
    global _TODOS, _NEXT_ID
    _TODOS = []
    _NEXT_ID = 1
    for i in range(1, 26):
        add(title=f"Task {i}", done=(i % 3 == 0))


def list_all() -> list[Todo]:
    return list(_TODOS)


def add(title: str, done: bool = False) -> Todo:
    global _NEXT_ID
    todo = Todo(id=_NEXT_ID, title=title, done=done)
    _TODOS.append(todo)
    _NEXT_ID += 1
    return todo


def get(todo_id: int) -> Todo | None:
    for todo in _TODOS:
        if todo.id == todo_id:
            return todo
    return None


def delete(todo_id: int) -> bool:
    global _TODOS
    before = len(_TODOS)
    _TODOS = [t for t in _TODOS if t.id != todo_id]
    return len(_TODOS) != before


reset()
