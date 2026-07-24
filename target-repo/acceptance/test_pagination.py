"""Acceptance: pagination + status filtering happy paths.

These describe the feature the agent must implement. They FAIL on the
base repo (feature absent) and PASS once pagination is correctly added.
A naive implementation is still expected to pass this file.

Seed: 25 todos, done when (id % 3 == 0) -> 8 done, 17 active.
Contract:
  GET /todos?page=&page_size=&status=
  - defaults: page=1, page_size=10
  - body stays a JSON array (backward compatible)
  - X-Total-Count header = total matching the status filter (pre-paging)
  - status in {active, done} filters by done flag
"""


def test_default_page_size_is_10(client):
    resp = client.get("/todos")
    assert resp.status_code == 200
    assert len(resp.json()) == 10


def test_total_count_header_present(client):
    resp = client.get("/todos")
    assert resp.headers.get("X-Total-Count") == "25"


def test_second_page(client):
    resp = client.get("/todos", params={"page": 2, "page_size": 10})
    ids = [t["id"] for t in resp.json()]
    assert ids == list(range(11, 21))


def test_last_partial_page(client):
    resp = client.get("/todos", params={"page": 3, "page_size": 10})
    ids = [t["id"] for t in resp.json()]
    assert ids == [21, 22, 23, 24, 25]


def test_custom_page_size(client):
    resp = client.get("/todos", params={"page": 1, "page_size": 5})
    assert len(resp.json()) == 5


def test_filter_status_done(client):
    resp = client.get("/todos", params={"status": "done", "page_size": 100})
    body = resp.json()
    assert resp.headers.get("X-Total-Count") == "8"
    assert all(t["done"] is True for t in body)
    assert len(body) == 8


def test_filter_status_active(client):
    resp = client.get("/todos", params={"status": "active", "page_size": 100})
    body = resp.json()
    assert resp.headers.get("X-Total-Count") == "17"
    assert all(t["done"] is False for t in body)
    assert len(body) == 17


def test_filter_and_paginate_combined(client):
    resp = client.get(
        "/todos", params={"status": "active", "page": 1, "page_size": 5}
    )
    body = resp.json()
    assert len(body) == 5
    assert all(t["done"] is False for t in body)
