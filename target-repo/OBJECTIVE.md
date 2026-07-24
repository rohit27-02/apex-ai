# Objective

**Add pagination and status filtering to `GET /todos`, keep the existing API compatible, and add tests.**

## Requirements

`GET /todos` must accept three optional query parameters:

| Param       | Type   | Default | Rules                                   |
|-------------|--------|---------|-----------------------------------------|
| `page`      | int    | `1`     | must be `>= 1`                          |
| `page_size` | int    | `10`    | must be in `[1, 100]`                   |
| `status`    | string | none    | one of `active`, `done` (else all)      |

Behaviour:

- The response **body stays a JSON array of todos** — this is the backward-compatibility contract. Do **not** wrap it in an object.
- Set an `X-Total-Count` response header equal to the number of todos matching the `status` filter **before** pagination is applied.
- `status=active` returns todos with `done == false`; `status=done` returns `done == true`.
- Invalid `page` or `page_size` must return **HTTP 422** (not 200, not 500).
- A `page` beyond the last page returns **HTTP 200** with an **empty array** and an unchanged `X-Total-Count`.

## Definition of done

All four acceptance criteria in `../validation/criteria.json` pass:

1. Backward-compat suite — `tests/`
2. Pagination + filtering — `acceptance/test_pagination.py`
3. Edge-case robustness — `acceptance/test_edge_cases.py`
4. Lint — `ruff check .`
