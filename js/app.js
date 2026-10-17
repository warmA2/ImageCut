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

    const geo = state.getCanvasDisplayGeometry();
    if (!geo) return;
    const { offsetX, offsetY, width: displayWidth, height: displayHeight } = geo;
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

// 自由行列：按新位置重建单元格并重绘分割线/边界框
function applyCustomGrid() {
    document.querySelectorAll('.bounding-box').forEach(el => el.remove());
    document.querySelectorAll('.grid-line').forEach(el => el.remove());
    detection.splitByCustomGrid(state.customColXs, state.customRowYs);
    ui.drawBoundingBoxes();
}

// 自由行列：按当前行/列数重置为均分分割线
function resetCustomGrid() {
    const rows = parseInt(elements.gridRows?.value) || 2;
    const cols = parseInt(elements.gridCols?.value) || 2;
    detection.initCustomGridLines(rows, cols);
    applyCustomGrid();
}

// 自由行列：裁边变化后把已有分割线夹回有效区域并重建单元格
function onTrimChange() {
    if (!state.canvas) return;
    const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;
    if (splitMode !== 'custom') return;
    detection.clampCustomLinesToTrim();
    applyCustomGrid();
}

// 更新位置切图预览框
function updateCropPositionPreview() {
    if (!state.canvas || !state.cropPositionRect) return;

    // 清除旧的预览框
    document.querySelectorAll('.crop-position-box').forEach(el => el.remove());

    const cropW = parseInt(elements.cropWidth?.value) || 200;
    const cropH = parseInt(elements.cropHeight?.value) || 200;

    // 以画布真实渲染尺寸为准（坐标存的是相对画布的显示坐标，这里补上画布在容器内的偏移）
    const geo = state.getCanvasDisplayGeometry();
    if (!geo) return;
    const { scaleX, scaleY, offsetX, offsetY, width: displayWidth, height: displayHeight } = geo;

    // 计算显示尺寸（将像素尺寸转换为显示尺寸）
    const displayCropW = cropW * scaleX;
    const displayCropH = cropH * scaleY;
    
    // 计算预览框位置（以点击位置为中心）
    const displayCenterX = offsetX + state.cropPositionRect.displayX;
    const displayCenterY = offsetY + state.cropPositionRect.displayY;
    
    let boxLeft = displayCenterX - displayCropW / 2;
    let boxTop = displayCenterY - displayCropH / 2;
    
    // 确保不超出canvas边界
    boxLeft = Math.max(offsetX, Math.min(boxLeft, offsetX + displayWidth - displayCropW));
    boxTop = Math.max(offsetY, Math.min(boxTop, offsetY + displayHeight - displayCropH));

    // 创建预览框
    const box = document.createElement('div');
    box.className = 'crop-position-box';
    box.style.left = `${boxLeft}px`;
    box.style.top = `${boxTop}px`;
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
    // 自由行列分割线拖动结束后重建单元格
    ui.setCustomGridChangeHandler(applyCustomGrid);

    // 切图模式切换
    document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            elements.gridInputs.style.display = (mode === 'grid' || mode === 'custom') ? 'flex' : 'none';
            elements.customGridHint.style.display = mode === 'custom' ? 'block' : 'none';
            elements.positionInputs.style.display = mode === 'position' ? 'flex' : 'none';
            elements.autoDetectionOptions.style.display = mode === 'auto' ? 'block' : 'none';
            
            // 清除旧的边界框
            document.querySelectorAll('.bounding-box').forEach(el => el.remove());
            document.querySelectorAll('.grid-line').forEach(el => el.remove());
            document.querySelectorAll('.crop-position-box').forEach(el => el.remove());
            state.setCropPositionRect(null);
            
            // 切换模式时更新分割线预览
            if (mode === 'grid' && state.canvas) {
                updateGridPreview();
            }

            // 自由行列：按当前行列数重置分割线，并重建单元格
            if (mode === 'custom' && state.canvas) {
                resetCustomGrid();
            }
            
            // 位置切图模式时更新鼠标样式
            if (mode === 'position' && state.canvas) {
                elements.canvasContainer.style.cursor = 'crosshair';
            } else {
                elements.canvasContainer.style.cursor = '';
            }
        });
    });

    // 小元素容忍度滑块
    elements.smallElementTolerance.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        state.setSmallElementTolerance(value);
        elements.smallElementToleranceValue.textContent = value + '%';        
        // 如果已有检测结果，根据当前模式重新处理
        if (state.canvas && state.elements.length > 0) {
            // 清除旧的边界框和分割线
            document.querySelectorAll('.bounding-box').forEach(el => el.remove());
            document.querySelectorAll('.grid-line').forEach(el => el.remove());
            
            // 根据当前选中的切图模式重新处理
            const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;
            if (splitMode === 'grid') {
                // 行列切图模式 - 重新调用行列切图
                const rows = parseInt(elements.gridRows?.value) || 2;
                const cols = parseInt(elements.gridCols?.value) || 2;
                detection.splitByGrid(rows, cols);
            } else if (splitMode === 'custom') {
                // 自由行列模式 - 按分割线位置重建单元格
                detection.splitByCustomGrid(state.customColXs, state.customRowYs);
            } else if (splitMode === 'position') {
                // 位置切图模式 - 重新调用位置切图
                if (state.cropPositionRect) {
                    const cropW = parseInt(elements.cropWidth?.value) || 200;
                    const cropH = parseInt(elements.cropHeight?.value) || 200;
                    detection.splitByPosition(
                        state.cropPositionRect.centerX,
                        state.cropPositionRect.centerY,
                        cropW,
                        cropH
                    );
                }
            } else {
                // 自动检测模式 - 重新调用自动检测
                detection.findElements();
            }
            
            ui.drawBoundingBoxes();
        }
    });

    // 小元素合并方向
    elements.smallElementMergeDir.addEventListener('change', (e) => {
        state.setSmallElementMergeDir(e.target.value);
        // 如果已有检测结果，重新处理以应用新方向
        if (state.canvas && state.elements.length > 0) {
            const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;
            if (splitMode === 'grid') {
                const rows = parseInt(elements.gridRows?.value) || 2;
                const cols = parseInt(elements.gridCols?.value) || 2;
                detection.splitByGrid(rows, cols);
            } else if (splitMode === 'custom') {
                detection.splitByCustomGrid(state.customColXs, state.customRowYs);
            } else if (splitMode !== 'position') {
                detection.findElements();
            }
        }
    });

    // 边缘透明像素开关
    elements.enableEdgePadding.addEventListener('change', (e) => {
        state.setEnableEdgePadding(e.target.checked);
    });

    // 边缘透明像素大小滑块
    elements.edgePaddingSize.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        state.setEdgePaddingSize(value);
        elements.edgePaddingValue.textContent = value + 'px';
    });

    // 统一输出尺寸开关
    elements.enableUniformSize.addEventListener('change', (e) => {
        state.setEnableUniformSize(e.target.checked);
        elements.uniformSizeInputs.style.display = e.target.checked ? 'inline-flex' : 'none';
    });

    // 统一输出尺寸宽度输入
    elements.uniformWidth.addEventListener('input', (e) => {
        state.setUniformWidth(parseInt(e.target.value) || 0);
    });

    // 统一输出尺寸高度输入
    elements.uniformHeight.addEventListener('input', (e) => {
        state.setUniformHeight(parseInt(e.target.value) || 0);
    });

    // 裁剪边缘像素输入（上/右/下/左）
    elements.trimTop.addEventListener('input', (e) => {
        state.setTrimTop(Math.max(0, parseInt(e.target.value) || 0));
        onTrimChange();
    });
    elements.trimRight.addEventListener('input', (e) => {
        state.setTrimRight(Math.max(0, parseInt(e.target.value) || 0));
        onTrimChange();
    });
    elements.trimBottom.addEventListener('input', (e) => {
        state.setTrimBottom(Math.max(0, parseInt(e.target.value) || 0));
        onTrimChange();
    });
    elements.trimLeft.addEventListener('input', (e) => {
        state.setTrimLeft(Math.max(0, parseInt(e.target.value) || 0));
        onTrimChange();
    });

    // 去除外延描边开关
    elements.enableInnerShrink.addEventListener('change', (e) => {
        state.setEnableInnerShrink(e.target.checked);
        elements.innerShrinkInputs.style.display = e.target.checked ? 'inline-flex' : 'none';
    });

    // 收缩像素输入
    elements.innerShrinkSize.addEventListener('input', (e) => {
        state.setInnerShrinkSize(Math.max(1, parseInt(e.target.value) || 1));
    });

    // 边缘内缩开关
    elements.enableEdgeInset.addEventListener('change', (e) => {
        state.setEnableEdgeInset(e.target.checked);
        elements.edgeInsetInputs.style.display = e.target.checked ? 'inline-flex' : 'none';
    });

    // 边缘内缩像素输入
    elements.edgeInsetSize.addEventListener('input', (e) => {
        state.setEdgeInsetSize(Math.max(1, parseInt(e.target.value) || 1));
    });

    // 剔除孤立像素开关
    elements.enableIsolateRemove.addEventListener('change', (e) => {
        state.setEnableIsolateRemove(e.target.checked);
    });

    // 分组说明展开/收起（只影响说明，不影响控件）
    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('.option-toggle');
        if (!toggle) return;
        const group = toggle.closest('.option-group');
        if (!group) return;
        const expanded = group.classList.toggle('expanded');
        toggle.textContent = expanded ? '收起说明' : '展开说明';
    });

    // 行列输入变化时实时更新分割线预览
    elements.gridRows.addEventListener('input', () => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked');
        if (!splitMode || !state.canvas) return;
        if (splitMode.value === 'grid') {
            updateGridPreview();
        } else if (splitMode.value === 'custom') {
            resetCustomGrid();
        }
    });

    elements.gridCols.addEventListener('input', () => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked');
        if (!splitMode || !state.canvas) return;
        if (splitMode.value === 'grid') {
            updateGridPreview();
        } else if (splitMode.value === 'custom') {
            resetCustomGrid();
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

        // 以画布真实渲染尺寸为准换算显示坐标 → 图像像素坐标
        const geo = state.getCanvasDisplayGeometry();
        if (!geo) return;
        const containerRect = elements.canvasContainer.getBoundingClientRect();
        const displayX = e.clientX - containerRect.left - geo.offsetX;
        const displayY = e.clientY - containerRect.top - geo.offsetY;

        const x = displayX * geo.toImageX;
        const y = displayY * geo.toImageY;

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

    // Canvas容器点击
    elements.canvasContainer.addEventListener('click', (e) => {
        const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;
        
        // 如果正在选择背景色，不处理点击
        if (state.isPickingBgColor) return;

        // 手动合并模式优先处理
        if (state.isManualMergeMode) {
            // 找到被点击的边界框
            const boxes = document.querySelectorAll('.bounding-box');
            for (let i = 0; i < boxes.length; i++) {
                const box = boxes[i];
                const rect = box.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    // 切换选中状态
                    if (state.manualMergeSelected.has(i)) {
                        state.manualMergeSelected.delete(i);
                    } else {
                        state.manualMergeSelected.add(i);
                    }
                    ui.updateManualMergeSelection();
                    ui.updateManualMergeCount();
                    return;
                }
            }
            return;
        }

        // 位置切图模式
        if (splitMode !== 'position' || !state.canvas) return;

        // 以画布真实渲染尺寸为准换算坐标
        const geo = state.getCanvasDisplayGeometry();
        if (!geo) return;
        const containerRect = elements.canvasContainer.getBoundingClientRect();
        const displayX = e.clientX - containerRect.left - geo.offsetX;
        const displayY = e.clientY - containerRect.top - geo.offsetY;

        const centerX = displayX * geo.toImageX;
        const centerY = displayY * geo.toImageY;

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
        } else if (splitMode === 'custom') {
            // 自由行列：分割线可能还没初始化（例如直接上传后切图）
            if (state.customColXs.length === 0 && state.customRowYs.length === 0) {
                const rows = parseInt(elements.gridRows?.value) || 2;
                const cols = parseInt(elements.gridCols?.value) || 2;
                detection.initCustomGridLines(rows, cols);
            }
            detection.splitByCustomGrid(state.customColXs, state.customRowYs);
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
            elements.elementCount.textContent = '0';
            elements.previewCount.textContent = '0';
            alert('未检测到元素');
            return;
        }

        // 更新元素数量显示
        elements.elementCount.textContent = state.elements.length;
        elements.previewCount.textContent = state.elements.length;

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

    // 手动合并按钮
    elements.manualMergeBtn.addEventListener('click', () => {
        if (state.elements.length < 2) {
            alert('请先进行切图，至少需要2个元素才能合并');
            return;
        }
        
        state.setIsManualMergeMode(true);
        state.setManualMergeSelected(new Set());
        elements.manualMergeControls.style.display = 'block';
        elements.manualMergeBtn.style.display = 'none';
        ui.updateManualMergeCount();
        ui.updateManualMergeSelection();
        
        // 更新右侧预览区域的提示
        if (state.elements.length > 0) {
            ui.drawBoundingBoxes();
        }
    });

    // 确认合并按钮
    elements.confirmMergeBtn.addEventListener('click', () => {
        if (state.manualMergeSelected.size < 2) {
            alert('请至少选择2个元素进行合并');
            return;
        }

        // 执行合并
        const indices = Array.from(state.manualMergeSelected).sort((a, b) => b - a);
        detection.mergeElementsByIndices(indices);

        // 退出手动合并模式
        state.setIsManualMergeMode(false);
        state.setManualMergeSelected(new Set());
        elements.manualMergeControls.style.display = 'none';
        elements.manualMergeBtn.style.display = 'block';

        // 更新UI
        ui.drawBoundingBoxes();
        elements.elementCount.textContent = state.elements.length;
        elements.previewCount.textContent = state.elements.length;

        alert('合并成功！');
    });

    // 取消合并按钮
    elements.cancelMergeBtn.addEventListener('click', () => {
        state.setIsManualMergeMode(false);
        state.setManualMergeSelected(new Set());
        elements.manualMergeControls.style.display = 'none';
        elements.manualMergeBtn.style.display = 'block';
        ui.updateManualMergeSelection();
    });

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
