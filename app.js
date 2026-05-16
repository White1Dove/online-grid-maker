(function () {
  var MAX_FILE_SIZE = 100 * 1024 * 1024;
  var MAX_CANVAS_SIZE = 16384;
  var MAX_IMAGE_PIXELS = 30 * 1000 * 1000;
  var MAX_GRID_COUNT = 26;
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
    tool: document.querySelector(".tool"),
    previewCard: document.querySelector(".preview-card"),
    uploadZone: document.getElementById("uploadZone"),
    imageInput: document.getElementById("imageInput"),
    canvasWrap: document.getElementById("canvasWrap"),
    canvas: document.getElementById("gridCanvas"),
    previewTopbar: document.getElementById("previewTopbar"),
    changeImageBtn: document.getElementById("changeImageBtn"),
    printingGuide: document.getElementById("printingGuide"),
    printingGuideIntro: document.getElementById("printingGuideIntro"),
    printingGuideList: document.getElementById("printingGuideList"),
    status: document.getElementById("statusMessage"),
    controls: document.getElementById("controls"),
    showGrid: document.getElementById("showGrid"),
    gridTypeCustom: document.getElementById("gridTypeCustom"),
    gridTypeSquare: document.getElementById("gridTypeSquare"),
    rows: document.getElementById("rows"),
    rowsValue: document.getElementById("rowsValue"),
    cols: document.getElementById("cols"),
    colsValue: document.getElementById("colsValue"),
    lineWidth: document.getElementById("lineWidth"),
    lineWidthValue: document.getElementById("lineWidthValue"),
    color: document.getElementById("color"),
    colorTrigger: document.getElementById("colorTrigger"),
    colorSwatch: document.getElementById("colorSwatch"),
    colorHex: document.getElementById("colorHex"),
    colorPopover: document.getElementById("colorPopover"),
    colorSpectrum: document.getElementById("colorSpectrum"),
    colorHue: document.getElementById("colorHue"),
    eyedropperBtn: document.getElementById("eyedropperBtn"),
    pickerPreview: document.getElementById("pickerPreview"),
    colorRed: document.getElementById("colorRed"),
    colorGreen: document.getElementById("colorGreen"),
    colorBlue: document.getElementById("colorBlue"),
    opacity: document.getElementById("opacity"),
    opacityValue: document.getElementById("opacityValue"),
    labels: document.getElementById("labels"),
    labelPosition: document.getElementById("labelPosition"),
    labelPositionField: document.getElementById("labelPositionField"),
    grayscaleToggle: document.getElementById("grayscaleToggle"),
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
    showGrid: true,
    rows: 3,
    cols: 3,
    lineWidth: 1,
    color: "#000000",
    opacity: 0.5,
    labels: true,
    labelPosition: "bottom-left",
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
    gridType: defaults.gridType,
    grayscale: defaults.grayscale
  };

  var colorState = {
    hue: 0,
    saturation: 0,
    value: 0,
    dragging: false
  };

  var ctx = els.canvas.getContext("2d", { willReadFrequently: true });

  initialize();

  function initialize() {
    if (els.perspectiveControls) {
      els.perspectiveControls.hidden = !isPerspective;
    }

    applyDefaults(false);
    setToolState("demo");
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

    var uploadBtn = document.getElementById("uploadBtn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        els.imageInput.click();
      });
    }

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

    if (els.grayscaleToggle) {
      els.grayscaleToggle.addEventListener("click", function () {
        state.grayscale = !state.grayscale;
        updateGrayscaleToggle();
        scheduleRender();
      });
    }

    if (els.changeImageBtn) {
      els.changeImageBtn.addEventListener("click", function () {
        els.imageInput.value = "";
        els.imageInput.click();
      });
    }

    bindColorPickerEvents();

    window.addEventListener("resize", function () {
      if (state.image) {
        scheduleRender();
      }
    });
  }

  function loadFile(file) {
    clearMessage();

    if (!isSupportedFile(file)) {
      showMessage("Please upload a JPG, PNG, WebP, or static GIF image.", true);
      els.imageInput.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showMessage("The maximum file size is 100MB.", true);
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
        if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
          showMessage("Image resolution is too large for browser processing. Please use an image up to 30 megapixels.", true);
          els.imageInput.value = "";
          return;
        }

        if (image.naturalWidth > MAX_CANVAS_SIZE || image.naturalHeight > MAX_CANVAS_SIZE) {
          showMessage("This image is too large for browser canvas rendering.", true);
          els.imageInput.value = "";
          return;
        }

        state.image = image;
        els.uploadZone.hidden = true;
        els.canvasWrap.hidden = false;
        if (els.previewTopbar) {
          els.previewTopbar.hidden = false;
        }
        if (els.changeImageBtn) {
          els.changeImageBtn.hidden = false;
        }
        if (els.previewCard) {
          els.previewCard.classList.add("has-image");
        }
        els.downloadBtn.disabled = false;
        setToolState("editing");
        showMessage("Image loaded locally in your browser.", false);
        scheduleRender();
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
    setInputValue(els.showGrid, defaults.showGrid);
    setInputValue(els.rows, defaults.rows);
    setInputValue(els.cols, defaults.cols);
    setInputValue(els.lineWidth, defaults.lineWidth);
    setInputValue(els.color, defaults.color);
    setInputValue(els.opacity, defaults.opacity);
    setInputValue(els.labels, defaults.labels);
    setInputValue(els.labelPosition, defaults.labelPosition);
    state.grayscale = defaults.grayscale;
    syncColorPickerFromValue(els.color ? els.color.value : defaults.color, false);

    setInputValue(els.vanishingPoint, defaults.vanishingPoint);
    setInputValue(els.horizon, defaults.horizon);
    setInputValue(els.paperFormat, defaults.paperFormat);
    setInputValue(els.paperWidth, defaults.paperWidth);
    setInputValue(els.paperHeight, defaults.paperHeight);

    if (clearImage) {
      clearLoadedImage();
    }

    updatePaperFields();
    updateLabelPositionField();
    updateOutputs();
    scheduleRender();
  }

  function setInputValue(input, value) {
    if (!input) {
      return;
    }
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
      return;
    }
    input.value = value;
  }

  function clearLoadedImage() {
    state.image = null;
    els.imageInput.value = "";
    if (state.renderFrame) {
      cancelAnimationFrame(state.renderFrame);
      state.renderFrame = 0;
    }
    els.canvas.width = 0;
    els.canvas.height = 0;
    els.canvas.style.width = "";
    els.canvas.style.height = "";
    els.uploadZone.hidden = false;
    els.canvasWrap.hidden = true;
    if (els.previewTopbar) {
      els.previewTopbar.hidden = true;
    }
    if (els.changeImageBtn) {
      els.changeImageBtn.hidden = true;
    }
    if (els.previewCard) {
      els.previewCard.classList.remove("has-image");
    }
    els.downloadBtn.disabled = true;
    hidePrintingGuide();
    clearMessage();
    setToolState("demo");
  }

  function setToolState(nextState) {
    if (!els.tool || !els.tool.hasAttribute("data-state")) {
      return;
    }
    els.tool.dataset.state = nextState === "editing" ? "editing" : "demo";
  }

  function handleControlInput(target) {
    if (target === els.rows || target === els.cols) {
      syncSquareGrid(target);
    }
    if (target === els.paperFormat) {
      updatePaperFields();
    }
    if (target === els.labels) {
      updateLabelPositionField();
    }
    scheduleRender();
  }

  function bindColorPickerEvents() {
    if (
      !els.colorTrigger ||
      !els.colorPopover ||
      !els.colorSpectrum ||
      !els.colorHue ||
      !els.colorRed ||
      !els.colorGreen ||
      !els.colorBlue
    ) {
      return;
    }

    // Prevent clicks inside the popover from triggering the outside-click close logic
    els.colorPopover.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
    });
    els.colorPopover.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    els.colorTrigger.addEventListener("click", function () {
      if (els.colorPopover.hidden) {
        openColorPicker();
      } else {
        closeColorPicker();
      }
    });

    els.colorHue.addEventListener("input", function () {
      colorState.hue = getNumber(els.colorHue, 0, 360, colorState.hue);
      applyColorFromPicker();
      drawColorSpectrum();
    });

    if (els.eyedropperBtn) {
      els.eyedropperBtn.addEventListener("click", function () {
        if (!window.EyeDropper) {
          showMessage("Screen color picking is not available in this browser.", true);
          return;
        }
        var eyedropper = new window.EyeDropper();
        eyedropper.open().then(function (result) {
          syncColorPickerFromValue(result.sRGBHex, true);
        }).catch(function () {
          // The user may cancel the system picker.
        });
      });
    }

    els.colorSpectrum.addEventListener("pointerdown", function (event) {
      colorState.dragging = true;
      els.colorSpectrum.setPointerCapture(event.pointerId);
      updateColorFromSpectrum(event);
    });

    els.colorSpectrum.addEventListener("pointermove", function (event) {
      if (colorState.dragging) {
        updateColorFromSpectrum(event);
      }
    });

    ["pointerup", "pointercancel"].forEach(function (eventName) {
      els.colorSpectrum.addEventListener(eventName, function (event) {
        colorState.dragging = false;
        if (els.colorSpectrum.hasPointerCapture(event.pointerId)) {
          els.colorSpectrum.releasePointerCapture(event.pointerId);
        }
      });
    });

    [els.colorRed, els.colorGreen, els.colorBlue].forEach(function (input) {
      input.addEventListener("input", function () {
        applyColorFromRgbInputs();
      });
      input.addEventListener("change", function () {
        normalizeRgbInput(input);
        applyColorFromRgbInputs();
      });
    });

    document.addEventListener("pointerdown", function (event) {
      if (!els.colorPopover.hidden && !els.colorPopover.parentElement.contains(event.target)) {
        closeColorPicker();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !els.colorPopover.hidden) {
        closeColorPicker();
      }
    });
  }

  function openColorPicker() {
    els.colorPopover.hidden = false;
    els.colorTrigger.setAttribute("aria-expanded", "true");
    syncColorPickerFromValue(els.color.value || defaults.color, false);
    drawColorSpectrum();
    positionColorPopover();
  }

  function closeColorPicker() {
    if (!els.colorPopover) {
      return;
    }
    els.colorPopover.hidden = true;
    els.colorTrigger.setAttribute("aria-expanded", "false");
  }

  function positionColorPopover() {
    if (!els.colorPopover || !els.colorTrigger) {
      return;
    }

    els.colorPopover.dataset.placement = "bottom";
    var triggerRect = els.colorTrigger.getBoundingClientRect();
    var popoverRect = els.colorPopover.getBoundingClientRect();
    var availableBelow = window.innerHeight - triggerRect.bottom;
    var availableAbove = triggerRect.top;
    var shouldOpenUp = availableBelow < popoverRect.height + 8 && availableAbove > availableBelow;
    els.colorPopover.dataset.placement = shouldOpenUp ? "top" : "bottom";
  }

  function syncColorPickerFromValue(hex, shouldRender) {
    if (!els.color) {
      return;
    }

    var normalized = normalizeHexColor(hex) || defaults.color;
    var hsv = hexToHsv(normalized);
    els.color.value = normalized;
    colorState.hue = hsv.hue;
    colorState.saturation = hsv.saturation;
    colorState.value = hsv.value;
    syncColorDisplay();
    drawColorSpectrum();

    if (shouldRender) {
      scheduleRender();
    }
  }

  function syncColorDisplay() {
    if (!els.color) {
      return;
    }

    var color = (els.color.value || defaults.color).toUpperCase();
    if (els.colorHex) {
      els.colorHex.textContent = color;
    }
    if (els.colorSwatch) {
      els.colorSwatch.style.backgroundColor = color;
    }
    if (els.pickerPreview) {
      els.pickerPreview.style.backgroundColor = color;
    }
    var rgb = hexToRgb(color);
    if (els.colorRed) {
      els.colorRed.value = rgb.red;
    }
    if (els.colorGreen) {
      els.colorGreen.value = rgb.green;
    }
    if (els.colorBlue) {
      els.colorBlue.value = rgb.blue;
    }
    if (els.colorHue) {
      els.colorHue.value = Math.round(colorState.hue);
    }
  }

  function drawColorSpectrum() {
    if (!els.colorSpectrum) {
      return;
    }

    var spectrumStyle = window.getComputedStyle(els.colorSpectrum);
    var displayWidth = Math.round(parseFloat(spectrumStyle.width)) || 280;
    var displayHeight = Math.round(parseFloat(spectrumStyle.height)) || 160;
    if (els.colorSpectrum.width !== displayWidth) {
      els.colorSpectrum.width = displayWidth;
    }
    if (els.colorSpectrum.height !== displayHeight) {
      els.colorSpectrum.height = displayHeight;
    }

    var spectrumCtx = els.colorSpectrum.getContext("2d");
    var width = els.colorSpectrum.width;
    var height = els.colorSpectrum.height;
    var hueColor = hsvToHex(colorState.hue, 1, 1);
    spectrumCtx.clearRect(0, 0, width, height);
    spectrumCtx.fillStyle = hueColor;
    spectrumCtx.fillRect(0, 0, width, height);

    var whiteGradient = spectrumCtx.createLinearGradient(0, 0, width, 0);
    whiteGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    whiteGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    spectrumCtx.fillStyle = whiteGradient;
    spectrumCtx.fillRect(0, 0, width, height);

    var blackGradient = spectrumCtx.createLinearGradient(0, 0, 0, height);
    blackGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    blackGradient.addColorStop(1, "rgba(0, 0, 0, 1)");
    spectrumCtx.fillStyle = blackGradient;
    spectrumCtx.fillRect(0, 0, width, height);

    var markerX = colorState.saturation * width;
    var markerY = (1 - colorState.value) * height;
    spectrumCtx.beginPath();
    spectrumCtx.arc(markerX, markerY, 7, 0, Math.PI * 2);
    spectrumCtx.lineWidth = 2.5;
    spectrumCtx.strokeStyle = "#ffffff";
    spectrumCtx.stroke();
    spectrumCtx.beginPath();
    spectrumCtx.arc(markerX, markerY, 4, 0, Math.PI * 2);
    spectrumCtx.lineWidth = 1.5;
    spectrumCtx.strokeStyle = "#111827";
    spectrumCtx.stroke();
  }

  function updateColorFromSpectrum(event) {
    var rect = els.colorSpectrum.getBoundingClientRect();
    var x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
    var y = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
    colorState.saturation = rect.width ? x / rect.width : 0;
    colorState.value = rect.height ? 1 - y / rect.height : 0;
    applyColorFromPicker();
    drawColorSpectrum();
  }

  function applyColorFromPicker() {
    var hex = hsvToHex(colorState.hue, colorState.saturation, colorState.value);
    els.color.value = hex;
    syncColorDisplay();
    scheduleRender();
  }

  function normalizeHexColor(value) {
    if (!/^#[0-9a-f]{6}$/i.test(value || "")) {
      return "";
    }
    return value.toLowerCase();
  }

  function applyColorFromRgbInputs() {
    var red = getRgbValue(els.colorRed);
    var green = getRgbValue(els.colorGreen);
    var blue = getRgbValue(els.colorBlue);
    syncColorPickerFromValue(rgbToHex(red, green, blue), true);
  }

  function normalizeRgbInput(input) {
    input.value = getRgbValue(input);
  }

  function getRgbValue(input) {
    return getNumber(input, 0, 255, 0);
  }

  function hexToRgb(hex) {
    var normalized = normalizeHexColor(hex) || defaults.color;
    return {
      red: parseInt(normalized.slice(1, 3), 16),
      green: parseInt(normalized.slice(3, 5), 16),
      blue: parseInt(normalized.slice(5, 7), 16)
    };
  }

  function hexToHsv(hex) {
    var normalized = normalizeHexColor(hex) || defaults.color;
    var red = parseInt(normalized.slice(1, 3), 16) / 255;
    var green = parseInt(normalized.slice(3, 5), 16) / 255;
    var blue = parseInt(normalized.slice(5, 7), 16) / 255;
    var max = Math.max(red, green, blue);
    var min = Math.min(red, green, blue);
    var delta = max - min;
    var hue = 0;

    if (delta) {
      if (max === red) {
        hue = 60 * (((green - blue) / delta) % 6);
      } else if (max === green) {
        hue = 60 * ((blue - red) / delta + 2);
      } else {
        hue = 60 * ((red - green) / delta + 4);
      }
    }

    if (hue < 0) {
      hue += 360;
    }

    return {
      hue: hue,
      saturation: max === 0 ? 0 : delta / max,
      value: max
    };
  }

  function hsvToHex(hue, saturation, value) {
    var chroma = value * saturation;
    var huePrime = hue / 60;
    var second = chroma * (1 - Math.abs((huePrime % 2) - 1));
    var match = value - chroma;
    var red = 0;
    var green = 0;
    var blue = 0;

    if (huePrime >= 0 && huePrime < 1) {
      red = chroma;
      green = second;
    } else if (huePrime < 2) {
      red = second;
      green = chroma;
    } else if (huePrime < 3) {
      green = chroma;
      blue = second;
    } else if (huePrime < 4) {
      green = second;
      blue = chroma;
    } else if (huePrime < 5) {
      red = second;
      blue = chroma;
    } else {
      red = chroma;
      blue = second;
    }

    return rgbToHex(
      Math.round((red + match) * 255),
      Math.round((green + match) * 255),
      Math.round((blue + match) * 255)
    );
  }

  function rgbToHex(red, green, blue) {
    return "#" + [red, green, blue].map(function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
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

    var value = getNumber(source, 1, MAX_GRID_COUNT, defaults.rows);
    setInputValue(els.rows, value);
    setInputValue(els.cols, value);
  }

  function updatePaperFields() {
    if (!els.paperFormat || !els.customPaperFields) {
      return;
    }
    els.customPaperFields.hidden = els.paperFormat.value !== "custom";
  }

  function updateLabelPositionField() {
    if (!els.labelPositionField || !els.labels) {
      return;
    }
    els.labelPositionField.classList.toggle("is-visible", els.labels.checked);
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
    var naturalWidth = state.image.naturalWidth;
    var naturalHeight = state.image.naturalHeight;
    var containerWidth = els.canvasWrap.clientWidth - 24;
    var containerHeight = els.canvasWrap.clientHeight - 8;
    if (containerWidth <= 0 || containerHeight <= 0) {
      containerWidth = Math.min(700, window.innerWidth - 380);
      containerHeight = 580;
    }
    var imgAspect = naturalWidth / naturalHeight;
    var containerAspect = containerWidth / containerHeight;
    var displayWidth;
    var displayHeight;

    if (imgAspect > containerAspect) {
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgAspect;
    } else {
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgAspect;
    }

    displayWidth = Math.max(1, displayWidth);
    displayHeight = Math.max(1, displayHeight);

    els.canvas.style.width = displayWidth + "px";
    els.canvas.style.height = displayHeight + "px";

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.round(displayWidth * dpr);
    els.canvas.height = Math.round(displayHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(state.image, 0, 0, displayWidth, displayHeight);

    if (settings.grayscale) {
      applyGrayscaleToContext(ctx, els.canvas.width, els.canvas.height);
    }

    if (settings.showGrid) {
      drawGridOnContext(ctx, displayWidth, displayHeight, settings);
    }

    updatePrintingGuide(settings, naturalWidth, naturalHeight);
  }

  function renderForExport() {
    var settings = getSettings();
    settings.isExport = true;
    var width = state.image.naturalWidth;
    var height = state.image.naturalHeight;
    var exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    var exportCtx = exportCanvas.getContext("2d", { willReadFrequently: true });

    exportCtx.drawImage(state.image, 0, 0, width, height);

    if (settings.grayscale) {
      applyGrayscaleToContext(exportCtx, width, height);
    }

    if (settings.showGrid) {
      drawGridOnContext(exportCtx, width, height, settings);
    }

    return exportCanvas;
  }

  function getSettings() {
    return {
      showGrid: els.showGrid ? els.showGrid.checked : defaults.showGrid,
      rows: getNumber(els.rows, 1, MAX_GRID_COUNT, defaults.rows),
      cols: getNumber(els.cols, 1, MAX_GRID_COUNT, defaults.cols),
      lineWidth: getNumber(els.lineWidth, 1, 10, defaults.lineWidth),
      color: els.color.value || defaults.color,
      opacity: getNumber(els.opacity, 0.1, 1, defaults.opacity),
      labels: els.labels.checked,
      labelPosition: els.labelPosition ? els.labelPosition.value : defaults.labelPosition,
      grayscale: state.grayscale,
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
    if (els.rowsValue) {
      els.rowsValue.textContent = getNumber(els.rows, 1, MAX_GRID_COUNT, defaults.rows);
    }
    if (els.colsValue) {
      els.colsValue.textContent = getNumber(els.cols, 1, MAX_GRID_COUNT, defaults.cols);
    }
    if (els.lineWidthValue) {
      els.lineWidthValue.textContent = getNumber(els.lineWidth, 1, 10, defaults.lineWidth) + "px";
    }
    if (els.colorHex) {
      syncColorDisplay();
    }
    if (els.opacityValue) {
      els.opacityValue.textContent = formatDecimal(getNumber(els.opacity, 0.1, 1, defaults.opacity));
    }
    if (els.horizonValue && els.horizon) {
      els.horizonValue.textContent = getNumber(els.horizon, 15, 85, defaults.horizon) + "%";
    }
    updateLabelPositionField();
    updateGrayscaleToggle();
  }

  function updateGrayscaleToggle() {
    if (!els.grayscaleToggle) {
      return;
    }
    els.grayscaleToggle.classList.toggle("is-active", state.grayscale);
    els.grayscaleToggle.setAttribute("aria-pressed", state.grayscale ? "true" : "false");
    els.grayscaleToggle.textContent = state.grayscale ? "Revert to Original Color" : "Convert to Black & White";
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

  function drawGridOnContext(targetCtx, width, height, settings) {
    targetCtx.save();
    targetCtx.globalAlpha = settings.opacity;
    targetCtx.strokeStyle = settings.color;
    targetCtx.fillStyle = settings.color;
    targetCtx.lineWidth = settings.lineWidth === 1 ? 0.75 : settings.lineWidth;
    targetCtx.lineCap = "butt";
    targetCtx.lineJoin = "miter";

    drawRectGrid(targetCtx, width, height, settings);

    if (isPerspective) {
      drawPerspectiveGrid(targetCtx, width, height, settings);
    }

    targetCtx.restore();
  }

  function drawRectGrid(targetCtx, width, height, settings) {
    var rows = settings.rows;
    var cols = settings.cols;
    var cellWidth = width / cols;
    var cellHeight = height / rows;
    targetCtx.beginPath();
    for (var col = 1; col < cols; col += 1) {
      var x = col * cellWidth;
      targetCtx.moveTo(x, 0);
      targetCtx.lineTo(x, height);
    }
    for (var row = 1; row < rows; row += 1) {
      var y = row * cellHeight;
      targetCtx.moveTo(0, y);
      targetCtx.lineTo(width, y);
    }
    targetCtx.stroke();

    if (settings.labels) {
      drawLabels(targetCtx, rows, cols, cellWidth, cellHeight, settings);
    }
  }

  function drawLabels(targetCtx, rows, cols, cellWidth, cellHeight, settings) {
    var fontRatio = settings.isExport ? 0.16 : 0.34;
    var minFontSize = settings.isExport ? 12 : 8;
    var maxFontSize = settings.isExport ? 24 : 14;
    var fontSize = Math.max(minFontSize, Math.min(maxFontSize, Math.floor(Math.min(cellWidth, cellHeight) * fontRatio)));
    var widestLabel = toColumnLabel(rows - 1) + cols;
    var pad = getLabelPadding(fontSize, settings.isExport);

    targetCtx.font = fontSize + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    while (
      fontSize > minFontSize &&
      (
        targetCtx.measureText(widestLabel).width > cellWidth - pad * 2 ||
        fontSize > cellHeight - pad * 2
      )
    ) {
      fontSize -= 1;
      pad = getLabelPadding(fontSize, settings.isExport);
      targetCtx.font = fontSize + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    }

    targetCtx.textBaseline = "top";

    for (var row = 0; row < rows; row += 1) {
      var rowLabel = toColumnLabel(row);
      for (var col = 0; col < cols; col += 1) {
        var label = rowLabel + (col + 1);
        var y = settings.labelPosition === "bottom-left"
          ? cellHeight * (row + 1) - pad - fontSize
          : row * cellHeight + pad;
        targetCtx.fillText(label, col * cellWidth + pad, y);
      }
    }
  }

  function getLabelPadding(fontSize, isExport) {
    return Math.max(isExport ? 2 : 1, Math.min(isExport ? 8 : 4, Math.floor(fontSize * 0.25)));
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

  function drawPerspectiveGrid(targetCtx, width, height, settings) {
    var horizonY = height * (settings.horizon / 100);
    var guideCount = Math.max(2, settings.cols);
    var depthCount = Math.max(2, settings.rows);
    var points = getVanishingPoints(width, horizonY, settings.vanishingPoint);

    targetCtx.beginPath();
    targetCtx.moveTo(0, horizonY);
    targetCtx.lineTo(width, horizonY);
    targetCtx.stroke();

    points.forEach(function (point) {
      targetCtx.beginPath();
      for (var i = 0; i <= guideCount; i += 1) {
        var edgeX = width * (i / guideCount);
        targetCtx.moveTo(point.x, point.y);
        targetCtx.lineTo(edgeX, height);
        targetCtx.moveTo(point.x, point.y);
        targetCtx.lineTo(edgeX, 0);
      }
      targetCtx.stroke();
      drawVanishingPoint(targetCtx, point);
    });

    targetCtx.beginPath();
    for (var below = 1; below <= depthCount; below += 1) {
      var downT = Math.pow(below / depthCount, 1.6);
      var yBelow = horizonY + (height - horizonY) * downT;
      targetCtx.moveTo(0, yBelow);
      targetCtx.lineTo(width, yBelow);
    }
    for (var above = 1; above <= depthCount; above += 1) {
      var upT = Math.pow(above / depthCount, 1.6);
      var yAbove = horizonY - horizonY * upT;
      targetCtx.moveTo(0, yAbove);
      targetCtx.lineTo(width, yAbove);
    }
    targetCtx.stroke();
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

  function drawVanishingPoint(targetCtx, point) {
    var size = 5;
    targetCtx.beginPath();
    targetCtx.moveTo(point.x - size, point.y);
    targetCtx.lineTo(point.x + size, point.y);
    targetCtx.moveTo(point.x, point.y - size);
    targetCtx.lineTo(point.x, point.y + size);
    targetCtx.stroke();
  }

  function applyGrayscaleToContext(targetCtx, width, height) {
    var imageData = targetCtx.getImageData(0, 0, width, height);
    var data = imageData.data;

    for (var i = 0; i < data.length; i += 4) {
      var gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    targetCtx.putImageData(imageData, 0, 0);
  }

  function downloadPng() {
    if (!state.image) {
      return;
    }

    renderForExport().toBlob(function (blob) {
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
