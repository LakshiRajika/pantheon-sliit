"""Maps each user role to its assistant configuration and exposes a lookup
function used by the chat service to resolve which assistant a conversation
should use.
"""

from app.assistants.configs import (
    CUSTOMS_OFFICER_CONFIG,
    IMPORTER_EXPORTER_CONFIG,
    MANAGEMENT_CONFIG,
    PORT_OPERATIONS_CONFIG,
    SHIPPING_AGENT_CONFIG,
)
from app.permissions.roles import RoleName

ASSISTANT_REGISTRY = {
    RoleName.CUSTOMS_OFFICER: CUSTOMS_OFFICER_CONFIG,
    RoleName.PORT_OPERATIONS: PORT_OPERATIONS_CONFIG,
    RoleName.SHIPPING_AGENT: SHIPPING_AGENT_CONFIG,
    RoleName.IMPORTER_EXPORTER: IMPORTER_EXPORTER_CONFIG,
    RoleName.MANAGEMENT: MANAGEMENT_CONFIG,
    # RoleName.ADMIN intentionally absent: no chatbot for Admin.
}


def resolve_assistant(role: RoleName):
    """Looks up the AssistantConfig for a given role, raising if the role has
    no configured assistant (currently only Admin)."""
    config = ASSISTANT_REGISTRY.get(role)
    if config is None:
        raise ValueError(f"No assistant configured for role '{role}'. Admin has no chatbot by design.")
    return config
