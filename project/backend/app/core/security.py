"""Password hashing and JWT access-token creation/decoding used for authenticating users."""

from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()


def hash_password(plain: str) -> str:
    """Hash a plaintext password with Argon2 for storage."""
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plaintext password against a stored Argon2 hash, returning False on mismatch instead of raising."""
    try:
        return _hasher.verify(hashed, plain)
    except VerifyMismatchError:
        return False


def create_access_token(subject: str, role: str, extra_claims: dict | None = None) -> str:
    """Build and sign a JWT access token for the given subject and role, with an expiry and any extra claims."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Verify and decode a JWT access token, returning its claims payload."""
    settings = get_settings()
    # Role in the token is only a cache of what RBAC resolved at login time;
    # every request still re-checks permissions against the database, never
    # trusting this claim alone for authorization decisions.
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
