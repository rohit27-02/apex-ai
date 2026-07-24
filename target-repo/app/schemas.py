"""Pydantic schemas for the todo service.

The public shape of a Todo is intentionally stable: any change to these
fields is an API-compatibility break and is guarded by tests/test_compat.py.
"""

from pydantic import BaseModel, Field


class TodoIn(BaseModel):
    title: str = Field(min_length=1)
    done: bool = False


class Todo(BaseModel):
    id: int
    title: str
    done: bool
