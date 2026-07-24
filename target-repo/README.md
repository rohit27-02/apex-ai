# Todo Service (target repo)

A small FastAPI todo service used as the **target repository** for the
APEX-AI control plane. The agent under test is pointed at this repo and
asked to complete the task in [`OBJECTIVE.md`](./OBJECTIVE.md).

## Layout

```
app/            service code (main, store, schemas)
tests/          baseline CRUD + backward-compat suite (green at base)
acceptance/     objective acceptance tests (red at base, green when solved)
conftest.py     shared fixtures (re-seeds store per test)
```

## Running

```powershell
# from this directory, with the repo venv active
python -m pytest tests -q          # baseline suite
python -m pytest acceptance -q      # objective acceptance suite
ruff check .                        # lint
```

## Store seed

25 todos, `done` when `id % 3 == 0` → **8 done**, **17 active**.
