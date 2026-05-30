const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const canvasContainer = document.getElementById('canvasContainer');
const stats = document.getElementById('stats');
const imageSize = document.getElementById('imageSize');
const elementCount = document.getElementById('elementCount');
const previewCount = document.getElementById('previewCount');
const previewGrid = document.getElementById('previewGrid');
const startBtn = document.getElementById('startBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const showBoundingBox = document.getElementById('showBoundingBox');
const enableHoverHighlight = document.getElementById('enableHoverHighlight');
const excludeInner = document.getElementById('excludeInner');
const sizeSlider = document.getElementById('sizeSlider');
const sizeValue = document.getElementById('sizeValue');
const enableBatchSelect = document.getElementById('enableBatchSelect');
const batchDownloadBtn = document.getElementById('batchDownloadBtn');
const selectedCount = document.getElementById('selectedCount');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectInverseBtn = document.getElementById('selectInverseBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');

let originalImage = null;
let processedImage = null;
let originalFileName = '';
let selectedItems = new Set();
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;
let canvas = null;
let ctx = null;
let processedCanvas = null;
let processedCtx = null;
let elements = [];
let croppedImages = [];
let bgColor = null;
let isPickingBgColor = false;
let tolerance = 10;

const pickBgColorBtn = document.getElementById('pickBgColorBtn');
const bgColorPreview = document.getElementById('bgColorPreview');
const toleranceSlider = document.getElementById('toleranceSlider');
const toleranceValue = document.getElementById('toleranceValue');
const removeBgBtn = document.getElementById('removeBgBtn');
const previewBgRemove = document.getElementById('previewBgRemove');
let originalImageData = null;

toleranceSlider.addEventListener('input', (e) => {
    tolerance = parseInt(e.target.value);
    toleranceValue.textContent = tolerance;
    if (previewBgRemove.checked && bgColor) {
        applyBgRemovePreview();
    }
});

previewBgRemove.addEventListener('change', (e) => {
    if (!originalImage || !bgColor) {
        previewBgRemove.checked = false;
        return;
    }

    if (e.target.checked) {
        originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyBgRemovePreview();
    } else {
        if (originalImageData) {
            ctx.putImageData(originalImageData, 0, 0);
            originalImageData = null;
        }
    }
});

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
});

async function processFile(file) {
    if (!file.type.startsWith('image/png')) {
        alert('请上传PNG格式图片');
        return;
    }

    originalFileName = file.name.replace(/\.[^/.]+$/, '');

    const img = new Image();
    img.onload = () => {
        originalImage = img;
        displayImage(img);
        startBtn.disabled = false;
        clearBtn.disabled = false;
        downloadBtn.disabled = true;
        imageSize.textContent = `${img.width} × ${img.height}`;
    };
    img.src = URL.createObjectURL(file);
}

function displayImage(img) {
    canvasContainer.innerHTML = '';

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');

    // 获取容器可用大小
    const containerRect = canvasContainer.getBoundingClientRect();
    const maxWidth = Math.max(200, containerRect.width - 40);
    const maxHeight = Math.max(200, containerRect.height - 40);

    let width = img.width;
    let height = img.height;

    // 计算缩放比例保持原始比例
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    canvasContainer.appendChild(canvas);

    stats.style.display = 'flex';
}

function getPixelColor(x, y, scale = 1) {
    const sourceCtx = processedCtx || ctx;
    if (!sourceCtx) return { r: 0, g: 0, b: 0, a: 0 };
    // x和y已经是显示坐标，不需要乘以scale
    const pixelData = sourceCtx.getImageData(x, y, 1, 1).data;
    return {
        r: pixelData[0],
        g: pixelData[1],
        b: pixelData[2],
        a: pixelData[3]
    };
}

function isTransparent(x, y, scale = 1) {
    const color = getPixelColor(x, y, scale);

    if (color.a < 128) { // 提高alpha阈值，更宽松的判断
        return true;
    }

    if (bgColor) {
        if (Math.abs(color.r - bgColor.r) < tolerance &&
            Math.abs(color.g - bgColor.g) < tolerance &&
            Math.abs(color.b - bgColor.b) < tolerance) {
            return true;
        }
    }

    return false;
}

function findBoundingBox(startX, startY, visited, width, height, scale) {
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;

    const stack = [[startX, startY]];
    visited[startY][startX] = true;

    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (!visited[ny][nx] && !isTransparent(nx, ny, scale)) {
                    visited[ny][nx] = true;
                    stack.push([nx, ny]);
                    minX = Math.min(minX, nx);
                    maxX = Math.max(maxX, nx);
                    minY = Math.min(minY, ny);
                    maxY = Math.max(maxY, ny);
                }
            }
        }
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    };
}

function isInside(a, b) {
    return a.x >= b.x && a.y >= b.y &&
        (a.x + a.width) <= (b.x + b.width) &&
        (a.y + a.height) <= (b.y + b.height);
}

function findElements() {
    const sourceCanvas = processedCanvas || canvas;
    if (!sourceCanvas) return;

    const scale = originalImage.width / sourceCanvas.width;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    const visited = Array(height).fill(null).map(() => Array(width).fill(false));
    elements = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!visited[y][x] && !isTransparent(x, y, scale)) {
                const box = findBoundingBox(x, y, visited, width, height, scale);

                if (box.width >= 5 && box.height >= 5) {
                    elements.push(box);
                }
            }
        }
    }

    if (excludeInner.checked) {
        const innerElements = new Set();

        for (let i = 0; i < elements.length; i++) {
            for (let j = 0; j < elements.length; j++) {
                if (i !== j && isInside(elements[i], elements[j])) {
                    innerElements.add(i);
                }
            }
        }

        const outerElements = elements.filter((_, index) => !innerElements.has(index));
        const filteredInnerElements = [];

        for (const index of innerElements) {
            let isContainedByInner = false;
            for (const otherIndex of innerElements) {
                if (index !== otherIndex && isInside(elements[index], elements[otherIndex])) {
                    isContainedByInner = true;
                    break;
                }
            }
            if (!isContainedByInner) {
                filteredInnerElements.push(elements[index]);
            }
        }

        elements = [...outerElements, ...filteredInnerElements];
    }

    return elements;
}

function drawBoundingBoxes() {
    if (!showBoundingBox.checked) return;
    if (!canvas) return;

    // 获取canvas相对于容器的位置
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = canvasContainer.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    elements.forEach((box, index) => {
        const rect = document.createElement('div');
        rect.className = 'bounding-box';
        rect.style.left = `${offsetX + box.x}px`;
        rect.style.top = `${offsetY + box.y}px`;
        rect.style.width = `${box.width}px`;
        rect.style.height = `${box.height}px`;
        rect.setAttribute('data-label', `${index + 1}`);
        rect.style.cursor = 'pointer';

        rect.addEventListener('mouseenter', () => {
            highlightPreviewItem(index);
        });

        rect.addEventListener('mouseleave', () => {
            unhighlightPreviewItem();
        });

        rect.addEventListener('click', (e) => {
            e.stopPropagation();
            if (enableBatchSelect.checked) {
                const previewItems = document.querySelectorAll('.preview-item');
                const item = previewItems[index];
                if (item) {
                    const checkbox = item.querySelector('.checkbox');
                    const checkboxCustom = item.querySelector('.checkbox-custom');
                    toggleSelect(index, item, checkbox, checkboxCustom);
                }
            }
        });

        canvasContainer.appendChild(rect);
    });
}

function highlightPreviewItem(index) {
    const previewItems = document.querySelectorAll('.preview-item');
    previewItems.forEach((item, i) => {
        if (i === index) {
            item.style.boxShadow = '0 0 15px rgba(255, 152, 0, 0.8)';
            item.style.transform = 'scale(1.05)';
            item.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    });
}

function unhighlightPreviewItem() {
    const previewItems = document.querySelectorAll('.preview-item');
    previewItems.forEach(item => {
        item.style.boxShadow = '';
        item.style.transform = '';
    });
}

function toggleBoundingBoxes() {
    const boxes = document.querySelectorAll('.bounding-box');
    boxes.forEach(box => {
        box.style.display = showBoundingBox.checked ? 'block' : 'none';
    });
}

showBoundingBox.addEventListener('change', toggleBoundingBoxes);

let highlightBox = null;
let currentHoverElement = -1;

canvasContainer.addEventListener('mousemove', (e) => {
    if (!canvas || elements.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (x >= element.x && x <= element.x + element.width &&
            y >= element.y && y <= element.y + element.height) {
            if (currentHoverElement !== i) {
                currentHoverElement = i;
                highlightPreviewItem(i);
            }
            return;
        }
    }

    if (currentHoverElement !== -1) {
        currentHoverElement = -1;
        unhighlightPreviewItem();
    }
});

canvasContainer.addEventListener('mouseleave', () => {
    if (currentHoverElement !== -1) {
        currentHoverElement = -1;
        unhighlightPreviewItem();
    }
});
let maskLayer = null;

function highlightElement(index) {
    if (!enableHoverHighlight.checked) return;
    if (!canvas) return;

    const box = document.querySelectorAll('.bounding-box')[index];

    if (box) {
        box.style.borderColor = '#ff9800';
        box.style.background = 'rgba(255, 152, 0, 0.3)';
        box.style.transform = 'scale(1.02)';
        box.style.zIndex = 10;
        box.style.display = 'block';

        document.querySelectorAll('.bounding-box').forEach((b, i) => {
            if (i !== index) {
                b.style.opacity = '0.3';
            }
        });
    } else {
        const element = elements[index];
        if (element) {
            // 获取canvas相对于容器的位置
            const canvasRect = canvas.getBoundingClientRect();
            const containerRect = canvasContainer.getBoundingClientRect();
            const offsetX = canvasRect.left - containerRect.left;
            const offsetY = canvasRect.top - containerRect.top;

            highlightBox = document.createElement('div');
            highlightBox.className = 'highlight-box';
            highlightBox.style.left = `${offsetX + element.x}px`;
            highlightBox.style.top = `${offsetY + element.y}px`;
            highlightBox.style.width = `${element.width}px`;
            highlightBox.style.height = `${element.height}px`;
            canvasContainer.appendChild(highlightBox);

            maskLayer = document.createElement('canvas');
            maskLayer.className = 'highlight-mask';
            maskLayer.width = canvas.width;
            maskLayer.height = canvas.height;
            maskLayer.style.position = 'absolute';
            maskLayer.style.top = `${offsetY}px`;
            maskLayer.style.left = `${offsetX}px`;
            maskLayer.style.zIndex = '5';

            const maskCtx = maskLayer.getContext('2d');
            maskCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            maskCtx.fillRect(0, 0, canvas.width, canvas.height);

            maskCtx.clearRect(element.x, element.y, element.width, element.height);

            canvasContainer.appendChild(maskLayer);
        }
    }
}

function unhighlightElement() {
    document.querySelectorAll('.bounding-box').forEach(box => {
        box.style.borderColor = '#4caf50';
        box.style.background = 'rgba(76, 175, 80, 0.1)';
        box.style.transform = 'scale(1)';
        box.style.zIndex = 1;
        box.style.opacity = '1';
        box.style.display = showBoundingBox.checked ? 'block' : 'none';
    });

    if (highlightBox) {
        highlightBox.remove();
        highlightBox = null;
    }

    if (maskLayer) {
        maskLayer.remove();
        maskLayer = null;
    }
}

function cropElements() {
    const sourceCanvas = processedCanvas || canvas;
    const sourceImage = processedImage || originalImage;

    if (!sourceCanvas || !sourceImage) return;

    const scale = sourceImage.width / sourceCanvas.width;
    croppedImages = [];

    const getInnerElements = (outerIndex) => {
        if (!excludeInner.checked) return [];
        const outerBox = elements[outerIndex];
        return elements
            .map((box, index) => ({ box, index }))
            .filter(({ box, index }) => index !== outerIndex && isInside(box, outerBox));
    };

    elements.forEach((box, index) => {
        const newCanvas = document.createElement('canvas');
        const newCtx = newCanvas.getContext('2d');

        const originalX = box.x * scale;
        const originalY = box.y * scale;
        const originalWidth = box.width * scale;
        const originalHeight = box.height * scale;

        newCanvas.width = originalWidth;
        newCanvas.height = originalHeight;

        newCtx.drawImage(
            sourceImage,
            originalX, originalY, originalWidth, originalHeight,
            0, 0, originalWidth, originalHeight
        );

        if (excludeInner.checked) {
            const innerElements = getInnerElements(index);
            innerElements.forEach(({ box: innerBox }) => {
                const innerX = (innerBox.x - box.x) * scale;
                const innerY = (innerBox.y - box.y) * scale;
                const innerW = innerBox.width * scale;
                const innerH = innerBox.height * scale;
                newCtx.clearRect(innerX, innerY, innerW, innerH);
            });
        }

        croppedImages.push({
            canvas: newCanvas,
            index: index + 1,
            width: originalWidth,
            height: originalHeight
        });
    });
}

function updatePreviewGrid() {
    previewGrid.innerHTML = '';

    if (croppedImages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.gridColumn = 'span 2';
        empty.innerHTML = '<i>👆</i><p>点击开始切图</p>';
        previewGrid.appendChild(empty);
        return;
    }

    croppedImages.forEach((item, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.dataset.index = index;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        checkbox.checked = selectedItems.has(index);

        const checkboxCustom = document.createElement('div');
        checkboxCustom.className = 'checkbox-custom';

        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        img.alt = `元素 ${item.index}`;
        img.style.maxWidth = sizeSlider.value + 'px';
        img.style.maxHeight = sizeSlider.value + 'px';

        const previewInfo = document.createElement('div');
        previewInfo.className = 'preview-info';
        previewInfo.innerHTML = `
            <span>${item.index}</span>
            <span style="float:right">${Math.round(item.width)}×${Math.round(item.height)}</span>
        `;

        previewItem.appendChild(checkbox);
        previewItem.appendChild(checkboxCustom);
        previewItem.appendChild(img);
        previewItem.appendChild(previewInfo);

        if (selectedItems.has(index)) {
            previewItem.classList.add('selected');
            checkboxCustom.classList.add('checked');
        }

        updateCheckboxVisibility(previewItem, enableBatchSelect.checked);

        previewItem.addEventListener('click', (e) => {
            if (enableBatchSelect.checked) {
                e.preventDefault();
                toggleSelect(index, previewItem, checkbox, checkboxCustom);
            } else {
                downloadSingle(index);
            }
        });

        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            toggleSelect(index, previewItem, checkbox, checkboxCustom);
        });

        previewItem.addEventListener('mouseenter', () => {
            highlightElement(index);
        });

        previewItem.addEventListener('mouseleave', () => {
            unhighlightElement();
        });

        previewGrid.appendChild(previewItem);
    });
}

function updateCheckboxVisibility(item, visible) {
    const checkbox = item.querySelector('.checkbox');
    const checkboxCustom = item.querySelector('.checkbox-custom');
    if (checkbox) checkbox.classList.toggle('visible', visible);
    if (checkboxCustom) checkboxCustom.classList.toggle('visible', visible);
}

function toggleSelect(index, previewItem, checkbox, checkboxCustom) {
    if (selectedItems.has(index)) {
        selectedItems.delete(index);
        previewItem.classList.remove('selected');
        checkbox.checked = false;
        checkboxCustom.classList.remove('checked');
    } else {
        selectedItems.add(index);
        previewItem.classList.add('selected');
        checkbox.checked = true;
        checkboxCustom.classList.add('checked');
    }
    updateSelectedCount();
}

function updateSelectedCount() {
    selectedCount.textContent = selectedItems.size;
    batchDownloadBtn.disabled = selectedItems.size === 0;
}

function downloadSingle(index) {
    const item = croppedImages[index];
    const link = document.createElement('a');
    link.href = item.canvas.toDataURL('image/png');
    link.download = `${originalFileName}_${item.index}.png`;
    link.click();
}

async function downloadAll() {
    const zip = new JSZip();

    croppedImages.forEach((item) => {
        const dataUrl = item.canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        zip.file(`${originalFileName}_${item.index}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${originalFileName}_elements.zip`;
    link.click();
}

startBtn.addEventListener('click', () => {
    document.querySelectorAll('.bounding-box').forEach(el => el.remove());

    elements = findElements();
    elementCount.textContent = elements.length;
    previewCount.textContent = elements.length;

    if (elements.length === 0) {
        alert('未检测到非透明元素');
        return;
    }

    drawBoundingBoxes();
    cropElements();
    updatePreviewGrid();

    downloadBtn.disabled = false;

    const hasImages = croppedImages.length > 0;
    selectAllBtn.disabled = !enableBatchSelect.checked || !hasImages;
    selectInverseBtn.disabled = !enableBatchSelect.checked || !hasImages;
    clearSelectionBtn.disabled = !enableBatchSelect.checked || !hasImages;
});

downloadBtn.addEventListener('click', downloadAll);

clearBtn.addEventListener('click', () => {
    canvasContainer.innerHTML = '<div class="empty-state"><i>🖼️</i><p>请先上传图片</p></div>';
    previewGrid.innerHTML = '<div class="empty-state" style="grid-column: span 2;"><i>👆</i><p>上传图片后开始切图</p></div>';
    stats.style.display = 'none';
    startBtn.disabled = true;
    downloadBtn.disabled = true;
    clearBtn.disabled = true;
    originalImage = null;
    canvas = null;
    ctx = null;
    elements = [];
    croppedImages = [];
    fileInput.value = '';
});

sizeSlider.addEventListener('input', (e) => {
    const size = e.target.value;
    sizeValue.textContent = size + 'px';
    document.querySelectorAll('.preview-item img').forEach(img => {
        img.style.maxWidth = size + 'px';
        img.style.maxHeight = size + 'px';
    });
});

enableBatchSelect.addEventListener('change', (e) => {
    const visible = e.target.checked;
    const hasImages = croppedImages.length > 0;
    selectAllBtn.disabled = !visible || !hasImages;
    selectInverseBtn.disabled = !visible || !hasImages;
    clearSelectionBtn.disabled = !visible || !hasImages;

    document.querySelectorAll('.preview-item').forEach(item => {
        updateCheckboxVisibility(item, visible);
    });
    if (!visible) {
        selectedItems.clear();
        updateSelectedCount();
        document.querySelectorAll('.preview-item').forEach(item => {
            item.classList.remove('selected');
            const checkboxCustom = item.querySelector('.checkbox-custom');
            if (checkboxCustom) checkboxCustom.classList.remove('checked');
        });
    }
});

selectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.preview-item').forEach((item, index) => {
        const checkbox = item.querySelector('.checkbox');
        const checkboxCustom = item.querySelector('.checkbox-custom');
        if (!selectedItems.has(index)) {
            toggleSelect(index, item, checkbox, checkboxCustom);
        }
    });
});

selectInverseBtn.addEventListener('click', () => {
    document.querySelectorAll('.preview-item').forEach((item, index) => {
        const checkbox = item.querySelector('.checkbox');
        const checkboxCustom = item.querySelector('.checkbox-custom');
        toggleSelect(index, item, checkbox, checkboxCustom);
    });
});

clearSelectionBtn.addEventListener('click', () => {
    document.querySelectorAll('.preview-item').forEach((item, index) => {
        if (selectedItems.has(index)) {
            const checkbox = item.querySelector('.checkbox');
            const checkboxCustom = item.querySelector('.checkbox-custom');
            toggleSelect(index, item, checkbox, checkboxCustom);
        }
    });
});

previewGrid.addEventListener('mousedown', (e) => {
    if (!enableBatchSelect.checked) return;
    if (e.target.classList.contains('preview-item') || e.target.closest('.preview-item')) return;

    isSelecting = true;
    const rect = previewGrid.getBoundingClientRect();
    selectionStart = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    selectionBox.style.left = selectionStart.x + 'px';
    selectionBox.style.top = selectionStart.y + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    previewGrid.appendChild(selectionBox);
});

previewGrid.addEventListener('mousemove', (e) => {
    if (!isSelecting || !selectionBox) return;

    const rect = previewGrid.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const left = Math.min(selectionStart.x, currentX);
    const top = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);

    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
});

previewGrid.addEventListener('mouseup', () => {
    if (!isSelecting || !selectionBox) return;

    const boxRect = selectionBox.getBoundingClientRect();
    const gridRect = previewGrid.getBoundingClientRect();

    const boxLeft = boxRect.left - gridRect.left;
    const boxTop = boxRect.top - gridRect.top;
    const boxRight = boxLeft + boxRect.width;
    const boxBottom = boxTop + boxRect.height;

    document.querySelectorAll('.preview-item').forEach((item, index) => {
        const itemRect = item.getBoundingClientRect();
        const itemLeft = itemRect.left - gridRect.left;
        const itemTop = itemRect.top - gridRect.top;
        const itemRight = itemLeft + itemRect.width;
        const itemBottom = itemTop + itemRect.height;

        if (itemLeft < boxRight && itemRight > boxLeft && itemTop < boxBottom && itemBottom > boxTop) {
            const checkbox = item.querySelector('.checkbox');
            const checkboxCustom = item.querySelector('.checkbox-custom');
            toggleSelect(index, item, checkbox, checkboxCustom);
        }
    });

    selectionBox.remove();
    selectionBox = null;
    isSelecting = false;
});

previewGrid.addEventListener('mouseleave', () => {
    if (isSelecting && selectionBox) {
        selectionBox.remove();
        selectionBox = null;
        isSelecting = false;
    }
});

batchDownloadBtn.addEventListener('click', async () => {
    if (selectedItems.size === 0) return;

    const zip = new JSZip();

    selectedItems.forEach(index => {
        const item = croppedImages[index];
        const dataUrl = item.canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        zip.file(`${originalFileName}_${item.index}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${originalFileName}_selected.zip`;
    link.click();
});

clearBtn.addEventListener('click', () => {
    selectedItems.clear();
    updateSelectedCount();
    bgColor = null;
    bgColorPreview.style.display = 'none';
    processedImage = null;
    processedCanvas = null;
    removeBgBtn.disabled = true;
    previewBgRemove.checked = false;
    originalImageData = null;
    canvasContainer.innerHTML = '';
    canvas = null;
    ctx = null;
    originalImage = null;
    stats.style.display = 'none';
    previewGrid.innerHTML = '';
    previewCount.textContent = '0';
    startBtn.disabled = true;
    downloadBtn.disabled = true;
});

pickBgColorBtn.addEventListener('click', () => {
    if (!originalImage) {
        alert('请先上传图片');
        return;
    }

    isPickingBgColor = !isPickingBgColor;
    pickBgColorBtn.textContent = isPickingBgColor ? '取消选择' : '选择背景色';
    removeBgBtn.disabled = isPickingBgColor || !bgColor;

    if (isPickingBgColor) {
        canvasContainer.style.cursor = 'crosshair';
        canvasContainer.addEventListener('click', pickBgColorFromCanvas);
    } else {
        canvasContainer.style.cursor = '';
        canvasContainer.removeEventListener('click', pickBgColorFromCanvas);
    }
});

removeBgBtn.addEventListener('click', () => {
    if (!originalImage || !bgColor) return;

    removeBgFromImage();
});

function pickBgColorFromCanvas(e) {
    if (!ctx || !isPickingBgColor) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const imageData = ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;

    bgColor = {
        r: data[0],
        g: data[1],
        b: data[2],
        a: data[3]
    };

    updateBgColorPreview();
    isPickingBgColor = false;
    pickBgColorBtn.textContent = '选择背景色';
    canvasContainer.style.cursor = '';
    canvasContainer.removeEventListener('click', pickBgColorFromCanvas);
    removeBgBtn.disabled = false;

    if (previewBgRemove.checked) {
        if (!originalImageData) {
            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        applyBgRemovePreview();
    }
}

function updateBgColorPreview() {
    if (bgColor) {
        bgColorPreview.innerHTML = `
            <span>背景色:</span>
            <div class="color-box" style="background: rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${bgColor.a / 255})"></div>
            <span>(${bgColor.r}, ${bgColor.g}, ${bgColor.b})</span>
        `;
        bgColorPreview.style.display = 'flex';
    } else {
        bgColorPreview.style.display = 'none';
    }
}

function getBgRemoveMode() {
    const radios = document.querySelectorAll('input[name="bgRemoveMode"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'edge';
}

function applyBgRemovePreview() {
    if (!canvas || !ctx || !bgColor) return;

    if (originalImageData) {
        ctx.putImageData(originalImageData, 0, 0);
    }

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const mode = getBgRemoveMode();
    const processedData = removeBgColor(imageData, width, height, mode);
    ctx.putImageData(processedData, 0, 0);
}

function removeBgFromImage() {
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const imageData = ctx.getImageData(0, 0, width, height);
    const mode = getBgRemoveMode();
    const processedData = removeBgColor(imageData, width, height, mode);
    ctx.putImageData(processedData, 0, 0);

    processedImage = new Image();
    processedImage.src = canvas.toDataURL('image/png');

    if (originalImageData) {
        originalImageData = null;
    }
    previewBgRemove.checked = false;
}

function removeBgColor(imageData, width, height, mode = 'edge') {
    if (!bgColor) return imageData;

    const data = imageData.data;
    const currentTolerance = tolerance;

    if (mode === 'edge') {
        const visited = new Uint8Array(width * height);
        const queueX = [];
        const queueY = [];
        let queueStart = 0;

        for (let x = 0; x < width; x++) {
            queueX.push(x);
            queueY.push(0);
            queueX.push(x);
            queueY.push(height - 1);
        }
        for (let y = 0; y < height; y++) {
            queueX.push(0);
            queueY.push(y);
            queueX.push(width - 1);
            queueY.push(y);
        }

        while (queueStart < queueX.length) {
            const x = queueX[queueStart];
            const y = queueY[queueStart];
            queueStart++;

            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const idx = (y * width + x) * 4;

            if (visited[y * width + x]) continue;

            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            if (Math.abs(r - bgColor.r) < currentTolerance &&
                Math.abs(g - bgColor.g) < currentTolerance &&
                Math.abs(b - bgColor.b) < currentTolerance) {
                visited[y * width + x] = 1;
                data[idx + 3] = 0;

                queueX.push(x + 1);
                queueY.push(y);
                queueX.push(x - 1);
                queueY.push(y);
                queueX.push(x);
                queueY.push(y + 1);
                queueX.push(x);
                queueY.push(y - 1);
            }
        }
    } else {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            if (Math.abs(r - bgColor.r) < currentTolerance &&
                Math.abs(g - bgColor.g) < currentTolerance &&
                Math.abs(b - bgColor.b) < currentTolerance) {
                data[i + 3] = 0;
            }
        }
    }

    return imageData;
}