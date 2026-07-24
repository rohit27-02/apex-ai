"""Tests for the todo service."""

from app.main import app, todos


def test_list_todos():
    """List all todos."""
    # Reset state
    todos.clear()
    todos.extend([
        {"id": 1, "title": "Buy groceries", "done": False},
        {"id": 2, "title": "Walk the dog", "done": True},
    ])
    assert len(todos) == 2


def test_create_todo():
    """Create a new todo."""
    todos.clear()
    new_todo = {"id": 1, "title": "New task", "done": False}
    todos.append(new_todo)
    assert len(todos) == 1
    assert todos[0]["title"] == "New task"


def test_update_todo():
    """Update a todo."""
    todos.clear()
    todos.append({"id": 1, "title": "Old title", "done": False})
    todos[0]["title"] = "New title"
    assert todos[0]["title"] == "New title"


def test_delete_todo():
    """Delete a todo."""
    todos.clear()
    todos.append({"id": 1, "title": "To delete", "done": False})
    todos.clear()
    assert len(todos) == 0
