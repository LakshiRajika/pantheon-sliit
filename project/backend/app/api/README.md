# app/api

This package is the top-level HTTP/WebSocket entry point of the API layer. It contains a single file, `router.py`, whose job is to aggregate every versioned router into one `APIRouter` instance that the application mounts under a common prefix.

## router.py

`router.py` creates `api_router = APIRouter()` and includes, in order, the routers from `app/api/v1`:

- `auth.router`
- `ws.router` (the WebSocket endpoint)
- `users.router`
- `shipments.router`
- `documents.router`
- `workflows.router`
- `reviews.router`
- `tracking.router`
- `analytics.router`
- `chat.router`
- `admin.router`

Each of these sub-routers defines its own path prefix and tags (see `app/api/v1/README.md` for the full endpoint list). `router.py` itself adds no prefix, no dependencies, and no additional logic — it exists purely to give the application a single object to mount.

`app/main.py` then wires this aggregate router into the FastAPI app with:

```python
app.include_router(api_router, prefix=settings.api_prefix)
```

where `settings.api_prefix` defaults to `/api/v1`. As a result, every endpoint defined across the `v1` routers (and the `/ws` WebSocket route) becomes reachable under `/api/v1/...`. Adding a new feature router to the API only requires importing it here and calling `api_router.include_router(...)` — no changes to `main.py` are needed.
