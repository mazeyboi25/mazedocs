# MazeDocs V1

MazeDocs V1 is a free, local-first student document toolkit.

## Included tools

- Merge PDFs
- Organize PDF pages
- Reorder pages by dragging
- Rotate pages
- Delete pages
- Extract selected pages
- Compress image-heavy PDFs
- Images to PDF
- Phone camera / Scan to PDF
- Optional grayscale scan output
- OCR for images
- OCR for scanned PDFs
- Copy / download extracted text
- Assignment Builder for combining PDFs and images

## V2

The universal file-converter suite is intentionally reserved for MazeDocs V2.

Planned V2 examples:

- PDF → Word
- PDF → PowerPoint
- Word → PDF
- PowerPoint → Word
- PowerPoint → PDF
- Excel / CSV conversion tools
- More common student file conversions

## Run locally

MazeDocs V1 is static and does not require Python.

Recommended:

1. Open the folder in VS Code.
2. Use the Live Server extension.
3. Open `index.html`.

You can also run:

```bash
python -m http.server 5500
```

Then visit:

```text
http://localhost:5500
```

## Deploy to Vercel

From the MazeDocs folder:

```bash
vercel
```

Then deploy production:

```bash
vercel --prod
```

Or force a fresh production build:

```bash
vercel --prod --force
```

## Privacy

Core document processing happens locally in the browser. MazeDocs V1 does not have a file-upload backend.

It loads these browser libraries from public CDNs:

- pdf-lib
- PDF.js
- Tesseract.js
- SortableJS
- Anime.js
- Lenis

## Compression note

V1 PDF compression is intended mainly for scanned or image-heavy school PDFs.

It renders each PDF page as a JPEG and rebuilds the document. This may reduce file size considerably, but selectable/searchable text becomes flattened into an image.

## Mobile

The interface is optimized for phone widths including:

- 360 × 800
- 390 × 844
- 430 × 932

The Scan tool uses `capture="environment"` where supported so phones can open the rear camera.
