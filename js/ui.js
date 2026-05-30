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
    if (!elements.showBoundingBox.checked) return;
    if (!state.canvas) return;

    const canvasRect = state.canvas.getBoundingClientRect();
    const containerRect = elements.canvasContainer.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // 判断是否是行列切图模式
    const isGridMode = state.elements.length > 0 && state.elements[0].row !== undefined;

    // 计算缩放比例 - canvas的显示尺寸 vs 实际像素尺寸
    const displayWidth = canvasRect.width;
    const displayHeight = canvasRect.height;
    const scaleX = displayWidth / state.canvas.width;
    const scaleY = displayHeight / state.canvas.height;

    if (isGridMode) {
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
        
        // 所有模式下都使用缩放后的坐标
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
            const canvasRect = state.canvas.getBoundingClientRect();
            const containerRect = elements.canvasContainer.getBoundingClientRect();
            const offsetX = canvasRect.left - containerRect.left;
            const offsetY = canvasRect.top - containerRect.top;
            
            // 计算缩放比例
            const displayWidth = canvasRect.width;
            const displayHeight = canvasRect.height;
            const scaleX = displayWidth / state.canvas.width;
            const scaleY = displayHeight / state.canvas.height;

            state.setHighlightBox(document.createElement('div'));
            state.highlightBox.className = 'highlight-box';
            
            // 使用缩放后的坐标
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

// 更新预览网格
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

        previewItem.appendChild(checkbox);
        previewItem.appendChild(checkboxCustom);
        previewItem.appendChild(img);
        previewItem.appendChild(previewInfo);

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
