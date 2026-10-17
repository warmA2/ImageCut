// UI模块
import * as state from './state.js';
import * as elements from './elements.js';

// 高亮预览项
export function highlightPreviewItem(index) {
    const previewItems = document.querySelectorAll('.preview-item');
    previewItems.forEach((item, i) => {
        if (i === index) {
            item.style.boxShadow = '0 0 15px rgba(255, 152, 0, 0.8)';
            item.style.transform = 'scale(1.05)';
            item.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    });
}

// 取消高亮预览项
export function unhighlightPreviewItem() {
    const previewItems = document.querySelectorAll('.preview-item');
    previewItems.forEach(item => {
        item.style.boxShadow = '';
        item.style.transform = '';
    });
}

// 绘制边界框
export function drawBoundingBoxes() {
    if (!state.canvas) return;

    // 自由行列模式的分割线同时也是拖拽手柄，不受"显示边界框"开关影响
    if (getSplitMode() === 'custom') {
        removeCustomGridLines();
        renderCustomGridLines();
    }

    if (!elements.showBoundingBox.checked) return;

    // 判断是否是行列切图模式
    const isGridMode = state.elements.length > 0 && state.elements[0].row !== undefined;

    // 以画布真实渲染尺寸为准计算缩放比例与偏移
    const geo = state.getCanvasDisplayGeometry();
    if (!geo) return;
    const { scaleX, scaleY, offsetX, offsetY, width: displayWidth, height: displayHeight } = geo;

    if (isGridMode && getSplitMode() === 'grid') {
        // 绘制行列分割线
        const rows = Math.max(...state.elements.map(e => e.row));
        const cols = Math.max(...state.elements.map(e => e.col));
        const cellWidth = displayWidth / cols;
        const cellHeight = displayHeight / rows;

        // 绘制垂直线
        for (let i = 1; i < cols; i++) {
            const line = document.createElement('div');
            line.className = 'grid-line vertical';
            line.style.left = `${offsetX + i * cellWidth}px`;
            line.style.top = `${offsetY}px`;
            line.style.width = '2px';
            line.style.height = `${displayHeight}px`;
            elements.canvasContainer.appendChild(line);
        }

        // 绘制水平线
        for (let i = 1; i < rows; i++) {
            const line = document.createElement('div');
            line.className = 'grid-line horizontal';
            line.style.left = `${offsetX}px`;
            line.style.top = `${offsetY + i * cellHeight}px`;
            line.style.width = `${displayWidth}px`;
            line.style.height = '2px';
            elements.canvasContainer.appendChild(line);
        }
    }

    state.elements.forEach((box, index) => {
        const rect = document.createElement('div');
        rect.className = 'bounding-box';
        
        // 所有模式下都使用缩放后的坐标（含画布在容器内的偏移）
        rect.style.left = `${offsetX + box.x * scaleX}px`;
        rect.style.top = `${offsetY + box.y * scaleY}px`;
        rect.style.width = `${box.width * scaleX}px`;
        rect.style.height = `${box.height * scaleY}px`;
        
        const isGridElement = box.row !== undefined && box.col !== undefined;
        rect.setAttribute('data-label', isGridElement ? `${box.row}-${box.col}` : `${index + 1}`);
        rect.style.cursor = 'pointer';

        rect.addEventListener('mouseenter', () => {
            highlightPreviewItem(index);
        });

        rect.addEventListener('mouseleave', () => {
            unhighlightPreviewItem();
        });

        rect.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // 如果是手动合并模式，处理合并选择
            if (state.isManualMergeMode) {
                if (state.manualMergeSelected.has(index)) {
                    state.manualMergeSelected.delete(index);
                } else {
                    state.manualMergeSelected.add(index);
                }
                state.setManualMergeSelected(state.manualMergeSelected);
                ui.updateManualMergeSelection();
                ui.updateManualMergeCount();
                return;
            }
            
            // 批量选择模式
            if (elements.enableBatchSelect.checked) {
                const previewItems = document.querySelectorAll('.preview-item');
                const item = previewItems[index];
                if (item) {
                    const checkbox = item.querySelector('.checkbox');
                    const checkboxCustom = item.querySelector('.checkbox-custom');
                    toggleSelect(index, item, checkbox, checkboxCustom);
                }
            }
        });

        elements.canvasContainer.appendChild(rect);
    });
}

// 切换边界框可见性
export function toggleBoundingBoxes() {
    const boxes = document.querySelectorAll('.bounding-box');
    const lines = document.querySelectorAll('.grid-line');
    boxes.forEach(box => {
        box.style.display = elements.showBoundingBox.checked ? 'block' : 'none';
    });
    lines.forEach(line => {
        // 自由行列的分割线是拖拽手柄，始终显示
        if (line.classList.contains('custom-grid-line')) return;
        line.style.display = elements.showBoundingBox.checked ? 'block' : 'none';
    });
}

// 高亮元素
export function highlightElement(index) {
    if (!elements.enableHoverHighlight.checked) return;
    if (!state.canvas) return;

    const box = document.querySelectorAll('.bounding-box')[index];

    if (box) {
        box.style.borderColor = '#ff9800';
        box.style.background = 'rgba(255, 152, 0, 0.3)';
        box.style.transform = 'scale(1.02)';
        box.style.zIndex = '10';
        box.style.display = 'block';

        document.querySelectorAll('.bounding-box').forEach((b, i) => {
            if (i !== index) {
                b.style.opacity = '0.3';
            }
        });
    } else {
        const element = state.elements[index];
        if (element) {
            // 以画布真实渲染尺寸为准计算缩放比例与偏移
            const geo = state.getCanvasDisplayGeometry();
            if (!geo) return;
            const { scaleX, scaleY, offsetX, offsetY } = geo;

            state.setHighlightBox(document.createElement('div'));
            state.highlightBox.className = 'highlight-box';
            
            // 使用缩放后的坐标（含画布在容器内的偏移）
            state.highlightBox.style.left = `${offsetX + element.x * scaleX}px`;
            state.highlightBox.style.top = `${offsetY + element.y * scaleY}px`;
            state.highlightBox.style.width = `${element.width * scaleX}px`;
            state.highlightBox.style.height = `${element.height * scaleY}px`;
            elements.canvasContainer.appendChild(state.highlightBox);

            state.setMaskLayer(document.createElement('canvas'));
            state.maskLayer.className = 'highlight-mask';
            state.maskLayer.width = state.canvas.width;
            state.maskLayer.height = state.canvas.height;
            state.maskLayer.style.position = 'absolute';
            state.maskLayer.style.top = `${offsetY}px`;
            state.maskLayer.style.left = `${offsetX}px`;
            state.maskLayer.style.width = `${geo.width}px`;
            state.maskLayer.style.height = `${geo.height}px`;
            state.maskLayer.style.zIndex = '5';

            const maskCtx = state.maskLayer.getContext('2d');
            maskCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            maskCtx.fillRect(0, 0, state.canvas.width, state.canvas.height);

            maskCtx.clearRect(element.x, element.y, element.width, element.height);

            elements.canvasContainer.appendChild(state.maskLayer);
        }
    }
}

// 取消高亮元素
export function unhighlightElement() {
    document.querySelectorAll('.bounding-box').forEach(box => {
        box.style.borderColor = '#4caf50';
        box.style.background = 'rgba(76, 175, 80, 0.1)';
        box.style.transform = 'scale(1)';
        box.style.zIndex = '1';
        box.style.opacity = '1';
        box.style.display = elements.showBoundingBox.checked ? 'block' : 'none';
    });

    if (state.highlightBox) {
        state.highlightBox.remove();
        state.setHighlightBox(null);
    }

    if (state.maskLayer) {
        state.maskLayer.remove();
        state.setMaskLayer(null);
    }
}

// ===== 单图放大预览（Lightbox） =====
let lightboxInitialized = false;
let lbScale = 1;
let lbTranslateX = 0;
let lbTranslateY = 0;
let lbDragging = false;
let lbDragStartX = 0;
let lbDragStartY = 0;

function applyLbTransform(lightboxImg) {
    lightboxImg.style.transform =
        `translate(${lbTranslateX}px, ${lbTranslateY}px) scale(${lbScale})`;
}

function resetLbTransform(lightboxImg) {
    lbScale = 1;
    lbTranslateX = 0;
    lbTranslateY = 0;
    applyLbTransform(lightboxImg);
}

function updateLbCaption(caption, item, label) {
    const zoomText = lbScale === 1 ? '' : ` · 缩放 ${Math.round(lbScale * 100)}%`;
    caption.textContent =
        `元素 ${label} · ${Math.round(item.width)}×${Math.round(item.height)}` +
        zoomText + ' · 滚轮缩放 · 双击复位';
}

function initLightbox() {
    if (lightboxInitialized) return;
    lightboxInitialized = true;

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    lightboxImg.draggable = false;
    const caption = document.getElementById('lightboxCaption');
    const closeBtn = document.getElementById('lightboxClose');
    const backdrop = lightbox.querySelector('.lightbox-backdrop');

    const closeLightbox = () => {
        lightbox.style.display = 'none';
        resetLbTransform(lightboxImg);
    };

    closeBtn.addEventListener('click', closeLightbox);
    backdrop.addEventListener('click', closeLightbox);

    // 滚轮缩放（以鼠标位置为中心）；绑定在整个遮罩层上，光标略偏出图片也能缩放
    lightbox.addEventListener('wheel', (e) => {
        if (lightbox.style.display === 'none') return;
        e.preventDefault();

        const rect = lightboxImg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // 鼠标相对图片中心的位置（当前缩放下的屏幕坐标）
        const offsetX = e.clientX - cx;
        const offsetY = e.clientY - cy;

        const oldScale = lbScale;
        const oldTx = lbTranslateX;
        const oldTy = lbTranslateY;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        lbScale = Math.min(20, Math.max(0.1, lbScale * factor));

        // 缩放倍数接近 1 时吸附回 1，消除浮点累积误差并同时复位平移
        if (Math.abs(lbScale - 1) < 0.005) {
            lbScale = 1;
            lbTranslateX = 0;
            lbTranslateY = 0;
            applyLbTransform(lightboxImg);
        } else {
            // 调整平移量，使鼠标指向的图片点保持不动（考虑已有的平移量）
            const ratio = lbScale / oldScale;
            lbTranslateX = e.clientX - cx - offsetX * ratio + oldTx;
            lbTranslateY = e.clientY - cy - offsetY * ratio + oldTy;
            applyLbTransform(lightboxImg);
        }
        const item = state.croppedImages[lightboxImg.dataset.index];
        if (item) {
            const element = state.elements[lightboxImg.dataset.index];
            const isGridMode = element && element.row !== undefined && element.col !== undefined;
            const label = isGridMode ? `${element.row}-${element.col}` : `${item.index}`;
            updateLbCaption(caption, item, label);
        }
    }, { passive: false });

    // 双击复位
    lightboxImg.addEventListener('dblclick', () => {
        resetLbTransform(lightboxImg);
        const item = state.croppedImages[lightboxImg.dataset.index];
        if (item) {
            const element = state.elements[lightboxImg.dataset.index];
            const isGridMode = element && element.row !== undefined && element.col !== undefined;
            const label = isGridMode ? `${element.row}-${element.col}` : `${item.index}`;
            updateLbCaption(caption, item, label);
        }
    });

    // 按住拖拽平移
    lightboxImg.addEventListener('mousedown', (e) => {
        e.preventDefault();
        lbDragging = true;
        lbDragStartX = e.clientX - lbTranslateX;
        lbDragStartY = e.clientY - lbTranslateY;
        lightboxImg.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
        if (!lbDragging) return;
        lbTranslateX = e.clientX - lbDragStartX;
        lbTranslateY = e.clientY - lbDragStartY;
        applyLbTransform(lightboxImg);
    });
    document.addEventListener('mouseup', () => {
        if (lbDragging) {
            lbDragging = false;
            lightboxImg.style.cursor = 'grab';
        }
    });

    // Esc 关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.style.display !== 'none') {
            closeLightbox();
        }
    });
}

function openLightbox(index) {
    initLightbox();

    const item = state.croppedImages[index];
    if (!item) return;

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const caption = document.getElementById('lightboxCaption');

    const element = state.elements[index];
    const isGridMode = element && element.row !== undefined && element.col !== undefined;
    const label = isGridMode ? `${element.row}-${element.col}` : `${item.index}`;

    lightboxImg.dataset.index = index;
    lightboxImg.src = item.canvas.toDataURL('image/png');
    lightboxImg.alt = `元素 ${label}`;
    lightboxImg.style.cursor = 'grab';
    resetLbTransform(lightboxImg);
    updateLbCaption(caption, item, label);
    lightbox.style.display = 'flex';
}

export function updatePreviewGrid() {
    elements.previewGrid.innerHTML = '';

    if (state.croppedImages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.gridColumn = 'span 2';
        empty.innerHTML = '<i>👆</i><p>点击开始切图</p>';
        elements.previewGrid.appendChild(empty);
        return;
    }

    state.croppedImages.forEach((item, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.dataset.index = index;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        checkbox.checked = state.selectedItems.has(index);

        const checkboxCustom = document.createElement('div');
        checkboxCustom.className = 'checkbox-custom';

        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        const element = state.elements[index];
        const isGridMode = element && element.row !== undefined && element.col !== undefined;
        const label = isGridMode ? `${element.row}-${element.col}` : `${item.index}`;
        img.alt = `元素 ${label}`;
        img.style.maxWidth = elements.sizeSlider.value + 'px';
        img.style.maxHeight = elements.sizeSlider.value + 'px';

        const previewInfo = document.createElement('div');
        previewInfo.className = 'preview-info';
        previewInfo.innerHTML = `
            <span>${label}</span>
            <span style="float:right">${Math.round(item.width)}×${Math.round(item.height)}</span>
        `;

        // 放大预览按钮（悬停预览项时显示在右上角）
        const zoomBtn = document.createElement('button');
        zoomBtn.className = 'preview-zoom-btn';
        zoomBtn.title = '放大预览';
        zoomBtn.textContent = '🔍';
        zoomBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openLightbox(index);
        });

        previewItem.appendChild(checkbox);
        previewItem.appendChild(checkboxCustom);
        previewItem.appendChild(img);
        previewItem.appendChild(previewInfo);
        previewItem.appendChild(zoomBtn);

        if (state.selectedItems.has(index)) {
            previewItem.classList.add('selected');
            checkboxCustom.classList.add('checked');
        }

        updateCheckboxVisibility(previewItem, elements.enableBatchSelect.checked);

        previewItem.addEventListener('click', (e) => {
            if (elements.enableBatchSelect.checked) {
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

        elements.previewGrid.appendChild(previewItem);
    });
}

// 更新复选框可见性
export function updateCheckboxVisibility(item, visible) {
    const checkbox = item.querySelector('.checkbox');
    const checkboxCustom = item.querySelector('.checkbox-custom');
    if (checkbox) checkbox.classList.toggle('visible', visible);
    if (checkboxCustom) checkboxCustom.classList.toggle('visible', visible);
}

// 切换选择
export function toggleSelect(index, previewItem, checkbox, checkboxCustom) {
    if (state.selectedItems.has(index)) {
        state.selectedItems.delete(index);
        previewItem.classList.remove('selected');
        checkbox.checked = false;
        checkboxCustom.classList.remove('checked');
    } else {
        state.selectedItems.add(index);
        previewItem.classList.add('selected');
        checkbox.checked = true;
        checkboxCustom.classList.add('checked');
    }
    updateSelectedCount();
}

// 更新选中数量
export function updateSelectedCount() {
    elements.selectedCount.textContent = state.selectedItems.size;
    elements.batchDownloadBtn.disabled = state.selectedItems.size === 0;
}

// 下载单个元素
export function downloadSingle(index) {
    const item = state.croppedImages[index];
    const link = document.createElement('a');
    link.href = item.canvas.toDataURL('image/png');
    link.download = `${state.originalFileName}_${item.index}.png`;
    link.click();
}

// 更新手动合并选中的样式
export function updateManualMergeSelection() {
    const boxes = document.querySelectorAll('.bounding-box');
    boxes.forEach((box, index) => {
        if (state.manualMergeSelected.has(index)) {
            box.classList.add('selected');
        } else {
            box.classList.remove('selected');
        }
    });
}

// 更新手动合并计数显示
export function updateManualMergeCount() {
    const count = state.manualMergeSelected.size;
    elements.manualMergeCount.textContent = count;
    elements.mergeCount.textContent = count;
    elements.confirmMergeBtn.disabled = count < 2;
}

// ===== 自由行列：可拖拽分割线 =====
// 分割线拖动结束后触发的回调（由 app.js 注册，用于按新位置重建单元格）
let customGridChangeHandler = null;
// 分割线之间的最小间距（原图像素）
const CUSTOM_GRID_MIN_GAP = 10;
// 分割线热区宽度的一半（显示像素）
const CUSTOM_GRID_HIT_OFFSET = 4;

export function setCustomGridChangeHandler(fn) {
    customGridChangeHandler = fn;
}

// 当前选中的切图模式
function getSplitMode() {
    return document.querySelector('input[name="splitMode"]:checked')?.value || 'auto';
}

// 裁边后的有效区域（与 detection.getTrimBounds 保持一致）
function getTrimBounds() {
    const width = state.canvas.width;
    const height = state.canvas.height;
    const left = Math.max(0, Math.floor(state.trimLeft) || 0);
    const top = Math.max(0, Math.floor(state.trimTop) || 0);
    const right = Math.max(left, Math.min(width, width - Math.max(0, Math.floor(state.trimRight) || 0)));
    const bottom = Math.max(top, Math.min(height, height - Math.max(0, Math.floor(state.trimBottom) || 0)));
    return { left, top, right, bottom };
}

// 移除自由行列的分割线
export function removeCustomGridLines() {
    document.querySelectorAll('.custom-grid-line').forEach(el => el.remove());
}

// 绘制可拖拽的行列分割线
export function renderCustomGridLines() {
    if (!state.canvas) return;

    // 以画布真实渲染尺寸为准，保证线条与实际切图位置一致
    const geo = state.getCanvasDisplayGeometry();
    if (!geo) return;
    const { scaleX, scaleY, offsetX, offsetY, width: displayWidth, height: displayHeight } = geo;

    state.customColXs.forEach((x, index) => {
        const line = document.createElement('div');
        line.className = 'grid-line custom-grid-line vertical';
        line.style.left = `${offsetX + x * scaleX - CUSTOM_GRID_HIT_OFFSET}px`;
        line.style.top = `${offsetY}px`;
        line.style.width = `${CUSTOM_GRID_HIT_OFFSET * 2 + 2}px`;
        line.style.height = `${displayHeight}px`;
        attachCustomLineDrag(line, 'col', index);
        elements.canvasContainer.appendChild(line);
    });

    state.customRowYs.forEach((y, index) => {
        const line = document.createElement('div');
        line.className = 'grid-line custom-grid-line horizontal';
        line.style.left = `${offsetX}px`;
        line.style.top = `${offsetY + y * scaleY - CUSTOM_GRID_HIT_OFFSET}px`;
        line.style.width = `${displayWidth}px`;
        line.style.height = `${CUSTOM_GRID_HIT_OFFSET * 2 + 2}px`;
        attachCustomLineDrag(line, 'row', index);
        elements.canvasContainer.appendChild(line);
    });
}

// 给分割线绑定拖拽：拖动过程中只移动线本身，松手后再重建单元格
function attachCustomLineDrag(line, axis, index) {
    line.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isCol = axis === 'col';
        line.classList.add('dragging');

        const onMove = (ev) => {
            if (!state.canvas) return;

            // 以画布真实渲染尺寸为准：显示坐标(相对画布) → 原图像素坐标
            const geo = state.getCanvasDisplayGeometry();
            if (!geo) return;
            const toImage = isCol ? geo.toImageX : geo.toImageY;

            const containerRect = elements.canvasContainer.getBoundingClientRect();
            const offset = isCol
                ? ev.clientX - containerRect.left - geo.offsetX
                : ev.clientY - containerRect.top - geo.offsetY;

            const coords = isCol ? state.customColXs : state.customRowYs;
            // 夹在"裁边后的有效区域"与相邻分割线之间，保证顺序不乱且留出最小间距
            const trim = getTrimBounds();
            const areaStart = isCol ? trim.left : trim.top;
            const areaEnd = isCol ? trim.right : trim.bottom;
            // 收缩一个最小间距，避免线落到有效区域边界上而被 splitByCustomGrid 丢弃
            const innerStart = areaStart + CUSTOM_GRID_MIN_GAP;
            const innerEnd = areaEnd - CUSTOM_GRID_MIN_GAP;
            if (innerStart > innerEnd) return;
            const lower = Math.max(
                innerStart,
                index === 0 ? innerStart : coords[index - 1] + CUSTOM_GRID_MIN_GAP
            );
            const upper = Math.min(
                innerEnd,
                index === coords.length - 1
                    ? innerEnd
                    : coords[index + 1] - CUSTOM_GRID_MIN_GAP
            );
            const value = Math.max(lower, Math.min(upper, Math.round(offset * toImage)));

            const newCoords = [...coords];
            newCoords[index] = value;
            if (isCol) {
                state.setCustomColXs(newCoords);
            } else {
                state.setCustomRowYs(newCoords);
            }

            // 实时把线移动到新位置（视觉反馈）
            const base = isCol ? geo.offsetX : geo.offsetY;
            const displayPos = base + value / toImage - CUSTOM_GRID_HIT_OFFSET;
            line.style[isCol ? 'left' : 'top'] = `${displayPos}px`;
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            line.classList.remove('dragging');
            if (customGridChangeHandler) customGridChangeHandler();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}
