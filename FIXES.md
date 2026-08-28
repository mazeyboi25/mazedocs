# MazeDocs V2 Clean Fixes

- Fixed Universal Converter route error caused by relying on `/api/routes`.
- Converter now uses a clear output-format dropdown.
- PDF users can explicitly choose DOCX, PPTX, TXT, PNG pages, or JPG pages.
- Conversion POST now uses the stable `/api` endpoint.
- Added safe handling for non-JSON backend error pages.
- Restored missing image helper functions.
- Fixed Images → PDF file selection.
- JPG, PNG, and WEBP are accepted even when the browser provides no MIME type.
- Images → PDF uses the source image itself as the PDF page with no A4 margins.
- Removed Assignment Builder references and unused UI/CSS.
- Removed local `.git`, `.venv`, `.vercel`, and cache folders from this ZIP.
