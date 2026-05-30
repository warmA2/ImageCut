// 图像处理模块
import * as state from './state.js';
import * as elements from './elements.js';

// 预加载的图像数据，避免重复调用 getImageData
let cachedImageData = null;
let cachedWidth = 0;
let cachedHeight = 0;

// 缓存图像数据
export function cacheImageData() {
    const sourceCtx = state.processedCtx || state.ctx;
    if (!sourceCtx) return;
    
    const width = sourceCtx.canvas.width;
    const height = sourceCtx.canvas.height;
    cachedImageData = sourceCtx.getImageData(0, 0, width, height);
    cachedWidth = width;
    cachedHeight = height;
}

// 清除缓存
export function clearCachedImageData() {
    cachedImageData = null;
}

// 获取像素颜色（使用缓存数据）
export function getPixelColor(x, y, scale = 1) {
    if (!cachedImageData) {
        cacheImageData();
    }
    
    if (!cachedImageData) return { r: 0, g: 0, b: 0, a: 0 };
    
    const idx = (y * cachedWidth + x) * 4;
    return {
        r: cachedImageData.data[idx],
        g: cachedImageData.data[idx + 1],
        b: cachedImageData.data[idx + 2],
        a: cachedImageData.data[idx + 3]
    };
}

// 判断是否透明（使用缓存数据）
export function isTransparent(x, y, scale = 1) {
    if (!cachedImageData) {
        cacheImageData();
    }
    
    if (!cachedImageData) return true;
    
    const idx = (y * cachedWidth + x) * 4;
    const a = cachedImageData.data[idx + 3];

    if (a < 128) {
        return true;
    }

    if (state.bgColor) {
        const r = cachedImageData.data[idx];
        const g = cachedImageData.data[idx + 1];
        const b = cachedImageData.data[idx + 2];
        
        if (Math.abs(r - state.bgColor.r) < state.tolerance &&
            Math.abs(g - state.bgColor.g) < state.tolerance &&
            Math.abs(b - state.bgColor.b) < state.tolerance) {
            return true;
        }
    }

    return false;
}

// 显示图片
export function displayImage(img) {
    elements.canvasContainer.innerHTML = '';

    state.setCanvas(document.createElement('canvas'));
    state.setCtx(state.canvas.getContext('2d'));

    // 使用图片原始尺寸，但有最大限制
    const maxDisplayWidth = 560; // 左侧面板最大宽度 - padding
    const maxDisplayHeight = 600;
    
    let displayWidth = img.width;
    let displayHeight = img.height;

    // 如果图片过大，则按比例缩放
    if (img.width > maxDisplayWidth || img.height > maxDisplayHeight) {
        const ratio = Math.min(maxDisplayWidth / img.width, maxDisplayHeight / img.height);
        displayWidth = Math.floor(img.width * ratio);
        displayHeight = Math.floor(img.height * ratio);
    }

    // 设置canvas的显示尺寸（CSS尺寸）
    state.canvas.style.width = `${displayWidth}px`;
    state.canvas.style.height = `${displayHeight}px`;
    
    // 设置canvas的实际像素尺寸为原始尺寸
    state.canvas.width = img.width;
    state.canvas.height = img.height;
    
    state.ctx.drawImage(img, 0, 0);
    elements.canvasContainer.appendChild(state.canvas);

    elements.stats.style.display = 'flex';
}

// 处理文件上传
export async function processFile(file) {
    if (!file.type.startsWith('image/png')) {
        alert('请上传PNG格式图片');
        return;
    }

    state.setOriginalFileName(file.name.replace(/\.[^/.]+$/, ''));

    const img = new Image();
    img.onload = () => {
        state.setOriginalImage(img);
        displayImage(img);
        elements.startBtn.disabled = false;
        elements.clearBtn.disabled = false;
        elements.downloadBtn.disabled = true;
        elements.imageSize.textContent = `${img.width} × ${img.height}`;
    };
    img.src = URL.createObjectURL(file);
}

// 从Canvas上选择背景色
export function pickBgColorFromCanvas(e) {
    if (!state.ctx || !state.isPickingBgColor) return;

    const rect = state.canvas.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    
    // 转换坐标到canvas像素坐标
    const scaleX = state.canvas.width / rect.width;
    const scaleY = state.canvas.height / rect.height;
    const x = Math.floor(displayX * scaleX);
    const y = Math.floor(displayY * scaleY);

    const imageData = state.ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;

    state.setBgColor({
        r: data[0],
        g: data[1],
        b: data[2],
        a: data[3]
    });

    updateBgColorPreview();
    state.setIsPickingBgColor(false);
    elements.pickBgColorBtn.textContent = '选择背景色';
    elements.pickBgColorBtn.classList.remove('btn-warning');
    elements.pickBgColorBtn.classList.add('btn-small');
    elements.canvasContainer.style.cursor = '';
    elements.canvasContainer.removeEventListener('click', pickBgColorFromCanvas);
    elements.removeBgBtn.disabled = false;

    if (elements.previewBgRemove.checked) {
        if (!state.originalImageData) {
            state.setOriginalImageData(state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height));
        }
        applyBgRemovePreview();
    }
}

// 更新背景色预览
export function updateBgColorPreview() {
    if (state.bgColor) {
        elements.bgColorPreview.innerHTML = `
            <span>背景色:</span>
            <div class="color-box" style="background: rgba(${state.bgColor.r}, ${state.bgColor.g}, ${state.bgColor.b}, ${state.bgColor.a / 255})"></div>
            <span>(${state.bgColor.r}, ${state.bgColor.g}, ${state.bgColor.b})</span>
        `;
        elements.bgColorPreview.style.display = 'flex';
    } else {
        elements.bgColorPreview.style.display = 'none';
    }
}

// 获取背景去除模式
export function getBgRemoveMode() {
    const radios = document.querySelectorAll('input[name="bgRemoveMode"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'edge';
}

// 应用背景去除预览
export function applyBgRemovePreview() {
    if (!state.canvas || !state.ctx || !state.bgColor) return;

    // 清除旧的图像数据缓存
    clearCachedImageData();

    if (state.originalImageData) {
        state.ctx.putImageData(state.originalImageData, 0, 0);
    }

    const width = state.canvas.width;
    const height = state.canvas.height;
    const imageData = state.ctx.getImageData(0, 0, width, height);
    const mode = getBgRemoveMode();
    const processedData = removeBgColor(imageData, width, height, mode);
    state.ctx.putImageData(processedData, 0, 0);
}

// 去除背景
export function removeBgFromImage() {
    if (!state.canvas || !state.ctx) return;

    // 清除旧的图像数据缓存
    clearCachedImageData();

    const width = state.canvas.width;
    const height = state.canvas.height;

    const imageData = state.ctx.getImageData(0, 0, width, height);
    const mode = getBgRemoveMode();
    const processedData = removeBgColor(imageData, width, height, mode);
    state.ctx.putImageData(processedData, 0, 0);

    const newProcessedImage = new Image();
    newProcessedImage.src = state.canvas.toDataURL('image/png');
    state.setProcessedImage(newProcessedImage);

    if (state.originalImageData) {
        state.setOriginalImageData(null);
    }
    elements.previewBgRemove.checked = false;
}

// 去除背景色
export function removeBgColor(imageData, width, height, mode = 'edge') {
    if (!state.bgColor) return imageData;

    const data = imageData.data;
    const currentTolerance = state.tolerance;

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

            if (Math.abs(r - state.bgColor.r) < currentTolerance &&
                Math.abs(g - state.bgColor.g) < currentTolerance &&
                Math.abs(b - state.bgColor.b) < currentTolerance) {
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

            if (Math.abs(r - state.bgColor.r) < currentTolerance &&
                Math.abs(g - state.bgColor.g) < currentTolerance &&
                Math.abs(b - state.bgColor.b) < currentTolerance) {
                data[i + 3] = 0;
            }
        }
    }

    return imageData;
}
