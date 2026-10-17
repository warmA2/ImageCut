// 元素检测模块
import * as state from './state.js';
import * as elements from './elements.js';
import * as image from './image.js';

// 最大检测尺寸，超过此尺寸会进行缩放
const MAX_DETECTION_SIZE = 2000;
// 跳步大小，用于加速检测
const STEP_SIZE = 2;

// 获取裁剪边缘后的有效区域（上/右/下/左各裁掉指定像素）
function getTrimBounds(width, height) {
    const left = Math.max(0, Math.floor(state.trimLeft) || 0);
    const top = Math.max(0, Math.floor(state.trimTop) || 0);
    const right = Math.max(left, Math.min(width, width - Math.max(0, Math.floor(state.trimRight) || 0)));
    const bottom = Math.max(top, Math.min(height, height - Math.max(0, Math.floor(state.trimBottom) || 0)));
    return { left, top, right, bottom };
}

// 对画布的非透明区域做“外延剥边”：
// 只从图形的【外轮廓】向内剥掉 pixels 像素（描边减N），
// 内部孔洞、凹陷（不与画面外部连通）不受影响，画布尺寸保持不变。
// 做法：从画布边缘洪水填充出“外部背景”，让外部区域逐轮向前景推进；
// 剥边后只对新外边缘的 1px 做羽化，核心像素 alpha 原样保留，消除锯齿。
function erodeNonTransparent(canvas, pixels) {
    const w = canvas.width;
    const h = canvas.height;
    if (!pixels || pixels <= 0 || w === 0 || h === 0) return;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const total = w * h;

    // 二值前景掩码：有可见 alpha 即视为前景
    const fg = new Uint8Array(total);
    let anyForeground = false;
    for (let p = 0; p < total; p++) {
        if (data[p * 4 + 3] >= 10) {
            fg[p] = 1;
            anyForeground = true;
        }
    }
    if (!anyForeground) return;

    // 1) 从画布四条边洪水填充（8邻域），标记与画面外部连通的背景
    const outside = new Uint8Array(total);
    const stack = [];
    for (let x = 0; x < w; x++) {
        [x, (h - 1) * w + x].forEach(p => {
            if (!fg[p] && !outside[p]) { outside[p] = 1; stack.push(p); }
        });
    }
    for (let y = 0; y < h; y++) {
        [y * w, y * w + w - 1].forEach(p => {
            if (!fg[p] && !outside[p]) { outside[p] = 1; stack.push(p); }
        });
    }
    while (stack.length) {
        const p = stack.pop();
        const px = p % w, py = (p - px) / w;
        for (let dy = -1; dy <= 1; dy++) {
            const ny = py + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = px + dx;
                if (nx < 0 || nx >= w) continue;
                const q = ny * w + nx;
                if (!fg[q] && !outside[q]) { outside[q] = 1; stack.push(q); }
            }
        }
    }

    // 2) 外部区域逐轮向前景推进 N 轮（硬剥边）和 N+1 轮（羽化边缘带）
    let cur = outside;
    let removedN = null; // 第 N 轮后被剥除的集合
    const rounds = pixels + 1;
    for (let round = 1; round <= rounds; round++) {
        const next = new Uint8Array(cur);
        for (let y = 1; y < h - 1; y++) {
            const row = y * w;
            for (let x = 1; x < w - 1; x++) {
                const p = row + x;
                if (!fg[p] || cur[p]) continue;
                if (cur[p - 1] || cur[p + 1] ||
                    cur[p - w] || cur[p - w - 1] || cur[p - w + 1] ||
                    cur[p + w] || cur[p + w - 1] || cur[p + w + 1]) {
                    next[p] = 1;
                }
            }
        }
        // 贴画布边的前景像素：其上一轮“画布外”视同外部，可被剥除
        for (let x = 0; x < w; x++) {
            [x, (h - 1) * w + x].forEach(p => { if (fg[p]) next[p] = 1; });
        }
        for (let y = 0; y < h; y++) {
            [y * w, y * w + w - 1].forEach(p => { if (fg[p]) next[p] = 1; });
        }
        cur = next;
        if (round === pixels) removedN = new Uint8Array(cur);
    }
    const removedN1 = cur;

    // 3) 硬剥边后的 alpha：被剥除=0，其余保持原始 alpha
    let changed = false;
    const hardAlpha = new Uint8ClampedArray(total);
    for (let p = 0; p < total; p++) {
        if (removedN[p]) {
            if (data[p * 4 + 3] !== 0) changed = true;
            hardAlpha[p] = 0;
        } else {
            hardAlpha[p] = data[p * 4 + 3];
        }
    }
    if (!changed) return;

    // 4) 只对“第 N+1 轮才会被剥到”的 1px 边缘带做 3×3 均值羽化；
    //    核心前景（N+1 轮仍未被触及）alpha 原样保留，不会变淡。
    const finalAlpha = new Uint8ClampedArray(hardAlpha);
    for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        for (let x = 1; x < w - 1; x++) {
            const p = row + x;
            if (!(removedN1[p] && !removedN[p])) continue;
            finalAlpha[p] = (
                hardAlpha[p] +
                hardAlpha[p - 1] + hardAlpha[p + 1] +
                hardAlpha[p - w] + hardAlpha[p - w - 1] + hardAlpha[p - w + 1] +
                hardAlpha[p + w] + hardAlpha[p + w - 1] + hardAlpha[p + w + 1]
            ) / 9;
        }
    }
    for (let p = 0; p < total; p++) data[p * 4 + 3] = finalAlpha[p];

    ctx.putImageData(imageData, 0, 0);
}

// 剔除输出画布中的孤立像素：
// 找出非透明像素的所有连通块（8邻域），只保留最大的一个（即连续的主体外轮廓），
// 其余孤立的杂点/杂色 alpha 全部置 0。画布尺寸不变。
function removeIsolatedPixels(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const total = w * h;

    const fg = new Uint8Array(total);
    let anyForeground = false;
    for (let p = 0; p < total; p++) {
        if (data[p * 4 + 3] >= 10) {
            fg[p] = 1;
            anyForeground = true;
        }
    }
    if (!anyForeground) return;

    // 连通块标记（迭代洪水填充，避免递归爆栈）
    const label = new Int32Array(total); // 0 = 未标记
    const sizes = [0]; // sizes[i] = 第 i 个连通块的像素数（下标从 1 开始）
    const stack = [];
    let count = 0;
    for (let start = 0; start < total; start++) {
        if (!fg[start] || label[start]) continue;
        count++;
        let size = 0;
        label[start] = count;
        stack.push(start);
        while (stack.length) {
            const p = stack.pop();
            size++;
            const px = p % w;
            const py = (p - px) / w;
            for (let dy = -1; dy <= 1; dy++) {
                const ny = py + dy;
                if (ny < 0 || ny >= h) continue;
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const nx = px + dx;
                    if (nx < 0 || nx >= w) continue;
                    const q = ny * w + nx;
                    if (fg[q] && !label[q]) {
                        label[q] = count;
                        stack.push(q);
                    }
                }
            }
        }
        sizes.push(size);
    }
    if (count <= 1) return; // 只有一个连通块（本身就是连续外轮廓），无需处理

    // 找到最大连通块
    let maxLabel = 1;
    for (let i = 2; i <= count; i++) {
        if (sizes[i] > sizes[maxLabel]) maxLabel = i;
    }

    // 其余连通块的 alpha 全部置 0
    let changed = false;
    for (let p = 0; p < total; p++) {
        if (fg[p] && label[p] !== maxLabel) {
            data[p * 4 + 3] = 0;
            changed = true;
        }
    }
    if (changed) ctx.putImageData(imageData, 0, 0);
}

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

// 计算两个矩形的中心距离
function getDistance(a, b) {
    const aCenterX = a.x + a.width / 2;
    const aCenterY = a.y + a.height / 2;
    const bCenterX = b.x + b.width / 2;
    const bCenterY = b.y + b.height / 2;
    return Math.sqrt(Math.pow(aCenterX - bCenterX, 2) + Math.pow(aCenterY - bCenterY, 2));
}

// 计算两个矩形的交集面积
function getIntersectionArea(a, b) {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);
    if (x2 <= x1 || y2 <= y1) return 0;
    return (x2 - x1) * (y2 - y1);
}

// 合并小元素到大图
function mergeSmallElements(elements, tolerancePercent, mergeDir) {
    if (tolerancePercent <= 0 || elements.length <= 1) {
        return elements;
    }

    // 计算每个元素的面积，并深拷贝元素
    const elementsWithArea = elements.map((el, index) => ({
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        color: el.color,
        index,
        area: el.width * el.height
    }));

    // 找到最大面积作为基准
    const maxArea = Math.max(...elementsWithArea.map(e => e.area));
    const thresholdArea = maxArea * (tolerancePercent / 100);

    // 找出小元素和大元素
    const smallElements = [];
    const largeElements = [];
    for (const el of elementsWithArea) {
        if (el.area <= thresholdArea) {
            smallElements.push(el);
        } else {
            largeElements.push(el);
        }
    }

    // 如果没有小元素或没有大元素，返回原数组
    if (smallElements.length === 0 || largeElements.length === 0) {
        return elements;
    }

    // 记录被合并的小元素索引及其对应的大元素索引
    const mergeMap = new Map();

    // 为每个小元素找到最近的大元素（使用边界框之间的边-边最短距离）
    for (const smallEl of smallElements) {
        let nearestLarge = null;

        // 计算小元素与某个大元素边界框的间距（重叠时该轴间距为0）
        const calcEdgeDist = (largeEl) => {
            const gapX = Math.max(
                0,
                smallEl.x - (largeEl.x + largeEl.width),
                largeEl.x - (smallEl.x + smallEl.width)
            );
            const gapY = Math.max(
                0,
                smallEl.y - (largeEl.y + largeEl.height),
                largeEl.y - (smallEl.y + smallEl.height)
            );
            // 边-边最短距离：两轴间距的欧氏距离
            return { gapX, gapY, dist: Math.hypot(gapX, gapY) };
        };

        // 阈值与小元素自身尺寸挂钩：碎片离大图不超过自身尺寸的2倍才算归属
        // 用整体边距（而非单轴 OR），避免同列但相距很远的元素被错误打包
        const threshold = Math.max(smallEl.width, smallEl.height) * 2;

        // 收集阈值内所有候选。方向不做事先硬过滤（否则会丢掉不同方向但相对更近的近邻），
        // 只影响排序时的距离权重：
        //   row：水平间距 gapX 为主序、垂直间距 gapY 为次序 → 越接近的越胜出
        //   col：垂直间距 gapY 为主序、水平间距 gapX 为次序
        //   any：整体欧氏距离 hypot(gapX, gapY)
        let pool = [];
        for (const largeEl of largeElements) {
            const { gapX, gapY } = calcEdgeDist(largeEl);
            if (Math.hypot(gapX, gapY) <= threshold) {
                pool.push({ largeEl, gapX, gapY });
            }
        }
        if (pool.length === 0) continue;

        pool.sort((a, b) => {
            if (mergeDir === 'row') {
                return (a.gapX - b.gapX) || (a.gapY - b.gapY);
            } else if (mergeDir === 'col') {
                return (a.gapY - b.gapY) || (a.gapX - b.gapX);
            } else {
                return Math.hypot(a.gapX, a.gapY) - Math.hypot(b.gapX, b.gapY);
            }
        });
        nearestLarge = pool[0].largeEl;

        if (nearestLarge) {
                // 硬约束：合并后大元素扩张的边界框不得触碰其他大元素，
                // 防止一个切图把旁边独立的大元素内容也包含进去
                const candLeft = Math.min(nearestLarge.x, smallEl.x);
                const candTop = Math.min(nearestLarge.y, smallEl.y);
                const candRight = Math.max(
                    nearestLarge.x + nearestLarge.width,
                    smallEl.x + smallEl.width
                );
                const candBottom = Math.max(
                    nearestLarge.y + nearestLarge.height,
                    smallEl.y + smallEl.height
                );

                let blocked = false;
                for (const other of largeElements) {
                    if (other.index === nearestLarge.index) continue;
                    const overlaps =
                        candLeft < other.x + other.width &&
                        candRight > other.x &&
                        candTop < other.y + other.height &&
                        candBottom > other.y;
                    if (overlaps) {
                        blocked = true;
                        break;
                    }
                }

            if (!blocked) {
                mergeMap.set(smallEl.index, nearestLarge.index);
            }
        }
    }

    // 如果没有任何合并，返回原数组
    if (mergeMap.size === 0) {
        return elements;
    }

    // 根据mergeMap进行合并，使用原始位置计算合并后的边界框
    const mergedLargeElements = new Map();
    
    // 先复制所有大元素到结果中
    for (const largeEl of largeElements) {
        mergedLargeElements.set(largeEl.index, {
            x: largeEl.x,
            y: largeEl.y,
            width: largeEl.width,
            height: largeEl.height,
            color: largeEl.color,
            area: largeEl.area
        });
    }

    // 对每个小元素，将其合并到对应的大元素
    for (const [smallIndex, largeIndex] of mergeMap) {
        const smallEl = elementsWithArea.find(el => el.index === smallIndex);
        const largeEl = mergedLargeElements.get(largeIndex);
        
        if (smallEl && largeEl) {
            // 先保存旧的右边界和下边界，避免 x/y 更新后计算错误
            const oldRight = largeEl.x + largeEl.width;
            const oldBottom = largeEl.y + largeEl.height;
            const smallRight = smallEl.x + smallEl.width;
            const smallBottom = smallEl.y + smallEl.height;

            // 更新左上角为两者最左最上
            largeEl.x = Math.min(largeEl.x, smallEl.x);
            largeEl.y = Math.min(largeEl.y, smallEl.y);
            // 宽度 = 最大右边界 - 最左x，高度 = 最大下边界 - 最上y
            largeEl.width = Math.max(oldRight, smallRight) - largeEl.x;
            largeEl.height = Math.max(oldBottom, smallBottom) - largeEl.y;
            largeEl.area = largeEl.width * largeEl.height;
        }
    }

    // 注意：不再合并"重叠"的大元素。
    // 原始大元素是互不重叠的独立元素，合并小元素后边界框扩张导致的重叠
    // 是因为小元素位于两个大元素之间。此时大元素仍应保持独立，
    // 否则会把两个本应分开切的元素错误合并，导致少切图片。

    // 构建最终结果
    const result = [];
    
    // 添加合并后的大元素
    for (const [, mergedEl] of mergedLargeElements) {
        result.push({
            x: mergedEl.x,
            y: mergedEl.y,
            width: mergedEl.width,
            height: mergedEl.height,
            color: mergedEl.color
        });
    }

    // 添加未被合并的小元素
    for (const smallEl of smallElements) {
        if (!mergeMap.has(smallEl.index)) {
            result.push({
                x: smallEl.x,
                y: smallEl.y,
                width: smallEl.width,
                height: smallEl.height,
                color: smallEl.color
            });
        }
    }

    // 按位置排序
    return sortElementsByPosition(result);
}

// 判断a是否在b内部
export function isInside(a, b) {
    return a.x >= b.x && a.y >= b.y &&
        (a.x + a.width) <= (b.x + b.width) &&
        (a.y + a.height) <= (b.y + b.height);
}

// 查找边界框（使用八方向搜索，但增加最小面积限制）
export function findBoundingBox(startX, startY, visited, width, height, scale) {
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;

    const stack = [[startX, startY]];
    visited[startY][startX] = true;

    // 使用四方向搜索，避免对角连接导致不应该连接的元素被合并
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
        const trim = getTrimBounds(width, height);

        // 使用跳步来加速检测（仅在裁剪边缘后的有效区域内扫描）
        for (let y = trim.top; y < trim.bottom; y += STEP_SIZE) {
            for (let x = trim.left; x < trim.right; x += STEP_SIZE) {
                // 检查当前点和相邻点
                let hasNonTransparent = false;
                for (let dy = 0; dy < STEP_SIZE && y + dy < trim.bottom; dy++) {
                    for (let dx = 0; dx < STEP_SIZE && x + dx < trim.right; dx++) {
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

                    // 限制边界框不超出裁剪边缘区域
                    const boxRight = Math.min(box.x + box.width, trim.right);
                    const boxBottom = Math.min(box.y + box.height, trim.bottom);
                    box.x = Math.max(box.x, trim.left);
                    box.y = Math.max(box.y, trim.top);
                    box.width = boxRight - box.x;
                    box.height = boxBottom - box.y;

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
        const sortedElements = sortElementsByPosition(state.elements);
        state.setElements(sortedElements);

        // 合并小元素
        if (state.smallElementTolerance > 0) {
            const mergedElements = mergeSmallElements(state.elements, state.smallElementTolerance, state.smallElementMergeDir);
            state.setElements(mergedElements);
        }

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
    const trim = getTrimBounds(width, height);
    const origTrim = getTrimBounds(originalWidth, originalHeight);

    // 使用跳步来加速检测（仅在裁剪边缘后的有效区域内扫描）
    for (let y = trim.top; y < trim.bottom; y += STEP_SIZE) {
        for (let x = trim.left; x < trim.right; x += STEP_SIZE) {
            // 检查当前点和相邻点
            let hasNonTransparent = false;
            for (let dy = 0; dy < STEP_SIZE && y + dy < trim.bottom; dy++) {
                for (let dx = 0; dx < STEP_SIZE && x + dx < trim.right; dx++) {
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

                // 在检测坐标系内限制边界框不超出裁剪边缘区域
                const boxRight = Math.min(box.x + box.width, trim.right);
                const boxBottom = Math.min(box.y + box.height, trim.bottom);
                box.x = Math.max(box.x, trim.left);
                box.y = Math.max(box.y, trim.top);
                box.width = boxRight - box.x;
                box.height = boxBottom - box.y;

                if (box.width >= 3 && box.height >= 3) {
                    // 将边界框坐标转换回原始图像尺寸
                    const scaledBox = {
                        x: Math.round(box.x * scale),
                        y: Math.round(box.y * scale),
                        width: Math.round(box.width * scale),
                        height: Math.round(box.height * scale)
                    };

                    // 确保不会超出原图边界和裁剪边缘区域
                    scaledBox.x = Math.max(origTrim.left, scaledBox.x);
                    scaledBox.y = Math.max(origTrim.top, scaledBox.y);
                    scaledBox.width = Math.min(origTrim.right - scaledBox.x, scaledBox.width);
                    scaledBox.height = Math.min(origTrim.bottom - scaledBox.y, scaledBox.height);

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
    const sortedElements = sortElementsByPosition(state.elements);
    state.setElements(sortedElements);

    // 合并小元素
    if (state.smallElementTolerance > 0) {
        const mergedElements = mergeSmallElements(state.elements, state.smallElementTolerance, state.smallElementMergeDir);
        state.setElements(mergedElements);
    }

    return state.elements;
}

// 裁剪元素
export function cropElements() {
    const sourceImage = state.processedImage || state.originalImage;

    if (!sourceImage) return;

    const cropped = [];
    const fullWidth = sourceImage.width;
    const fullHeight = sourceImage.height;

    // 计算统一输出尺寸
    let targetWidth = 0;
    let targetHeight = 0;

    if (state.enableUniformSize) {
        // 严格使用用户填写的宽高；留空(0)时才自动取最大元素尺寸
        const maxW = Math.max(...state.elements.map(el => el.width));
        const maxH = Math.max(...state.elements.map(el => el.height));
        targetWidth = state.uniformWidth > 0 ? state.uniformWidth : maxW;
        targetHeight = state.uniformHeight > 0 ? state.uniformHeight : maxH;
    }

    const getInnerElements = (outerIndex) => {
        if (!elements.excludeInner.checked) return [];
        const outerBox = state.elements[outerIndex];
        return state.elements
            .map((box, index) => ({ box, index }))
            .filter(({ box, index }) => index !== outerIndex && isInside(box, outerBox));
    };

    // 裁剪边缘后的有效区域，所有输出都不能包含被裁掉的边缘像素
    const trim = getTrimBounds(fullWidth, fullHeight);

    state.elements.forEach((box, index) => {
        const newCanvas = document.createElement('canvas');
        const newCtx = newCanvas.getContext('2d');

        // 确保坐标不会超出图像边界，并限制在裁剪边缘区域内
        const safeX = Math.max(trim.left, box.x);
        const safeY = Math.max(trim.top, box.y);
        const safeWidth = Math.min(trim.right - safeX, box.width);
        const safeHeight = Math.min(trim.bottom - safeY, box.height);

        // 元素完全落在被裁剪的边缘区域内，跳过
        if (safeWidth <= 0 || safeHeight <= 0) return;

        // 边缘内缩：裁剪区域四边各向内裁掉 N 像素，直接去掉边缘杂色
        const inset = state.enableEdgeInset ? state.edgeInsetSize : 0;
        const insetX = inset > 0 ? Math.min(inset, Math.floor((safeWidth - 1) / 2)) : 0;
        const insetY = inset > 0 ? Math.min(inset, Math.floor((safeHeight - 1) / 2)) : 0;
        const cropX = safeX + insetX;
        const cropY = safeY + insetY;
        const cropW = safeWidth - insetX * 2;
        const cropH = safeHeight - insetY * 2;

        if (state.enableUniformSize) {
            // 统一尺寸模式：创建固定尺寸 canvas，元素居中放置
            newCanvas.width = targetWidth;
            newCanvas.height = targetHeight;

            // 等比缩放（只缩小不放大，避免小图被放大模糊），完整居中显示
            const fitScale = Math.min(1, targetWidth / cropW, targetHeight / cropH);
            const drawW = Math.round(cropW * fitScale);
            const drawH = Math.round(cropH * fitScale);
            const offsetX = Math.floor((targetWidth - drawW) / 2);
            const offsetY = Math.floor((targetHeight - drawH) / 2);

            // 绘制图像到中央
            newCtx.drawImage(
                sourceImage,
                cropX, cropY, cropW, cropH,
                offsetX, offsetY, drawW, drawH
            );

            if (elements.excludeInner.checked) {
                const innerElements = getInnerElements(index);
                innerElements.forEach(({ box: innerBox }) => {
                    const innerX = offsetX + (innerBox.x - cropX) * fitScale;
                    const innerY = offsetY + (innerBox.y - cropY) * fitScale;
                    newCtx.clearRect(innerX, innerY, innerBox.width * fitScale, innerBox.height * fitScale);
                });
            }
        } else {
            // 原有的 edge padding 模式
            const padding = state.enableEdgePadding ? state.edgePaddingSize : 0;
            const newWidth = cropW + padding * 2;
            const newHeight = cropH + padding * 2;

            newCanvas.width = newWidth;
            newCanvas.height = newHeight;

            // 绘制图像到中央（边缘保持透明）
            newCtx.drawImage(
                sourceImage,
                cropX, cropY, cropW, cropH,
                padding, padding, cropW, cropH
            );

            if (elements.excludeInner.checked) {
                const innerElements = getInnerElements(index);
                innerElements.forEach(({ box: innerBox }) => {
                    const innerX = innerBox.x - cropX + padding;
                    const innerY = innerBox.y - cropY + padding;
                    newCtx.clearRect(innerX, innerY, innerBox.width, innerBox.height);
                });
            }
        }

        // 去除外延描边：把非透明图形最外圈 N 像素变透明（画布尺寸不变）
        if (state.enableInnerShrink && state.innerShrinkSize > 0) {
            erodeNonTransparent(newCanvas, state.innerShrinkSize);
        }

        // 剔除孤立像素：只保留最大的连通块（连续的主体外轮廓）
        if (state.enableIsolateRemove) {
            removeIsolatedPixels(newCanvas);
        }

        // 保存行列信息（如果有的话）
        const elementData = {
            canvas: newCanvas,
            index: index + 1,
            width: newCanvas.width,
            height: newCanvas.height
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

    // 在裁剪边缘后的有效区域内均分
    const trim = getTrimBounds(width, height);
    const effWidth = trim.right - trim.left;
    const effHeight = trim.bottom - trim.top;

    const cellWidth = Math.floor(effWidth / cols);
    const cellHeight = Math.floor(effHeight / rows);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = trim.left + col * cellWidth;
            const y = trim.top + row * cellHeight;
            const w = col === cols - 1 ? trim.right - x : cellWidth;
            const h = row === rows - 1 ? trim.bottom - y : cellHeight;

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

// 生成自由行列的默认分割线（在原图有效区域内均分）
export function initCustomGridLines(rows, cols) {
    if (!state.originalImage) return;
    const img = state.originalImage;
    const trim = getTrimBounds(img.width, img.height);
    const effWidth = trim.right - trim.left;
    const effHeight = trim.bottom - trim.top;

    const colXs = [];
    for (let i = 1; i < cols; i++) {
        colXs.push(Math.round(trim.left + (effWidth * i) / cols));
    }
    const rowYs = [];
    for (let i = 1; i < rows; i++) {
        rowYs.push(Math.round(trim.top + (effHeight * i) / rows));
    }
    state.setCustomColXs(colXs);
    state.setCustomRowYs(rowYs);
}

// 裁边变化后，把已有分割线夹回新的有效区域（保持顺序与最小间距）
export function clampCustomLinesToTrim() {
    if (!state.originalImage) return;
    const img = state.originalImage;
    const trim = getTrimBounds(img.width, img.height);
    const minGap = 10;

    const clampAxis = (coords, start, end) => {
        const innerStart = start + minGap;
        const innerEnd = end - minGap;
        if (innerStart > innerEnd) return [];
        const sorted = [...coords].sort((a, b) => a - b);
        const result = [];
        let prev = innerStart - minGap;
        for (const c of sorted) {
            const v = Math.max(innerStart, Math.min(innerEnd, Math.round(c)));
            if (v <= prev) continue;
            result.push(v);
            prev = v;
        }
        return result;
    };

    state.setCustomColXs(clampAxis(state.customColXs, trim.left, trim.right));
    state.setCustomRowYs(clampAxis(state.customRowYs, trim.top, trim.bottom));
}

// 按自由行列切图：用分割线的实际位置（原图像素坐标）构建单元格
export function splitByCustomGrid(colXs, rowYs) {
    if (!state.originalImage) return;

    const img = state.originalImage;
    const trim = getTrimBounds(img.width, img.height);

    // 只保留落在有效区域内的分割线，排序去重后与有效区域边界组成分割点
    const xs = [...colXs]
        .filter(x => x > trim.left && x < trim.right)
        .sort((a, b) => a - b)
        .filter((x, i, arr) => i === 0 || x !== arr[i - 1]);
    const ys = [...rowYs]
        .filter(y => y > trim.top && y < trim.bottom)
        .sort((a, b) => a - b)
        .filter((y, i, arr) => i === 0 || y !== arr[i - 1]);

    const xEdges = [trim.left, ...xs, trim.right];
    const yEdges = [trim.top, ...ys, trim.bottom];

    const newElements = [];
    for (let r = 0; r < yEdges.length - 1; r++) {
        for (let c = 0; c < xEdges.length - 1; c++) {
            newElements.push({
                x: xEdges[c],
                y: yEdges[r],
                width: xEdges[c + 1] - xEdges[c],
                height: yEdges[r + 1] - yEdges[r],
                color: null,
                row: r + 1,
                col: c + 1
            });
        }
    }

    state.setElements(newElements);
}

// 合并指定索引的元素
export function mergeElementsByIndices(indices) {
    if (indices.length < 2) return state.elements;

    // 获取要合并的元素
    const elementsToMerge = indices.map(index => state.elements[index]);
    
    // 计算合并后的边界框
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elementsToMerge) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
    }

    // 创建合并后的元素
    const mergedElement = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        color: null
    };

    // 从原数组中移除被合并的元素，并添加合并后的元素
    const newElements = state.elements
        .filter((_, index) => !indices.includes(index))
        .concat(mergedElement);

    // 对新元素按位置排序
    sortElementsByPosition(newElements);

    state.setElements(newElements);
    return newElements;
}

// 位置切图
export function splitByPosition(centerX, centerY, cropW, cropH) {
    if (!state.originalImage) return;

    const img = state.originalImage;
    const fullWidth = img.width;
    const fullHeight = img.height;

    // 裁剪边缘后的有效区域
    const trim = getTrimBounds(fullWidth, fullHeight);

    // 计算以点击位置为中心的矩形区域
    const halfW = cropW / 2;
    const halfH = cropH / 2;

    // 计算矩形左上角坐标
    let x = centerX - halfW;
    let y = centerY - halfH;

    // 确保不超出有效区域边界
    x = Math.max(trim.left, Math.min(x, trim.right - cropW));
    y = Math.max(trim.top, Math.min(y, trim.bottom - cropH));

    // 如果裁剪尺寸大于有效区域尺寸，调整尺寸
    const actualW = Math.min(cropW, trim.right - trim.left);
    const actualH = Math.min(cropH, trim.bottom - trim.top);

    const newElements = [{
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(actualW),
        height: Math.round(actualH),
        color: null
    }];

    state.setElements(newElements);
}
