/* ============================================================
   MAZEDOCS V1 — script.js

   Tools included:
   - Merge PDFs
   - Organize / rotate / delete / extract pages
   - Visual PDF compression
   - Images to PDF
   - Scan photos to PDF
   - OCR images and PDFs

   Processing is local-first in the browser.
   ============================================================ */

(() => {
  "use strict";


  /* ==========================================================
     01. SMALL HELPERS
     ========================================================== */

  const $ = (selector, scope = document) => {
    return scope.querySelector(selector);
  };


  const $$ = (selector, scope = document) => {
    return [...scope.querySelectorAll(selector)];
  };


  const reducedMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;


  const makeId = () => {
    return (
      crypto.randomUUID?.()
      ||
      `${Date.now()}-${Math.random()}`
    );
  };


  const isPdf = (file) => {
    return (
      file?.type === "application/pdf"
      ||
      file?.name
        ?.toLowerCase()
        .endsWith(".pdf")
    );
  };


  const isImage = (file) => {
    return Boolean(
      file?.type?.startsWith(
        "image/"
      )
    );
  };


  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) {
      return "—";
    }


    if (bytes < 1024) {
      return `${bytes} B`;
    }


    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }


    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }


  function cleanBaseName(name) {
    return (
      String(name || "mazedocs-file")
        .replace(/\.[^/.]+$/, "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .trim()
      ||
      "mazedocs-file"
    );
  }


  function downloadBlob(blob, filename) {
    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      filename;


    document.body.appendChild(
      link
    );


    link.click();

    link.remove();


    window.setTimeout(
      () => {
        URL.revokeObjectURL(
          url
        );
      },
      500
    );
  }


  function downloadBytes(
    bytes,
    filename,
    mimeType = "application/octet-stream"
  ) {
    const blob =
      new Blob(
        [bytes],
        {
          type:
            mimeType
        }
      );


    downloadBlob(
      blob,
      filename
    );
  }


  function fileToDataUrl(file) {
    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();


        reader.onload =
          () => {
            resolve(
              reader.result
            );
          };


        reader.onerror =
          reject;


        reader.readAsDataURL(
          file
        );

      }
    );
  }


  /* ==========================================================
     02. PDF.JS CONFIG
     ========================================================== */

  function configurePdfJs() {
    if (!window.pdfjsLib) {
      return;
    }


    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }


  /* ==========================================================
     03. APP STATE
     ========================================================== */

  const state = {
    activeTool:
      "merge",

    mergeFiles:
      [],

    organizeFile:
      null,

    organizeBytes:
      null,

    organizePages:
      [],

    compressFile:
      null,

    imageFiles:
      [],

    scanFiles:
      [],

    ocrFile:
      null
  };


  const toolTitles = {
    merge:
      "Merge PDF",

    organize:
      "Organize PDF",

    compress:
      "Compress PDF",

    images:
      "Images → PDF",

    scan:
      "Scan to PDF",

    ocr:
      "Extract Text",

    convert:
      "Universal Converter"
  };


  /* ==========================================================
     04. ELEMENTS
     ========================================================== */

  const elements = {
    openToolsButton:
      $("#open-tools-button"),

    heroToolsButton:
      $("#hero-tools-button"),

    toolCards:
      $$(".tool-card"),

    toolPanels:
      $$("[data-tool-panel]"),

    workspace:
      $("#workspace"),

    workspaceTitle:
      $("#workspace-title"),

    resetToolButton:
      $("#reset-tool-button"),

    processingOverlay:
      $("#processing-overlay"),

    processingTitle:
      $("#processing-title"),

    processingDetail:
      $("#processing-detail"),

    toast:
      $("#toast"),


    /* Merge */

    mergeInput:
      $("#merge-input"),

    mergeDrop:
      $("#merge-drop"),

    mergeChooseButton:
      $("#merge-choose-button"),

    mergeList:
      $("#merge-list"),

    mergeActions:
      $("#merge-actions"),

    mergeCount:
      $("#merge-count"),

    mergeBuildButton:
      $("#merge-build-button"),


    /* Organize */

    organizeInput:
      $("#organize-input"),

    organizeDrop:
      $("#organize-drop"),

    organizeChooseButton:
      $("#organize-choose-button"),

    organizePages:
      $("#organize-pages"),

    organizeActions:
      $("#organize-actions"),

    organizeSummary:
      $("#organize-summary"),

    organizeExportSelectedButton:
      $("#organize-export-selected-button"),

    organizeExportAllButton:
      $("#organize-export-all-button"),


    /* Compress */

    compressInput:
      $("#compress-input"),

    compressDrop:
      $("#compress-drop"),

    compressChooseButton:
      $("#compress-choose-button"),

    compressFileName:
      $("#compress-file-name"),

    compressFileMeta:
      $("#compress-file-meta"),

    compressSettings:
      $("#compress-settings"),

    compressQuality:
      $("#compress-quality"),

    compressQualityLabel:
      $("#compress-quality-label"),

    compressBuildButton:
      $("#compress-build-button"),


    /* Images */

    imagesInput:
      $("#images-input"),

    imagesDrop:
      $("#images-drop"),

    imagesChooseButton:
      $("#images-choose-button"),

    imagesList:
      $("#images-list"),

    imagesActions:
      $("#images-actions"),

    imagesCount:
      $("#images-count"),

    imagesBuildButton:
      $("#images-build-button"),


    /* Scan */

    scanInput:
      $("#scan-input"),

    scanCameraButton:
      $("#scan-camera-button"),

    scanList:
      $("#scan-list"),

    scanActions:
      $("#scan-actions"),

    scanGrayscale:
      $("#scan-grayscale"),

    scanBuildButton:
      $("#scan-build-button"),


    /* OCR */

    ocrInput:
      $("#ocr-input"),

    ocrDrop:
      $("#ocr-drop"),

    ocrChooseButton:
      $("#ocr-choose-button"),

    ocrFileName:
      $("#ocr-file-name"),

    ocrProgress:
      $("#ocr-progress"),

    ocrStatus:
      $("#ocr-status"),

    ocrPercent:
      $("#ocr-percent"),

    ocrProgressFill:
      $("#ocr-progress-fill"),

    ocrResult:
      $("#ocr-result"),

    ocrOutput:
      $("#ocr-output"),

    ocrCopyButton:
      $("#ocr-copy-button"),

    ocrDownloadButton:
      $("#ocr-download-button")
  };


  /* ==========================================================
     05. FEEDBACK
     ========================================================== */

  function showToast(message) {
    elements.toast.textContent =
      message;


    elements.toast.classList.add(
      "is-visible"
    );


    window.clearTimeout(
      showToast.timer
    );


    showToast.timer =
      window.setTimeout(() => {

        elements.toast.classList.remove(
          "is-visible"
        );

      }, 2500);
  }


  function showProcessing(
    title,
    detail
  ) {
    elements.processingTitle.textContent =
      title;


    elements.processingDetail.textContent =
      detail;


    elements.processingOverlay.hidden =
      false;
  }


  function hideProcessing() {
    elements.processingOverlay.hidden =
      true;
  }


  /* ==========================================================
     06. DRAG / DROP
     ========================================================== */

  function attachDropZone(
    element,
    onFiles
  ) {
    [
      "dragenter",
      "dragover"
    ].forEach(
      (eventName) => {

        element.addEventListener(
          eventName,
          (event) => {

            event.preventDefault();


            element.classList.add(
              "is-dragging"
            );

          }
        );

      }
    );


    [
      "dragleave",
      "drop"
    ].forEach(
      (eventName) => {

        element.addEventListener(
          eventName,
          (event) => {

            event.preventDefault();


            element.classList.remove(
              "is-dragging"
            );


            if (
              eventName ===
              "drop"
            ) {
              onFiles(
                [
                  ...event.dataTransfer.files
                ]
              );
            }

          }
        );

      }
    );
  }


  /* ==========================================================
     07. TOOL NAVIGATION
     ========================================================== */

  function scrollToTools() {
    document
      .querySelector("#tools")
      ?.scrollIntoView({
        behavior:
          reducedMotion
            ? "auto"
            : "smooth",

        block:
          "start"
      });
  }


  function selectTool(toolName) {
    state.activeTool =
      toolName;


    elements.toolCards.forEach(
      (card) => {

        card.classList.toggle(
          "is-active",
          card.dataset.tool ===
            toolName
        );

      }
    );


    elements.toolPanels.forEach(
      (panel) => {

        const isActive =
          panel.dataset.toolPanel ===
          toolName;


        panel.hidden =
          !isActive;


        panel.classList.toggle(
          "is-active",
          isActive
        );

      }
    );


    elements.workspaceTitle.textContent =
      toolTitles[toolName]
      ||
      "MazeDocs";


    elements.workspace.scrollIntoView({
      behavior:
        reducedMotion
          ? "auto"
          : "smooth",

      block:
        "start"
    });
  }


  /* ==========================================================
     08. MERGE PDF
     ========================================================== */

  function addMergeFiles(files) {
    const pdfFiles =
      files.filter(
        isPdf
      );


    if (!pdfFiles.length) {
      showToast(
        "Choose PDF files."
      );

      return;
    }


    pdfFiles.forEach(
      (file) => {

        state.mergeFiles.push({
          id:
            makeId(),

          file
        });

      }
    );


    renderMergeFiles();
  }


  function renderMergeFiles() {
    elements.mergeList.innerHTML =
      "";


    state.mergeFiles.forEach(
      (item, index) => {

        const row =
          document.createElement(
            "article"
          );


        row.className =
          "file-row";


        row.dataset.id =
          item.id;


        row.innerHTML = `
          <span class="file-row__number">
            ${String(index + 1).padStart(2, "0")}
          </span>

          <div class="file-row__info">
            <strong></strong>
            <span></span>
          </div>

          <button
            class="file-remove"
            type="button"
            aria-label="Remove file"
          >
            ×
          </button>
        `;


        row
          .querySelector("strong")
          .textContent =
            item.file.name;


        row
          .querySelector(".file-row__info span")
          .textContent =
            formatBytes(
              item.file.size
            );


        row
          .querySelector(".file-remove")
          .addEventListener(
            "click",
            () => {

              state.mergeFiles =
                state.mergeFiles.filter(
                  (candidate) =>
                    candidate.id !==
                    item.id
                );


              renderMergeFiles();

            }
          );


        elements.mergeList.appendChild(
          row
        );

      }
    );


    elements.mergeActions.hidden =
      state.mergeFiles.length <
      2;


    elements.mergeCount.textContent =
      `${state.mergeFiles.length} file${
        state.mergeFiles.length === 1
          ? ""
          : "s"
      }`;
  }


  async function buildMergedPdf() {
    if (
      state.mergeFiles.length <
      2
    ) {
      showToast(
        "Add at least two PDFs."
      );

      return;
    }


    showProcessing(
      "Combining PDFs.",
      "Copying pages into one new document."
    );


    try {
      const output =
        await PDFLib.PDFDocument.create();


      for (
        const item of
        state.mergeFiles
      ) {
        const source =
          await PDFLib.PDFDocument.load(
            await item.file.arrayBuffer()
          );


        const copiedPages =
          await output.copyPages(
            source,
            source.getPageIndices()
          );


        copiedPages.forEach(
          (page) => {

            output.addPage(
              page
            );

          }
        );
      }


      const bytes =
        await output.save();


      downloadBytes(
        bytes,
        "mazedocs-merged.pdf",
        "application/pdf"
      );


      showToast(
        "Merged PDF ready."
      );
    }
    catch (error) {
      console.error(
        error
      );


      showToast(
        "Could not merge these PDFs."
      );
    }
    finally {
      hideProcessing();
    }
  }


  /* ==========================================================
     09. ORGANIZE PDF
     ========================================================== */

  async function loadOrganizePdf(file) {
    if (
      !file ||
      !isPdf(file)
    ) {
      showToast(
        "Choose a PDF."
      );

      return;
    }


    showProcessing(
      "Opening PDF.",
      "Rendering page previews."
    );


    try {
      const bytes =
        await file.arrayBuffer();


      state.organizeFile =
        file;


      state.organizeBytes =
        bytes.slice(0);


      state.organizePages =
        [];


      const pdf =
        await window.pdfjsLib.getDocument({
          data:
            new Uint8Array(
              bytes.slice(0)
            )
        }).promise;


      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber += 1
      ) {
        elements.processingDetail.textContent =
          `Rendering page ${pageNumber} of ${pdf.numPages}.`;


        const page =
          await pdf.getPage(
            pageNumber
          );


        const viewport =
          page.getViewport({
            scale:
              0.42
          });


        const canvas =
          document.createElement(
            "canvas"
          );


        canvas.width =
          Math.ceil(
            viewport.width
          );


        canvas.height =
          Math.ceil(
            viewport.height
          );


        const context =
          canvas.getContext(
            "2d",
            {
              alpha:
                false
            }
          );


        await page.render({
          canvasContext:
            context,

          viewport
        }).promise;


        state.organizePages.push({
          id:
            makeId(),

          originalIndex:
            pageNumber - 1,

          rotation:
            0,

          selected:
            false,

          canvas
        });
      }


      renderOrganizePages();
    }
    catch (error) {
      console.error(
        error
      );


      showToast(
        "Could not open this PDF."
      );
    }
    finally {
      hideProcessing();
    }
  }


  function renderOrganizePages() {
    elements.organizePages.innerHTML =
      "";


    state.organizePages.forEach(
      (pageState, index) => {

        const card =
          document.createElement(
            "article"
          );


        card.className =
          "page-card";


        if (
          pageState.selected
        ) {
          card.classList.add(
            "is-selected"
          );
        }


        card.dataset.id =
          pageState.id;


        const preview =
          document.createElement(
            "div"
          );


        preview.className =
          "page-card__preview";


        const canvas =
          document.createElement(
            "canvas"
          );


        canvas.width =
          pageState.canvas.width;


        canvas.height =
          pageState.canvas.height;


        canvas
          .getContext("2d")
          .drawImage(
            pageState.canvas,
            0,
            0
          );


        canvas.style.transform =
          `rotate(${pageState.rotation}deg)`;


        preview.appendChild(
          canvas
        );


        preview.addEventListener(
          "click",
          () => {

            pageState.selected =
              !pageState.selected;


            renderOrganizePages();

          }
        );


        const footer =
          document.createElement(
            "div"
          );


        footer.className =
          "page-card__meta";


        footer.innerHTML = `
          <span>
            PAGE ${String(index + 1).padStart(2, "0")}
          </span>

          <div class="page-card__controls">

            <button
              class="page-action rotate-page"
              type="button"
              aria-label="Rotate page"
            >
              ↻
            </button>

            <button
              class="page-action delete-page"
              type="button"
              aria-label="Delete page"
            >
              ×
            </button>

          </div>
        `;


        footer
          .querySelector(".rotate-page")
          .addEventListener(
            "click",
            () => {

              pageState.rotation =
                (
                  pageState.rotation +
                  90
                )
                %
                360;


              renderOrganizePages();

            }
          );


        footer
          .querySelector(".delete-page")
          .addEventListener(
            "click",
            () => {

              state.organizePages =
                state.organizePages.filter(
                  (candidate) =>
                    candidate.id !==
                    pageState.id
                );


              renderOrganizePages();

            }
          );


        card.append(
          preview,
          footer
        );


        elements.organizePages.appendChild(
          card
        );

      }
    );


    const selectedCount =
      state.organizePages.filter(
        (page) =>
          page.selected
      ).length;


    elements.organizeActions.hidden =
      state.organizePages.length ===
      0;


    elements.organizeSummary.textContent =
      `${state.organizePages.length} page${
        state.organizePages.length === 1
          ? ""
          : "s"
      } · ${selectedCount} selected`;
  }


  async function exportOrganizedPdf(
    selectedOnly
  ) {
    if (
      !state.organizeBytes
    ) {
      return;
    }


    const pages =
      selectedOnly
        ? state.organizePages.filter(
            (page) =>
              page.selected
          )
        : state.organizePages;


    if (!pages.length) {
      showToast(
        "Select at least one page."
      );

      return;
    }


    showProcessing(
      "Building PDF.",
      selectedOnly
        ? "Extracting selected pages."
        : "Applying your new page order."
    );


    try {
      const source =
        await PDFLib.PDFDocument.load(
          state.organizeBytes.slice(0)
        );


      const output =
        await PDFLib.PDFDocument.create();


      for (
        const pageState of
        pages
      ) {
        const [copiedPage] =
          await output.copyPages(
            source,
            [
              pageState.originalIndex
            ]
          );


        copiedPage.setRotation(
          PDFLib.degrees(
            pageState.rotation
          )
        );


        output.addPage(
          copiedPage
        );
      }


      const bytes =
        await output.save();


      const baseName =
        cleanBaseName(
          state.organizeFile.name
        );


      downloadBytes(
        bytes,
        selectedOnly
          ? `${baseName}-extracted.pdf`
          : `${baseName}-organized.pdf`,
        "application/pdf"
      );


      showToast(
        "PDF ready."
      );
    }
    catch (error) {
      console.error(
        error
      );


      showToast(
        "Could not export this PDF."
      );
    }
    finally {
      hideProcessing();
    }
  }


  /* ==========================================================
     10. COMPRESS PDF
     ========================================================== */

  function setCompressFile(file) {
    if (
      !file ||
      !isPdf(file)
    ) {
      showToast(
        "Choose a PDF."
      );

      return;
    }


    state.compressFile =
      file;


    elements.compressFileName.textContent =
      file.name;


    elements.compressFileMeta.textContent =
      `${formatBytes(file.size)} · visual compression`;


    elements.compressSettings.hidden =
      false;
  }


  async function compressPdf() {
    if (
      !state.compressFile
    ) {
      return;
    }


    showProcessing(
      "Compressing PDF.",
      "Rebuilding pages as smaller images."
    );


    try {
      const originalBytes =
        await state.compressFile.arrayBuffer();


      const pdf =
        await window.pdfjsLib.getDocument({
          data:
            new Uint8Array(
              originalBytes
            )
        }).promise;


      const output =
        await PDFLib.PDFDocument.create();


      const quality =
        Number(
          elements.compressQuality.value
        )
        /
        100;


      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber += 1
      ) {
        elements.processingDetail.textContent =
          `Compressing page ${pageNumber} of ${pdf.numPages}.`;


        const page =
          await pdf.getPage(
            pageNumber
          );


        const renderScale =
          1.25;


        const viewport =
          page.getViewport({
            scale:
              renderScale
          });


        const canvas =
          document.createElement(
            "canvas"
          );


        canvas.width =
          Math.ceil(
            viewport.width
          );


        canvas.height =
          Math.ceil(
            viewport.height
          );


        const context =
          canvas.getContext(
            "2d",
            {
              alpha:
                false
            }
          );


        context.fillStyle =
          "#ffffff";


        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height
        );


        await page.render({
          canvasContext:
            context,

          viewport
        }).promise;


        const dataUrl =
          canvas.toDataURL(
            "image/jpeg",
            quality
          );


        const jpegBytes =
          await fetch(
            dataUrl
          ).then(
            (response) =>
              response.arrayBuffer()
          );


        const embedded =
          await output.embedJpg(
            jpegBytes
          );


        const newPage =
          output.addPage([
            viewport.width /
              renderScale,

            viewport.height /
              renderScale
          ]);


        newPage.drawImage(
          embedded,
          {
            x:
              0,

            y:
              0,

            width:
              newPage.getWidth(),

            height:
              newPage.getHeight()
          }
        );
      }


      const bytes =
        await output.save({
          useObjectStreams:
            true
        });


      downloadBytes(
        bytes,
        `${cleanBaseName(state.compressFile.name)}-compressed.pdf`,
        "application/pdf"
      );


      showToast(
        `Compressed copy: ${formatBytes(bytes.byteLength)}`
      );
    }
    catch (error) {
      console.error(
        error
      );


      showToast(
        "Could not compress this PDF."
      );
    }
    finally {
      hideProcessing();
    }
  }


  /* ==========================================================
     11. IMAGE HELPERS
     ========================================================== */

  async function normalizeImageForPdf(
  pdfDocument,
  file,
  grayscale = false
) {

  const dataUrl =
    await fileToDataUrl(
      file
    );


  const image =
    await new Promise(
      (resolve, reject) => {

        const element =
          new Image();


        element.onload =
          () => resolve(element);


        element.onerror =
          reject;


        element.src =
          dataUrl;

      }
    );


  /*
   * Limit extremely large images so the browser does not
   * consume unnecessary memory.
   *
   * IMPORTANT:
   * We keep the original aspect ratio.
   */

  const maximumDimension =
    2600;


  const resizeScale =
    Math.min(
      1,

      maximumDimension /
      Math.max(
        image.naturalWidth,
        image.naturalHeight
      )
    );


  const width =
    Math.max(
      1,

      Math.round(
        image.naturalWidth *
        resizeScale
      )
    );


  const height =
    Math.max(
      1,

      Math.round(
        image.naturalHeight *
        resizeScale
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    width;


  canvas.height =
    height;


  /*
   * Keep alpha support enabled.
   *
   * DO NOT use:
   *
   * { alpha: false }
   *
   * because that removes transparency.
   */

  const context =
    canvas.getContext(
      "2d",
      {
        alpha: true
      }
    );


  /*
   * IMPORTANT:
   *
   * Do NOT fill the canvas with white.
   *
   * The previous version had:
   *
   * context.fillStyle = "#ffffff";
   * context.fillRect(...);
   *
   * That is what permanently created a white background.
   */

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  context.drawImage(
    image,
    0,
    0,
    width,
    height
  );


  /*
   * Optional grayscale mode.
   *
   * Used by the Scan tool.
   */

  if (grayscale) {

    const imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );


    const pixels =
      imageData.data;


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {

      const gray =
        (
          pixels[index] *
          0.299
        )
        +
        (
          pixels[index + 1] *
          0.587
        )
        +
        (
          pixels[index + 2] *
          0.114
        );


      pixels[index] =
        gray;


      pixels[index + 1] =
        gray;


      pixels[index + 2] =
        gray;

    }


    context.putImageData(
      imageData,
      0,
      0
    );

  }


  /*
   * Convert everything through PNG.
   *
   * PNG is used instead of JPEG because:
   *
   * - PNG supports transparency
   * - no artificial white background
   * - works consistently for JPG / PNG / WEBP input
   */

  const pngDataUrl =
    canvas.toDataURL(
      "image/png"
    );


  const pngBytes =
    await fetch(
      pngDataUrl
    ).then(
      (response) =>
        response.arrayBuffer()
    );


  const embedded =
    await pdfDocument.embedPng(
      pngBytes
    );


  return {

    embedded,

    width,

    height

  };

}
  async function buildPdfFromImages(
  items,
  filename,
  grayscale = false
) {

  if (!items.length) {

    showToast(
      "Add at least one image."
    );


    return;

  }


  showProcessing(
    "Building PDF.",
    "Turning each image directly into a PDF page."
  );


  try {

    const output =
      await PDFLib.PDFDocument.create();


    for (
      let index = 0;
      index < items.length;
      index += 1
    ) {

      elements.processingDetail.textContent =
        `Adding image ${index + 1} of ${items.length}.`;


      const imageData =
        await normalizeImageForPdf(
          output,
          items[index].file,
          grayscale
        );


      /*
       * ======================================================
       * IMAGE-SIZED PDF PAGE
       * ======================================================
       *
       * Instead of creating:
       *
       * 595 x 842 A4 page
       *
       * we make the PDF page EXACTLY match the image.
       *
       * This removes:
       *
       * - white borders
       * - page margins
       * - A4 padding
       * - letterboxing
       */


      const pageWidth =
        imageData.width;


      const pageHeight =
        imageData.height;


      const page =
        output.addPage([
          pageWidth,
          pageHeight
        ]);


      /*
       * Image starts at the exact bottom-left corner
       * and fills 100% of the PDF page.
       */

      page.drawImage(
        imageData.embedded,
        {

          x:
            0,

          y:
            0,

          width:
            pageWidth,

          height:
            pageHeight

        }
      );

    }


    const bytes =
      await output.save();


    downloadBytes(
      bytes,
      filename,
      "application/pdf"
    );


    showToast(
      "PDF ready."
    );

  }
  catch (error) {

    console.error(
      error
    );


    showToast(
      "Could not build this PDF."
    );

  }
  finally {

    hideProcessing();

  }

}
  /* ==========================================================
     12. IMAGES → PDF
     ========================================================== */

  function addImageFiles(files) {
    addImagesToState(
      state.imageFiles,
      files
    );


    renderImageFiles();
  }


  function renderImageFiles() {
    elements.imagesList.innerHTML =
      "";


    state.imageFiles.forEach(
      (item, index) => {

        const card =
          createImageCard(
            item,
            index,
            () => {

              revokePreview(
                item
              );


              state.imageFiles =
                state.imageFiles.filter(
                  (candidate) =>
                    candidate.id !==
                    item.id
                );


              renderImageFiles();

            }
          );


        elements.imagesList.appendChild(
          card
        );

      }
    );


    elements.imagesActions.hidden =
      state.imageFiles.length ===
      0;


    elements.imagesCount.textContent =
      `${state.imageFiles.length} image${
        state.imageFiles.length === 1
          ? ""
          : "s"
      }`;
  }


  /* ==========================================================
     13. SCAN TO PDF
     ========================================================== */

  function addScanFiles(files) {
    addImagesToState(
      state.scanFiles,
      files
    );


    renderScanFiles();
  }


  function renderScanFiles() {
    elements.scanList.innerHTML =
      "";


    state.scanFiles.forEach(
      (item, index) => {

        const card =
          createImageCard(
            item,
            index,
            () => {

              revokePreview(
                item
              );


              state.scanFiles =
                state.scanFiles.filter(
                  (candidate) =>
                    candidate.id !==
                    item.id
                );


              renderScanFiles();

            }
          );


        elements.scanList.appendChild(
          card
        );

      }
    );


    elements.scanActions.hidden =
      state.scanFiles.length ===
      0;
  }


  /* ==========================================================
     14. OCR
     ========================================================== */

  function setOcrProgress(
    percent,
    status
  ) {
    const safePercent =
      Math.max(
        0,
        Math.min(
          100,
          Number(percent)
        )
      );


    elements.ocrProgress.hidden =
      false;


    elements.ocrPercent.textContent =
      `${Math.round(safePercent)}%`;


    elements.ocrStatus.textContent =
      status;


    elements.ocrProgressFill.style.width =
      `${safePercent}%`;
  }


  async function runOcr(file) {
    if (
      !file
      ||
      (
        !isPdf(file)
        &&
        !isImage(file)
      )
    ) {
      showToast(
        "Choose an image or PDF."
      );

      return;
    }


    state.ocrFile =
      file;


    elements.ocrFileName.textContent =
      `${file.name} · ${formatBytes(file.size)}`;


    elements.ocrOutput.value =
      "";


    elements.ocrResult.hidden =
      true;


    setOcrProgress(
      1,
      "Preparing OCR"
    );


    try {
      let text =
        "";


      if (
        isImage(file)
      ) {
        const result =
          await window.Tesseract.recognize(
            file,
            "eng",
            {
              logger:
                (message) => {

                  if (
                    message.status ===
                    "recognizing text"
                  ) {
                    setOcrProgress(
                      message.progress *
                        100,

                      "Recognizing image text"
                    );
                  }

                }
            }
          );


        text =
          result.data.text
          ||
          "";
      }
      else {
        const bytes =
          await file.arrayBuffer();


        const pdf =
          await window.pdfjsLib.getDocument({
            data:
              new Uint8Array(
                bytes
              )
          }).promise;


        const pageResults =
          [];


        for (
          let pageNumber = 1;
          pageNumber <= pdf.numPages;
          pageNumber += 1
        ) {
          const page =
            await pdf.getPage(
              pageNumber
            );


          const viewport =
            page.getViewport({
              scale:
                1.55
            });


          const canvas =
            document.createElement(
              "canvas"
            );


          canvas.width =
            Math.ceil(
              viewport.width
            );


          canvas.height =
            Math.ceil(
              viewport.height
            );


          const context =
            canvas.getContext(
              "2d",
              {
                alpha:
                  false
              }
            );


          context.fillStyle =
            "#ffffff";


          context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
          );


          await page.render({
            canvasContext:
              context,

            viewport
          }).promise;


          const result =
            await window.Tesseract.recognize(
              canvas,
              "eng",
              {
                logger:
                  (message) => {

                    if (
                      message.status ===
                      "recognizing text"
                    ) {
                      const pageFraction =
                        (
                          pageNumber -
                          1 +
                          message.progress
                        )
                        /
                        pdf.numPages;


                      setOcrProgress(
                        pageFraction *
                          100,

                        `Reading page ${pageNumber} of ${pdf.numPages}`
                      );
                    }

                  }
              }
            );


          pageResults.push(
            `--- PAGE ${pageNumber} ---\n\n${result.data.text || ""}`
          );
        }


        text =
          pageResults.join(
            "\n\n"
          );
      }


      elements.ocrOutput.value =
        text.trim();


      elements.ocrResult.hidden =
        false;


      setOcrProgress(
        100,
        "OCR complete"
      );


      showToast(
        "Text extracted."
      );
    }
    catch (error) {
      console.error(
        error
      );


      showToast(
        "OCR could not read this file."
      );
    }
  }


  function downloadOcrText() {
    const text =
      elements.ocrOutput.value;


    if (!text.trim()) {
      showToast(
        "There is no extracted text yet."
      );

      return;
    }


    const name =
      state.ocrFile
        ? `${cleanBaseName(state.ocrFile.name)}-text.txt`
        : "mazedocs-ocr.txt";


    downloadBlob(
      new Blob(
        [text],
        {
          type:
            "text/plain;charset=utf-8"
        }
      ),
      name
    );
  }


  /* ==========================================================
     16. SORTABLE LISTS
     ========================================================== */

  function initializeSortable(
    element,
    stateKey,
    renderFunction
  ) {
    if (
      !window.Sortable
      ||
      !element
    ) {
      return;
    }


    window.Sortable.create(
      element,
      {
        animation:
          170,

        ghostClass:
          "sortable-ghost",

        onEnd:
          () => {

            const ids =
              [
                ...element.children
              ].map(
                (child) =>
                  child.dataset.id
              );


            const items =
              state[stateKey];


            state[stateKey] =
              ids
                .map(
                  (id) =>
                    items.find(
                      (item) =>
                        item.id ===
                        id
                    )
                )
                .filter(
                  Boolean
                );


            renderFunction();
          }
      }
    );
  }


  /* ==========================================================
     17. RESET ACTIVE TOOL
     ========================================================== */

  function resetActiveTool() {
    if (
      state.activeTool ===
      "merge"
    ) {
      state.mergeFiles =
        [];


      elements.mergeInput.value =
        "";


      renderMergeFiles();
    }


    if (
      state.activeTool ===
      "organize"
    ) {
      state.organizeFile =
        null;


      state.organizeBytes =
        null;


      state.organizePages =
        [];


      elements.organizeInput.value =
        "";


      renderOrganizePages();
    }


    if (
      state.activeTool ===
      "compress"
    ) {
      state.compressFile =
        null;


      elements.compressInput.value =
        "";


      elements.compressFileName.textContent =
        "Choose a PDF to compress";


      elements.compressFileMeta.textContent =
        "Best for scanned or image-heavy PDFs.";


      elements.compressSettings.hidden =
        true;
    }


    if (
      state.activeTool ===
      "images"
    ) {
      state.imageFiles.forEach(
        revokePreview
      );


      state.imageFiles =
        [];


      elements.imagesInput.value =
        "";


      renderImageFiles();
    }


    if (
      state.activeTool ===
      "scan"
    ) {
      state.scanFiles.forEach(
        revokePreview
      );


      state.scanFiles =
        [];


      elements.scanInput.value =
        "";


      renderScanFiles();
    }


    if (
      state.activeTool ===
      "ocr"
    ) {
      state.ocrFile =
        null;


      elements.ocrInput.value =
        "";


      elements.ocrFileName.textContent =
        "Choose an image or PDF";


      elements.ocrProgress.hidden =
        true;


      elements.ocrResult.hidden =
        true;


      elements.ocrOutput.value =
        "";
    }



    showToast(
      `${toolTitles[state.activeTool]} reset.`
    );
  }


  /* ==========================================================
     18. EVENT BINDINGS
     ========================================================== */

  function bindNavigation() {
    elements.openToolsButton.addEventListener(
      "click",
      scrollToTools
    );


    elements.heroToolsButton.addEventListener(
      "click",
      scrollToTools
    );


    elements.toolCards.forEach(
      (card) => {

        card.addEventListener(
          "click",
          () => {

            selectTool(
              card.dataset.tool
            );

          }
        );

      }
    );


    elements.resetToolButton.addEventListener(
      "click",
      resetActiveTool
    );
  }


  function bindMergeTool() {
    elements.mergeChooseButton.addEventListener(
      "click",
      () => {

        elements.mergeInput.click();

      }
    );


    elements.mergeInput.addEventListener(
      "change",
      () => {

        addMergeFiles(
          [
            ...elements.mergeInput.files
          ]
        );


        elements.mergeInput.value =
          "";

      }
    );


    attachDropZone(
      elements.mergeDrop,
      addMergeFiles
    );


    elements.mergeBuildButton.addEventListener(
      "click",
      buildMergedPdf
    );
  }


  function bindOrganizeTool() {
    elements.organizeChooseButton.addEventListener(
      "click",
      () => {

        elements.organizeInput.click();

      }
    );


    elements.organizeInput.addEventListener(
      "change",
      () => {

        loadOrganizePdf(
          elements.organizeInput.files[0]
        );

      }
    );


    attachDropZone(
      elements.organizeDrop,
      (files) => {

        loadOrganizePdf(
          files[0]
        );

      }
    );


    elements.organizeExportSelectedButton.addEventListener(
      "click",
      () => {

        exportOrganizedPdf(
          true
        );

      }
    );


    elements.organizeExportAllButton.addEventListener(
      "click",
      () => {

        exportOrganizedPdf(
          false
        );

      }
    );
  }


  function bindCompressTool() {
    elements.compressChooseButton.addEventListener(
      "click",
      () => {

        elements.compressInput.click();

      }
    );


    elements.compressInput.addEventListener(
      "change",
      () => {

        setCompressFile(
          elements.compressInput.files[0]
        );

      }
    );


    attachDropZone(
      elements.compressDrop,
      (files) => {

        setCompressFile(
          files[0]
        );

      }
    );


    elements.compressQuality.addEventListener(
      "input",
      () => {

        elements.compressQualityLabel.textContent =
          `${elements.compressQuality.value}%`;

      }
    );


    elements.compressBuildButton.addEventListener(
      "click",
      compressPdf
    );
  }


  function bindImagesTool() {
    elements.imagesChooseButton.addEventListener(
      "click",
      () => {

        elements.imagesInput.click();

      }
    );


    elements.imagesInput.addEventListener(
      "change",
      () => {

        addImageFiles(
          [
            ...elements.imagesInput.files
          ]
        );


        elements.imagesInput.value =
          "";

      }
    );


    attachDropZone(
      elements.imagesDrop,
      addImageFiles
    );


    elements.imagesBuildButton.addEventListener(
      "click",
      () => {

        buildPdfFromImages(
          state.imageFiles,
          "mazedocs-images.pdf",
          false
        );

      }
    );
  }


  function bindScanTool() {
    elements.scanCameraButton.addEventListener(
      "click",
      () => {

        elements.scanInput.click();

      }
    );


    elements.scanInput.addEventListener(
      "change",
      () => {

        addScanFiles(
          [
            ...elements.scanInput.files
          ]
        );


        elements.scanInput.value =
          "";

      }
    );


    elements.scanBuildButton.addEventListener(
      "click",
      () => {

        buildPdfFromImages(
          state.scanFiles,
          "mazedocs-scan.pdf",
          elements.scanGrayscale.checked
        );

      }
    );
  }


  function bindOcrTool() {
    elements.ocrChooseButton.addEventListener(
      "click",
      () => {

        elements.ocrInput.click();

      }
    );


    elements.ocrInput.addEventListener(
      "change",
      () => {

        runOcr(
          elements.ocrInput.files[0]
        );

      }
    );


    attachDropZone(
      elements.ocrDrop,
      (files) => {

        runOcr(
          files[0]
        );

      }
    );


    elements.ocrCopyButton.addEventListener(
      "click",
      async () => {

        try {
          await navigator.clipboard.writeText(
            elements.ocrOutput.value
          );


          showToast(
            "Text copied."
          );
        }
        catch {
          elements.ocrOutput.select();


          document.execCommand(
            "copy"
          );


          showToast(
            "Text copied."
          );
        }

      }
    );


    elements.ocrDownloadButton.addEventListener(
      "click",
      downloadOcrText
    );
  }


  /* ==========================================================
     19. LENIS / INTRO ANIMATION
     ========================================================== */

  function initializeLenis() {
    if (
      !window.Lenis
      ||
      reducedMotion
    ) {
      return;
    }


    const lenis =
      new window.Lenis({
        duration:
          0.9,

        smoothWheel:
          true,

        smoothTouch:
          false
      });


    const frame = (time) => {

      lenis.raf(
        time
      );


      window.requestAnimationFrame(
        frame
      );

    };


    window.requestAnimationFrame(
      frame
    );
  }


  function animateIntro() {
    if (
      !window.anime
      ||
      reducedMotion
    ) {
      return;
    }


    window.anime
      .timeline({
        easing:
          "easeOutExpo"
      })

      .add({
        targets:
          ".topbar",

        translateY: [
          -16,
          0
        ],

        opacity: [
          0,
          1
        ],

        duration:
          650
      })

      .add(
        {
          targets:
            ".hero__copy h1 span",

          translateY: [
            38,
            0
          ],

          opacity: [
            0,
            1
          ],

          delay:
            window.anime.stagger(
              70
            ),

          duration:
            850
        },
        "-=350"
      )

      .add(
        {
          targets: [
            ".hero__lede",
            ".hero__actions"
          ],

          translateY: [
            16,
            0
          ],

          opacity: [
            0,
            1
          ],

          delay:
            window.anime.stagger(
              80
            ),

          duration:
            620
        },
        "-=560"
      )

      .add(
        {
          targets:
            ".paper-sheet",

          translateY: [
            25,
            0
          ],

          opacity: [
            0,
            1
          ],

          delay:
            window.anime.stagger(
              90
            ),

          duration:
            760
        },
        "-=620"
      );
  }


  /* ==========================================================
     20. STARTUP
     ========================================================== */

  function initializeSortableLists() {
    initializeSortable(
      elements.mergeList,
      "mergeFiles",
      renderMergeFiles
    );


    initializeSortable(
      elements.organizePages,
      "organizePages",
      renderOrganizePages
    );


    initializeSortable(
      elements.imagesList,
      "imageFiles",
      renderImageFiles
    );


    initializeSortable(
      elements.scanList,
      "scanFiles",
      renderScanFiles
    );

  }


  function initialize() {
    configurePdfJs();

    bindNavigation();

    bindMergeTool();

    bindOrganizeTool();

    bindCompressTool();

    bindImagesTool();

    bindScanTool();

    bindOcrTool();

    initializeSortableLists();

    initializeLenis();

    animateIntro();

    renderMergeFiles();

    renderOrganizePages();

    renderImageFiles();

    renderScanFiles();
  }


  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once:
          true
      }
    );
  }
  else {
    initialize();
  }

})();


/* ============================================================
   MAZEDOCS V2 — UNIVERSAL CONVERTER
   Kept separate from the V1 tool controller so V1 remains stable.
   ============================================================ */

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const converterInput = $("#converter-input");
  const converterDrop = $("#converter-drop");
  const chooseButton = $("#converter-choose-button");
  const clearButton = $("#converter-clear-button");
  const fileCard = $("#converter-file");
  const fileExt = $("#converter-file-ext");
  const fileName = $("#converter-file-name");
  const fileMeta = $("#converter-file-meta");
  const targets = $("#converter-targets");
  const targetGrid = $("#converter-target-grid");
  const routeNote = $("#converter-route-note");
  const action = $("#converter-action");
  const selectedRoute = $("#converter-selected-route");
  const selectedDescription = $("#converter-selected-description");
  const runButton = $("#converter-run-button");
  const engineStatus = $("#converter-engine-status");
  const resetButton = $("#reset-tool-button");
  const toastElement = $("#toast");

  if (!converterInput) {
    return;
  }

  const API_BASE =
    String(window.MAZEDOCS_API_BASE || "")
      .replace(/\/$/, "");

  const state = {
    file: null,
    source: "",
    target: "",
    routes: [],
    apiOnline: false,
    libreoffice: false
  };

  const targetDetails = {
    docx: "Editable Microsoft Word document",
    pptx: "Microsoft PowerPoint presentation",
    pdf: "Portable PDF document",
    txt: "Plain editable text",
    html: "Web-ready HTML document",
    csv: "Comma-separated spreadsheet data",
    json: "Structured JSON data",
    xlsx: "Microsoft Excel workbook",
    png: "PNG image pages",
    jpg: "JPEG image pages",
    webp: "WEBP image"
  };

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function extensionOf(file) {
    const parts = file.name.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function toast(message) {
    if (!toastElement) return;

    toastElement.textContent = message;
    toastElement.classList.add("is-visible");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      toastElement.classList.remove("is-visible");
    }, 2800);
  }

  function setEngineStatus(online, libreoffice, message = "") {
    state.apiOnline = online;
    state.libreoffice = libreoffice;

    engineStatus.classList.toggle("is-online", online);
    engineStatus.classList.toggle("is-full", Boolean(libreoffice));

    const strong = engineStatus.querySelector("strong");
    const small = engineStatus.querySelector("small");

    if (!online) {
      strong.textContent = "Converter API offline";
      small.textContent = message || "Start the MazeDocs V2 Python server to use converters.";
      return;
    }

    if (libreoffice) {
      strong.textContent = "Full conversion engine online";
      small.textContent = "LibreOffice detected · legacy .doc / .ppt / .xls routes enabled.";
      return;
    }

    strong.textContent = "Portable conversion engine online";
    small.textContent = "PDF, modern Office, data, text, and image routes are ready. Legacy Office routes need LibreOffice.";
  }

  async function checkApi() {
    try {
      const response = await fetch(`${API_BASE}/api`, { cache: "no-store" });
      if (!response.ok) throw new Error("API unavailable");
      const data = await response.json();
      setEngineStatus(true, Boolean(data.libreoffice_available));
    }
    catch (error) {
      setEngineStatus(false, false);
    }
  }

  function clearConverter() {
    state.file = null;
    state.source = "";
    state.target = "";
    state.routes = [];

    converterInput.value = "";
    fileCard.hidden = true;
    targets.hidden = true;
    action.hidden = true;
    targetGrid.innerHTML = "";
    converterDrop.hidden = false;
  }

  async function setFile(file) {
    if (!file) return;

    const source = extensionOf(file);
    if (!source) {
      toast("This file has no recognizable extension.");
      return;
    }

    state.file = file;
    state.source = source;
    state.target = "";

    converterDrop.hidden = true;
    fileCard.hidden = false;
    targets.hidden = false;
    action.hidden = true;

    fileExt.textContent = source.toUpperCase();
    fileName.textContent = file.name;
    fileMeta.textContent = formatBytes(file.size);
    targetGrid.innerHTML = '<div class="converter-loading">Finding valid conversion routes…</div>';

    try {
      const response = await fetch(
        `${API_BASE}/api/routes?ext=${encodeURIComponent(source)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unsupported file type");
      }

      state.routes = data.outputs || [];
      routeNote.textContent = data.note || "";
      renderTargets();
    }
    catch (error) {
      state.routes = [];
      targetGrid.innerHTML = `<div class="converter-error">${String(error.message || error)}</div>`;
      routeNote.textContent = "Converter API required.";
    }
  }

  function renderTargets() {
    targetGrid.innerHTML = "";

    if (!state.routes.length) {
      targetGrid.innerHTML = '<div class="converter-error">No conversion routes are available for this format.</div>';
      return;
    }

    state.routes.forEach((route) => {
      const target = typeof route === "string" ? route : route.target;
      const requiresLibreOffice = Boolean(route.requires_libreoffice);
      const available = route.available !== false;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "converter-target";
      button.dataset.target = target;

      if (!available) {
        button.classList.add("is-unavailable");
      }

      button.innerHTML = `
        <span>${target.toUpperCase()}</span>
        <small>${targetDetails[target] || "Converted file"}</small>
        ${requiresLibreOffice ? '<b>FULL ENGINE</b>' : '<b>READY</b>'}
      `;

      button.addEventListener("click", () => {
        if (!available) {
          toast("This route needs the full LibreOffice engine.");
          return;
        }

        state.target = target;

        [...targetGrid.querySelectorAll(".converter-target")].forEach((item) => {
          item.classList.toggle("is-selected", item === button);
        });

        selectedRoute.textContent = `${state.source.toUpperCase()} → ${target.toUpperCase()}`;
        selectedDescription.textContent = route.description || targetDetails[target] || "Converted file";
        action.hidden = false;
      });

      targetGrid.appendChild(button);
    });
  }

  async function convertFile() {
    if (!state.file || !state.target) {
      toast("Choose an output format first.");
      return;
    }

    const originalText = runButton.innerHTML;
    runButton.disabled = true;
    runButton.textContent = "Converting…";
    action.classList.add("is-processing");

    try {
      const form = new FormData();
      form.append("file", state.file);
      form.append("target", state.target);

      const response = await fetch(`${API_BASE}/api/convert`, {
        method: "POST",
        body: form
      });

      if (!response.ok) {
        let message = `Conversion failed (${response.status}).`;
        try {
          const error = await response.json();
          message = error.detail || message;
        }
        catch {}
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const encodedMatch = disposition.match(/filename\\*=UTF-8''([^;]+)/i);
      const plainMatch = disposition.match(/filename="?([^";]+)"?/i);

      let downloadName = `mazedocs-converted.${state.target}`;
      if (encodedMatch) downloadName = decodeURIComponent(encodedMatch[1]);
      else if (plainMatch) downloadName = plainMatch[1];

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 700);

      toast("Conversion complete.");
    }
    catch (error) {
      console.error(error);
      toast(error.message || "Conversion failed.");
    }
    finally {
      runButton.disabled = false;
      runButton.innerHTML = originalText;
      action.classList.remove("is-processing");
    }
  }

  function attachDropZone() {
    ["dragenter", "dragover"].forEach((name) => {
      converterDrop.addEventListener(name, (event) => {
        event.preventDefault();
        converterDrop.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      converterDrop.addEventListener(name, (event) => {
        event.preventDefault();
        converterDrop.classList.remove("is-dragging");

        if (name === "drop") {
          setFile(event.dataTransfer.files[0]);
        }
      });
    });
  }

  chooseButton.addEventListener("click", () => converterInput.click());

  converterInput.addEventListener("change", () => {
    setFile(converterInput.files[0]);
  });

  clearButton.addEventListener("click", clearConverter);
  runButton.addEventListener("click", convertFile);

  resetButton?.addEventListener("click", () => {
    const panel = document.querySelector('[data-tool-panel="convert"]');
    if (panel && !panel.hidden) {
      clearConverter();
    }
  });

  attachDropZone();
  checkApi();
})();
