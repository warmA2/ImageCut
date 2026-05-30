// 主入口文件
import * as state from './state.js';
import * as elements from './elements.js';
import * as image from './image.js';
import * as detection from './detection.js';
import * as ui from './ui.js';
import * as selection from './selection.js';
import * as download from './download.js';

// 更新行列分割线预览
function updateGridPreview() {
    if (!state.canvas) return;

    // 清除旧的分割线
    document.querySelectorAll('.grid-line').forEach(el => el.remove());

    const rows = parseInt(elements.gridRows.value) || 2;
    const cols = parseInt(elements.gridCols.value) || 2;

    const canvasRect = state.canvas.getBoundingClientRect();
    const containerRect = elements.canvasContainer.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;
    const displayWidth = canvasRect.width;
    const displayHeight = canvasRect.height;
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

// 更新位置切图预览框
function updateCropPositionPreview() {
    if (!state.canvas || !state.cropPositionRect) return;

    // 清除旧的预览框
    document.querySelectorAll('.crop-position-box').forEach(el => el.remove());

    const cropW = parseInt(elements.cropWidth?.value) || 200;
    const cropH = parseInt(elements.cropHeight?.value) || 200;

    const canvasRect = state.canvas.getBoundingClientRect();
    const containerRect = elements.canvasContainer.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // 计算显示尺寸（将像素尺寸转换为显示尺寸）
    const scaleX = canvasRect.width / state.canvas.width;
    const scaleY = canvasRect.height / state.canvas.height;
    
    const displayCropW = cropW * scaleX;
    const displayCropH = cropH * scaleY;
    
    // 计算预览框位置（以点击位置为中心）
    const displayCenterX = state.cropPositionRect.displayX;
    const displayCenterY = state.cropPositionRect.displayY;
    
    let boxLeft = displayCenterX - displayCropW / 2;
    let boxTop = displayCenterY - displayCropH / 2;
    
    // 确保不超出canvas边界
    boxLeft = Math.max(0, Math.min(boxLeft, canvasRect.width - displayCropW));
    boxTop = Math.max(0, Math.min(boxTop, canvasRect.height - displayCropH));

    // 创建预览框
    const box = document.createElement('div');
    box.className = 'crop-position-box';
    box.style.left = `${offsetX + boxLeft}px`;
    box.style.top = `${offsetY + boxTop}px`;
    box.style.width = `${displayCropW}px`;
    box.style.height = `${displayCropH}px`;
    
    // 添加尺寸标签
    const label = document.createElement('div');
    label.className = 'crop-position-label';
    label.textContent = `${cropW} × ${cropH}`;
    box.appendChild(label);
    
    elements.canvasContainer.appendChild(box);
}

// 初始化事件绑定
function initEventListeners() {
    // 切图模式切换
    document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            elements.gridInputs.style.display = e.target.value === 'grid' ? 'flex' : 'none';
            elements.positionInputs.style.display = e.target.value === 'position' ? 'flex' : 'none';
            
            // 清除旧的边界框
            document.querySelectorAll('.bounding-box').forEach(el => el.remove());
            document.querySelectorAll('.grid-line').forEach(el => el.remove());
            document.querySelectorAll('.crop-position-box').forEach(el => el.remove());
            state.setCropPositionRect(null);
            
            // 切换模式时更新分割线预览
            if (e.target.value === 'grid' && state.canvas) {
                updateGridPreview();
            }
            
            // 位置切图模式时更新鼠标样式
            if (e.target.value === 'position' && state.canvas) {
                elements.canvasContainer.style.cursor = 'crosshair';
            } else {
                elements.canvasContainer.style.cursor = '';
            }
        });
    });

    // 行列输入变化时实时更新分割线预览
    elements.gridRows.addEventListener('input', () => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked');
        if (splitMode && splitMode.value === 'grid' && state.canvas) {
            updateGridPreview();
        }
    });

    elements.gridCols.addEventListener('input', () => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked');
        if (splitMode && splitMode.value === 'grid' && state.canvas) {
            updateGridPreview();
        }
    });

    // 位置切图尺寸输入变化时更新预览框
    elements.cropWidth.addEventListener('input', () => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked');
        if (splitMode && splitMode.value === 'position' && state.cropPositionRect) {
            updateCropPositionPreview();
        }
    });

    elements.cropHeight.addEventListener('input', () => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked');
        if (splitMode && splitMode.value === 'position' && state.cropPositionRect) {
            updateCropPositionPreview();
        }
    });

    // 去除背景色开关
    elements.enableBgRemove.addEventListener('change', (e) => {
        elements.bgColorPanel.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) {
            state.setBgColor(null);
            elements.bgColorPreview.style.display = 'none';
            elements.removeBgBtn.disabled = true;
            elements.pickBgColorBtn.textContent = '选择背景色';
            elements.canvasContainer.style.cursor = '';
            elements.canvasContainer.removeEventListener('click', image.pickBgColorFromCanvas);
            state.setIsPickingBgColor(false);
            if (state.originalImageData) {
                state.ctx.putImageData(state.originalImageData, 0, 0);
                state.setOriginalImageData(null);
            }
            elements.previewBgRemove.checked = false;
        }
    });

    // 容差滑块
    elements.toleranceSlider.addEventListener('input', (e) => {
        state.setTolerance(parseInt(e.target.value));
        elements.toleranceValue.textContent = state.tolerance;
        if (elements.previewBgRemove.checked && state.bgColor) {
            image.applyBgRemovePreview();
        }
    });

    // 预览背景去除
    elements.previewBgRemove.addEventListener('change', (e) => {
        if (!state.originalImage || !state.bgColor) {
            elements.previewBgRemove.checked = false;
            return;
        }

        if (e.target.checked) {
            state.setOriginalImageData(state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height));
            image.applyBgRemovePreview();
        } else {
            if (state.originalImageData) {
                state.ctx.putImageData(state.originalImageData, 0, 0);
                state.setOriginalImageData(null);
            }
        }
    });

    // 上传区域
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });
    elements.uploadArea.addEventListener('dragleave', () => elements.uploadArea.classList.remove('dragover'));
    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) image.processFile(files[0]);
    });

    // 文件选择
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) image.processFile(e.target.files[0]);
    });

    // 显示边界框切换
    elements.showBoundingBox.addEventListener('change', ui.toggleBoundingBoxes);

    // Canvas容器鼠标移动
    elements.canvasContainer.addEventListener('mousemove', (e) => {
        if (!state.canvas || state.elements.length === 0) return;

        const rect = state.canvas.getBoundingClientRect();
        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;
        
        // 总是需要转换坐标，因为canvas显示尺寸和像素尺寸不同
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        const x = displayX * scaleX;
        const y = displayY * scaleY;

        for (let i = 0; i < state.elements.length; i++) {
            const element = state.elements[i];
            if (x >= element.x && x <= element.x + element.width &&
                y >= element.y && y <= element.y + element.height) {
                if (state.currentHoverElement !== i) {
                    state.setCurrentHoverElement(i);
                    if (elements.enablePositionSync.checked) {
                        ui.highlightPreviewItem(i);
                    }
                }
                return;
            }
        }

        if (state.currentHoverElement !== -1) {
            state.setCurrentHoverElement(-1);
            ui.unhighlightPreviewItem();
        }
    });

    // Canvas容器鼠标离开
    elements.canvasContainer.addEventListener('mouseleave', () => {
        if (state.currentHoverElement !== -1) {
            state.setCurrentHoverElement(-1);
            ui.unhighlightPreviewItem();
        }
    });

    // Canvas容器点击（位置切图模式）
    elements.canvasContainer.addEventListener('click', (e) => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;
        if (splitMode !== 'position' || !state.canvas) return;
        
        // 如果正在选择背景色，不处理位置切图
        if (state.isPickingBgColor) return;

        const rect = state.canvas.getBoundingClientRect();
        const displayX = e.clientX - rect.left;
        const displayY = e.clientY - rect.top;
        
        // 转换坐标到canvas像素坐标
        const scaleX = state.canvas.width / rect.width;
        const scaleY = state.canvas.height / rect.height;
        const centerX = displayX * scaleX;
        const centerY = displayY * scaleY;

        // 保存点击位置
        state.setCropPositionRect({
            centerX,
            centerY,
            displayX,
            displayY
        });

        // 显示预览框
        updateCropPositionPreview();
    });

    // 开始切图
    elements.startBtn.addEventListener('click', async () => {
        document.querySelectorAll('.bounding-box').forEach(el => el.remove());
        document.querySelectorAll('.grid-line').forEach(el => el.remove());
        elements.previewGrid.innerHTML = '<div class="empty-state" style="grid-column: span 2;"><i>⏳</i><p>正在处理中...</p></div>';

        state.selectedItems.clear();
        ui.updateSelectedCount();
        
        // 清除旧的图像数据缓存
        image.clearCachedImageData();

        const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;

        if (splitMode === 'grid') {
            const rows = parseInt(elements.gridRows?.value) || 2;
            const cols = parseInt(elements.gridCols?.value) || 2;
            detection.splitByGrid(rows, cols);
        } else if (splitMode === 'position') {
            if (!state.cropPositionRect) {
                alert('请先点击图片选择切图位置');
                return;
            }
            const cropW = parseInt(elements.cropWidth?.value) || 200;
            const cropH = parseInt(elements.cropHeight?.value) || 200;
            detection.splitByPosition(
                state.cropPositionRect.centerX,
                state.cropPositionRect.centerY,
                cropW,
                cropH
            );
        } else {
            detection.findElements();
        }

        if (state.elements.length === 0) {
            elements.previewGrid.innerHTML = '<div class="empty-state" style="grid-column: span 2;"><i>😕</i><p>未检测到元素</p></div>';
            alert('未检测到元素');
            return;
        }

        ui.drawBoundingBoxes();
        detection.cropElements();
        ui.updatePreviewGrid();

        elements.downloadBtn.disabled = false;

        const hasImages = state.croppedImages.length > 0;
        elements.selectAllBtn.disabled = !elements.enableBatchSelect.checked || !hasImages;
        elements.selectInverseBtn.disabled = !elements.enableBatchSelect.checked || !hasImages;
        elements.clearSelectionBtn.disabled = !elements.enableBatchSelect.checked || !hasImages;
    });

    // 下载全部
    elements.downloadBtn.addEventListener('click', download.downloadAll);

    // 清除
    elements.clearBtn.addEventListener('click', () => {
        elements.canvasContainer.innerHTML = '<div class="empty-state"><i>🖼️</i><p>请先上传图片</p></div>';
        elements.previewGrid.innerHTML = '<div class="empty-state" style="grid-column: span 2;"><i>👆</i><p>上传图片后开始切图</p></div>';
        elements.stats.style.display = 'none';
        elements.startBtn.disabled = true;
        elements.downloadBtn.disabled = true;
        elements.clearBtn.disabled = true;
        state.setOriginalImage(null);
        state.setCanvas(null);
        state.setCtx(null);
        state.setElements([]);
        state.setCroppedImages([]);
        elements.fileInput.value = '';
    });

    // 大小滑块
    elements.sizeSlider.addEventListener('input', (e) => {
        const size = e.target.value;
        elements.sizeValue.textContent = size + 'px';
        document.querySelectorAll('.preview-item img').forEach(img => {
            img.style.maxWidth = size + 'px';
            img.style.maxHeight = size + 'px';
        });
    });

    // 批量选择切换
    elements.enableBatchSelect.addEventListener('change', (e) => {
        const visible = e.target.checked;
        const hasImages = state.croppedImages.length > 0;
        elements.selectAllBtn.disabled = !visible || !hasImages;
        elements.selectInverseBtn.disabled = !visible || !hasImages;
        elements.clearSelectionBtn.disabled = !visible || !hasImages;

        document.querySelectorAll('.preview-item').forEach(item => {
            ui.updateCheckboxVisibility(item, visible);
        });
        if (!visible) {
            state.selectedItems.clear();
            ui.updateSelectedCount();
            document.querySelectorAll('.preview-item').forEach(item => {
                item.classList.remove('selected');
                const checkboxCustom = item.querySelector('.checkbox-custom');
                if (checkboxCustom) checkboxCustom.classList.remove('checked');
            });
        }
    });

    // 全选
    elements.selectAllBtn.addEventListener('click', selection.selectAll);
    // 反选
    elements.selectInverseBtn.addEventListener('click', selection.selectInverse);
    // 清除选择
    elements.clearSelectionBtn.addEventListener('click', selection.clearSelection);

    // 预览网格
    elements.previewGrid.addEventListener('mousedown', selection.handlePreviewGridMouseDown);
    elements.previewGrid.addEventListener('mousemove', selection.handlePreviewGridMouseMove);
    elements.previewGrid.addEventListener('mouseup', selection.handlePreviewGridMouseUp);
    elements.previewGrid.addEventListener('mouseleave', selection.handlePreviewGridMouseLeave);

    // 批量下载
    elements.batchDownloadBtn.addEventListener('click', download.batchDownload);

    // 清除（第二个）
    elements.clearBtn.addEventListener('click', () => {
        state.selectedItems.clear();
        ui.updateSelectedCount();
        state.setBgColor(null);
        elements.bgColorPreview.style.display = 'none';
        state.setProcessedImage(null);
        state.setProcessedCanvas(null);
        elements.removeBgBtn.disabled = true;
        elements.previewBgRemove.checked = false;
        state.setOriginalImageData(null);
        elements.canvasContainer.innerHTML = '';
        state.setCanvas(null);
        state.setCtx(null);
        state.setOriginalImage(null);
        elements.stats.style.display = 'none';
        elements.previewGrid.innerHTML = '';
        elements.previewCount.textContent = '0';
        elements.startBtn.disabled = true;
        elements.downloadBtn.disabled = true;
    });

    // 选择背景色
    elements.pickBgColorBtn.addEventListener('click', () => {
        if (!state.originalImage) {
            alert('请先上传图片');
            return;
        }

        state.setIsPickingBgColor(!state.isPickingBgColor);
        elements.pickBgColorBtn.textContent = state.isPickingBgColor ? '取消选择' : '选择背景色';

        if (state.isPickingBgColor) {
            elements.pickBgColorBtn.classList.add('btn-warning');
            elements.canvasContainer.style.cursor = 'crosshair';
            elements.canvasContainer.addEventListener('click', image.pickBgColorFromCanvas);
        } else {
            elements.pickBgColorBtn.classList.remove('btn-warning');
            elements.canvasContainer.style.cursor = '';
            elements.canvasContainer.removeEventListener('click', image.pickBgColorFromCanvas);
        }

        elements.removeBgBtn.disabled = state.isPickingBgColor || !state.bgColor;
    });

    // 去除背景
    elements.removeBgBtn.addEventListener('click', () => {
        if (!state.originalImage || !state.bgColor) return;
        image.removeBgFromImage();
    });
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', initEventListeners);
