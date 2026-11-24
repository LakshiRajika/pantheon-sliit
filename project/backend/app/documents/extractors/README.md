# Document Extractors

This subdirectory turns an uploaded PDF's raw bytes into plain text and then
into a small set of structured trade-document fields.

## pdf_extractor.py

- `extract_text(pdf_bytes)` parses the PDF using `pypdf.PdfReader` and
  concatenates the extracted text of every page into a single string,
  separated by newlines. Parsing failures (an unreadable PDF) and
  per-page extraction failures are both caught and logged as warnings rather
  than raised, so a bad or partially corrupt PDF yields an empty or partial
  string instead of crashing the caller.

- `extract_structured_fields(raw_text)` runs each regex in `FIELD_PATTERNS`
  against the extracted text with `pattern.search(...)` and returns a dict
  mapping each field name to its first match (stripped of surrounding
  whitespace) or `None` if the pattern didn't match anywhere in the text.

- `FIELD_PATTERNS` is a dict of compiled regexes for the trade-document
  fields the system currently looks for:
  - `bill_of_lading_number` - matches a "B/L", "B/L No.", or "B/L Number"
    label followed by an optional `:`/`#` separator and a value of 5 or more
    uppercase letters, digits, or hyphens.
  - `container_number` - matches a standard ISO container number: four
    uppercase letters followed by seven digits (e.g. `MSCU1234567`).
  - `vessel_name` - matches a "Vessel" label followed by a free-form value
    of 3-50 characters (letters, digits, spaces, periods, apostrophes,
    hyphens).
  - `certificate_number` - matches a "Certificate", "Certificate No.", or
    "Certificate Number" label followed by a value of 5 or more uppercase
    letters, digits, or hyphens.

  These patterns are deliberately simple for the current stage of the
  project; a layout-aware or LLM-assisted extractor is the expected upgrade
  path as document variety grows.

### Case-sensitivity of the label vs. the capture group

Each pattern wraps only its label portion in a scoped inline group,
`(?i:...)`, so that just the label text ("B/L", "Vessel", "Certificate", "No.",
"Number", etc.) is matched case-insensitively. The capture group that follows
- `([A-Z0-9-]{5,})` and similar - deliberately stays case-sensitive.

This matters because a single trailing `re.I` flag on the whole pattern would
make the capture group case-insensitive too, allowing it to match lowercase
letters. In that case, a label word immediately adjacent to the capture
group - such as "Number" itself (6 letters, no digits, satisfying a
`{5,}` length requirement) - could be captured as if it were the field value,
instead of the actual bill-of-lading or certificate number that follows it.
Scoping the case-insensitivity to only the label avoids this: the label can
appear in any casing, but the captured value is still constrained to the
uppercase-letter/digit/hyphen pattern real identifiers use.
