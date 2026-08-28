# MazeDocs V2 — Student Utility OS

MazeDocs V2 keeps every V1 PDF/student utility and adds a **Universal Converter**.

## V1 tools still included

- Merge PDF
- Organize / reorder PDF pages
- Rotate, delete, and extract pages
- Compress image-heavy PDFs
- Images → PDF
- Scan / camera → PDF
- OCR images and PDFs
- Assignment Builder

## New in V2

### PDF

- PDF → DOCX
- PDF → PPTX
- PDF → TXT
- PDF → PNG pages (ZIP)
- PDF → JPG pages (ZIP)

### Word

- DOCX → PDF
- DOCX → TXT
- DOCX → HTML
- DOC → DOCX / PDF / TXT with LibreOffice

### PowerPoint

- PPTX → DOCX
- PPTX → PDF
- PPTX → TXT
- PPT → DOCX / PDF / TXT with LibreOffice

`PPTX → DOCX` creates a Word handout with slide headings, extracted slide text, tables, and available slide images.

### Spreadsheets / data

- XLSX → CSV
- XLSX → JSON
- XLSX → PDF
- XLS → XLSX / CSV / JSON / PDF with LibreOffice
- CSV → XLSX / JSON
- JSON → CSV / XLSX

### Text / web

- TXT → DOCX / PDF
- Markdown → HTML / DOCX / PDF
- HTML → TXT / DOCX / PDF

### Images

- JPG / PNG / WEBP / HEIC → common image formats
- JPG / PNG / WEBP / HEIC → PDF

## Two conversion modes

### Portable engine

Pure Python routes work without LibreOffice, including the important V2 routes:

- PDF → Word
- PDF → PowerPoint
- PPTX → Word
- PDF → images
- spreadsheet/data conversions
- image conversions

Modern Office → PDF routes have a basic pure-Python fallback if LibreOffice is missing.

### Full engine

Legacy `.doc`, `.ppt`, and `.xls` require LibreOffice.

The included `Dockerfile` installs LibreOffice so the full engine works on a Docker host such as Render or Railway.

## Run locally on Windows

From the MazeDocs V2 folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn server:app --reload --port 8000
```

Open:

```text
http://127.0.0.1:8000
```

API health:

```text
http://127.0.0.1:8000/api
```

### Optional: enable legacy .doc / .ppt / .xls locally

Install LibreOffice. MazeDocs checks common Windows locations automatically, including:

```text
C:\Program Files\LibreOffice\program\soffice.exe
```

Restart the server and `/api` should show:

```json
"libreoffice_available": true
```

## Vercel

The root still includes `vercel.json` and `api/index.py`.

You can deploy with:

```powershell
vercel --prod --force
```

Important: Vercel does **not** provide LibreOffice in the normal Python runtime, so legacy `.doc`, `.ppt`, and `.xls` routes will be disabled there. Vercel request-body limits can also be lower than MazeDocs' own 25 MB application limit.

For the complete V2 conversion engine, use the Docker deployment.

## Docker / Render / Railway

Build locally:

```powershell
docker build -t mazedocs-v2 .
docker run -p 8000:8000 mazedocs-v2
```

Then open:

```text
http://localhost:8000
```

The Docker image includes LibreOffice Writer, Impress, and Calc.

## GitHub release

Recommended V2 tag:

```powershell
git add .
git commit -m "Release MazeDocs V2"
git tag -a v2.0.0 -m "MazeDocs V2"
git push origin main
git push origin v2.0.0
```

## Conversion quality notes

- **PDF → DOCX:** designed for editable output. Highly complex PDF layouts may shift because PDFs do not store Word-style document structure.
- **PDF → PPTX:** prioritizes visual fidelity by putting each PDF page onto its own PowerPoint slide.
- **PPTX → DOCX:** creates an editable study/handout document, rather than trying to reproduce the slide canvas exactly.
- **Office → PDF:** LibreOffice provides the best results. Portable fallback output is intentionally simpler.
