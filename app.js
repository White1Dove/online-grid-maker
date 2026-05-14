(function () {
  var MAX_FILE_SIZE = 20 * 1024 * 1024;
  var MAX_CANVAS_SIZE = 16384;
  var SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  var page = document.body.dataset.page || "grid";
  var isPerspective = page === "perspective";
  var PAPER_FORMATS = {
    a4: { label: "A4", width: 210, height: 297 },
    a3: { label: "A3", width: 297, height: 420 },
    a5: { label: "A5", width: 148, height: 210 },
    letter: { label: "Letter", width: 216, height: 279 },
    legal: { label: "Legal", width: 216, height: 356 }
  };

  var els = {
    uploadZone: document.getElementById("uploadZone"),
    imageInput: document.getElementById("imageInput"),
    canvasWrap: document.getElementById("canvasWrap"),
    canvas: document.getElementById("gridCanvas"),
    changeImageBtn: document.getElementById("changeImageBtn"),
    printingGuide: document.getElementById("printingGuide"),
    printingGuideIntro: document.getElementById("printingGuideIntro"),
    printingGuideList: document.getElementById("printingGuideList"),
    status: document.getElementById("statusMessage"),
    controls: document.getElementById("controls"),
    gridTypeCustom: document.getElementById("gridTypeCustom"),
    gridTypeSquare: document.getElementById("gridTypeSquare"),
    rows: document.getElementById("rows"),
    cols: document.getElementById("cols"),
    lineWidth: document.getElementById("lineWidth"),
    color: document.getElementById("color"),
    opacity: document.getElementById("opacity"),
    opacityValue: document.getElementById("opacityValue"),
    labels: document.getElementById("labels"),
    diagonal: document.getElementById("diagonal"),
    grayscale: document.getElementById("grayscale"),
    downloadBtn: document.getElementById("downloadBtn"),
    resetBtn: document.getElementById("resetBtn"),
    perspectiveControls: document.getElementById("perspectiveControls"),
    vanishingPoint: document.getElementById("vanishingPoint"),
    horizon: document.getElementById("horizon"),
    horizonValue: document.getElementById("horizonValue"),
    paperFormat: document.getElementById("paperFormat"),
    customPaperFields: document.getElementById("customPaperFields"),
    paperWidth: document.getElementById("paperWidth"),
    paperHeight: document.getElementById("paperHeight")
  };

  var defaults = {
    gridType: "custom",
    rows: 5,
    cols: 5,
    lineWidth: 2,
    color: "#000000",
    opacity: 0.5,
    labels: page === "drawing",
    diagonal: false,
    grayscale: false,
    vanishingPoint: "center",
    horizon: 50,
    paperFormat: "a4",
    paperWidth: 210,
    paperHeight: 297
  };

  var state = {
    image: null,
    renderFrame: 0,
    gridType: defaults.gridType
  };

  var ctx = els.canvas.getContext("2d", { willReadFrequently: true });

  initialize();

  function initialize() {
    if (els.perspectiveControls) {
      els.perspectiveControls.hidden = !isPerspective;
    }

    applyDefaults(false);
    bindEvents();
    updateOutputs();
  }

  function bindEvents() {
    els.imageInput.addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      if (file) {
        loadFile(file);
      }
    });

    ["dragenter", "dragover"].forEach(function (eventName) {
      els.uploadZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        els.uploadZone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach(function (eventName) {
      els.uploadZone.addEventListener(eventName, function (event) {
        event.preventDefault();
        els.uploadZone.classList.remove("is-dragover");
      });
    });

    els.uploadZone.addEventListener("drop", function (event) {
      var file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) {
        loadFile(file);
      }
    });

    els.controls.addEventListener("click", function (event) {
      if (event.target.dataset && event.target.dataset.gridType) {
        setGridType(event.target.dataset.gridType, true);
      }
    });

    els.controls.addEventListener("input", function (event) {
      handleControlInput(event.target);
    });

    els.controls.addEventListener("change", function (event) {
      if (event.target.type === "number") {
        normalizeNumberInput(event.target);
      }
      handleControlInput(event.target);
    });

    els.controls.addEventListener("reset", function (event) {
      event.preventDefault();
      applyDefaults(true);
    });

    els.downloadBtn.addEventListener("click", downloadPng);

    if (els.changeImageBtn) {
      els.changeImageBtn.addEventListener("click", function () {
        els.imageInput.value = "";
        els.imageInput.click();
      });
    }
  }

  function loadFile(file) {
    clearMessage();

    if (!isSupportedFile(file)) {
      showMessage("Please upload a JPG, PNG, WebP, or static GIF image.", true);
      els.imageInput.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showMessage("The maximum file size is 20MB.", true);
      els.imageInput.value = "";
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () {
      showMessage("The image could not be read. Please try another file.", true);
      els.imageInput.value = "";
    };
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        if (image.naturalWidth > MAX_CANVAS_SIZE || image.naturalHeight > MAX_CANVAS_SIZE) {
          showMessage("This image is too large for browser canvas rendering.", true);
          els.imageInput.value = "";
          return;
        }

        state.image = image;
        els.uploadZone.hidden = true;
        els.canvasWrap.hidden = false;
        if (els.changeImageBtn) {
          els.changeImageBtn.hidden = false;
        }
        els.downloadBtn.disabled = false;
        showMessage("Image loaded locally in your browser.", false);
        render();
      };
      image.onerror = function () {
        showMessage("The selected file is not a valid image.", true);
        els.imageInput.value = "";
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function isSupportedFile(file) {
    return SUPPORTED_TYPES.indexOf(file.type) !== -1 || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
  }

  function applyDefaults(clearImage) {
    state.gridType = defaults.gridType;
    setGridType(defaults.gridType, false);
    els.rows.value = defaults.rows;
    els.cols.value = defaults.cols;
    els.lineWidth.value = defaults.lineWidth;
    els.color.value = defaults.color;
    els.opacity.value = defaults.opacity;
    els.labels.checked = defaults.labels;
    els.diagonal.checked = defaults.diagonal;
    els.grayscale.checked = defaults.grayscale;

    if (els.vanishingPoint) {
      els.vanishingPoint.value = defaults.vanishingPoint;
    }
    if (els.horizon) {
      els.horizon.value = defaults.horizon;
    }
    if (els.paperFormat) {
      els.paperFormat.value = defaults.paperFormat;
    }
    if (els.paperWidth) {
      els.paperWidth.value = defaults.paperWidth;
    }
    if (els.paperHeight) {
      els.paperHeight.value = defaults.paperHeight;
    }

    if (clearImage) {
      state.image = null;
      els.imageInput.value = "";
      els.canvas.width = 0;
      els.canvas.height = 0;
      els.uploadZone.hidden = false;
      els.canvasWrap.hidden = true;
      if (els.changeImageBtn) {
        els.changeImageBtn.hidden = true;
      }
      els.downloadBtn.disabled = true;
      hidePrintingGuide();
      clearMessage();
    }

    updatePaperFields();
    updateOutputs();
    scheduleRender();
  }

  function handleControlInput(target) {
    if (target === els.rows || target === els.cols) {
      syncSquareGrid(target);
    }
    if (target === els.paperFormat) {
      updatePaperFields();
    }
    scheduleRender();
  }

  function setGridType(type, shouldRender) {
    state.gridType = type === "square" ? "square" : "custom";
    setGridButtonState(els.gridTypeCustom, state.gridType === "custom");
    setGridButtonState(els.gridTypeSquare, state.gridType === "square");

    if (state.gridType === "square") {
      syncSquareGrid(els.rows);
    }

    if (shouldRender) {
      scheduleRender();
    }
  }

  function setGridButtonState(button, active) {
    if (!button) {
      return;
    }
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function syncSquareGrid(source) {
    if (state.gridType !== "square") {
      return;
    }

    var value = getNumber(source, 1, 50, defaults.rows);
    els.rows.value = value;
    els.cols.value = value;
  }

  function updatePaperFields() {
    if (!els.paperFormat || !els.customPaperFields) {
      return;
    }
    els.customPaperFields.hidden = els.paperFormat.value !== "custom";
  }

  function scheduleRender() {
    updateOutputs();

    if (!state.image) {
      hidePrintingGuide();
      return;
    }

    if (state.renderFrame) {
      cancelAnimationFrame(state.renderFrame);
    }

    state.renderFrame = requestAnimationFrame(render);
  }

  function render() {
    if (!state.image) {
      return;
    }

    state.renderFrame = 0;
    var settings = getSettings();
    var width = state.image.naturalWidth;
    var height = state.image.naturalHeight;

    els.canvas.width = width;
    els.canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(state.image, 0, 0, width, height);

    if (settings.grayscale) {
      applyGrayscale(width, height);
    }

    ctx.save();
    ctx.globalAlpha = settings.opacity;
    ctx.strokeStyle = settings.color;
    ctx.fillStyle = settings.color;
    ctx.lineWidth = settings.lineWidth;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    drawRectGrid(width, height, settings);

    if (isPerspective) {
      drawPerspectiveGrid(width, height, settings);
    }

    ctx.restore();
    updatePrintingGuide(settings, width, height);
  }

  function getSettings() {
    return {
      rows: getNumber(els.rows, 1, 50, defaults.rows),
      cols: getNumber(els.cols, 1, 50, defaults.cols),
      lineWidth: getNumber(els.lineWidth, 1, 10, defaults.lineWidth),
      color: els.color.value || defaults.color,
      opacity: getNumber(els.opacity, 0, 1, defaults.opacity),
      labels: els.labels.checked,
      diagonal: els.diagonal.checked,
      grayscale: els.grayscale.checked,
      vanishingPoint: els.vanishingPoint ? els.vanishingPoint.value : defaults.vanishingPoint,
      horizon: els.horizon ? getNumber(els.horizon, 15, 85, defaults.horizon) : defaults.horizon
    };
  }

  function getNumber(input, min, max, fallback) {
    var value = Number(input.value);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, value));
  }

  function normalizeNumberInput(input) {
    var min = Number(input.min);
    var max = Number(input.max);
    var fallback = Number(input.defaultValue) || 1;
    input.value = getNumber(input, min, max, fallback);
  }

  function updateOutputs() {
    els.opacityValue.textContent = formatDecimal(getNumber(els.opacity, 0, 1, defaults.opacity));
    if (els.horizonValue && els.horizon) {
      els.horizonValue.textContent = getNumber(els.horizon, 15, 85, defaults.horizon) + "%";
    }
  }

  function formatDecimal(value) {
    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatMm(value) {
    return value.toFixed(1);
  }

  function formatPaperMm(value) {
    return Number(value).toFixed(1).replace(/\.0$/, "");
  }

  function drawRectGrid(width, height, settings) {
    var rows = settings.rows;
    var cols = settings.cols;
    var cellWidth = width / cols;
    var cellHeight = height / rows;
    var lineInset = settings.lineWidth / 2;

    ctx.beginPath();
    for (var col = 0; col <= cols; col += 1) {
      var x = clampLine(col * cellWidth, width, lineInset);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (var row = 0; row <= rows; row += 1) {
      var y = clampLine(row * cellHeight, height, lineInset);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    if (settings.diagonal) {
      drawDiagonalLines(rows, cols, cellWidth, cellHeight);
    }

    if (settings.labels) {
      drawLabels(rows, cols, cellWidth, cellHeight, settings);
    }
  }

  function clampLine(value, max, inset) {
    return Math.min(max - inset, Math.max(inset, value));
  }

  function drawDiagonalLines(rows, cols, cellWidth, cellHeight) {
    ctx.beginPath();
    for (var row = 0; row < rows; row += 1) {
      for (var col = 0; col < cols; col += 1) {
        var left = col * cellWidth;
        var top = row * cellHeight;
        var right = left + cellWidth;
        var bottom = top + cellHeight;

        ctx.moveTo(left, top);
        ctx.lineTo(right, bottom);
        ctx.moveTo(right, top);
        ctx.lineTo(left, bottom);
      }
    }
    ctx.stroke();
  }

  function drawLabels(rows, cols, cellWidth, cellHeight, settings) {
    var minCellSize = 30 + (settings.lineWidth || 2) * 2;
    if (cellWidth < minCellSize || cellHeight < minCellSize * 0.75) {
      return;
    }

    var fontSize = Math.max(10, Math.min(18, Math.floor(Math.min(cellWidth, cellHeight) * 0.18)));
    var pad = Math.max(4, Math.min(10, fontSize * 0.45));

    ctx.font = fontSize + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textBaseline = "top";

    var lastRowLabel = toColumnLabel(rows - 1);
    var widestLabel = lastRowLabel + cols;
    var estimatedWidth = ctx.measureText(widestLabel).width;
    var shouldCheckEachLabel = estimatedWidth > cellWidth * 0.85;

    for (var row = 0; row < rows; row += 1) {
      var rowLabel = toColumnLabel(row);
      for (var col = 0; col < cols; col += 1) {
        var label = rowLabel + (col + 1);
        if (shouldCheckEachLabel && ctx.measureText(label).width > cellWidth * 0.85) {
          continue;
        }
        ctx.fillText(label, col * cellWidth + pad, row * cellHeight + pad);
      }
    }
  }

  function toColumnLabel(index) {
    var label = "";
    var number = index + 1;
    while (number > 0) {
      number -= 1;
      label = String.fromCharCode(65 + (number % 26)) + label;
      number = Math.floor(number / 26);
    }
    return label;
  }

  function getPaperSettings() {
    if (!els.paperFormat) {
      return null;
    }

    if (els.paperFormat.value === "custom") {
      return {
        label: "Custom",
        width: getNumber(els.paperWidth, 1, 2000, defaults.paperWidth),
        height: getNumber(els.paperHeight, 1, 2000, defaults.paperHeight)
      };
    }

    return PAPER_FORMATS[els.paperFormat.value] || PAPER_FORMATS.a4;
  }

  function updatePrintingGuide(settings, imageWidth, imageHeight) {
    if (!els.printingGuide || !state.image) {
      return;
    }

    var paper = getPaperSettings();
    if (!paper) {
      hidePrintingGuide();
      return;
    }

    var printableWidth = paper.width * 0.95;
    var printableHeight = paper.height * 0.95;
    var imageShortSide = Math.min(imageWidth, imageHeight);
    var paperShortSide = Math.min(printableWidth, printableHeight);
    var scale = paperShortSide / imageShortSide;
    var printWidth = imageWidth * scale;
    var printHeight = imageHeight * scale;
    var verticalLines = Math.max(0, settings.cols - 1);
    var horizontalLines = Math.max(0, settings.rows - 1);
    var lastLabel = toColumnLabel(settings.rows - 1) + settings.cols;
    var article = /^[Aa]/.test(paper.label) ? "an" : "a";
    var guideItems = [
      "Draw " + verticalLines + " vertical lines at " + formatMm(printWidth / settings.cols) + "mm intervals",
      "Draw " + horizontalLines + " horizontal lines at " + formatMm(printHeight / settings.rows) + "mm intervals"
    ];

    if (settings.labels) {
      guideItems.push("Label each cell from A1 to " + lastLabel);
    }

    els.printingGuideIntro.textContent = "For " + article + " " + paper.label + " print (" + formatPaperMm(paper.width) + "×" + formatPaperMm(paper.height) + "mm):";
    els.printingGuideList.textContent = "";
    guideItems.forEach(function (item) {
      var listItem = document.createElement("li");
      listItem.textContent = item;
      els.printingGuideList.appendChild(listItem);
    });
    els.printingGuide.hidden = false;
  }

  function hidePrintingGuide() {
    if (els.printingGuide) {
      els.printingGuide.hidden = true;
    }
  }

  function drawPerspectiveGrid(width, height, settings) {
    var horizonY = height * (settings.horizon / 100);
    var guideCount = Math.max(2, settings.cols);
    var depthCount = Math.max(2, settings.rows);
    var points = getVanishingPoints(width, horizonY, settings.vanishingPoint);

    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();

    points.forEach(function (point) {
      ctx.beginPath();
      for (var i = 0; i <= guideCount; i += 1) {
        var edgeX = width * (i / guideCount);
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(edgeX, height);
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(edgeX, 0);
      }
      ctx.stroke();
      drawVanishingPoint(point);
    });

    ctx.beginPath();
    for (var below = 1; below <= depthCount; below += 1) {
      var downT = Math.pow(below / depthCount, 1.6);
      var yBelow = horizonY + (height - horizonY) * downT;
      ctx.moveTo(0, yBelow);
      ctx.lineTo(width, yBelow);
    }
    for (var above = 1; above <= depthCount; above += 1) {
      var upT = Math.pow(above / depthCount, 1.6);
      var yAbove = horizonY - horizonY * upT;
      ctx.moveTo(0, yAbove);
      ctx.lineTo(width, yAbove);
    }
    ctx.stroke();
  }

  function getVanishingPoints(width, y, mode) {
    if (mode === "left") {
      return [{ x: 0, y: y }];
    }
    if (mode === "right") {
      return [{ x: width, y: y }];
    }
    if (mode === "two-point") {
      return [
        { x: 0, y: y },
        { x: width, y: y }
      ];
    }
    return [{ x: width / 2, y: y }];
  }

  function drawVanishingPoint(point) {
    var size = 5;
    ctx.beginPath();
    ctx.moveTo(point.x - size, point.y);
    ctx.lineTo(point.x + size, point.y);
    ctx.moveTo(point.x, point.y - size);
    ctx.lineTo(point.x, point.y + size);
    ctx.stroke();
  }

  function applyGrayscale(width, height) {
    var imageData = ctx.getImageData(0, 0, width, height);
    var data = imageData.data;

    for (var i = 0; i < data.length; i += 4) {
      var gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function downloadPng() {
    if (!state.image) {
      return;
    }

    els.canvas.toBlob(function (blob) {
      if (!blob) {
        showMessage("The PNG could not be created. Please try again.", true);
        return;
      }

      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "grid-overlay-" + Date.now() + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function showMessage(text, isError) {
    els.status.textContent = text;
    els.status.classList.toggle("is-error", Boolean(isError));
    els.status.classList.toggle("is-success", Boolean(text && !isError));
  }

  function clearMessage() {
    showMessage("", false);
  }
})();
