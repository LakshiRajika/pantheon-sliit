"""Creates roles, permissions, role-permission links, and one demo user per
role so every workspace has a login on day one.

Run with:  uv run python -m scripts.seed_data
"""

import asyncio

from app.core.event_loop import use_selector_event_loop_on_windows
from app.core.security import hash_password
from app.database.models import Permission, Role, RolePermission, User
from app.database.session import AsyncSessionLocal
from app.permissions.permission_catalog import Permission as PermEnum
from app.permissions.policy import ROLE_PERMISSIONS
from app.permissions.roles import RoleName

DEMO_PASSWORD = "Pantheon123!"


async def seed() -> None:
    """Populate roles, permissions, role-permission mappings, and one demo user per role, then print the demo login credentials."""
    async with AsyncSessionLocal() as db:
        role_objs: dict[RoleName, Role] = {}
        for role_name in RoleName:
            role = Role(name=role_name.value, description=f"{role_name.value} workspace")
            db.add(role)
            role_objs[role_name] = role
        await db.flush()

        perm_objs: dict[PermEnum, Permission] = {}
        for perm in PermEnum:
            permission = Permission(code=perm.value, description=perm.value)
            db.add(permission)
            perm_objs[perm] = permission
        await db.flush()

        for role_name, perms in ROLE_PERMISSIONS.items():
            for perm in perms:
                db.add(RolePermission(role_id=role_objs[role_name].id, permission_id=perm_objs[perm].id))

        for role_name in RoleName:
            db.add(
                User(
                    email=f"{role_name.value}@pantheon.demo",
                    full_name=role_name.value.replace("_", " ").title(),
                    password_hash=hash_password(DEMO_PASSWORD),
                    role_id=role_objs[role_name].id,
                )
            )

        await db.commit()
        print("Seed complete. Demo login for every role: <role>@pantheon.demo /", DEMO_PASSWORD)
        for role_name in RoleName:
            print(f"  {role_name.value:<20} -> {role_name.value}@pantheon.demo")


if __name__ == "__main__":
    use_selector_event_loop_on_windows()  # must run before asyncio.run() (Windows + psycopg async)
    asyncio.run(seed())
