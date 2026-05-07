/**
 * ============================================================
 * 共享 DOM 与图像工具函数
 * ============================================================
 */

'use strict';

/**
 * 安全获取 DOM 元素
 * @param {string} selector - CSS 选择器
 * @param {Element} [parent=document] - 父元素
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * 安全获取所有 DOM 元素
 * @param {string} selector - CSS 选择器
 * @param {Element} [parent=document] - 父元素
 * @returns {Element[]}
 */
export function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}

/**
 * 计算 RGB 像素的感知亮度（ITU-R BT.601 标准）
 * @param {number} r - 红色通道 (0-255)
 * @param {number} g - 绿色通道 (0-255)
 * @param {number} b - 蓝色通道 (0-255)
 * @returns {number} 亮度值 (0-255)
 */
export function calcBrightness(r, g, b) {
    return r * 0.299 + g * 0.587 + b * 0.114;
}

// 复用 canvas 避免内存泄漏
let _frameCanvas = null;
let _frameCtx = null;

/**
 * 从视频元素捕获一帧画面（复用 canvas 减少 GC 压力）
 * @param {HTMLVideoElement} video - 视频元素
 * @param {number} width - 捕获宽度
 * @param {number} height - 捕获高度
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, width: number, height: number } | null}
 */
export function getVideoFrame(video, width = 320, height = 240) {
    if (!video) return null;
    if (!_frameCanvas) {
        _frameCanvas = document.createElement('canvas');
        _frameCtx = _frameCanvas.getContext('2d');
    }
    if (_frameCanvas.width !== width || _frameCanvas.height !== height) {
        _frameCanvas.width = width;
        _frameCanvas.height = height;
    }
    _frameCtx.drawImage(video, 0, 0, width, height);
    const imageData = _frameCtx.getImageData(0, 0, width, height);
    return { canvas: _frameCanvas, ctx: _frameCtx, imageData, width, height };
}

/**
 * 获取亮度等级描述
 * @param {number} brightness - 亮度值 (0-255)
 * @returns {{ level: string, desc: string }}
 */
export function getBrightnessLevel(brightness) {
    if (brightness > 200) return { level: '非常亮', desc: '当前场景非常明亮，可能是在户外或光线充足的环境中。' };
    if (brightness > 150) return { level: '明亮', desc: '当前场景光线充足。' };
    if (brightness > 100) return { level: '适中', desc: '当前场景光线适中，室内正常照明环境。' };
    if (brightness > 50) return { level: '较暗', desc: '当前场景较暗，建议开启更多照明。' };
    return { level: '非常暗', desc: '当前场景非常暗，请注意安全，建议开启照明。' };
}

/**
 * 计算图像数据的平均亮度
 * @param {Uint8ClampedArray} data - ImageData.data
 * @param {number} [stride=16] - 采样步长
 * @returns {number} 平均亮度 (0-255)
 */
export function avgBrightness(data, stride = 16) {
    let total = 0, count = 0;
    for (let i = 0; i < data.length; i += stride) {
        total += calcBrightness(data[i], data[i + 1], data[i + 2]);
        count++;
    }
    return count > 0 ? Math.round(total / count) : 0;
}
