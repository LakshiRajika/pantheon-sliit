"""Request and response schemas for authentication endpoints: login, registration, token issuance, and current-user info."""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Credentials submitted to authenticate a user."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Issued access token returned after a successful login or registration."""

    access_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    """New account details submitted when registering a user."""

    email: EmailStr
    password: str
    full_name: str
    role: str  # validated server-side against the Role table, never auto-trusted


class MeResponse(BaseModel):
    """Profile and permission info for the currently authenticated user."""

    id: str
    email: str
    full_name: str
    role: str
    permissions: list[str]
