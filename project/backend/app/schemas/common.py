"""Shared Pydantic field types reused across the request/response schemas."""

from typing import Annotated

from pydantic import BeforeValidator

IdStr = Annotated[str, BeforeValidator(str)]
"""A string field that also accepts a UUID (or any other str()-able value) as
input. Response schemas built with `model_validate()` from a SQLAlchemy ORM
object receive native `uuid.UUID` primary/foreign keys, which plain `str`
fields reject outright; this coerces them before validation instead."""
