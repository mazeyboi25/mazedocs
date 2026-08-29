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


  /*
   * MazeDocs user-facing file ceiling.
   *
   * IMPORTANT:
   * This does NOT increase Vercel Function's request-body limit.
   * Universal Converter files are sent directly from the browser
   * to the Railway converter backend, so they do not pass through
   * a Vercel Function request body.
   */
  const MAX_APP_FILE_BYTES =
    200 * 1024 * 1024;


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
    if (!file) {
      return false;
    }

    if (file.type?.startsWith("image/")) {
      return true;
    }

    return /\.(jpe?g|png|webp)$/i.test(
      file.name || ""
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

    scanCount:
      $("#scan-count"),

    scanBuildButton:
      $("#scan-build-button"),


    /* Image enhancement preview */

    enhancementModal:
      $("#enhancement-modal"),

    enhancementClose:
      $("#enhancement-close"),

    enhancementOriginal:
      $("#enhancement-original"),

    enhancementPreview:
      $("#enhancement-preview"),

    enhancementPreviewLabel:
      $("#enhancement-preview-label"),

    enhancementRendering:
      $("#enhancement-rendering"),

    enhancementStatus:
      $("#enhancement-status"),

    enhancementScroll:
      $("#enhancement-scroll"),

    enhancementCompare:
      $("#enhancement-compare"),

    enhancementPresets:
      $("#enhancement-presets"),

    enhancementCropOpen:
      $("#enhancement-crop-open"),

    enhancementCropState:
      $("#enhancement-crop-state"),

    enhancementCropPanel:
      $("#enhancement-crop-panel"),

    enhancementCropStage:
      $("#enhancement-crop-stage"),

    enhancementCropImage:
      $("#enhancement-crop-image"),

    enhancementCropPolygon:
      $("#enhancement-crop-polygon"),

    enhancementCropLine:
      $("#enhancement-crop-line"),

    enhancementCropHandles:
      $$("[data-crop-corner]"),

    enhancementCropAuto:
      $("#enhancement-crop-auto"),

    enhancementCropReset:
      $("#enhancement-crop-reset"),

    enhancementCropCancel:
      $("#enhancement-crop-cancel"),

    enhancementCropDone:
      $("#enhancement-crop-done"),

    enhancementPresetButtons:
      $$("[data-enhancement]"),

    enhancementApplyAll:
      $("#enhancement-apply-all"),

    enhancementApplyPage:
      $("#enhancement-apply-page"),


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

  const IMAGE_ENHANCEMENT_PRESETS = {
    original: {
      label: "Original"
    },

    auto: {
      label: "Auto Scan"
    },

    document: {
      label: "Clean Document"
    },

    vivid: {
      label: "Color Scan"
    },

    grayscale: {
      label: "Clean Gray"
    },

    bw: {
      label: "B&W Scan"
    },

    shadow: {
      label: "Remove Shadows"
    },

    sharpen: {
      label: "Text Boost"
    },

    denoise: {
      label: "Denoise"
    },

    photo: {
      label: "Photo Enhance"
    }
  };


  const FULL_CROP_QUAD = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ];


  let enhancementSession = {
    item: null,
    items: null,
    mode: "original",
    previewUrl: "",
    requestId: 0,
    returnFocus: null,
    cropQuad: null,
    savedCropQuad: null,
    cropEditing: false
  };


  let openCvPromise = null;


  /*
   * Enhancement previews are intentionally serialized.
   * Rapid preset clicks must never start several large canvas jobs at once.
   */
  let enhancementPreviewTimer = 0;
  let enhancementPreviewRunning = false;
  let enhancementPreviewPending = false;


  function scheduleEnhancementPreview(delay = 70) {
    window.clearTimeout(enhancementPreviewTimer);

    enhancementPreviewTimer = window.setTimeout(
      async () => {
        enhancementPreviewTimer = 0;

        if (enhancementPreviewRunning) {
          enhancementPreviewPending = true;
          return;
        }

        enhancementPreviewRunning = true;

        try {
          do {
            enhancementPreviewPending = false;
            await renderEnhancementPreview();
          } while (enhancementPreviewPending);
        }
        finally {
          enhancementPreviewRunning = false;
        }
      },
      delay
    );
  }


  function clampChannel(value) {
    return Math.max(
      0,
      Math.min(
        255,
        value
      )
    );
  }


  function getEnhancementLabel(mode) {
    return (
      IMAGE_ENHANCEMENT_PRESETS[mode]?.label
      ||
      IMAGE_ENHANCEMENT_PRESETS.original.label
    );
  }


  function cloneCropQuad(quad) {
    const source =
      Array.isArray(quad)
      && quad.length === 4
        ? quad
        : FULL_CROP_QUAD;


    return source.map(
      (point) => ({
        x: Math.max(0, Math.min(1, Number(point?.x) || 0)),
        y: Math.max(0, Math.min(1, Number(point?.y) || 0))
      })
    );
  }


  function isFullCropQuad(quad) {
    if (
      !Array.isArray(quad)
      || quad.length !== 4
    ) {
      return true;
    }


    return quad.every(
      (point, index) => {
        const target =
          FULL_CROP_QUAD[index];


        return (
          Math.abs(point.x - target.x) < 0.002
          &&
          Math.abs(point.y - target.y) < 0.002
        );
      }
    );
  }


  function cropDistance(a, b) {
    return Math.hypot(
      b.x - a.x,
      b.y - a.y
    );
  }


  function orderCropPoints(points) {
    if (
      !Array.isArray(points)
      || points.length !== 4
    ) {
      return cloneCropQuad();
    }


    const bySum =
      [...points].sort(
        (a, b) =>
          (a.x + a.y)
          -
          (b.x + b.y)
      );


    const byDifference =
      [...points].sort(
        (a, b) =>
          (a.x - a.y)
          -
          (b.x - b.y)
      );


    return [
      bySum[0],
      byDifference[3],
      bySum[3],
      byDifference[0]
    ].map(
      (point) => ({
        x: Math.max(0, Math.min(1, point.x)),
        y: Math.max(0, Math.min(1, point.y))
      })
    );
  }



  async function waitForOpenCvReady() {
    const started =
      Date.now();


    while (
      Date.now() - started < 16000
    ) {
      let candidate =
        window.cv;


      try {
        if (
          candidate
          && typeof candidate.then === "function"
        ) {
          candidate =
            await candidate;


          window.cv =
            candidate;
        }
      }
      catch (error) {
        throw error;
      }


      if (
        candidate
        && candidate.Mat
        && typeof candidate.imread === "function"
        && typeof candidate.warpPerspective === "function"
      ) {
        return candidate;
      }


      await new Promise(
        (resolve) =>
          window.setTimeout(
            resolve,
            80
          )
      );
    }


    throw new Error(
      "Advanced scan engine timed out."
    );
  }


  function loadOpenCv() {
    if (
      window.cv
      && window.cv.Mat
      && typeof window.cv.imread === "function"
    ) {
      return Promise.resolve(
        window.cv
      );
    }


    if (
      openCvPromise
    ) {
      return openCvPromise;
    }


    openCvPromise =
      new Promise(
        (resolve, reject) => {
          const existing =
            document.querySelector(
              "script[data-mazedocs-opencv]"
            );


          const finish =
            () => {
              waitForOpenCvReady()
                .then(resolve)
                .catch(
                  (error) => {
                    openCvPromise =
                      null;


                    reject(error);
                  }
                );
            };


          if (
            existing
          ) {
            finish();

            return;
          }


          const script =
            document.createElement(
              "script"
            );


          script.src =
            "https://docs.opencv.org/4.x/opencv.js";


          script.async =
            true;


          script.dataset.mazedocsOpencv =
            "true";


          script.addEventListener(
            "load",
            finish,
            {
              once: true
            }
          );


          script.addEventListener(
            "error",
            () => {
              openCvPromise =
                null;


              reject(
                new Error(
                  "Could not load the advanced scan engine."
                )
              );
            },
            {
              once: true
            }
          );


          document.head.appendChild(
            script
          );
        }
      );


    return openCvPromise;
  }


  async function loadImageElement(file) {
    const objectUrl =
      URL.createObjectURL(
        file
      );


    try {
      return await new Promise(
        (resolve, reject) => {
          const image =
            new Image();


          image.decoding =
            "async";


          image.onload =
            () => resolve(image);


          image.onerror =
            () => reject(
              new Error(
                "Could not decode this image."
              )
            );


          image.src =
            objectUrl;
        }
      );
    }
    finally {
      /*
       * The decoded image remains usable after load, so the temporary Blob
       * URL can be released immediately instead of keeping a second large
       * representation of the photo alive in memory.
       */
      URL.revokeObjectURL(
        objectUrl
      );
    }
  }


  function createWorkingCanvas(
    image,
    maximumDimension
  ) {
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


    const context =
      canvas.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );


    context.clearRect(
      0,
      0,
      width,
      height
    );


    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );


    return {
      canvas,
      context,
      width,
      height
    };
  }


  function luminance(
    red,
    green,
    blue
  ) {
    return (
      red * 0.299
      +
      green * 0.587
      +
      blue * 0.114
    );
  }


  function findAutoLevels(
    pixels
  ) {
    const histogram =
      new Uint32Array(
        256
      );


    const pixelCount =
      Math.max(
        1,
        pixels.length / 4
      );


    const stride =
      Math.max(
        1,
        Math.floor(
          pixelCount /
          80000
        )
      );


    let samples =
      0;


    for (
      let pixelIndex = 0;
      pixelIndex < pixelCount;
      pixelIndex += stride
    ) {
      const offset =
        pixelIndex * 4;


      if (
        pixels[offset + 3] <
        8
      ) {
        continue;
      }


      const value =
        Math.round(
          luminance(
            pixels[offset],
            pixels[offset + 1],
            pixels[offset + 2]
          )
        );


      histogram[
        Math.max(
          0,
          Math.min(
            255,
            value
          )
        )
      ] += 1;


      samples += 1;
    }


    if (
      samples <
      10
    ) {
      return {
        low: 0,
        high: 255
      };
    }


    const lowTarget =
      samples * 0.012;


    const highTarget =
      samples * 0.992;


    let cumulative =
      0;


    let low =
      0;


    let high =
      255;


    for (
      let value = 0;
      value < 256;
      value += 1
    ) {
      cumulative +=
        histogram[value];


      if (
        cumulative >=
        lowTarget
      ) {
        low =
          value;

        break;
      }
    }


    cumulative =
      0;


    for (
      let value = 0;
      value < 256;
      value += 1
    ) {
      cumulative +=
        histogram[value];


      if (
        cumulative >=
        highTarget
      ) {
        high =
          value;

        break;
      }
    }


    if (
      high - low <
      48
    ) {
      low =
        Math.max(
          0,
          low - 20
        );


      high =
        Math.min(
          255,
          high + 20
        );
    }


    return {
      low,
      high
    };
  }


  function applyAutoTone(
    imageData,
    {
      saturation = 1.06,
      contrast = 1.04,
      brightness = 0
    } = {}
  ) {
    const pixels =
      imageData.data;


    const {
      low,
      high
    } =
      findAutoLevels(
        pixels
      );


    const range =
      Math.max(
        1,
        high - low
      );


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {
      if (
        pixels[index + 3] ===
        0
      ) {
        continue;
      }


      let red =
        (
          (
            pixels[index] -
            low
          ) /
          range
        ) *
        255;


      let green =
        (
          (
            pixels[index + 1] -
            low
          ) /
          range
        ) *
        255;


      let blue =
        (
          (
            pixels[index + 2] -
            low
          ) /
          range
        ) *
        255;


      const gray =
        luminance(
          red,
          green,
          blue
        );


      red =
        gray
        +
        (
          red - gray
        ) *
        saturation;


      green =
        gray
        +
        (
          green - gray
        ) *
        saturation;


      blue =
        gray
        +
        (
          blue - gray
        ) *
        saturation;


      red =
        (
          red - 128
        ) *
        contrast
        +
        128
        +
        brightness;


      green =
        (
          green - 128
        ) *
        contrast
        +
        128
        +
        brightness;


      blue =
        (
          blue - 128
        ) *
        contrast
        +
        128
        +
        brightness;


      pixels[index] =
        clampChannel(
          red
        );


      pixels[index + 1] =
        clampChannel(
          green
        );


      pixels[index + 2] =
        clampChannel(
          blue
        );
    }
  }


  function createBlurredBackground(
    canvas,
    radius
  ) {
    const blurred =
      document.createElement(
        "canvas"
      );


    blurred.width =
      canvas.width;


    blurred.height =
      canvas.height;


    const context =
      blurred.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );


    context.clearRect(
      0,
      0,
      blurred.width,
      blurred.height
    );


    /*
     * Large-radius illumination estimation is done on a small copy and then
     * scaled back up. It produces a smoother page-lighting map while avoiding
     * an expensive 50–100 px blur over every full-resolution PDF page.
     */
    if (
      radius > 3
    ) {
      const maximumSide =
        360;


      const scale =
        Math.min(
          1,
          maximumSide /
          Math.max(
            canvas.width,
            canvas.height
          )
        );


      const small =
        document.createElement(
          "canvas"
        );


      small.width =
        Math.max(
          24,
          Math.round(
            canvas.width * scale
          )
        );


      small.height =
        Math.max(
          24,
          Math.round(
            canvas.height * scale
          )
        );


      const smallContext =
        small.getContext(
          "2d"
        );


      smallContext.imageSmoothingEnabled =
        true;


      smallContext.imageSmoothingQuality =
        "high";


      smallContext.drawImage(
        canvas,
        0,
        0,
        small.width,
        small.height
      );


      const softened =
        document.createElement(
          "canvas"
        );


      softened.width =
        small.width;


      softened.height =
        small.height;


      const softenedContext =
        softened.getContext(
          "2d"
        );


      if (
        "filter" in softenedContext
      ) {
        softenedContext.filter =
          `blur(${Math.max(4, Math.min(14, radius * scale * 1.8))}px)`;
      }


      softenedContext.drawImage(
        small,
        0,
        0
      );


      softenedContext.filter =
        "none";


      context.imageSmoothingEnabled =
        true;


      context.imageSmoothingQuality =
        "high";


      context.drawImage(
        softened,
        0,
        0,
        blurred.width,
        blurred.height
      );
    }
    else {
      if (
        "filter" in context
      ) {
        context.filter =
          `blur(${radius}px)`;
      }


      context.drawImage(
        canvas,
        0,
        0
      );


      context.filter =
        "none";
    }


    return context.getImageData(
      0,
      0,
      blurred.width,
      blurred.height
    );
  }



  function normalizePageLighting(
    imageData,
    backgroundData,
    strength = 1
  ) {
    const pixels =
      imageData.data;


    const background =
      backgroundData.data;


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {
      if (
        pixels[index + 3] ===
        0
      ) {
        continue;
      }


      const currentLum =
        Math.max(
          1,
          luminance(
            pixels[index],
            pixels[index + 1],
            pixels[index + 2]
          )
        );


      const backgroundLum =
        Math.max(
          28,
          luminance(
            background[index],
            background[index + 1],
            background[index + 2]
          )
        );


      const targetLum =
        clampChannel(
          (
            currentLum /
            backgroundLum
          ) *
          236
        );


      const correctedLum =
        currentLum
        +
        (
          targetLum -
          currentLum
        ) *
        strength;


      const ratio =
        correctedLum /
        currentLum;


      pixels[index] =
        clampChannel(
          pixels[index] *
          ratio
        );


      pixels[index + 1] =
        clampChannel(
          pixels[index + 1] *
          ratio
        );


      pixels[index + 2] =
        clampChannel(
          pixels[index + 2] *
          ratio
        );
    }
  }


  function applyGrayscale(
    imageData
  ) {
    const pixels =
      imageData.data;


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {
      const gray =
        luminance(
          pixels[index],
          pixels[index + 1],
          pixels[index + 2]
        );


      pixels[index] =
        gray;


      pixels[index + 1] =
        gray;


      pixels[index + 2] =
        gray;
    }
  }


  function applyBlackAndWhite(
    imageData,
    backgroundData
  ) {
    const pixels =
      imageData.data;


    const background =
      backgroundData.data;


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {
      if (
        pixels[index + 3] ===
        0
      ) {
        continue;
      }


      const gray =
        luminance(
          pixels[index],
          pixels[index + 1],
          pixels[index + 2]
        );


      const localBackground =
        luminance(
          background[index],
          background[index + 1],
          background[index + 2]
        );


      const threshold =
        Math.max(
          118,
          Math.min(
            224,
            localBackground - 15
          )
        );


      const distance =
        gray - threshold;


      let value;


      if (
        distance <=
        -18
      ) {
        value =
          0;
      }
      else if (
        distance >=
        14
      ) {
        value =
          255;
      }
      else {
        value =
          (
            (
              distance + 18
            ) /
            32
          ) *
          255;
      }


      pixels[index] =
        value;


      pixels[index + 1] =
        value;


      pixels[index + 2] =
        value;
    }
  }


  function applyUnsharpMask(
    imageData,
    blurredData,
    amount = 0.55
  ) {
    const pixels =
      imageData.data;


    const blurred =
      blurredData.data;


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {
      pixels[index] =
        clampChannel(
          pixels[index]
          +
          (
            pixels[index] -
            blurred[index]
          ) *
          amount
        );


      pixels[index + 1] =
        clampChannel(
          pixels[index + 1]
          +
          (
            pixels[index + 1] -
            blurred[index + 1]
          ) *
          amount
        );


      pixels[index + 2] =
        clampChannel(
          pixels[index + 2]
          +
          (
            pixels[index + 2] -
            blurred[index + 2]
          ) *
          amount
        );
    }
  }


  function applySoftDenoise(
    canvas
  ) {
    const source =
      document.createElement(
        "canvas"
      );


    source.width =
      canvas.width;


    source.height =
      canvas.height;


    source
      .getContext(
        "2d"
      )
      .drawImage(
        canvas,
        0,
        0
      );


    const context =
      canvas.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );


    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    if (
      "filter" in context
    ) {
      context.filter =
        "blur(0.55px) contrast(1.03)";
    }


    context.drawImage(
      source,
      0,
      0
    );


    context.filter =
      "none";
  }


  function applyGrayWorldBalance(
    imageData,
    strength = 0.3
  ) {
    const pixels =
      imageData.data;


    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let count = 0;


    const pixelCount =
      Math.max(
        1,
        pixels.length / 4
      );


    const stride =
      Math.max(
        1,
        Math.floor(
          pixelCount / 90000
        )
      );


    for (
      let pixelIndex = 0;
      pixelIndex < pixelCount;
      pixelIndex += stride
    ) {
      const offset =
        pixelIndex * 4;


      if (
        pixels[offset + 3] < 8
      ) {
        continue;
      }


      redTotal +=
        pixels[offset];


      greenTotal +=
        pixels[offset + 1];


      blueTotal +=
        pixels[offset + 2];


      count += 1;
    }


    if (
      count < 8
    ) {
      return;
    }


    const redMean =
      redTotal / count;


    const greenMean =
      greenTotal / count;


    const blueMean =
      blueTotal / count;


    const neutral =
      (
        redMean
        + greenMean
        + blueMean
      ) / 3;


    const redScale =
      1
      +
      (
        neutral /
        Math.max(1, redMean)
        - 1
      ) * strength;


    const greenScale =
      1
      +
      (
        neutral /
        Math.max(1, greenMean)
        - 1
      ) * strength;


    const blueScale =
      1
      +
      (
        neutral /
        Math.max(1, blueMean)
        - 1
      ) * strength;


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {
      if (
        pixels[index + 3] === 0
      ) {
        continue;
      }


      pixels[index] =
        clampChannel(
          pixels[index] * redScale
        );


      pixels[index + 1] =
        clampChannel(
          pixels[index + 1] * greenScale
        );


      pixels[index + 2] =
        clampChannel(
          pixels[index + 2] * blueScale
        );
    }
  }


  function liftPaperWhites(
    imageData,
    start = 174,
    strength = 0.58
  ) {
    const pixels =
      imageData.data;


    for (
      let index = 0;
      index < pixels.length;
      index += 4
    ) {
      if (
        pixels[index + 3] === 0
      ) {
        continue;
      }


      const gray =
        luminance(
          pixels[index],
          pixels[index + 1],
          pixels[index + 2]
        );


      if (
        gray <= start
      ) {
        continue;
      }


      const progress =
        Math.min(
          1,
          (
            gray - start
          ) /
          Math.max(
            1,
            255 - start
          )
        );


      const lift =
        progress
        * progress
        * 26
        * strength;


      pixels[index] =
        clampChannel(
          pixels[index] + lift
        );


      pixels[index + 1] =
        clampChannel(
          pixels[index + 1] + lift
        );


      pixels[index + 2] =
        clampChannel(
          pixels[index + 2] + lift
        );
    }
  }


  async function applyOpenCvEnhancement(
    canvas,
    mode
  ) {
    /*
     * Normal enhancement previews intentionally stay on the Canvas path.
     * Loading OpenCV here can allocate a large WebAssembly heap and freeze
     * lower-memory laptops/phones. OpenCV is loaded only by explicit crop
     * features such as Auto edges / perspective correction.
     */
    void canvas;
    void mode;
    return false;
  }


  function smoothStep(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }


  function applyAdaptiveLocalLevels(
    imageData,
    {
      tilesX = 8,
      tilesY = 8,
      amount = 0.25
    } = {}
  ) {
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;

    if (
      !width
      || !height
      || amount <= 0
    ) {
      return;
    }

    const tileWidth = Math.ceil(width / tilesX);
    const tileHeight = Math.ceil(height / tilesY);
    const stats = [];

    for (let tileY = 0; tileY < tilesY; tileY += 1) {
      stats[tileY] = [];

      for (let tileX = 0; tileX < tilesX; tileX += 1) {
        const histogram = new Uint32Array(256);
        const startX = tileX * tileWidth;
        const startY = tileY * tileHeight;
        const endX = Math.min(width, startX + tileWidth);
        const endY = Math.min(height, startY + tileHeight);
        const sampleStep = Math.max(
          1,
          Math.floor(
            Math.max(tileWidth, tileHeight) / 150
          )
        );

        let samples = 0;

        for (let y = startY; y < endY; y += sampleStep) {
          for (let x = startX; x < endX; x += sampleStep) {
            const index = (y * width + x) * 4;

            if (pixels[index + 3] < 8) {
              continue;
            }

            const gray = Math.round(
              luminance(
                pixels[index],
                pixels[index + 1],
                pixels[index + 2]
              )
            );

            histogram[gray] += 1;
            samples += 1;
          }
        }

        const findPercentile = (fraction) => {
          if (!samples) return fraction < .5 ? 0 : 255;

          const target = samples * fraction;
          let cumulative = 0;

          for (let value = 0; value < 256; value += 1) {
            cumulative += histogram[value];
            if (cumulative >= target) return value;
          }

          return 255;
        };

        let low = findPercentile(.025);
        let high = findPercentile(.985);

        if (high - low < 58) {
          const midpoint = (high + low) / 2;
          low = Math.max(0, midpoint - 29);
          high = Math.min(255, midpoint + 29);
        }

        stats[tileY][tileX] = { low, high };
      }
    }

    const readStat = (x, y) =>
      stats[
        Math.max(0, Math.min(tilesY - 1, y))
      ][
        Math.max(0, Math.min(tilesX - 1, x))
      ];

    for (let y = 0; y < height; y += 1) {
      const tileY = y / tileHeight - .5;
      const y0 = Math.floor(tileY);
      const y1 = y0 + 1;
      const fy = tileY - y0;

      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;

        if (pixels[index + 3] === 0) {
          continue;
        }

        const tileX = x / tileWidth - .5;
        const x0 = Math.floor(tileX);
        const x1 = x0 + 1;
        const fx = tileX - x0;

        const s00 = readStat(x0, y0);
        const s10 = readStat(x1, y0);
        const s01 = readStat(x0, y1);
        const s11 = readStat(x1, y1);

        const lowTop = s00.low + (s10.low - s00.low) * fx;
        const lowBottom = s01.low + (s11.low - s01.low) * fx;
        const highTop = s00.high + (s10.high - s00.high) * fx;
        const highBottom = s01.high + (s11.high - s01.high) * fx;

        const localLow = lowTop + (lowBottom - lowTop) * fy;
        const localHigh = highTop + (highBottom - highTop) * fy;
        const localRange = Math.max(42, localHigh - localLow);

        const currentLum = Math.max(
          1,
          luminance(
            pixels[index],
            pixels[index + 1],
            pixels[index + 2]
          )
        );

        const mappedLum = clampChannel(
          ((currentLum - localLow) / localRange) * 255
        );

        const targetLum =
          currentLum +
          (mappedLum - currentLum) * amount;

        const ratio = targetLum / currentLum;

        pixels[index] = clampChannel(pixels[index] * ratio);
        pixels[index + 1] = clampChannel(pixels[index + 1] * ratio);
        pixels[index + 2] = clampChannel(pixels[index + 2] * ratio);
      }
    }
  }


  function applyPaperAndInkCleanup(
    imageData,
    {
      paperStrength = 0.65,
      inkStrength = 0.12,
      neutralizeStrength = 0.55,
      preserveColor = 0.8
    } = {}
  ) {
    const pixels = imageData.data;

    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) {
        continue;
      }

      let red = pixels[index];
      let green = pixels[index + 1];
      let blue = pixels[index + 2];

      const gray = luminance(red, green, blue);
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const chroma = maximum - minimum;

      const neutralWeight =
        1 - Math.min(1, chroma / 48);

      const paperMask =
        smoothStep((gray - 148) / 94)
        * (
          neutralWeight
          + (1 - neutralWeight) * (1 - preserveColor) * .38
        );

      if (paperMask > 0) {
        const whiten = paperMask * paperStrength;

        red += (255 - red) * whiten;
        green += (255 - green) * whiten;
        blue += (255 - blue) * whiten;

        const postGray = luminance(red, green, blue);
        const neutralize =
          paperMask
          * neutralWeight
          * neutralizeStrength;

        red += (postGray - red) * neutralize;
        green += (postGray - green) * neutralize;
        blue += (postGray - blue) * neutralize;
      }

      if (gray < 172) {
        const inkMask =
          smoothStep((172 - gray) / 132)
          * inkStrength;

        red *= 1 - inkMask;
        green *= 1 - inkMask;
        blue *= 1 - inkMask;
      }

      pixels[index] = clampChannel(red);
      pixels[index + 1] = clampChannel(green);
      pixels[index + 2] = clampChannel(blue);
    }
  }


  function applyDocumentPipeline(
    canvas,
    {
      lighting = 0.85,
      balance = 0.25,
      localContrast = 0.2,
      paper = 0.55,
      ink = 0.1,
      neutralize = 0.45,
      preserveColor = 0.8,
      saturation = 1,
      contrast = 1.05,
      brightness = 2,
      sharpen = 0.25,
      grayscale = false
    } = {}
  ) {
    const context = canvas.getContext(
      "2d",
      {
        alpha: true,
        willReadFrequently: true
      }
    );

    let imageData = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const illumination = createBlurredBackground(
      canvas,
      Math.max(
        18,
        Math.round(
          Math.min(canvas.width, canvas.height) * .045
        )
      )
    );

    normalizePageLighting(
      imageData,
      illumination,
      lighting
    );

    if (balance > 0) {
      applyGrayWorldBalance(
        imageData,
        balance
      );
    }

    if (grayscale) {
      applyGrayscale(imageData);
    }

    if (localContrast > 0) {
      applyAdaptiveLocalLevels(
        imageData,
        {
          tilesX: canvas.width > canvas.height ? 10 : 8,
          tilesY: canvas.height > canvas.width ? 10 : 8,
          amount: localContrast
        }
      );
    }

    applyAutoTone(
      imageData,
      {
        saturation: grayscale ? 1 : saturation,
        contrast,
        brightness
      }
    );

    applyPaperAndInkCleanup(
      imageData,
      {
        paperStrength: paper,
        inkStrength: ink,
        neutralizeStrength: neutralize,
        preserveColor
      }
    );

    context.putImageData(
      imageData,
      0,
      0
    );

    if (sharpen > 0) {
      const blurred = createBlurredBackground(
        canvas,
        .85
      );

      imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      applyUnsharpMask(
        imageData,
        blurred,
        sharpen
      );

      context.putImageData(
        imageData,
        0,
        0
      );
    }
  }


  async function applyEnhancementPreset(
    canvas,
    mode
  ) {
    if (
      !mode
      || mode === "original"
    ) {
      return;
    }

    if (mode === "denoise") {
      applySoftDenoise(canvas);

      applyDocumentPipeline(
        canvas,
        {
          lighting: .45,
          balance: .12,
          localContrast: .08,
          paper: .22,
          ink: .04,
          neutralize: .18,
          preserveColor: .92,
          saturation: 1.01,
          contrast: 1.025,
          brightness: 1,
          sharpen: .16
        }
      );

      return;
    }

    if (mode === "bw") {
      const context = canvas.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );

      let imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const illumination = createBlurredBackground(
        canvas,
        Math.max(
          20,
          Math.round(
            Math.min(canvas.width, canvas.height) * .05
          )
        )
      );

      normalizePageLighting(
        imageData,
        illumination,
        1
      );

      applyGrayscale(imageData);

      applyAdaptiveLocalLevels(
        imageData,
        {
          tilesX: 8,
          tilesY: 10,
          amount: .2
        }
      );

      context.putImageData(
        imageData,
        0,
        0
      );

      const thresholdBackground = createBlurredBackground(
        canvas,
        Math.max(
          14,
          Math.round(
            Math.min(canvas.width, canvas.height) * .025
          )
        )
      );

      imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

      applyBlackAndWhite(
        imageData,
        thresholdBackground
      );

      context.putImageData(
        imageData,
        0,
        0
      );

      return;
    }

    const settings = {
      auto: {
        lighting: .78,
        balance: .22,
        localContrast: .18,
        paper: .52,
        ink: .08,
        neutralize: .42,
        preserveColor: .88,
        saturation: 1.015,
        contrast: 1.045,
        brightness: 2,
        sharpen: .24
      },

      document: {
        lighting: 1,
        balance: .38,
        localContrast: .3,
        paper: .96,
        ink: .2,
        neutralize: .92,
        preserveColor: .76,
        saturation: .9,
        contrast: 1.075,
        brightness: 4,
        sharpen: .38
      },

      vivid: {
        lighting: .72,
        balance: .25,
        localContrast: .2,
        paper: .4,
        ink: .08,
        neutralize: .26,
        preserveColor: .96,
        saturation: 1.15,
        contrast: 1.055,
        brightness: 2,
        sharpen: .25
      },

      grayscale: {
        lighting: .96,
        balance: 0,
        localContrast: .3,
        paper: .78,
        ink: .16,
        neutralize: .8,
        preserveColor: 0,
        saturation: 1,
        contrast: 1.065,
        brightness: 3,
        sharpen: .32,
        grayscale: true
      },

      shadow: {
        lighting: 1,
        balance: .26,
        localContrast: .12,
        paper: .66,
        ink: .08,
        neutralize: .52,
        preserveColor: .9,
        saturation: 1,
        contrast: 1.035,
        brightness: 3,
        sharpen: .18
      },

      sharpen: {
        lighting: .58,
        balance: .12,
        localContrast: .24,
        paper: .42,
        ink: .18,
        neutralize: .34,
        preserveColor: .9,
        saturation: 1,
        contrast: 1.06,
        brightness: 1,
        sharpen: .58
      },

      photo: {
        lighting: .35,
        balance: .16,
        localContrast: .1,
        paper: .08,
        ink: 0,
        neutralize: .05,
        preserveColor: 1,
        saturation: 1.06,
        contrast: 1.035,
        brightness: 1,
        sharpen: .18
      }
    };

    applyDocumentPipeline(
      canvas,
      settings[mode]
      || settings.auto
    );
  }



  function cropCanvasToBounds(
    canvas,
    quad
  ) {
    const points =
      cloneCropQuad(quad);


    const xs =
      points.map(
        (point) =>
          point.x * canvas.width
      );


    const ys =
      points.map(
        (point) =>
          point.y * canvas.height
      );


    const left =
      Math.max(
        0,
        Math.floor(
          Math.min(...xs)
        )
      );


    const top =
      Math.max(
        0,
        Math.floor(
          Math.min(...ys)
        )
      );


    const right =
      Math.min(
        canvas.width,
        Math.ceil(
          Math.max(...xs)
        )
      );


    const bottom =
      Math.min(
        canvas.height,
        Math.ceil(
          Math.max(...ys)
        )
      );


    const width =
      Math.max(
        1,
        right - left
      );


    const height =
      Math.max(
        1,
        bottom - top
      );


    const output =
      document.createElement(
        "canvas"
      );


    output.width =
      width;


    output.height =
      height;


    const context =
      output.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );


    context.drawImage(
      canvas,
      left,
      top,
      width,
      height,
      0,
      0,
      width,
      height
    );


    return {
      canvas: output,
      context,
      width,
      height
    };
  }


  async function applyPerspectiveCrop(
    work,
    quad
  ) {
    if (
      isFullCropQuad(quad)
    ) {
      return work;
    }


    const normalized =
      cloneCropQuad(quad);


    const sourcePoints =
      normalized.map(
        (point) => ({
          x: point.x * (work.canvas.width - 1),
          y: point.y * (work.canvas.height - 1)
        })
      );


    const polygonArea =
      Math.abs(
        sourcePoints.reduce(
          (sum, point, index) => {
            const next =
              sourcePoints[
                (index + 1)
                % sourcePoints.length
              ];


            return sum +
              point.x * next.y -
              next.x * point.y;
          },
          0
        ) / 2
      );


    if (
      !Number.isFinite(polygonArea)
      || polygonArea <
        work.canvas.width
        * work.canvas.height
        * 0.004
    ) {
      return cropCanvasToBounds(
        work.canvas,
        normalized
      );
    }


    let outputWidth =
      Math.max(
        32,
        Math.round(
          Math.max(
            cropDistance(
              sourcePoints[0],
              sourcePoints[1]
            ),
            cropDistance(
              sourcePoints[3],
              sourcePoints[2]
            )
          )
        )
      );


    let outputHeight =
      Math.max(
        32,
        Math.round(
          Math.max(
            cropDistance(
              sourcePoints[0],
              sourcePoints[3]
            ),
            cropDistance(
              sourcePoints[1],
              sourcePoints[2]
            )
          )
        )
      );


    /*
     * Keep the perspective operation bounded. Phone photographs can decode to
     * extremely large canvases; allowing a crop to create an even larger
     * destination is one of the easiest ways to exhaust browser memory.
     */
    const sourceMaxSide =
      Math.max(
        work.canvas.width,
        work.canvas.height
      );


    const maximumPixels =
      7000000;


    const requestedPixels =
      outputWidth
      * outputHeight;


    const outputScale =
      Math.min(
        1,
        sourceMaxSide /
          Math.max(
            outputWidth,
            outputHeight
          ),
        requestedPixels > maximumPixels
          ? Math.sqrt(
              maximumPixels /
              requestedPixels
            )
          : 1
      );


    outputWidth =
      Math.max(
        32,
        Math.round(
          outputWidth
          * outputScale
        )
      );


    outputHeight =
      Math.max(
        32,
        Math.round(
          outputHeight
          * outputScale
        )
      );


    const sourceContext =
      work.canvas.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );


    if (
      !sourceContext
    ) {
      return cropCanvasToBounds(
        work.canvas,
        normalized
      );
    }


    const sourceImage =
      sourceContext.getImageData(
        0,
        0,
        work.canvas.width,
        work.canvas.height
      );


    const output =
      document.createElement(
        "canvas"
      );


    output.width =
      outputWidth;


    output.height =
      outputHeight;


    const outputContext =
      output.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );


    if (
      !outputContext
    ) {
      return cropCanvasToBounds(
        work.canvas,
        normalized
      );
    }


    const destinationImage =
      outputContext.createImageData(
        outputWidth,
        outputHeight
      );


    const sourceData =
      sourceImage.data;


    const destinationData =
      destinationImage.data;


    const sourceWidth =
      work.canvas.width;


    const sourceHeight =
      work.canvas.height;


    const p0 = sourcePoints[0];
    const p1 = sourcePoints[1];
    const p2 = sourcePoints[2];
    const p3 = sourcePoints[3];


    /*
     * Projective square -> quadrilateral coefficients. This performs the same
     * kind of four-corner straightening as the previous OpenCV path, but it
     * stays inside normal browser memory instead of starting a large WASM heap.
     */
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;


    let g = 0;
    let h = 0;


    const divisor =
      dx1 * dy2 -
      dx2 * dy1;


    if (
      Math.abs(dx3) > 0.00001
      || Math.abs(dy3) > 0.00001
    ) {
      if (
        Math.abs(divisor) < 0.00001
      ) {
        return cropCanvasToBounds(
          work.canvas,
          normalized
        );
      }


      g =
        (
          dx3 * dy2 -
          dx2 * dy3
        ) /
        divisor;


      h =
        (
          dx1 * dy3 -
          dx3 * dy1
        ) /
        divisor;
    }


    const a =
      p1.x - p0.x +
      g * p1.x;


    const b =
      p3.x - p0.x +
      h * p3.x;


    const c = p0.x;


    const d =
      p1.y - p0.y +
      g * p1.y;


    const e =
      p3.y - p0.y +
      h * p3.y;


    const f = p0.y;


    const useBilinear =
      outputWidth
      * outputHeight <=
      2200000;


    const maxSourceX =
      sourceWidth - 1;


    const maxSourceY =
      sourceHeight - 1;


    for (
      let y = 0;
      y < outputHeight;
      y += 1
    ) {
      const v =
        outputHeight > 1
          ? y /
            (outputHeight - 1)
          : 0;


      for (
        let x = 0;
        x < outputWidth;
        x += 1
      ) {
        const u =
          outputWidth > 1
            ? x /
              (outputWidth - 1)
            : 0;


        const denominator =
          g * u +
          h * v +
          1;


        if (
          Math.abs(denominator) <
          0.000001
        ) {
          continue;
        }


        const sourceX =
          Math.max(
            0,
            Math.min(
              maxSourceX,
              (
                a * u +
                b * v +
                c
              ) /
              denominator
            )
          );


        const sourceY =
          Math.max(
            0,
            Math.min(
              maxSourceY,
              (
                d * u +
                e * v +
                f
              ) /
              denominator
            )
          );


        const destinationIndex =
          (
            y * outputWidth +
            x
          ) * 4;


        if (
          !useBilinear
        ) {
          const nearestX =
            Math.round(sourceX);


          const nearestY =
            Math.round(sourceY);


          const sourceIndex =
            (
              nearestY * sourceWidth +
              nearestX
            ) * 4;


          destinationData[destinationIndex] =
            sourceData[sourceIndex];


          destinationData[destinationIndex + 1] =
            sourceData[sourceIndex + 1];


          destinationData[destinationIndex + 2] =
            sourceData[sourceIndex + 2];


          destinationData[destinationIndex + 3] =
            sourceData[sourceIndex + 3];


          continue;
        }


        const x0 =
          Math.floor(sourceX);


        const y0 =
          Math.floor(sourceY);


        const x1 =
          Math.min(
            maxSourceX,
            x0 + 1
          );


        const y1 =
          Math.min(
            maxSourceY,
            y0 + 1
          );


        const fx =
          sourceX - x0;


        const fy =
          sourceY - y0;


        const topLeft =
          (y0 * sourceWidth + x0) * 4;


        const topRight =
          (y0 * sourceWidth + x1) * 4;


        const bottomLeft =
          (y1 * sourceWidth + x0) * 4;


        const bottomRight =
          (y1 * sourceWidth + x1) * 4;


        const topWeight =
          1 - fy;


        const leftWeight =
          1 - fx;


        for (
          let channel = 0;
          channel < 4;
          channel += 1
        ) {
          destinationData[
            destinationIndex + channel
          ] =
            sourceData[
              topLeft + channel
            ] *
              leftWeight *
              topWeight +
            sourceData[
              topRight + channel
            ] *
              fx *
              topWeight +
            sourceData[
              bottomLeft + channel
            ] *
              leftWeight *
              fy +
            sourceData[
              bottomRight + channel
            ] *
              fx *
              fy;
        }
      }


      /*
       * Yield periodically so a large crop cannot lock the UI thread for one
       * long uninterrupted task. Preview crops are small enough that this is
       * effectively instant; export crops remain responsive.
       */
      if (
        y > 0
        && y % 64 === 0
      ) {
        await new Promise(
          (resolve) =>
            requestAnimationFrame(
              resolve
            )
        );
      }
    }


    outputContext.putImageData(
      destinationImage,
      0,
      0
    );


    return {
      canvas: output,
      context: outputContext,
      width: outputWidth,
      height: outputHeight
    };
  }


  async function renderImageWithEnhancement(
    file,
    mode = "original",
    maximumDimension = 2600,
    cropQuad = null
  ) {
    const image =
      await loadImageElement(
        file
      );


    let work =
      createWorkingCanvas(
        image,
        maximumDimension
      );


    if (
      cropQuad
      && !isFullCropQuad(cropQuad)
    ) {
      work =
        await applyPerspectiveCrop(
          work,
          cropQuad
        );
    }


    await applyEnhancementPreset(
      work.canvas,
      mode
    );


    work.width =
      work.canvas.width;


    work.height =
      work.canvas.height;


    return work;
  }



  async function canvasToObjectUrl(
    canvas
  ) {
    /*
     * PNG keeps small text and document edges crisp in the comparison preview.
     * The object URL avoids a large base64 string in memory.
     */
    const blob =
      await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/png"
          );
        }
      );


    if (
      !blob
    ) {
      return canvas.toDataURL(
        "image/png"
      );
    }


    return URL.createObjectURL(
      blob
    );
  }


  function releaseEnhancementPreview() {
    if (
      enhancementSession.previewUrl
      &&
      enhancementSession.previewUrl.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        enhancementSession.previewUrl
      );
    }


    enhancementSession.previewUrl =
      "";
  }


  function updateEnhancementCropState() {
    if (
      !elements.enhancementCropState
    ) {
      return;
    }


    const cropped =
      !isFullCropQuad(
        enhancementSession.cropQuad
      );


    elements.enhancementCropState.textContent =
      cropped
        ? "CROP READY"
        : "FULL PAGE";
  }


  async function renderEnhancementPreview() {
    const item =
      enhancementSession.item;


    if (
      !item
      || !elements.enhancementPreview
    ) {
      return;
    }


    const mode =
      enhancementSession.mode
      || "original";


    const cropQuad =
      cloneCropQuad(
        enhancementSession.cropQuad
      );


    const cropped =
      !isFullCropQuad(
        cropQuad
      );


    const requestId =
      ++enhancementSession.requestId;


    updateEnhancementCropState();


    elements.enhancementPresetButtons.forEach(
      (button) => {
        const active =
          button.dataset.enhancement ===
          mode;


        button.classList.toggle(
          "is-active",
          active
        );


        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );


    elements.enhancementPreviewLabel.textContent =
      `${getEnhancementLabel(mode)}${cropped ? " · Cropped" : ""}`;


    if (
      mode === "original"
      && !cropped
    ) {
      releaseEnhancementPreview();


      elements.enhancementRendering.hidden =
        true;


      elements.enhancementPreview.src =
        item.previewUrl;


      elements.enhancementStatus.textContent =
        "Original image selected. No cleanup or crop will be applied.";


      return;
    }


    elements.enhancementRendering.hidden =
      false;


    elements.enhancementStatus.textContent =
      cropped
        ? "Straightening crop and rendering a local preview…"
        : "Rendering an improved local preview…";


    await new Promise(
      (resolve) =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );


    try {
      const previewDimension =
        window.matchMedia(
          "(max-width: 720px)"
        ).matches
          ? 620
          : 900;


      const {
        canvas
      } =
        await renderImageWithEnhancement(
          item.file,
          mode,
          previewDimension,
          cropQuad
        );


      if (
        requestId !==
        enhancementSession.requestId
      ) {
        return;
      }


      const previewUrl =
        await canvasToObjectUrl(
          canvas
        );


      if (
        requestId !==
        enhancementSession.requestId
      ) {
        if (
          previewUrl.startsWith(
            "blob:"
          )
        ) {
          URL.revokeObjectURL(
            previewUrl
          );
        }


        return;
      }


      releaseEnhancementPreview();


      enhancementSession.previewUrl =
        previewUrl;


      elements.enhancementPreview.src =
        previewUrl;


      const parts = [
        getEnhancementLabel(mode)
      ];


      if (
        cropped
      ) {
        parts.push(
          "perspective crop"
        );
      }


      elements.enhancementStatus.textContent =
        `${parts.join(" + ")} · processed locally`;
    }
    catch (error) {
      console.error(
        "MazeDocs enhancement preview:",
        error
      );


      elements.enhancementPreview.src =
        item.previewUrl;


      elements.enhancementStatus.textContent =
        "Could not render this preview. The original is shown instead.";
    }
    finally {
      if (
        requestId ===
        enhancementSession.requestId
      ) {
        elements.enhancementRendering.hidden =
          true;
      }
    }
  }



  function renderCropOverlay() {
    const quad =
      cloneCropQuad(
        enhancementSession.cropQuad
      );


    const pointString =
      quad
        .map(
          (point) =>
            `${(point.x * 100).toFixed(3)},${(point.y * 100).toFixed(3)}`
        )
        .join(" ");


    if (
      elements.enhancementCropPolygon
    ) {
      elements.enhancementCropPolygon.setAttribute(
        "points",
        pointString
      );
    }


    if (
      elements.enhancementCropLine
    ) {
      const first =
        quad[0];


      elements.enhancementCropLine.setAttribute(
        "points",
        `${pointString} ${(first.x * 100).toFixed(3)},${(first.y * 100).toFixed(3)}`
      );
    }


    elements.enhancementCropHandles.forEach(
      (handle, index) => {
        const point =
          quad[index];


        if (
          !point
        ) {
          return;
        }


        handle.style.left =
          `${point.x * 100}%`;


        handle.style.top =
          `${point.y * 100}%`;
      }
    );


    updateEnhancementCropState();
  }


  function setEnhancementCropQuad(quad) {
    enhancementSession.cropQuad =
      cloneCropQuad(quad);


    renderCropOverlay();
  }


  function constrainCropPoint(
    index,
    x,
    y
  ) {
    const quad =
      cloneCropQuad(
        enhancementSession.cropQuad
      );


    const gap =
      0.025;


    let nextX =
      Math.max(
        0,
        Math.min(
          1,
          x
        )
      );


    let nextY =
      Math.max(
        0,
        Math.min(
          1,
          y
        )
      );


    if (
      index === 0
    ) {
      nextX =
        Math.min(
          nextX,
          quad[1].x - gap
        );


      nextY =
        Math.min(
          nextY,
          quad[3].y - gap
        );
    }


    if (
      index === 1
    ) {
      nextX =
        Math.max(
          nextX,
          quad[0].x + gap
        );


      nextY =
        Math.min(
          nextY,
          quad[2].y - gap
        );
    }


    if (
      index === 2
    ) {
      nextX =
        Math.max(
          nextX,
          quad[3].x + gap
        );


      nextY =
        Math.max(
          nextY,
          quad[1].y + gap
        );
    }


    if (
      index === 3
    ) {
      nextX =
        Math.min(
          nextX,
          quad[2].x - gap
        );


      nextY =
        Math.max(
          nextY,
          quad[0].y + gap
        );
    }


    return {
      x: Math.max(0, Math.min(1, nextX)),
      y: Math.max(0, Math.min(1, nextY))
    };
  }


  function openCropEditor() {
    const item =
      enhancementSession.item;


    if (
      !item
      || !elements.enhancementCropPanel
    ) {
      return;
    }


    enhancementSession.savedCropQuad =
      cloneCropQuad(
        enhancementSession.cropQuad
      );


    enhancementSession.cropEditing =
      true;


    elements.enhancementCompare.hidden =
      true;


    elements.enhancementPresets.hidden =
      true;


    elements.enhancementCropPanel.hidden =
      false;


    elements.enhancementCropImage.src =
      item.previewUrl;


    renderCropOverlay();


    if (
      elements.enhancementScroll
    ) {
      elements.enhancementScroll.scrollTop =
        0;
    }


    elements.enhancementStatus.textContent =
      "Drag the four handles to the document corners. Use Auto edges as a starting point if you want.";

  }


  function closeCropEditor(
    keepChanges
  ) {
    if (
      !enhancementSession.cropEditing
    ) {
      return;
    }


    if (
      !keepChanges
      && enhancementSession.savedCropQuad
    ) {
      enhancementSession.cropQuad =
        cloneCropQuad(
          enhancementSession.savedCropQuad
        );
    }


    enhancementSession.cropEditing =
      false;


    enhancementSession.savedCropQuad =
      null;


    elements.enhancementCropPanel.hidden =
      true;


    elements.enhancementCompare.hidden =
      false;


    elements.enhancementPresets.hidden =
      false;


    renderCropOverlay();
    scheduleEnhancementPreview(40);
  }


  async function detectDocumentCropQuad(file) {
    /*
     * Lightweight edge estimate used only as a starting point for the manual
     * four-corner crop. Keeping this outside OpenCV avoids allocating a WASM
     * heap merely to open the crop tool on lower-memory laptops and phones.
     */
    const image =
      await loadImageElement(
        file
      );


    const work =
      createWorkingCanvas(
        image,
        520
      );


    const context =
      work.canvas.getContext(
        "2d",
        {
          alpha: false,
          willReadFrequently: true
        }
      );


    if (
      !context
    ) {
      return null;
    }


    const imageData =
      context.getImageData(
        0,
        0,
        work.width,
        work.height
      );


    const data =
      imageData.data;


    const width =
      work.width;


    const height =
      work.height;


    const gray =
      new Uint8Array(
        width * height
      );


    for (
      let index = 0;
      index < gray.length;
      index += 1
    ) {
      const offset =
        index * 4;


      gray[index] =
        Math.round(
          data[offset] * 0.299 +
          data[offset + 1] * 0.587 +
          data[offset + 2] * 0.114
        );
    }


    let gradientTotal = 0;
    let gradientSquared = 0;
    let gradientCount = 0;


    const gradients = [];


    for (
      let y = 2;
      y < height - 2;
      y += 2
    ) {
      for (
        let x = 2;
        x < width - 2;
        x += 2
      ) {
        const center =
          y * width + x;


        const gx =
          Math.abs(
            gray[center + 1] -
            gray[center - 1]
          );


        const gy =
          Math.abs(
            gray[center + width] -
            gray[center - width]
          );


        const magnitude =
          gx + gy;


        gradients.push([
          x,
          y,
          magnitude
        ]);


        gradientTotal +=
          magnitude;


        gradientSquared +=
          magnitude * magnitude;


        gradientCount += 1;
      }
    }


    if (
      !gradientCount
    ) {
      return null;
    }


    const mean =
      gradientTotal /
      gradientCount;


    const variance =
      Math.max(
        0,
        gradientSquared /
          gradientCount -
        mean * mean
      );


    const threshold =
      Math.max(
        34,
        mean +
          Math.sqrt(variance) *
          1.15
      );


    const xs = [];
    const ys = [];


    gradients.forEach(
      ([x, y, magnitude]) => {
        if (
          magnitude >= threshold
        ) {
          xs.push(x);
          ys.push(y);
        }
      }
    );


    if (
      xs.length < 80
    ) {
      return null;
    }


    xs.sort(
      (a, b) => a - b
    );


    ys.sort(
      (a, b) => a - b
    );


    const percentile =
      (values, p) =>
        values[
          Math.max(
            0,
            Math.min(
              values.length - 1,
              Math.round(
                (values.length - 1) * p
              )
            )
          )
        ];


    let left =
      percentile(xs, 0.025);


    let right =
      percentile(xs, 0.975);


    let top =
      percentile(ys, 0.025);


    let bottom =
      percentile(ys, 0.975);


    const expandX =
      Math.max(
        8,
        (right - left) * 0.055
      );


    const expandY =
      Math.max(
        8,
        (bottom - top) * 0.055
      );


    left =
      Math.max(
        0,
        left - expandX
      );


    right =
      Math.min(
        width - 1,
        right + expandX
      );


    top =
      Math.max(
        0,
        top - expandY
      );


    bottom =
      Math.min(
        height - 1,
        bottom + expandY
      );


    if (
      right - left < width * 0.25
      || bottom - top < height * 0.25
    ) {
      return null;
    }


    return [
      {
        x: left / width,
        y: top / height
      },
      {
        x: right / width,
        y: top / height
      },
      {
        x: right / width,
        y: bottom / height
      },
      {
        x: left / width,
        y: bottom / height
      }
    ];
  }


  function openEnhancementModal(
    item,
    items,
    trigger
  ) {
    if (
      !item
      || !elements.enhancementModal
    ) {
      return;
    }


    releaseEnhancementPreview();


    enhancementSession.item =
      item;


    enhancementSession.items =
      items;


    enhancementSession.mode =
      item.enhancement
      || "original";


    enhancementSession.cropQuad =
      cloneCropQuad(
        item.cropQuad
      );


    enhancementSession.savedCropQuad =
      null;


    enhancementSession.cropEditing =
      false;


    enhancementSession.returnFocus =
      trigger
      || document.activeElement;


    elements.enhancementOriginal.src =
      item.previewUrl;


    elements.enhancementPreview.src =
      item.previewUrl;


    elements.enhancementCropImage.src =
      item.previewUrl;


    elements.enhancementCropPanel.hidden =
      true;


    elements.enhancementCompare.hidden =
      false;


    elements.enhancementPresets.hidden =
      false;


    elements.enhancementModal.hidden =
      false;


    if (
      elements.enhancementScroll
    ) {
      elements.enhancementScroll.scrollTop =
        0;
    }


    document.body.classList.add(
      "enhancement-open"
    );


    renderCropOverlay();
    scheduleEnhancementPreview(0);


    /*
     * Do not start OpenCV/WASM here. The heavy engine is loaded only when
     * the user explicitly requests Auto edges or a perspective operation.
     */
    window.setTimeout(
      () => {
        elements.enhancementClose?.focus();
      },
      20
    );
  }


  function closeEnhancementModal() {
    if (
      !elements.enhancementModal
      || elements.enhancementModal.hidden
    ) {
      return;
    }


    enhancementSession.requestId +=
      1;


    window.clearTimeout(
      enhancementPreviewTimer
    );


    enhancementPreviewTimer = 0;
    enhancementPreviewPending = false;


    releaseEnhancementPreview();


    elements.enhancementModal.hidden =
      true;


    document.body.classList.remove(
      "enhancement-open"
    );


    const focusTarget =
      enhancementSession.returnFocus;


    enhancementSession.item =
      null;


    enhancementSession.items =
      null;


    enhancementSession.cropQuad =
      null;


    enhancementSession.savedCropQuad =
      null;


    enhancementSession.cropEditing =
      false;


    enhancementSession.returnFocus =
      null;


    if (
      elements.enhancementCropPanel
    ) {
      elements.enhancementCropPanel.hidden =
        true;
    }


    if (
      elements.enhancementCompare
    ) {
      elements.enhancementCompare.hidden =
        false;
    }


    if (
      elements.enhancementPresets
    ) {
      elements.enhancementPresets.hidden =
        false;
    }


    focusTarget?.focus?.();
  }



  function rerenderImageToolForItems(
    items
  ) {
    if (
      items ===
      state.imageFiles
    ) {
      renderImageFiles();

      return;
    }


    if (
      items ===
      state.scanFiles
    ) {
      renderScanFiles();
    }
  }


  function bindImageEnhancement() {
    if (
      !elements.enhancementModal
    ) {
      return;
    }


    elements.enhancementPresetButtons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            enhancementSession.mode =
              button.dataset.enhancement
              || "original";


            scheduleEnhancementPreview();
          }
        );
      }
    );


    elements.enhancementCropOpen?.addEventListener(
      "click",
      openCropEditor
    );


    elements.enhancementCropReset?.addEventListener(
      "click",
      () => {
        setEnhancementCropQuad(
          FULL_CROP_QUAD
        );


        elements.enhancementStatus.textContent =
          "Crop reset to the full image.";
      }
    );


    elements.enhancementCropCancel?.addEventListener(
      "click",
      () =>
        closeCropEditor(
          false
        )
    );


    elements.enhancementCropDone?.addEventListener(
      "click",
      () =>
        closeCropEditor(
          true
        )
    );


    elements.enhancementCropAuto?.addEventListener(
      "click",
      async () => {
        const item =
          enhancementSession.item;


        if (
          !item
        ) {
          return;
        }


        const button =
          elements.enhancementCropAuto;


        const originalText =
          button.textContent;


        button.disabled =
          true;


        button.textContent =
          "Detecting…";


        elements.enhancementStatus.textContent =
          "Looking for the largest document outline locally…";


        try {
          const detected =
            await detectDocumentCropQuad(
              item.file
            );


          if (
            !detected
          ) {
            elements.enhancementStatus.textContent =
              "No clear four-corner page was detected. Drag the handles manually instead.";


            return;
          }


          setEnhancementCropQuad(
            detected
          );


          elements.enhancementStatus.textContent =
            "Page edges detected. Adjust any corner if needed, then use this crop.";
        }
        catch (error) {
          console.warn(
            "MazeDocs auto crop:",
            error
          );


          elements.enhancementStatus.textContent =
            "Auto edges are unavailable right now. Manual four-corner crop still works.";
        }
        finally {
          button.disabled =
            false;


          button.textContent =
            originalText;
        }
      }
    );


    elements.enhancementCropHandles.forEach(
      (handle) => {
        const cornerIndex =
          Number(
            handle.dataset.cropCorner
          );


        let pointerId =
          null;


        const moveCorner =
          (event) => {
            if (
              pointerId === null
              || event.pointerId !== pointerId
              || !elements.enhancementCropStage
            ) {
              return;
            }


            const rect =
              elements.enhancementCropStage.getBoundingClientRect();


            if (
              !rect.width
              || !rect.height
            ) {
              return;
            }


            const point =
              constrainCropPoint(
                cornerIndex,
                (
                  event.clientX
                  - rect.left
                ) / rect.width,
                (
                  event.clientY
                  - rect.top
                ) / rect.height
              );


            const quad =
              cloneCropQuad(
                enhancementSession.cropQuad
              );


            quad[cornerIndex] =
              point;


            enhancementSession.cropQuad =
              quad;


            renderCropOverlay();
          };


        const finishDrag =
          (event) => {
            if (
              pointerId === null
              || event.pointerId !== pointerId
            ) {
              return;
            }


            try {
              handle.releasePointerCapture?.(
                pointerId
              );
            }
            catch (error) {
              /* Pointer may already have been released. */
            }


            pointerId =
              null;
          };


        handle.addEventListener(
          "pointerdown",
          (event) => {
            event.preventDefault();


            pointerId =
              event.pointerId;


            handle.setPointerCapture?.(
              pointerId
            );


            moveCorner(event);
          }
        );


        handle.addEventListener(
          "pointermove",
          moveCorner
        );


        handle.addEventListener(
          "pointerup",
          finishDrag
        );


        handle.addEventListener(
          "pointercancel",
          finishDrag
        );
      }
    );


    elements.enhancementApplyPage.addEventListener(
      "click",
      () => {
        const item =
          enhancementSession.item;


        const items =
          enhancementSession.items;


        if (
          !item
          || !items
        ) {
          return;
        }


        item.enhancement =
          enhancementSession.mode
          || "original";


        const cropQuad =
          cloneCropQuad(
            enhancementSession.cropQuad
          );


        item.cropQuad =
          isFullCropQuad(cropQuad)
            ? null
            : cropQuad;


        rerenderImageToolForItems(
          items
        );


        const cropped =
          Boolean(
            item.cropQuad
          );


        showToast(
          `${getEnhancementLabel(item.enhancement)}${cropped ? " + crop" : ""} applied to this page.`
        );


        closeEnhancementModal();
      }
    );


    elements.enhancementApplyAll.addEventListener(
      "click",
      () => {
        const items =
          enhancementSession.items;


        const currentItem =
          enhancementSession.item;


        if (
          !items?.length
        ) {
          return;
        }


        const mode =
          enhancementSession.mode
          || "original";


        items.forEach(
          (item) => {
            item.enhancement =
              mode;
          }
        );


        if (
          currentItem
        ) {
          const cropQuad =
            cloneCropQuad(
              enhancementSession.cropQuad
            );


          currentItem.cropQuad =
            isFullCropQuad(cropQuad)
              ? null
              : cropQuad;
        }


        rerenderImageToolForItems(
          items
        );


        showToast(
          `${getEnhancementLabel(mode)} applied to all pages${currentItem?.cropQuad ? "; crop kept on this page" : ""}.`
        );


        closeEnhancementModal();
      }
    );


    elements.enhancementClose.addEventListener(
      "click",
      closeEnhancementModal
    );


    elements.enhancementModal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          elements.enhancementModal
        ) {
          closeEnhancementModal();
        }
      }
    );


    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !== "Escape"
          || elements.enhancementModal.hidden
        ) {
          return;
        }


        if (
          enhancementSession.cropEditing
        ) {
          closeCropEditor(
            false
          );


          return;
        }


        closeEnhancementModal();
      }
    );
  }



  async function normalizeImageForPdf(
    pdfDocument,
    item
  ) {
    const enhancement =
      item?.enhancement
      ||
      "original";


    const exportDimension =
      window.matchMedia(
        "(max-width: 720px)"
      ).matches
        ? 2400
        : 3000;


    const {
      canvas,
      width,
      height
    } =
      await renderImageWithEnhancement(
        item.file,
        enhancement,
        exportDimension,
        item.cropQuad
      );


    const pngBlob =
      await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/png"
          );
        }
      );


    if (!pngBlob) {
      throw new Error(
        "Could not prepare the enhanced page for PDF export."
      );
    }


    const pngBytes =
      await pngBlob.arrayBuffer();


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


  function addImagesToState(
    targetArray,
    files
  ) {
    const supportedImages =
      files.filter(
        isImage
      );


    if (
      !supportedImages.length
    ) {
      showToast(
        "Choose JPG, PNG, or WEBP images."
      );


      return;
    }


    supportedImages.forEach(
      (file) => {
        targetArray.push({
          id:
            makeId(),

          file,

          previewUrl:
            URL.createObjectURL(
              file
            ),

          enhancement:
            "original",

          cropQuad:
            null
        });
      }
    );
  }


  function revokePreview(item) {
    if (
      item?.previewUrl
    ) {
      URL.revokeObjectURL(
        item.previewUrl
      );
    }
  }


  function createImageCard(
    item,
    index,
    onRemove,
    onEnhance
  ) {
    const card =
      document.createElement(
        "article"
      );


    card.className =
      "image-card";


    card.dataset.id =
      item.id;


    const mode =
      item.enhancement
      ||
      "original";


    const cropped =
      Boolean(
        item.cropQuad
        && !isFullCropQuad(item.cropQuad)
      );


    const cardStatus =
      [
        mode === "original"
          ? "Original color"
          : getEnhancementLabel(mode),
        cropped
          ? "Perspective crop"
          : "Full page"
      ].join(" · ");


    card.innerHTML = `
      <div class="image-card__preview">
        <img alt="" />
        <span class="image-card__preset">${getEnhancementLabel(mode)}${cropped ? " · CROP" : ""}</span>
      </div>

      <div class="image-card__footer">
        <div class="image-card__meta">
          <span></span>
          <small>${cardStatus}</small>
        </div>

        <div class="image-card__controls">
          <button
            class="image-enhance"
            type="button"
          >
            Enhance
          </button>

          <button
            class="file-remove"
            type="button"
            aria-label="Remove image"
          >
            ×
          </button>
        </div>
      </div>
    `;


    card
      .querySelector(
        "img"
      )
      .src =
        item.previewUrl;


    card
      .querySelector(
        ".image-card__footer .image-card__meta > span"
      )
      .textContent =
        `${String(index + 1).padStart(2, "0")} · ${item.file.name}`;


    card
      .querySelector(
        ".image-enhance"
      )
      .addEventListener(
        "click",
        (event) => {
          event.stopPropagation();

          onEnhance?.(
            event.currentTarget
          );
        }
      );


    card
      .querySelector(
        ".file-remove"
      )
      .addEventListener(
        "click",
        (event) => {
          event.stopPropagation();

          onRemove();
        }
      );


    return card;
  }


  async function buildPdfFromImages(
    items,
    filename
  ) {
    if (
      !items.length
    ) {
      showToast(
        "Add at least one image."
      );


      return;
    }


    showProcessing(
      "Building PDF.",
      "Applying page enhancements locally and creating the final PDF."
    );


    try {
      const output =
        await PDFLib.PDFDocument.create();


      for (
        let index = 0;
        index < items.length;
        index += 1
      ) {
        const item =
          items[index];


        const enhancement =
          item.enhancement
          ||
          "original";


        elements.processingDetail.textContent =
          `Page ${index + 1} of ${items.length} · ${getEnhancementLabel(enhancement)}${item.cropQuad ? " · straightening crop" : ""}.`;


        const imageData =
          await normalizeImageForPdf(
            output,
            item
          );


        const page =
          output.addPage(
            [
              imageData.width,
              imageData.height
            ]
          );


        page.drawImage(
          imageData.embedded,
          {
            x: 0,
            y: 0,
            width: imageData.width,
            height: imageData.height
          }
        );


        /*
         * Give the browser a frame between pages. This keeps long
         * multi-page exports responsive on student laptops/phones.
         */
        await new Promise(
          (resolve) =>
            requestAnimationFrame(
              resolve
            )
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
            },
            (trigger) => {
              openEnhancementModal(
                item,
                state.imageFiles,
                trigger
              );
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
            },
            (trigger) => {
              openEnhancementModal(
                item,
                state.scanFiles,
                trigger
              );
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


    if (
      elements.scanCount
    ) {
      elements.scanCount.textContent =
        `${state.scanFiles.length} page${
          state.scanFiles.length === 1
            ? ""
            : "s"
        }`;
    }
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
    animation: 170,

    ghostClass:
      "sortable-ghost",

    /*
     * Do not let mobile dragging steal taps
     * from Enhance / Remove buttons.
     */
    filter:
      "button, .image-card__controls, .image-enhance, .file-remove",

    preventOnFilter:
      false,

    delay:
      120,

    delayOnTouchOnly:
      true,

    touchStartThreshold:
      6,

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
          "mazedocs-images.pdf"
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
          "mazedocs-scan.pdf"
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

    bindImageEnhancement();

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
   200 MB FRONTEND FLOW

   UNIVERSAL CONVERTER:
     Browser -> Railway POST /api -> converted result

   WHY:
   The Universal Converter no longer sends its file through a
   Vercel Function. The browser uploads directly to the dedicated
   Railway Python converter, which can accept MazeDocs files up to
   the application's 200 MB ceiling.
   ============================================================ */

(() => {
  "use strict";


  /* ==========================================================
     01. ELEMENTS
     ========================================================== */

  const $ = (selector) => {
    return document.querySelector(
      selector
    );
  };


  const converterInput =
    $("#converter-input");

  const converterDrop =
    $("#converter-drop");

  const chooseButton =
    $("#converter-choose-button");

  const clearButton =
    $("#converter-clear-button");

  const fileCard =
    $("#converter-file");

  const fileExt =
    $("#converter-file-ext");

  const fileName =
    $("#converter-file-name");

  const fileMeta =
    $("#converter-file-meta");

  const targets =
    $("#converter-targets");

  const targetSelect =
    $("#converter-target-select");

  const targetLabel =
    $("#converter-target-label");

  const targetDescription =
    $("#converter-target-description");

  const routeNote =
    $("#converter-route-note");

  const action =
    $("#converter-action");

  const selectedRoute =
    $("#converter-selected-route");

  const selectedDescription =
    $("#converter-selected-description");

  const runButton =
    $("#converter-run-button");

  const engineStatus =
    $("#converter-engine-status");

  const resetButton =
    $("#reset-tool-button");

  const toastElement =
    $("#toast");


  /*
   * This controller is only loaded on pages that contain
   * the Universal Converter UI.
   */
  if (
    !converterInput
    ||
    !targetSelect
  ) {
    return;
  }


  /* ==========================================================
     02. LIMITS / ENDPOINTS
     ========================================================== */

  /*
   * MazeDocs application ceiling.
   *
   * The browser sends Universal Converter uploads directly to
   * the Railway backend instead of through a Vercel Function.
   */
  const MAX_CONVERTER_FILE_BYTES =
    200 * 1024 * 1024;


  /*
   * Dedicated MazeDocs conversion backend.
   *
   * You can still override this before script.js loads with:
   *
   * window.MAZEDOCS_API_BASE =
   *   "https://another-backend.example.com";
   */
  const API_BASE =
    String(
      window.MAZEDOCS_API_BASE
      ||
      "https://mazedocs-converter-production.up.railway.app"
    ).replace(
      /\/$/,
      ""
    );


  /* ==========================================================
     03. SUPPORTED ROUTES
     ========================================================== */

  const ROUTES = {
    pdf: [
      {
        target:
          "docx",

        label:
          "Editable Word document (.docx)",

        description:
          "Rebuilds the PDF as an editable Word document while preserving text, images, tables, spacing, and page layout as closely as possible."
      },

      {
        target:
          "pptx",

        label:
          "PowerPoint (.pptx)",

        description:
          "Creates a PowerPoint presentation with one slide for each PDF page."
      },

      {
        target:
          "txt",

        label:
          "Plain text (.txt)",

        description:
          "Extracts readable text from the PDF."
      },

      {
        target:
          "png",

        label:
          "PNG pages (.zip)",

        description:
          "Exports every PDF page as a PNG image inside one ZIP file."
      },

      {
        target:
          "jpg",

        label:
          "JPG pages (.zip)",

        description:
          "Exports every PDF page as a JPEG image inside one ZIP file."
      }
    ],

    docx: [
      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Creates a PDF from the Word document."
      },

      {
        target:
          "txt",

        label:
          "Plain text (.txt)",

        description:
          "Extracts readable text from the Word document."
      },

      {
        target:
          "html",

        label:
          "HTML page (.html)",

        description:
          "Converts common Word paragraphs and tables into HTML."
      }
    ],

    doc: [
      {
        target:
          "docx",

        label:
          "Word document (.docx)",

        description:
          "Upgrades the legacy Word file to modern DOCX.",

        requiresLibreOffice:
          true
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Converts the legacy Word file to PDF.",

        requiresLibreOffice:
          true
      },

      {
        target:
          "txt",

        label:
          "Plain text (.txt)",

        description:
          "Extracts text from the legacy Word file.",

        requiresLibreOffice:
          true
      }
    ],

    pptx: [
      {
        target:
          "docx",

        label:
          "Word handout (.docx)",

        description:
          "Creates an editable Word handout from slide content."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Converts the presentation to PDF."
      },

      {
        target:
          "txt",

        label:
          "Plain text (.txt)",

        description:
          "Extracts slide text into one text file."
      }
    ],

    ppt: [
      {
        target:
          "docx",

        label:
          "Word handout (.docx)",

        description:
          "Converts the legacy PowerPoint into an editable Word handout.",

        requiresLibreOffice:
          true
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Converts the legacy PowerPoint to PDF.",

        requiresLibreOffice:
          true
      },

      {
        target:
          "txt",

        label:
          "Plain text (.txt)",

        description:
          "Extracts slide text from the legacy PowerPoint.",

        requiresLibreOffice:
          true
      }
    ],

    xlsx: [
      {
        target:
          "csv",

        label:
          "CSV data (.csv / .zip)",

        description:
          "Exports workbook data as CSV."
      },

      {
        target:
          "json",

        label:
          "JSON data (.json)",

        description:
          "Exports workbook data grouped by worksheet."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Creates a printable spreadsheet PDF."
      }
    ],

    xls: [
      {
        target:
          "xlsx",

        label:
          "Excel workbook (.xlsx)",

        description:
          "Upgrades the legacy XLS workbook to XLSX.",

        requiresLibreOffice:
          true
      },

      {
        target:
          "csv",

        label:
          "CSV data (.csv)",

        description:
          "Exports legacy spreadsheet data to CSV.",

        requiresLibreOffice:
          true
      },

      {
        target:
          "json",

        label:
          "JSON data (.json)",

        description:
          "Exports legacy spreadsheet data to JSON.",

        requiresLibreOffice:
          true
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Converts the legacy workbook to PDF.",

        requiresLibreOffice:
          true
      }
    ],

    csv: [
      {
        target:
          "xlsx",

        label:
          "Excel workbook (.xlsx)",

        description:
          "Turns CSV rows into an Excel workbook."
      },

      {
        target:
          "json",

        label:
          "JSON data (.json)",

        description:
          "Turns CSV rows into JSON objects."
      }
    ],

    json: [
      {
        target:
          "csv",

        label:
          "CSV data (.csv)",

        description:
          "Converts common JSON records into CSV."
      },

      {
        target:
          "xlsx",

        label:
          "Excel workbook (.xlsx)",

        description:
          "Converts common JSON records into an Excel workbook."
      }
    ],

    txt: [
      {
        target:
          "docx",

        label:
          "Word document (.docx)",

        description:
          "Places plain text into an editable Word document."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Turns plain text into a printable PDF."
      }
    ],

    md: [
      {
        target:
          "html",

        label:
          "HTML page (.html)",

        description:
          "Renders Markdown as HTML."
      },

      {
        target:
          "docx",

        label:
          "Word document (.docx)",

        description:
          "Turns Markdown into an editable Word document."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Turns Markdown into a printable PDF."
      }
    ],

    html: [
      {
        target:
          "txt",

        label:
          "Plain text (.txt)",

        description:
          "Removes markup and keeps readable page text."
      },

      {
        target:
          "docx",

        label:
          "Word document (.docx)",

        description:
          "Converts common HTML content into Word."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Creates a printable PDF from HTML content."
      }
    ],

    htm: [
      {
        target:
          "txt",

        label:
          "Plain text (.txt)",

        description:
          "Removes markup and keeps readable page text."
      },

      {
        target:
          "docx",

        label:
          "Word document (.docx)",

        description:
          "Converts common HTML content into Word."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Creates a printable PDF from HTML content."
      }
    ],

    jpg: [
      {
        target:
          "png",

        label:
          "PNG image (.png)",

        description:
          "Converts JPEG to PNG."
      },

      {
        target:
          "webp",

        label:
          "WEBP image (.webp)",

        description:
          "Converts JPEG to WEBP."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Uses the image itself as a PDF page without A4 margins."
      }
    ],

    jpeg: [
      {
        target:
          "png",

        label:
          "PNG image (.png)",

        description:
          "Converts JPEG to PNG."
      },

      {
        target:
          "webp",

        label:
          "WEBP image (.webp)",

        description:
          "Converts JPEG to WEBP."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Uses the image itself as a PDF page without A4 margins."
      }
    ],

    png: [
      {
        target:
          "jpg",

        label:
          "JPG image (.jpg)",

        description:
          "Converts PNG to JPEG. JPEG does not preserve transparency."
      },

      {
        target:
          "webp",

        label:
          "WEBP image (.webp)",

        description:
          "Converts PNG to WEBP."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Uses the image itself as a PDF page without extra margins."
      }
    ],

    webp: [
      {
        target:
          "jpg",

        label:
          "JPG image (.jpg)",

        description:
          "Converts WEBP to JPEG."
      },

      {
        target:
          "png",

        label:
          "PNG image (.png)",

        description:
          "Converts WEBP to PNG."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Uses the image itself as a PDF page without extra margins."
      }
    ],

    heic: [
      {
        target:
          "jpg",

        label:
          "JPG image (.jpg)",

        description:
          "Converts a HEIC phone photo to JPEG."
      },

      {
        target:
          "png",

        label:
          "PNG image (.png)",

        description:
          "Converts a HEIC phone photo to PNG."
      },

      {
        target:
          "pdf",

        label:
          "PDF document (.pdf)",

        description:
          "Uses the HEIC photo as a PDF page."
      }
    ]
  };


  /* ==========================================================
     04. STATE
     ========================================================== */

  const state = {
    file:
      null,

    source:
      "",

    target:
      "",

    apiOnline:
      false,

    libreOffice:
      false
  };


  /* ==========================================================
     05. HELPERS
     ========================================================== */

  function extensionOf(file) {
    const name =
      file?.name
        ?.toLowerCase()
        ||
      "";


    const dot =
      name.lastIndexOf(
        "."
      );


    return (
      dot >= 0
        ? name.slice(
            dot + 1
          )
        : ""
    );
  }


  function formatFileSize(bytes) {
    if (
      !Number.isFinite(
        bytes
      )
    ) {
      return "—";
    }


    if (
      bytes < 1024
    ) {
      return `${bytes} B`;
    }


    if (
      bytes < 1024 * 1024
    ) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }


    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }


  function toast(message) {
    if (!toastElement) {
      return;
    }


    toastElement.textContent =
      message;


    toastElement.classList.add(
      "is-visible"
    );


    clearTimeout(
      toast.timer
    );


    toast.timer =
      setTimeout(
        () => {
          toastElement.classList.remove(
            "is-visible"
          );
        },
        3000
      );
  }


  function sanitizeDownloadName(
    name,
    fallback
  ) {
    const clean =
      String(
        name || ""
      )
        .replace(
          /[<>:"/\\|?*\u0000-\u001F]/g,
          "-"
        )
        .trim();


    return (
      clean
      ||
      fallback
    );
  }


  function setRunButton(
    label,
    disabled = true
  ) {
    runButton.textContent =
      label;


    runButton.disabled =
      disabled;
  }


  function setConversionMessage(
    message
  ) {
    selectedDescription.textContent =
      message;
  }


  /* ==========================================================
     06. ENGINE STATUS
     ========================================================== */

  function setEngineStatus(
    online,
    libreOffice,
    message = ""
  ) {
    state.apiOnline =
      online;


    state.libreOffice =
      libreOffice;


    engineStatus.classList.toggle(
      "is-online",
      online
    );


    engineStatus.classList.toggle(
      "is-full",
      Boolean(
        libreOffice
      )
    );


    const strong =
      engineStatus.querySelector(
        "strong"
      );


    const small =
      engineStatus.querySelector(
        "small"
      );


    if (!online) {
      strong.textContent =
        "Converter API offline";


      small.textContent =
        message
        ||
        "Start the MazeDocs converter backend or redeploy the API.";


      return;
    }


    if (libreOffice) {
      strong.textContent =
        "Full conversion engine online";


      small.textContent =
        "LibreOffice detected · Universal Converter supports files up to 200 MB.";
    }
    else {
      strong.textContent =
        "Portable conversion engine online";


      small.textContent =
        "Railway converter online · modern formats ready · legacy .doc, .ppt, and .xls need LibreOffice.";
    }
  }


  /* ==========================================================
     07. TARGET PICKER
     ========================================================== */

  function resetTargetPicker() {
    state.target =
      "";


    targetSelect.innerHTML =
      '<option value="">Choose a format…</option>';


    targetLabel.textContent =
      "Choose an output format.";


    targetDescription.textContent =
      "MazeDocs only shows formats that make sense for the source file.";


    action.hidden =
      true;
  }


  function clearConverter() {
    state.file =
      null;


    state.source =
      "";


    resetTargetPicker();


    converterInput.value =
      "";


    fileCard.hidden =
      true;


    targets.hidden =
      true;


    converterDrop.hidden =
      false;


    routeNote.textContent =
      "Select the file type you want MazeDocs to create.";
  }


  function populateTargets() {
    resetTargetPicker();


    const routes =
      ROUTES[state.source]
      ||
      [];


    if (!routes.length) {
      targets.hidden =
        false;


      targetLabel.textContent =
        "Unsupported file type";


      targetDescription.textContent =
        `MazeDocs does not have conversion routes for .${state.source || "?"}.`;


      routeNote.textContent =
        "Choose another source file.";


      return;
    }


    routes.forEach(
      (route) => {
        const option =
          document.createElement(
            "option"
          );


        option.value =
          route.target;


        option.textContent =
          route.requiresLibreOffice
            ? `${route.label} · requires LibreOffice`
            : route.label;


        option.disabled =
          Boolean(
            route.requiresLibreOffice
            &&
            state.apiOnline
            &&
            !state.libreOffice
          );


        targetSelect.appendChild(
          option
        );
      }
    );


    targets.hidden =
      false;


    if (
      state.file.size >=
      50 * 1024 * 1024
    ) {
      routeNote.textContent =
        `Large file · ${formatFileSize(state.file.size)} will upload directly to the MazeDocs converter. Keep this tab open while it uploads.`;
    }
    else if (
      state.libreOffice
    ) {
      routeNote.textContent =
        "Full Railway conversion engine online · background conversion jobs enabled · files up to 200 MB supported.";
    }
    else {
      routeNote.textContent =
        "Railway converter online · legacy .doc, .ppt, and .xls need LibreOffice.";
    }
  }


  function setFile(file) {
    if (!file) {
      return;
    }


    if (
      file.size >
      MAX_CONVERTER_FILE_BYTES
    ) {
      toast(
        `Maximum file size is 200 MB. This file is ${formatFileSize(file.size)}.`
      );


      converterInput.value =
        "";


      return;
    }


    const source =
      extensionOf(
        file
      );


    if (
      !source
      ||
      !ROUTES[source]
    ) {
      toast(
        "This file type is not supported yet."
      );


      return;
    }


    state.file =
      file;


    state.source =
      source;


    converterDrop.hidden =
      true;


    fileCard.hidden =
      false;


    fileExt.textContent =
      source.toUpperCase();


    fileName.textContent =
      file.name;


    fileMeta.textContent =
      `${formatFileSize(file.size)} · Railway converter`;


    populateTargets();
  }


  function selectedRouteDefinition() {
    return (
      ROUTES[state.source]
      ||
      []
    ).find(
      (route) =>
        route.target ===
        state.target
    );
  }


  function updateSelectedTarget() {
    state.target =
      targetSelect.value;


    const route =
      selectedRouteDefinition();


    if (!route) {
      targetLabel.textContent =
        "Choose an output format.";


      targetDescription.textContent =
        "MazeDocs only shows formats that make sense for the source file.";


      action.hidden =
        true;


      return;
    }


    targetLabel.textContent =
      route.label;


    targetDescription.textContent =
      route.description;


    selectedRoute.textContent =
      `${state.source.toUpperCase()} → ${route.target.toUpperCase()}`;


    selectedDescription.textContent =
      route.description;


    if (
      state.source === "pdf"
      &&
      state.target === "docx"
    ) {
      selectedDescription.textContent =
        "Creates an editable Word document and preserves the PDF's text, images, tables, spacing, and layout as closely as the source allows.";
    }


    const unavailable =
      route.requiresLibreOffice
      &&
      !state.libreOffice;


    runButton.disabled =
      !state.apiOnline
      ||
      unavailable;


    if (unavailable) {
      selectedDescription.textContent =
        `${route.description} LibreOffice is required for this route.`;
    }
    else if (!state.apiOnline) {
      selectedDescription.textContent =
        `${route.description} The converter API is currently offline.`;
    }
    else if (
      state.file
      &&
      state.file.size >=
      50 * 1024 * 1024
    ) {
      selectedDescription.textContent =
        `${route.description} This ${formatFileSize(state.file.size)} file will upload directly to the MazeDocs Railway converter.`;
    }


    action.hidden =
      false;
  }


  /* ==========================================================
     08. RESPONSE HELPERS
     ========================================================== */

  async function readErrorResponse(
    response
  ) {
    const contentType =
      response.headers.get(
        "content-type"
      )
      ||
      "";


    if (
      contentType.includes(
        "application/json"
      )
    ) {
      try {
        const data =
          await response.json();


        return (
          data.detail
          ||
          data.message
          ||
          data.error
          ||
          `Request failed (${response.status}).`
        );
      }
      catch {
        return `Request failed (${response.status}).`;
      }
    }


    const text =
      await response.text();


    if (
      /<!doctype|<html/i.test(
        text
      )
    ) {
      return "The expected MazeDocs API endpoint was not reached.";
    }


    return (
      text.trim().slice(
        0,
        220
      )
      ||
      `Request failed (${response.status}).`
    );
  }


  function filenameFromDisposition(
    response,
    fallback
  ) {
    const disposition =
      response.headers.get(
        "content-disposition"
      )
      ||
      "";


    const encodedMatch =
      disposition.match(
        /filename\*=UTF-8''([^;]+)/i
      );


    const plainMatch =
      disposition.match(
        /filename="?([^";]+)"?/i
      );


    if (encodedMatch) {
      return sanitizeDownloadName(
        decodeURIComponent(
          encodedMatch[1]
        ),
        fallback
      );
    }


    if (plainMatch) {
      return sanitizeDownloadName(
        plainMatch[1],
        fallback
      );
    }


    return fallback;
  }


  function downloadBlob(
    blob,
    filename
  ) {
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


    setTimeout(
      () => {
        URL.revokeObjectURL(
          url
        );
      },
      900
    );
  }


  function downloadFromUrl(
    url,
    filename
  ) {
    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    /*
     * download is honored when the storage URL allows it.
     * Otherwise the URL opens normally and the provider serves
     * the file using its own Content-Disposition header.
     */
    link.download =
      filename
      ||
      "";


    link.rel =
      "noopener";


    document.body.appendChild(
      link
    );


    link.click();

    link.remove();
  }


  /* ==========================================================
     09. RAILWAY CONVERSION
     ========================================================== */

  function filenameFromXHR(
    request,
    fallback
  ) {
    const disposition =
      request.getResponseHeader(
        "content-disposition"
      )
      ||
      "";


    const encodedMatch =
      disposition.match(
        /filename\*=UTF-8''([^;]+)/i
      );


    const plainMatch =
      disposition.match(
        /filename="?([^";]+)"?/i
      );


    if (encodedMatch) {
      return sanitizeDownloadName(
        decodeURIComponent(
          encodedMatch[1]
        ),
        fallback
      );
    }


    if (plainMatch) {
      return sanitizeDownloadName(
        plainMatch[1],
        fallback
      );
    }


    return fallback;
  }


  async function errorMessageFromBlob(
    blob,
    status
  ) {
    try {
      const text =
        await blob.text();


      if (!text.trim()) {
        return `Conversion failed (${status}).`;
      }


      try {
        const data =
          JSON.parse(
            text
          );


        return (
          data.detail
          ||
          data.message
          ||
          data.error
          ||
          `Conversion failed (${status}).`
        );
      }
      catch {
        return text
          .replace(
            /<[^>]+>/g,
            " "
          )
          .replace(
            /\s+/g,
            " "
          )
          .trim()
          .slice(
            0,
            240
          )
          ||
          `Conversion failed (${status}).`;
      }
    }
    catch {
      return `Conversion failed (${status}).`;
    }
  }


  function uploadConversionJob() {
    return new Promise(
      (resolve, reject) => {
        const form =
          new FormData();


        form.append(
          "file",
          state.file
        );


        form.append(
          "target",
          state.target
        );


        const request =
          new XMLHttpRequest();


        request.open(
          "POST",
          `${API_BASE}/api/jobs`,
          true
        );


        request.responseType =
          "text";


        request.upload.addEventListener(
          "loadstart",
          () => {
            setRunButton(
              "Uploading 0%…"
            );


            setConversionMessage(
              `Uploading ${formatFileSize(state.file.size)} to the MazeDocs converter…`
            );
          }
        );


        request.upload.addEventListener(
          "progress",
          (event) => {
            if (!event.lengthComputable) {
              setRunButton(
                "Uploading…"
              );

              return;
            }


            const percent =
              Math.min(
                100,
                Math.round(
                  (
                    event.loaded /
                    event.total
                  )
                  *
                  100
                )
              );


            setRunButton(
              `Uploading ${percent}%…`
            );


            setConversionMessage(
              `Uploading to the MazeDocs converter · ${percent}%`
            );
          }
        );


        request.upload.addEventListener(
          "load",
          () => {
            setRunButton(
              "Starting conversion…"
            );


            setConversionMessage(
              "Upload complete. Starting the conversion job…"
            );
          }
        );


        request.addEventListener(
          "load",
          () => {
            let data = null;

            try {
              data = JSON.parse(
                request.responseText
                ||
                "{}"
              );
            }
            catch {
              data = null;
            }


            if (
              request.status >= 200
              &&
              request.status < 300
              &&
              data?.job_id
            ) {
              resolve(
                data.job_id
              );

              return;
            }


            reject(
              new Error(
                data?.detail
                ||
                data?.message
                ||
                `Could not start conversion (${request.status}).`
              )
            );
          }
        );


        request.addEventListener(
          "error",
          () => {
            reject(
              new Error(
                "Could not upload the file to the MazeDocs converter."
              )
            );
          }
        );


        request.timeout =
          0;


        request.send(
          form
        );
      }
    );
  }


  function wait(milliseconds) {
    return new Promise(
      (resolve) => {
        window.setTimeout(
          resolve,
          milliseconds
        );
      }
    );
  }


  function elapsedLabel(startedAt) {
    const seconds =
      Math.max(
        0,
        Math.floor(
          (
            Date.now()
            -
            startedAt
          )
          /
          1000
        )
      );


    const minutes =
      Math.floor(
        seconds /
        60
      );


    const remainder =
      seconds % 60;


    if (minutes > 0) {
      return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
    }


    return `${seconds}s`;
  }


  async function waitForConversionJob(
    jobId
  ) {
    const startedAt =
      Date.now();


    while (true) {
      const response =
        await fetch(
          `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}`,
          {
            cache:
              "no-store"
          }
        );


      const data =
        await response.json().catch(
          () => ({})
        );


      if (!response.ok) {
        throw new Error(
          data.detail
          ||
          data.message
          ||
          `Could not read conversion status (${response.status}).`
        );
      }


      if (
        data.status ===
        "done"
      ) {
        return data;
      }


      if (
        data.status ===
        "error"
      ) {
        throw new Error(
          data.error
          ||
          "Conversion failed."
        );
      }


      const elapsed =
        elapsedLabel(
          startedAt
        );


      setRunButton(
        `Converting… ${elapsed}`
      );


      setConversionMessage(
        `MazeDocs is rebuilding your ${state.source.toUpperCase()} as ${state.target.toUpperCase()} · ${elapsed}. Keep this tab open; the conversion is still running.`
      );


      await wait(
        1800
      );
    }
  }


  function triggerJobDownload(
    jobId,
    filename
  ) {
    const link =
      document.createElement(
        "a"
      );


    link.href =
      `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/download`;


    if (filename) {
      link.download =
        filename;
    }


    link.rel =
      "noopener";


    document.body.appendChild(
      link
    );


    link.click();
    link.remove();
  }


  async function convertThroughRailway() {
    const jobId =
      await uploadConversionJob();


    setRunButton(
      "Converting… 0s"
    );


    setConversionMessage(
      "Upload complete. MazeDocs is now converting the file in the background…"
    );


    const result =
      await waitForConversionJob(
        jobId
      );


    setRunButton(
      "Downloading…"
    );


    setConversionMessage(
      "Conversion complete. Your download is starting…"
    );


    triggerJobDownload(
      jobId,
      result.filename
    );
  }



  /* ==========================================================
     12. MAIN CONVERT ACTION
     ========================================================== */

  async function convertFile() {
    if (
      !state.file
      ||
      !state.target
    ) {
      toast(
        "Choose an output format first."
      );


      return;
    }


    if (
      !state.apiOnline
    ) {
      toast(
        "Converter API is offline."
      );


      return;
    }


    if (
      state.file.size >
      MAX_CONVERTER_FILE_BYTES
    ) {
      toast(
        "MazeDocs currently supports files up to 200 MB."
      );


      return;
    }


    const route =
      selectedRouteDefinition();


    if (
      route?.requiresLibreOffice
      &&
      !state.libreOffice
    ) {
      toast(
        "This conversion requires LibreOffice."
      );


      return;
    }


    const originalHtml =
      runButton.innerHTML;


    const originalDescription =
      selectedDescription.textContent;


    runButton.disabled =
      true;


    action.classList.add(
      "is-processing"
    );


    try {
      await convertThroughRailway();


      toast(
        "Conversion complete."
      );
    }
    catch (error) {
      console.error(
        error
      );


      const message =
        error.message
        ||
        "Conversion failed.";


      toast(
        message
      );


      selectedDescription.textContent =
        message;
    }
    finally {
      runButton.innerHTML =
        originalHtml;


      runButton.disabled =
        false;


      action.classList.remove(
        "is-processing"
      );


      updateSelectedTarget();


      if (
        selectedDescription.textContent ===
        "Conversion failed."
      ) {
        selectedDescription.textContent =
          originalDescription;
      }
    }
  }


  /* ==========================================================
     13. DROP ZONE / EVENTS
     ========================================================== */

  function attachDropZone() {
    [
      "dragenter",
      "dragover"
    ].forEach(
      (eventName) => {
        converterDrop.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();


            converterDrop.classList.add(
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
        converterDrop.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();


            converterDrop.classList.remove(
              "is-dragging"
            );


            if (
              eventName ===
              "drop"
            ) {
              setFile(
                event.dataTransfer.files[0]
              );
            }
          }
        );
      }
    );
  }


  chooseButton.addEventListener(
    "click",
    () => {
      converterInput.click();
    }
  );


  converterInput.addEventListener(
    "change",
    () => {
      setFile(
        converterInput.files[0]
      );
    }
  );


  targetSelect.addEventListener(
    "change",
    updateSelectedTarget
  );


  clearButton.addEventListener(
    "click",
    clearConverter
  );


  runButton.addEventListener(
    "click",
    convertFile
  );


  resetButton?.addEventListener(
    "click",
    () => {
      const panel =
        document.querySelector(
          '[data-tool-panel="convert"]'
        );


      if (
        panel
        &&
        !panel.hidden
      ) {
        clearConverter();
      }
    }
  );


  attachDropZone();

  clearConverter();

  /*
 * Railway Docker image already includes LibreOffice.
 * Do not expose a public health request on page load.
 */
setEngineStatus(
  true,
  true
);

if (state.file) {
  populateTargets();
}
})();

/* ============================================================
   MAZEDOCS FEEDBACK
   ============================================================ */

(() => {
  "use strict";


  /*
   * Put your Formspree ID here.
   *
   * Example:
   *
   * https://formspree.io/f/xabcdefg
   *
   * becomes:
   *
   * xabcdefg
   */

  const FEEDBACK_FORM_ID =
    "xgaeejow";


  const FEEDBACK_ENDPOINT =
    `https://formspree.io/f/${FEEDBACK_FORM_ID}`;


  const launcher =
    document.querySelector(
      "#feedback-launcher"
    );


  const modal =
    document.querySelector(
      "#feedback-modal"
    );


  const closeButton =
    document.querySelector(
      "#feedback-close"
    );


  const form =
    document.querySelector(
      "#feedback-form"
    );


  const ratingInput =
    document.querySelector(
      "#feedback-rating"
    );


  const stars =
    [
      ...document.querySelectorAll(
        ".feedback-star"
      )
    ];


  const submitButton =
    document.querySelector(
      "#feedback-submit"
    );


  const status =
    document.querySelector(
      "#feedback-status"
    );


  if (
    !launcher
    ||
    !modal
    ||
    !closeButton
    ||
    !form
    ||
    !ratingInput
    ||
    !submitButton
    ||
    !status
  ) {
    return;
  }


  let lastFocusedElement =
    null;


  /* ==========================================================
     STATUS
     ========================================================== */

  function setStatus(
    message,
    type = ""
  ) {

    status.textContent =
      message;


    status.className =
      "feedback-status";


    if (type) {

      status.classList.add(
        `is-${type}`
      );

    }

  }


  /* ==========================================================
     STARS
     ========================================================== */

  function updateStars(
    value = 0
  ) {

    stars.forEach(
      (star) => {

        const starValue =
          Number(
            star.dataset.rating
          );


        const active =
          starValue <= value;


        star.classList.toggle(
          "is-active",
          active
        );


        star.setAttribute(
          "aria-pressed",
          active
            ? "true"
            : "false"
        );

      }
    );

  }


  /* ==========================================================
     OPEN / CLOSE
     ========================================================== */

  function openFeedback() {

    lastFocusedElement =
      document.activeElement;


    modal.hidden =
      false;


    setStatus(
      ""
    );


    window.setTimeout(
      () => {

        closeButton.focus();

      },
      0
    );

  }


  function closeFeedback() {

    modal.hidden =
      true;


    setStatus(
      ""
    );


    if (
      lastFocusedElement
      instanceof HTMLElement
    ) {

      lastFocusedElement.focus();

    }

  }


  launcher.addEventListener(
    "click",
    openFeedback
  );


  closeButton.addEventListener(
    "click",
    closeFeedback
  );


  /*
   * Clicking the dark area outside
   * the form closes the feedback window.
   */

  modal.addEventListener(
    "click",
    (event) => {

      if (
        event.target === modal
      ) {

        closeFeedback();

      }

    }
  );


  /*
   * ESC also closes it.
   */

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape"
        &&
        !modal.hidden
      ) {

        closeFeedback();

      }

    }
  );


  /* ==========================================================
     RATING
     ========================================================== */

  stars.forEach(
    (star) => {

      star.addEventListener(
        "click",
        () => {

          const value =
            Number(
              star.dataset.rating
            );


          ratingInput.value =
            String(
              value
            );


          updateStars(
            value
          );


          setStatus(
            ""
          );

        }
      );

    }
  );


  /* ==========================================================
     SEND FEEDBACK
     ========================================================== */

  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      /*
       * Prevent accidental deployment
       * before Formspree is configured.
       */

      if (
        FEEDBACK_FORM_ID ===
        "YOUR_FORM_ID"
      ) {

        setStatus(
          "Add your Formspree form ID in script.js first.",
          "error"
        );


        return;
      }


      /*
       * Require a rating.
       */

      if (
        !ratingInput.value
      ) {

        setStatus(
          "Choose a star rating first.",
          "error"
        );


        return;
      }


      /*
       * Run normal browser validation
       * for message, email, etc.
       */

      if (
        !form.reportValidity()
      ) {

        return;

      }


      const originalButtonText =
        submitButton.textContent;


      submitButton.disabled =
        true;


      submitButton.textContent =
        "Sending…";


      setStatus(
        "Sending your feedback…"
      );


      /*
       * Collect every named field
       * from the feedback form.
       */

      const formData =
        new FormData(
          form
        );


      /*
       * Useful when you receive
       * the email so you know which
       * MazeDocs page submitted it.
       */

      formData.append(
        "page",
        window.location.href
      );


      try {

        const response =
          await fetch(
            FEEDBACK_ENDPOINT,
            {

              method:
                "POST",

              body:
                formData,

              headers: {
                Accept:
                  "application/json"
              }

            }
          );


        if (
          !response.ok
        ) {

          const data =
            await response
              .json()
              .catch(
                () => ({})
              );


          const message =
            data
              ?.errors
              ?.[0]
              ?.message
            ||
            "Could not send feedback. Please try again.";


          throw new Error(
            message
          );

        }


        /*
         * Success.
         */

        form.reset();


        ratingInput.value =
          "";


        updateStars(
          0
        );


        setStatus(
          "Thanks — your feedback was sent!",
          "success"
        );


        /*
         * Close after showing success.
         */

        window.setTimeout(
          () => {

            closeFeedback();

          },
          1400
        );

      }
      catch (error) {

        console.error(
          "MazeDocs feedback error:",
          error
        );


        setStatus(
          error.message
          ||
          "Could not send feedback. Please try again.",
          "error"
        );

      }
      finally {

        submitButton.disabled =
          false;


        submitButton.textContent =
          originalButtonText;

      }

    }
  );

})();