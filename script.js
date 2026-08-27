/* ============================================================
   MAZEDOCS V1 — script.js

   Tools included:
   - Merge PDFs
   - Organize / rotate / delete / extract pages
   - Visual PDF compression
   - Images to PDF
   - Scan photos to PDF
   - OCR images and PDFs
   - Assignment Builder

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
      null,

    assignmentFiles:
      []
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

    assignment:
      "Assignment Builder"
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
      $("#ocr-download-button"),


    /* Assignment */

    assignmentInput:
      $("#assignment-input"),

    assignmentDrop:
      $("#assignment-drop"),

    assignmentChooseButton:
      $("#assignment-choose-button"),

    assignmentList:
      $("#assignment-list"),

    assignmentActions:
      $("#assignment-actions"),

    assignmentName:
      $("#assignment-name"),

    assignmentBuildButton:
      $("#assignment-build-button")
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
    grayscale
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


    const maximumDimension =
      2200;


    const scale =
      Math.min(
        1,
        maximumDimension /
          Math.max(
            image.naturalWidth,
            image.naturalHeight
          )
      );


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
          scale
        )
      );


    canvas.height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
          scale
        )
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


    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );


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


    const jpegDataUrl =
      canvas.toDataURL(
        "image/jpeg",
        0.92
      );


    const jpegBytes =
      await fetch(
        jpegDataUrl
      ).then(
        (response) =>
          response.arrayBuffer()
      );


    const embedded =
      await pdfDocument.embedJpg(
        jpegBytes
      );


    return {
      embedded,

      width:
        canvas.width,

      height:
        canvas.height
    };
  }


  function addImagesToState(
    targetArray,
    files
  ) {
    const images =
      files.filter(
        isImage
      );


    if (!images.length) {
      showToast(
        "Choose image files."
      );

      return;
    }


    images.forEach(
      (file) => {

        targetArray.push({
          id:
            makeId(),

          file,

          previewUrl:
            URL.createObjectURL(
              file
            )
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
    onRemove
  ) {
    const card =
      document.createElement(
        "article"
      );


    card.className =
      "image-card";


    card.dataset.id =
      item.id;


    card.innerHTML = `
      <div class="image-card__preview">
        <img alt="" />
      </div>

      <div class="image-card__footer">
        <span></span>

        <button
          class="file-remove"
          type="button"
          aria-label="Remove image"
        >
          ×
        </button>
      </div>
    `;


    card
      .querySelector("img")
      .src =
        item.previewUrl;


    card
      .querySelector(".image-card__footer span")
      .textContent =
        `${String(index + 1).padStart(2, "0")} · ${item.file.name}`;


    card
      .querySelector(".file-remove")
      .addEventListener(
        "click",
        onRemove
      );


    return card;
  }


  async function buildPdfFromImages(
    items,
    filename,
    grayscale
  ) {
    if (!items.length) {
      showToast(
        "Add at least one image."
      );

      return;
    }


    showProcessing(
      "Building PDF.",
      "Turning images into document pages."
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


        const normalized =
          await normalizeImageForPdf(
            output,
            items[index].file,
            grayscale
          );


        const landscape =
          normalized.width >
          normalized.height;


        const pageWidth =
          landscape
            ? 842
            : 595;


        const pageHeight =
          landscape
            ? 595
            : 842;


        const margin =
          28;


        const scale =
          Math.min(
            (
              pageWidth -
              margin *
              2
            )
            /
            normalized.width,

            (
              pageHeight -
              margin *
              2
            )
            /
            normalized.height
          );


        const drawWidth =
          normalized.width *
          scale;


        const drawHeight =
          normalized.height *
          scale;


        const page =
          output.addPage([
            pageWidth,
            pageHeight
          ]);


        page.drawImage(
          normalized.embedded,
          {
            x:
              (
                pageWidth -
                drawWidth
              )
              /
              2,

            y:
              (
                pageHeight -
                drawHeight
              )
              /
              2,

            width:
              drawWidth,

            height:
              drawHeight
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
     15. ASSIGNMENT BUILDER
     ========================================================== */

  function addAssignmentFiles(files) {
    const supported =
      files.filter(
        (file) =>
          isPdf(file)
          ||
          isImage(file)
      );


    if (!supported.length) {
      showToast(
        "Add PDFs or images."
      );

      return;
    }


    supported.forEach(
      (file) => {

        state.assignmentFiles.push({
          id:
            makeId(),

          file
        });

      }
    );


    renderAssignmentFiles();
  }


  function renderAssignmentFiles() {
    elements.assignmentList.innerHTML =
      "";


    state.assignmentFiles.forEach(
      (item, index) => {

        const row =
          document.createElement(
            "article"
          );


        row.className =
          "assignment-row";


        row.dataset.id =
          item.id;


        row.innerHTML = `
          <span class="assignment-row__number">
            ${String(index + 1).padStart(2, "0")}
          </span>

          <span class="assignment-row__type">
            ${isPdf(item.file) ? "PDF" : "IMAGE"}
          </span>

          <div class="assignment-row__info">
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
          .querySelector(".assignment-row__info span")
          .textContent =
            `${formatBytes(item.file.size)} · ${
              isPdf(item.file)
                ? "pages kept"
                : "image becomes PDF page"
            }`;


        row
          .querySelector(".file-remove")
          .addEventListener(
            "click",
            () => {

              state.assignmentFiles =
                state.assignmentFiles.filter(
                  (candidate) =>
                    candidate.id !==
                    item.id
                );


              renderAssignmentFiles();

            }
          );


        elements.assignmentList.appendChild(
          row
        );

      }
    );


    elements.assignmentActions.hidden =
      state.assignmentFiles.length ===
      0;
  }


  async function buildAssignmentPdf() {
    if (
      !state.assignmentFiles.length
    ) {
      showToast(
        "Add assignment files first."
      );

      return;
    }


    showProcessing(
      "Building assignment.",
      "Combining PDFs and images into one file."
    );


    try {
      const output =
        await PDFLib.PDFDocument.create();


      for (
        let index = 0;
        index <
        state.assignmentFiles.length;
        index += 1
      ) {
        const item =
          state.assignmentFiles[index];


        elements.processingDetail.textContent =
          `Processing item ${index + 1} of ${state.assignmentFiles.length}.`;


        if (
          isPdf(
            item.file
          )
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
        else {
          const normalized =
            await normalizeImageForPdf(
              output,
              item.file,
              false
            );


          const landscape =
            normalized.width >
            normalized.height;


          const pageWidth =
            landscape
              ? 842
              : 595;


          const pageHeight =
            landscape
              ? 595
              : 842;


          const margin =
            28;


          const scale =
            Math.min(
              (
                pageWidth -
                margin *
                2
              )
              /
              normalized.width,

              (
                pageHeight -
                margin *
                2
              )
              /
              normalized.height
            );


          const drawWidth =
            normalized.width *
            scale;


          const drawHeight =
            normalized.height *
            scale;


          const page =
            output.addPage([
              pageWidth,
              pageHeight
            ]);


          page.drawImage(
            normalized.embedded,
            {
              x:
                (
                  pageWidth -
                  drawWidth
                )
                /
                2,

              y:
                (
                  pageHeight -
                  drawHeight
                )
                /
                2,

              width:
                drawWidth,

              height:
                drawHeight
            }
          );
        }
      }


      const bytes =
        await output.save();


      const outputName =
        cleanBaseName(
          elements.assignmentName.value
          ||
          "assignment-final"
        );


      downloadBytes(
        bytes,
        `${outputName}.pdf`,
        "application/pdf"
      );


      showToast(
        "Assignment PDF ready."
      );
    }
    catch (error) {
      console.error(
        error
      );


      showToast(
        "Could not build the assignment PDF."
      );
    }
    finally {
      hideProcessing();
    }
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


    if (
      state.activeTool ===
      "assignment"
    ) {
      state.assignmentFiles =
        [];


      elements.assignmentInput.value =
        "";


      renderAssignmentFiles();
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


  function bindAssignmentTool() {
    elements.assignmentChooseButton.addEventListener(
      "click",
      () => {

        elements.assignmentInput.click();

      }
    );


    elements.assignmentInput.addEventListener(
      "change",
      () => {

        addAssignmentFiles(
          [
            ...elements.assignmentInput.files
          ]
        );


        elements.assignmentInput.value =
          "";

      }
    );


    attachDropZone(
      elements.assignmentDrop,
      addAssignmentFiles
    );


    elements.assignmentBuildButton.addEventListener(
      "click",
      buildAssignmentPdf
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


    initializeSortable(
      elements.assignmentList,
      "assignmentFiles",
      renderAssignmentFiles
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

    bindAssignmentTool();

    initializeSortableLists();

    initializeLenis();

    animateIntro();

    renderMergeFiles();

    renderOrganizePages();

    renderImageFiles();

    renderScanFiles();

    renderAssignmentFiles();
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
