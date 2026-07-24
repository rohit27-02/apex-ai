"""Acceptance: pagination edge-case robustness (the seeded killer).

This is the criterion a *naive* implementation fails. A naive version
slices the list without validating the paging parameters, so it returns
200 (or crashes) instead of a clean 422 for invalid input.

Correct behaviour:
  - page < 1                -> 422
  - page_size < 1           -> 422
  - page_size > 100         -> 422
  - page far beyond range   -> 200 with an empty array, header unchanged
"""


def test_page_zero_is_rejected(client):
    assert client.get("/todos", params={"page": 0}).status_code == 422


def test_negative_page_is_rejected(client):
    assert client.get("/todos", params={"page": -1}).status_code == 422


def test_page_size_zero_is_rejected(client):
    assert client.get("/todos", params={"page_size": 0}).status_code == 422


def test_page_size_over_max_is_rejected(client):
    assert client.get("/todos", params={"page_size": 101}).status_code == 422


def test_out_of_range_page_returns_empty_array(client):
    resp = client.get("/todos", params={"page": 99, "page_size": 10})
    assert resp.status_code == 200
    assert resp.json() == []
    assert resp.headers.get("X-Total-Count") == "25"
