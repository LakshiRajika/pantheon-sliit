# scripts

Operational scripts for the backend. Currently contains one script, `seed_data.py`, which populates a freshly migrated database with the baseline data the application needs to be usable.

## seed_data.py

Running this script seeds:

- **Roles** — one `Role` row for every member of the `RoleName` enum (`app/permissions/roles.py`), e.g. `shipping_agent`, `customs_officer`, `port_operations`, `importer_exporter`, `management`, `admin`.
- **Permissions** — one `Permission` row for every member of the `Permission` enum in `app/permissions/permission_catalog.py`.
- **Role-permission links** — `RolePermission` rows connecting each role to its allowed permissions, read directly from the `ROLE_PERMISSIONS` mapping in `app/permissions/policy.py`. This mapping is the single source of truth for what each role can do; the seed script does not decide permissions itself, it just materializes that policy into the database.
- **Demo users** — one `User` per role, with:
  - email: `<role_name>@pantheon.demo` (e.g. `shipping_agent@pantheon.demo`)
  - full name: the role name title-cased (e.g. "Shipping Agent")
  - password: the fixed demo password `Pantheon123!` for every role, hashed with the same `hash_password` used by the real registration flow

All inserts happen inside one database session and are committed together at the end. After committing, the script prints the demo login for every role to stdout so they're easy to copy during manual testing.

### Running it

The script is written to be run as a module so that its `app.*` imports resolve correctly:

```bash
python -m scripts.seed_data
```

Run it once after applying migrations (`alembic upgrade head`) and before starting the server, against an empty database — it does not check for or skip existing rows, so re-running it against a database that already has this data will create duplicates or fail on unique constraints.

On Windows, the script calls `use_selector_event_loop_on_windows()` before `asyncio.run(...)`, for the same reason `run_server.py` does at the application entry point: the selector event loop policy must be set before anything creates an event loop, or the async Postgres driver (`psycopg`) fails to connect.
