// 全局状态变量
export let originalImage = null;
export let processedImage = null;
export let originalFileName = '';
export let selectedItems = new Set();
export let isSelecting = false;
export let selectionStart = { x: 0, y: 0 };
export let selectionBox = null;
export let canvas = null;
export let ctx = null;
export let processedCanvas = null;
export let processedCtx = null;
export let elements = [];
export let croppedImages = [];
export let bgColor = null;
export let isPickingBgColor = false;
export let tolerance = 10;
export let smallElementTolerance = 0;
export let smallElementMergeDir = 'any';
export let originalImageData = null;
export let highlightBox = null;
export let currentHoverElement = -1;
export let maskLayer = null;
export let cropPositionRect = null;
export let isManualMergeMode = false;
export let manualMergeSelected = new Set();
export let enableEdgePadding = false;
export let edgePaddingSize = 5;
export let enableUniformSize = false;
export let uniformWidth = 0;
export let uniformHeight = 0;
export let trimTop = 0;
export let trimRight = 0;
export let trimBottom = 0;
export let trimLeft = 0;
export let enableInnerShrink = false;
export let innerShrinkSize = 1;
export let enableIsolateRemove = false;
export let enableEdgeInset = false;
export let edgeInsetSize = 2;
// 自由行列模式：分割线在原图中的像素坐标（有序）
export let customColXs = [];
export let customRowYs = [];

// Setter 函数
export function setOriginalImage(img) { originalImage = img; }
export function setProcessedImage(img) { processedImage = img; }
export function setOriginalFileName(name) { originalFileName = name; }
export function setSelectedItems(items) { selectedItems = items; }
export function setIsSelecting(val) { isSelecting = val; }
export function setSelectionStart(x, y) { selectionStart = { x, y }; }
export function setSelectionBox(box) { selectionBox = box; }
export function setCanvas(c) { canvas = c; }
export function setCtx(c) { ctx = c; }
export function setProcessedCanvas(c) { processedCanvas = c; }
export function setProcessedCtx(c) { processedCtx = c; }
export function setElements(els) { elements = els; }
export function setCroppedImages(imgs) { croppedImages = imgs; }
export function setBgColor(color) { bgColor = color; }
export function setIsPickingBgColor(val) { isPickingBgColor = val; }
export function setTolerance(val) { tolerance = val; }
export function setOriginalImageData(data) { originalImageData = data; }
export function setHighlightBox(box) { highlightBox = box; }
export function setCurrentHoverElement(index) { currentHoverElement = index; }
export function setMaskLayer(layer) { maskLayer = layer; }
export function setCropPositionRect(rect) { cropPositionRect = rect; }
export function setSmallElementTolerance(val) { smallElementTolerance = val; }
export function setSmallElementMergeDir(val) { smallElementMergeDir = val; }
export function setIsManualMergeMode(val) { isManualMergeMode = val; }
export function setManualMergeSelected(indices) { manualMergeSelected = indices; }
export function setEnableEdgePadding(val) { enableEdgePadding = val; }
export function setEdgePaddingSize(val) { edgePaddingSize = val; }
export function setEnableUniformSize(val) { enableUniformSize = val; }
export function setUniformWidth(val) { uniformWidth = val; }
export function setUniformHeight(val) { uniformHeight = val; }
export function setTrimTop(val) { trimTop = val; }
export function setTrimRight(val) { trimRight = val; }
export function setTrimBottom(val) { trimBottom = val; }
export function setTrimLeft(val) { trimLeft = val; }
export function setEnableInnerShrink(val) { enableInnerShrink = val; }
export function setInnerShrinkSize(val) { innerShrinkSize = val; }
export function setEnableEdgeInset(val) { enableEdgeInset = val; }
export function setEdgeInsetSize(val) { edgeInsetSize = val; }
export function setEnableIsolateRemove(val) { enableIsolateRemove = val; }
export function setCustomColXs(val) { customColXs = val; }
export function setCustomRowYs(val) { customRowYs = val; }

// 画布显示几何：CSS 的 max-width/max-height 会让画布实际渲染尺寸小于 style 尺寸，
// 所有叠加层定位与"显示坐标 ↔ 图像像素坐标"换算都必须以真实渲染尺寸为准。
export function getCanvasDisplayGeometry() {
    if (!canvas || !canvas.parentElement) return null;
    const rect = canvas.getBoundingClientRect();
    const containerRect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
        width: rect.width,
        height: rect.height,
        // 画布相对容器左上角的偏移（容器有边框时会有一个像素级偏移）
        offsetX: rect.left - containerRect.left,
        offsetY: rect.top - containerRect.top,
        scaleX: rect.width / canvas.width,
        scaleY: rect.height / canvas.height,
        toImageX: canvas.width / rect.width,
        toImageY: canvas.height / rect.height,
    };
}
