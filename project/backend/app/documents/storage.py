"""Filesystem-backed storage helpers for uploaded shipment documents, keyed by storage path rather than stored binary content."""

import uuid
from pathlib import Path

from app.core.config import get_settings


def save_upload(shipment_id: uuid.UUID, filename: str, content: bytes) -> str:
    """Writes the file under a per-shipment protected directory and returns
    the storage path to persist as a DB reference. The DB never stores the
    binary itself - only this path."""
    settings = get_settings()
    safe_name = Path(filename).name  # strip any path components
    doc_id = uuid.uuid4()
    target_dir = Path(settings.upload_dir) / str(shipment_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{doc_id}_{safe_name}"
    target_path.write_bytes(content)
    return str(target_path)


def read_file(storage_path: str) -> bytes:
    """Reads and returns the raw bytes of a previously stored document, raising if the path no longer exists."""
    path = Path(storage_path)
    if not path.is_file():
        raise FileNotFoundError(f"Document not found at {storage_path}")
    return path.read_bytes()


def delete_file(storage_path: str) -> None:
    """Deletes the document file at the given storage path, doing nothing if it is already gone."""
    path = Path(storage_path)
    if path.is_file():
        path.unlink()
