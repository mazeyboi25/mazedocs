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
      label: "Auto"
    },

    document: {
      label: "Document"
    },

    vivid: {
      label: "Vivid Color"
    },

    grayscale: {
      label: "Grayscale"
    },

    bw: {
      label: "B&W"
    },

    shadow: {
      label: "Shadow Fix"
    },

    sharpen: {
      label: "Sharp Text"
    },

    denoise: {
      label: "Denoise"
    },

    photo: {
      label: "Photo"
    }
  };


  let enhancementSession = {
    item: null,
    items: null,
    mode: "original",
    previewUrl: "",
    requestId: 0,
    returnFocus: null
  };


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


  async function loadImageElement(file) {
    const dataUrl =
      await fileToDataUrl(
        file
      );


    return await new Promise(
      (resolve, reject) => {
        const image =
          new Image();


        image.onload =
          () => resolve(image);


        image.onerror =
          reject;


        image.src =
          dataUrl;
      }
    );
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


  function applyEnhancementPreset(
    canvas,
    mode
  ) {
    if (
      !mode
      ||
      mode ===
      "original"
    ) {
      return;
    }


    const context =
      canvas.getContext(
        "2d",
        {
          alpha: true,
          willReadFrequently: true
        }
      );


    if (
      mode ===
      "denoise"
    ) {
      applySoftDenoise(
        canvas
      );

      return;
    }


    let imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );


    if (
      mode ===
      "auto"
    ) {
      applyAutoTone(
        imageData,
        {
          saturation: 1.05,
          contrast: 1.05,
          brightness: 2
        }
      );
    }


    if (
      mode ===
      "photo"
    ) {
      applyAutoTone(
        imageData,
        {
          saturation: 1.13,
          contrast: 1.055,
          brightness: 1
        }
      );
    }


    if (
      mode ===
      "vivid"
    ) {
      applyAutoTone(
        imageData,
        {
          saturation: 1.28,
          contrast: 1.1,
          brightness: 2
        }
      );
    }


    if (
      mode ===
      "grayscale"
    ) {
      applyAutoTone(
        imageData,
        {
          saturation: 1,
          contrast: 1.04,
          brightness: 2
        }
      );


      applyGrayscale(
        imageData
      );
    }


    if (
      mode ===
      "shadow"
      ||
      mode ===
      "document"
      ||
      mode ===
      "bw"
    ) {
      const backgroundData =
        createBlurredBackground(
          canvas,
          Math.max(
            10,
            Math.round(
              Math.min(
                canvas.width,
                canvas.height
              ) *
              0.018
            )
          )
        );


      if (
        mode ===
        "bw"
      ) {
        applyBlackAndWhite(
          imageData,
          backgroundData
        );
      }
      else {
        normalizePageLighting(
          imageData,
          backgroundData,
          mode ===
          "document"
            ? 0.94
            : 0.72
        );


        applyAutoTone(
          imageData,
          mode ===
          "document"
            ? {
                saturation: 0.96,
                contrast: 1.13,
                brightness: 8
              }
            : {
                saturation: 1.02,
                contrast: 1.055,
                brightness: 4
              }
        );


        if (
          mode ===
          "document"
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


            if (
              gray >
              188
            ) {
              const lift =
                (
                  gray - 188
                ) /
                67;


              pixels[index] =
                clampChannel(
                  pixels[index]
                  +
                  15 * lift
                );


              pixels[index + 1] =
                clampChannel(
                  pixels[index + 1]
                  +
                  15 * lift
                );


              pixels[index + 2] =
                clampChannel(
                  pixels[index + 2]
                  +
                  15 * lift
                );
            }
          }
        }
      }
    }


    if (
      mode ===
      "sharpen"
    ) {
      applyAutoTone(
        imageData,
        {
          saturation: 1.01,
          contrast: 1.08,
          brightness: 1
        }
      );


      context.putImageData(
        imageData,
        0,
        0
      );


      const blurredData =
        createBlurredBackground(
          canvas,
          1.15
        );


      imageData =
        context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );


      applyUnsharpMask(
        imageData,
        blurredData,
        0.72
      );
    }


    context.putImageData(
      imageData,
      0,
      0
    );
  }


  async function renderImageWithEnhancement(
    file,
    mode = "original",
    maximumDimension = 2600
  ) {
    const image =
      await loadImageElement(
        file
      );


    const work =
      createWorkingCanvas(
        image,
        maximumDimension
      );


    applyEnhancementPreset(
      work.canvas,
      mode
    );


    return work;
  }


  async function canvasToObjectUrl(
    canvas
  ) {
    const blob =
      await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.9
          );
        }
      );


    if (
      !blob
    ) {
      return canvas.toDataURL(
        "image/jpeg",
        0.9
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


  async function renderEnhancementPreview() {
    const item =
      enhancementSession.item;


    if (
      !item
      ||
      !elements.enhancementPreview
    ) {
      return;
    }


    const mode =
      enhancementSession.mode
      ||
      "original";


    const requestId =
      ++enhancementSession.requestId;


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
      getEnhancementLabel(
        mode
      );


    if (
      mode ===
      "original"
    ) {
      releaseEnhancementPreview();


      elements.enhancementRendering.hidden =
        true;


      elements.enhancementPreview.src =
        item.previewUrl;


      elements.enhancementStatus.textContent =
        "Original image selected. No processing will be applied.";


      return;
    }


    elements.enhancementRendering.hidden =
      false;


    elements.enhancementStatus.textContent =
      "Rendering a local preview…";


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
          ? 760
          : 1100;


      const {
        canvas
      } =
        await renderImageWithEnhancement(
          item.file,
          mode,
          previewDimension
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


      elements.enhancementStatus.textContent =
        `${getEnhancementLabel(mode)} preview · processed locally`;
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


  function openEnhancementModal(
    item,
    items,
    trigger
  ) {
    if (
      !item
      ||
      !elements.enhancementModal
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
      ||
      "original";


    enhancementSession.returnFocus =
      trigger
      ||
      document.activeElement;


    elements.enhancementOriginal.src =
      item.previewUrl;


    elements.enhancementPreview.src =
      item.previewUrl;


    elements.enhancementModal.hidden =
      false;


    document.body.classList.add(
      "enhancement-open"
    );


    renderEnhancementPreview();


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
      ||
      elements.enhancementModal.hidden
    ) {
      return;
    }


    enhancementSession.requestId +=
      1;


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


    enhancementSession.returnFocus =
      null;


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
              ||
              "original";


            renderEnhancementPreview();
          }
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
          ||
          !items
        ) {
          return;
        }


        item.enhancement =
          enhancementSession.mode
          ||
          "original";


        rerenderImageToolForItems(
          items
        );


        showToast(
          `${getEnhancementLabel(item.enhancement)} applied to this page.`
        );


        closeEnhancementModal();
      }
    );


    elements.enhancementApplyAll.addEventListener(
      "click",
      () => {
        const items =
          enhancementSession.items;


        if (
          !items?.length
        ) {
          return;
        }


        const mode =
          enhancementSession.mode
          ||
          "original";


        items.forEach(
          (item) => {
            item.enhancement =
              mode;
          }
        );


        rerenderImageToolForItems(
          items
        );


        showToast(
          `${getEnhancementLabel(mode)} applied to all pages.`
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
          event.key ===
          "Escape"
          &&
          !elements.enhancementModal.hidden
        ) {
          closeEnhancementModal();
        }
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


    const {
      canvas,
      width,
      height
    } =
      await renderImageWithEnhancement(
        item.file,
        enhancement,
        2600
      );


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
            "original"
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


    card.innerHTML = `
      <div class="image-card__preview">
        <img alt="" />
        <span class="image-card__preset">${getEnhancementLabel(mode)}</span>
      </div>

      <div class="image-card__footer">
        <div class="image-card__meta">
          <span></span>
          <small>${mode === "original" ? "No enhancement" : "Enhancement ready for export"}</small>
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
          `Page ${index + 1} of ${items.length} · ${getEnhancementLabel(enhancement)}.`;


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