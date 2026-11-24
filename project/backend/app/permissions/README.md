# Permissions

This directory defines the RBAC model's static data (permission codes, role names, and the role-to-permission mapping) plus the resource-level ("whose record is this") access checks that run alongside role-based permission checks. It's the data/policy half of authorization; `app/auth` is the enforcement half that actually resolves the current user and calls into this.

## Files

- **`permission_catalog.py`** — Defines `Permission`, a `StrEnum` listing every permission code the system recognizes (e.g. `SHIPMENT_CREATE`, `DOCUMENT_UPLOAD`, `WORKFLOW_RETRY`, `REVIEW_DECIDE`, `ANALYTICS_READ_AGGREGATE`, `ADMIN_USERS_MANAGE`, etc.), grouped loosely by domain (shipment, document, workflow, review, tracking, analytics, chat, admin).

- **`roles.py`** — Defines `RoleName`, a `StrEnum` of the six roles in the system: `SHIPPING_AGENT`, `CUSTOMS_OFFICER`, `PORT_OPERATIONS`, `IMPORTER_EXPORTER`, `MANAGEMENT`, `ADMIN`.

- **`policy.py`** — `ROLE_PERMISSIONS`, a static `dict[RoleName, list[Permission]]` that is the source of truth for seeding the `role_permissions` database table (consumed by `scripts/seed_data.py`). Each role is mapped to its granted permission list — e.g. shipping agents get create/read-own/update on shipments plus document and workflow permissions, while admins get the admin-specific permissions and `WORKFLOW_RETRY`/`SHIPMENT_READ_ALL` but deliberately no `CHAT_USE` (admins have no operational chatbot). A comment notes that resource-level checks happen separately in `resource_access.py` — being granted a permission here never implies access to someone else's specific resource.

- **`resource_access.py`** — Resource-level (ownership/scope) checks, applied in addition to the role-based permission checks. `assert_can_access_shipment(user, shipment)` allows customs officers, port operations, management, and admins to see any shipment (since their role already carries `SHIPMENT_READ_ALL`), but restricts shipping agents and importer/exporters to shipments where they are the owning agent or the counterparty (`shipment.shipping_agent_id` / `shipment.importer_id` matching `user.id`), raising `ForbiddenError` otherwise. `assert_can_access_conversation(owner_id, user)` simply raises `ForbiddenError` unless the requesting user is the conversation's owner.

## How the pieces relate

`permission_catalog.py` and `roles.py` are pure enums with no dependencies on each other or on anything else. `policy.py` combines them into `ROLE_PERMISSIONS`, the table that gets seeded into the database and that `app.auth.dependencies.get_user_permissions` queries at request time via the `Role`/`Permission`/`RolePermission` ORM models — this is why `policy.py` is a seed source, not something read live on every request. `resource_access.py` is independent of the permission catalog/policy; it works directly with `RoleName` and the domain models (`Shipment`, `User`) to answer a narrower question — not "does this role have this permission" but "does this specific user own this specific record" — and is called from routers after `app.auth.require_permission` has already confirmed the role-level permission. `app.auth.authorization` re-exports the two `assert_can_access_*` functions so routers have one import point for both permission and resource checks.
