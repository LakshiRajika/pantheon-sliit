"""Request and response schemas for user administration: viewing users, assigning roles, and toggling active status."""

from pydantic import BaseModel


class UserOut(BaseModel):
    """Public representation of a user account."""

    id: str
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class RoleAssignRequest(BaseModel):
    """Request to change a user's assigned role."""

    role: str


class StatusUpdateRequest(BaseModel):
    """Request to activate or deactivate a user account."""

    is_active: bool
