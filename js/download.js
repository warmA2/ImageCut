// 下载模块
import * as state from './state.js';

// 下载全部
export async function downloadAll() {
    const zip = new JSZip();

    state.croppedImages.forEach((item) => {
        const dataUrl = item.canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        zip.file(`${state.originalFileName}_${item.index}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${state.originalFileName}_elements.zip`;
    link.click();
}

// 批量下载选中
export async function batchDownload() {
    if (state.selectedItems.size === 0) return;

    const zip = new JSZip();

    state.selectedItems.forEach(index => {
        const item = state.croppedImages[index];
        const dataUrl = item.canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        zip.file(`${state.originalFileName}_${item.index}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${state.originalFileName}_selected.zip`;
    link.click();
}
