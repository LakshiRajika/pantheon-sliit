# Documents

This package handles everything related to uploaded shipment documents: where the
underlying files live on disk, and how their contents are turned into
structured data and checked for correctness.

## storage.py

`storage.py` is the protected file storage layer for uploaded documents. It
writes and reads files directly on the filesystem rather than in the
database:

- `save_upload(shipment_id, filename, content)` strips any path components
  from the supplied filename (so a crafted filename can't escape the target
  directory), creates a per-shipment subdirectory under the configured
  `upload_dir`, and writes the file under a name prefixed with a freshly
  generated document UUID (`{doc_id}_{safe_name}`). It returns the resulting
  storage path as a plain string.
- `read_file(storage_path)` reads back the raw bytes for a given storage
  path, raising `FileNotFoundError` if the file is no longer present.
- `delete_file(storage_path)` removes the file at a storage path, silently
  doing nothing if it has already been deleted.

The key design point is that the database never stores the document's binary
content - only the storage path string returned by `save_upload`. The actual
bytes live in a per-shipment directory on disk, outside any publicly served
location, and are only ever accessed again through `read_file`/`delete_file`
using that stored path. This keeps the database lightweight and keeps
document content behind the same access controls as the rest of the
application rather than exposed as static files.

## extractors/ and validators/

The `extractors/` subdirectory is responsible for turning a raw PDF's bytes
into text and then into structured trade-document fields (bill of lading
number, container number, vessel name, certificate number). The
`validators/` subdirectory then runs deterministic checks against those
extracted fields - required-field completeness for a given document type,
and cross-document consistency checks between two sets of extracted fields.
See each subdirectory's own README for details.
