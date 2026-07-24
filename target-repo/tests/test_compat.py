"""Backward-compatibility guards for the public /todos contract.

These assertions must hold before AND after the pagination feature is
added. GET /todos must keep returning a JSON *array* whose items expose
exactly ``id``, ``title`` and ``done``.
"""


def test_todos_response_is_an_array(client):
    resp = client.get("/todos")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_todo_item_shape_is_stable(client):
    item = client.get("/todos").json()[0]
    assert set(item.keys()) == {"id", "title", "done"}
    assert isinstance(item["id"], int)
    assert isinstance(item["title"], str)
    assert isinstance(item["done"], bool)


def test_create_then_appears_in_list(client):
    client.post("/todos", json={"title": "Compat task"})
    titles = [t["title"] for t in client.get("/todos", params={"page_size": 100}).json()]
    assert "Compat task" in titles
