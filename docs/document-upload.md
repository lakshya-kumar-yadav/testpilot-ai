# Document Upload and Text Extraction

The document preview endpoint extracts text from a requirement document before the user chooses to save it as a requirement.

## Endpoint

`POST /api/projects/:projectId/requirements/preview`

Requires a bearer access token and an active project owned by the authenticated user.

Use `multipart/form-data` with one file field named `file`.

## Supported formats

| Format | Extension | MIME type |
| --- | --- | --- |
| PDF | `.pdf` | `application/pdf` |
| Word document | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Plain text | `.txt` | `text/plain` |

Limits:
- One file per request.
- Maximum upload size: 10 MB.
- Maximum extracted text: 100,000 characters.
- TXT files must be valid UTF-8.
- PDF and DOCX files must contain extractable text. Scanned-image OCR is not included yet.

## Example response

```json
{
  "data": {
    "projectId": "project-uuid",
    "fileName": "login-requirements.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 48210,
    "characterCount": 1260,
    "extractedText": "The user must be able to sign in..."
  }
}
```

The frontend should show the extracted text for review. After the user confirms it, save it with the existing Requirements API:

`POST /api/projects/:projectId/requirements`

Send the document title, confirmed extracted text, and original `sourceFileName`.

## Security and scope

- Authentication and active-project ownership are checked before file processing.
- Files are processed in memory and are not persisted by this endpoint.
- File count, upload size, extension, MIME type, and basic file signatures are checked.
- Text is normalized but not interpreted as trusted instructions.
- Extracted content remains untrusted input. Future LLM prompts must isolate document content from system instructions and defend against prompt injection.
- This endpoint does not execute macros, scripts, embedded content, or uploaded code.
- No OCR, image extraction, permanent file storage, malware scanning, or AI analysis is included in this iteration.
