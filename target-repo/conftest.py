"""Shared pytest fixtures.

Every test gets a freshly re-seeded store so runs are deterministic and
order-independent.
"""

import pytest
from fastapi.testclient import TestClient

from app import store
from app.main import app


@pytest.fixture(autouse=True)
def _fresh_store():
    store.reset()
    yield
    store.reset()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
