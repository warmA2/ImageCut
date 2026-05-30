// 选择和批量操作模块
import * as state from './state.js';
import * as elements from './elements.js';
import * as ui from './ui.js';

// 全选
export function selectAll() {
    document.querySelectorAll('.preview-item').forEach((item, index) => {
        const checkbox = item.querySelector('.checkbox');
        const checkboxCustom = item.querySelector('.checkbox-custom');
        if (!state.selectedItems.has(index)) {
            ui.toggleSelect(index, item, checkbox, checkboxCustom);
        }
    });
}

// 反选
export function selectInverse() {
    document.querySelectorAll('.preview-item').forEach((item, index) => {
        const checkbox = item.querySelector('.checkbox');
        const checkboxCustom = item.querySelector('.checkbox-custom');
        ui.toggleSelect(index, item, checkbox, checkboxCustom);
    });
}

// 清除选择
export function clearSelection() {
    document.querySelectorAll('.preview-item').forEach((item, index) => {
        if (state.selectedItems.has(index)) {
            const checkbox = item.querySelector('.checkbox');
            const checkboxCustom = item.querySelector('.checkbox-custom');
            ui.toggleSelect(index, item, checkbox, checkboxCustom);
        }
    });
}

// 处理批选开始
export function handlePreviewGridMouseDown(e) {
    if (!elements.enableBatchSelect.checked) return;
    if (e.target.classList.contains('preview-item') || e.target.closest('.preview-item')) return;

    state.setIsSelecting(true);
    const rect = elements.previewGrid.getBoundingClientRect();
    state.setSelectionStart(e.clientX - rect.left, e.clientY - rect.top);

    state.setSelectionBox(document.createElement('div'));
    state.selectionBox.className = 'selection-box';
    state.selectionBox.style.left = state.selectionStart.x + 'px';
    state.selectionBox.style.top = state.selectionStart.y + 'px';
    state.selectionBox.style.width = '0px';
    state.selectionBox.style.height = '0px';
    elements.previewGrid.appendChild(state.selectionBox);
}

// 处理批选移动
export function handlePreviewGridMouseMove(e) {
    if (!state.isSelecting || !state.selectionBox) return;

    const rect = elements.previewGrid.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const left = Math.min(state.selectionStart.x, currentX);
    const top = Math.min(state.selectionStart.y, currentY);
    const width = Math.abs(currentX - state.selectionStart.x);
    const height = Math.abs(currentY - state.selectionStart.y);

    state.selectionBox.style.left = left + 'px';
    state.selectionBox.style.top = top + 'px';
    state.selectionBox.style.width = width + 'px';
    state.selectionBox.style.height = height + 'px';
}

// 处理批选结束
export function handlePreviewGridMouseUp() {
    if (!state.isSelecting || !state.selectionBox) return;

    const boxRect = state.selectionBox.getBoundingClientRect();
    const gridRect = elements.previewGrid.getBoundingClientRect();

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
            ui.toggleSelect(index, item, checkbox, checkboxCustom);
        }
    });

    state.selectionBox.remove();
    state.setSelectionBox(null);
    state.setIsSelecting(false);
}

// 处理批选离开
export function handlePreviewGridMouseLeave() {
    if (state.isSelecting && state.selectionBox) {
        state.selectionBox.remove();
        state.setSelectionBox(null);
        state.setIsSelecting(false);
    }
}
