// 元素检测模块
import * as state from './state.js';
import * as elements from './elements.js';
import * as image from './image.js';

// 最大检测尺寸，超过此尺寸会进行缩放
const MAX_DETECTION_SIZE = 2000;
// 跳步大小，用于加速检测
const STEP_SIZE = 2;

// 按从左到右、从上到下排序元素
function sortElementsByPosition(elements) {
    return elements.sort((a, b) => {
        // 先按y坐标排序（从上到下）
        // 使用元素的中心点y坐标进行比较，更准确
        const aCenterY = a.y + a.height / 2;
        const bCenterY = b.y + b.height / 2;
        
        // 如果y坐标差距小于元素高度的一半，认为在同一行
        const yThreshold = Math.min(a.height, b.height) / 2;
        
        if (Math.abs(aCenterY - bCenterY) > yThreshold) {
            return aCenterY - bCenterY;
        }
        
        // 同一行则按x坐标排序（从左到右）
        return a.x - b.x;
    });
}

// 判断a是否在b内部
export function isInside(a, b) {
    return a.x >= b.x && a.y >= b.y &&
        (a.x + a.width) <= (b.x + b.width) &&
        (a.y + a.height) <= (b.y + b.height);
}

// 查找边界框
export function findBoundingBox(startX, startY, visited, width, height, scale) {
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
                if (!visited[ny][nx] && !image.isTransparent(nx, ny, scale)) {
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

// 查找元素
export function findElements() {
    const sourceCanvas = state.processedCanvas || state.canvas;
    if (!sourceCanvas) return;

    // 先缓存图像数据，避免重复调用 getImageData
    image.cacheImageData();

    // 对于超大图像，进行缩放处理
    let detectionScale = 1;
    let detectionWidth = sourceCanvas.width;
    let detectionHeight = sourceCanvas.height;
    
    // 如果图片很大，创建缩放后的canvas进行检测
    if (sourceCanvas.width > MAX_DETECTION_SIZE || sourceCanvas.height > MAX_DETECTION_SIZE) {
        detectionScale = Math.min(
            MAX_DETECTION_SIZE / sourceCanvas.width,
            MAX_DETECTION_SIZE / sourceCanvas.height
        );
        detectionWidth = Math.floor(sourceCanvas.width * detectionScale);
        detectionHeight = Math.floor(sourceCanvas.height * detectionScale);
        
        // 创建缩放后的canvas
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = detectionWidth;
        scaledCanvas.height = detectionHeight;
        const scaledCtx = scaledCanvas.getContext('2d');
        scaledCtx.drawImage(sourceCanvas, 0, 0, detectionWidth, detectionHeight);
        
        // 临时保存原始数据，切换到缩放canvas
        const originalCanvas = sourceCanvas;
        const originalCtx = state.processedCtx || state.ctx;
        
        // 更新临时状态
        state.setProcessedCanvas(scaledCanvas);
        state.setProcessedCtx(scaledCtx);
        
        // 清除旧缓存，重新缓存缩放后的数据
        image.clearCachedImageData();
        image.cacheImageData();
        
        // 检测完成后恢复
        try {
            const result = findElementsWithScale(detectionScale, originalCanvas.width, originalCanvas.height);
            return result;
        } finally {
            state.setProcessedCanvas(originalCanvas);
            state.setProcessedCtx(originalCtx);
            image.clearCachedImageData();
        }
    } else {
        // 普通模式：直接检测
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const visited = Array(height).fill(null).map(() => Array(width).fill(false));
        const foundElements = [];
        
        // 使用跳步来加速检测
        for (let y = 0; y < height; y += STEP_SIZE) {
            for (let x = 0; x < width; x += STEP_SIZE) {
                // 检查当前点和相邻点
                let hasNonTransparent = false;
                for (let dy = 0; dy < STEP_SIZE && y + dy < height; dy++) {
                    for (let dx = 0; dx < STEP_SIZE && x + dx < width; dx++) {
                        if (!visited[y + dy][x + dx] && !image.isTransparent(x + dy, y + dy, 1)) {
                            hasNonTransparent = true;
                            break;
                        }
                    }
                    if (hasNonTransparent) break;
                }
                
                if (hasNonTransparent) {
                    // 找到边界框
                    const box = findBoundingBox(x, y, visited, width, height, 1);

                    if (box.width >= 3 && box.height >= 3) {
                        foundElements.push(box);
                    }
                }
            }
        }

        if (elements.excludeInner.checked) {
            const innerElements = new Set();
            for (let i = 0; i < foundElements.length; i++) {
                for (let j = 0; j < foundElements.length; j++) {
                    if (i !== j && isInside(foundElements[i], foundElements[j])) {
                        innerElements.add(i);
                    }
                }
            }

            const outerElements = foundElements.filter((_, index) => !innerElements.has(index));
            const filteredInnerElements = [];

            for (const index of innerElements) {
                let isContainedByInner = false;
                for (const otherIndex of innerElements) {
                    if (index !== otherIndex && isInside(foundElements[index], foundElements[otherIndex])) {
                        isContainedByInner = true;
                        break;
                    }
                }
                if (!isContainedByInner) {
                    filteredInnerElements.push(foundElements[index]);
                }
            }

            state.setElements([...outerElements, ...filteredInnerElements]);
        } else {
            state.setElements(foundElements);
        }

        // 对元素进行排序
        sortElementsByPosition(state.elements);

        return state.elements;
    }
}

// 使用缩放查找元素的内部函数
function findElementsWithScale(detectionScale, originalWidth, originalHeight) {
    const detectionCanvas = state.processedCanvas || state.canvas;
    if (!detectionCanvas) return;

    const scale = originalWidth / detectionCanvas.width;
    const width = detectionCanvas.width;
    const height = detectionCanvas.height;

    const visited = Array(height).fill(null).map(() => Array(width).fill(false));
    const foundElements = [];

    // 使用跳步来加速检测
    for (let y = 0; y < height; y += STEP_SIZE) {
        for (let x = 0; x < width; x += STEP_SIZE) {
            // 检查当前点和相邻点
            let hasNonTransparent = false;
            for (let dy = 0; dy < STEP_SIZE && y + dy < height; dy++) {
                for (let dx = 0; dx < STEP_SIZE && x + dx < width; dx++) {
                    if (!visited[y + dy][x + dx] && !image.isTransparent(x + dx, y + dy, scale)) {
                        hasNonTransparent = true;
                        break;
                    }
                }
                if (hasNonTransparent) break;
            }
            
            if (hasNonTransparent) {
                // 找到边界框（使用完整搜索）
                const box = findBoundingBox(x, y, visited, width, height, scale);

                if (box.width >= 3 && box.height >= 3) {
                    // 将边界框坐标转换回原始图像尺寸
                    const scaledBox = {
                        x: Math.round(box.x * scale),
                        y: Math.round(box.y * scale),
                        width: Math.round(box.width * scale),
                        height: Math.round(box.height * scale)
                    };
                    
                    // 确保不会超出原图边界
                    scaledBox.x = Math.max(0, scaledBox.x);
                    scaledBox.y = Math.max(0, scaledBox.y);
                    scaledBox.width = Math.min(originalWidth - scaledBox.x, scaledBox.width);
                    scaledBox.height = Math.min(originalHeight - scaledBox.y, scaledBox.height);
                    
                    foundElements.push(scaledBox);
                }
            }
        }
    }

    if (elements.excludeInner.checked) {
        const innerElements = new Set();

        for (let i = 0; i < foundElements.length; i++) {
            for (let j = 0; j < foundElements.length; j++) {
                if (i !== j && isInside(foundElements[i], foundElements[j])) {
                    innerElements.add(i);
                }
            }
        }

        const outerElements = foundElements.filter((_, index) => !innerElements.has(index));
        const filteredInnerElements = [];

        for (const index of innerElements) {
            let isContainedByInner = false;
            for (const otherIndex of innerElements) {
                if (index !== otherIndex && isInside(foundElements[index], foundElements[otherIndex])) {
                    isContainedByInner = true;
                    break;
                }
            }
            if (!isContainedByInner) {
                filteredInnerElements.push(foundElements[index]);
            }
        }

        state.setElements([...outerElements, ...filteredInnerElements]);
    } else {
        state.setElements(foundElements);
    }

    // 对元素进行排序
    sortElementsByPosition(state.elements);

    return state.elements;
}

// 裁剪元素
export function cropElements() {
    const sourceImage = state.processedImage || state.originalImage;

    if (!sourceImage) return;

    const cropped = [];
    const fullWidth = sourceImage.width;
    const fullHeight = sourceImage.height;

    const getInnerElements = (outerIndex) => {
        if (!elements.excludeInner.checked) return [];
        const outerBox = state.elements[outerIndex];
        return state.elements
            .map((box, index) => ({ box, index }))
            .filter(({ box, index }) => index !== outerIndex && isInside(box, outerBox));
    };

    state.elements.forEach((box, index) => {
        const newCanvas = document.createElement('canvas');
        const newCtx = newCanvas.getContext('2d');

        // 确保坐标不会超出图像边界
        const safeX = Math.max(0, box.x);
        const safeY = Math.max(0, box.y);
        const safeWidth = Math.min(fullWidth - safeX, box.width);
        const safeHeight = Math.min(fullHeight - safeY, box.height);

        newCanvas.width = safeWidth;
        newCanvas.height = safeHeight;

        newCtx.drawImage(
            sourceImage,
            safeX, safeY, safeWidth, safeHeight,
            0, 0, safeWidth, safeHeight
        );

        if (elements.excludeInner.checked) {
            const innerElements = getInnerElements(index);
            innerElements.forEach(({ box: innerBox }) => {
                // 内部元素坐标是相对于外框的
                const innerX = innerBox.x - safeX;
                const innerY = innerBox.y - safeY;
                const innerW = innerBox.width;
                const innerH = innerBox.height;
                newCtx.clearRect(innerX, innerY, innerW, innerH);
            });
        }

        // 保存行列信息（如果有的话）
        const elementData = {
            canvas: newCanvas,
            index: index + 1,
            width: safeWidth,
            height: safeHeight
        };
        if (box.row !== undefined && box.col !== undefined) {
            elementData.row = box.row;
            elementData.col = box.col;
        }
        
        cropped.push(elementData);
    });
    
    state.setCroppedImages(cropped);
}

// 按行列均分切图
export function splitByGrid(rows, cols) {
    if (!state.originalImage) return;

    const newElements = [];
    const img = state.originalImage;
    const width = img.width;
    const height = img.height;

    const cellWidth = Math.floor(width / cols);
    const cellHeight = Math.floor(height / rows);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * cellWidth;
            const y = row * cellHeight;
            const w = col === cols - 1 ? width - x : cellWidth;
            const h = row === rows - 1 ? height - y : cellHeight;

            newElements.push({
                x,
                y,
                width: w,
                height: h,
                color: null,
                row: row + 1,
                col: col + 1
            });
        }
    }
    
    state.setElements(newElements);
}

// 位置切图
export function splitByPosition(centerX, centerY, cropW, cropH) {
    if (!state.originalImage) return;

    const img = state.originalImage;
    const fullWidth = img.width;
    const fullHeight = img.height;

    // 计算以点击位置为中心的矩形区域
    const halfW = cropW / 2;
    const halfH = cropH / 2;

    // 计算矩形左上角坐标
    let x = centerX - halfW;
    let y = centerY - halfH;

    // 确保不超出图像边界
    x = Math.max(0, Math.min(x, fullWidth - cropW));
    y = Math.max(0, Math.min(y, fullHeight - cropH));

    // 如果裁剪尺寸大于图像尺寸，调整尺寸
    const actualW = Math.min(cropW, fullWidth);
    const actualH = Math.min(cropH, fullHeight);

    const newElements = [{
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(actualW),
        height: Math.round(actualH),
        color: null
    }];

    state.setElements(newElements);
}
