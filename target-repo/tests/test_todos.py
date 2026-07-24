"""CRUD unit tests for the todo service (repo baseline suite)."""


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_list_returns_all_seeded(client):
    resp = client.get("/todos", params={"page_size": 100})
    assert resp.status_code == 200
    assert len(resp.json()) == 25


def test_get_single(client):
    resp = client.get("/todos/1")
    assert resp.status_code == 200
    assert resp.json()["id"] == 1


def test_get_missing_returns_404(client):
    resp = client.get("/todos/9999")
    assert resp.status_code == 404


def test_create(client):
    resp = client.post("/todos", json={"title": "New task", "done": False})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "New task"
    assert body["id"] == 26


def test_delete(client):
    resp = client.delete("/todos/1")
    assert resp.status_code == 204
    assert client.get("/todos/1").status_code == 404
