/**
 * ============================================================
 * CameraManager - 摄像头权限与视频流管理
 * ============================================================
 *
 * 用途：管理摄像头权限请求、视频流启停、Canvas 帧捕获。
 *       支持前后摄像头切换（根据当前模式自动选择），
 *       提供友好的权限错误提示。
 *
 * 依赖：需要宿主环境提供 $ 工具函数（安全获取 DOM 元素）
 *       在 app.js 中通过 import 后由 AccessibilityApp 传入 app 实例
 * ============================================================
 */

'use strict';

/**
 * 安全获取 DOM 元素（局部定义，避免循环依赖）
 * @param {string} selector - CSS 选择器
 * @param {Element} [parent=document] - 父元素
 * @returns {Element|null}
 */
function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/* ============================================================
   CameraManager 类
   ============================================================ */
class CameraManager {
    constructor(app) {
        this._app = app;
        this.stream = null;
        this.videoElement = null;
        this.canvasElement = null;
        this.ctx = null;
        this._isActive = false;
    }

    /**
     * 初始化摄像头
     * @param {string} videoId - video 元素 ID
     * @param {string} canvasId - canvas 元素 ID
     * @returns {Promise<boolean>} 是否成功
     */
    async init(videoId = 'camera-video', canvasId = 'camera-canvas') {
        this.videoElement = $(`#${videoId}`);
        this.canvasElement = $(`#${canvasId}`);

        if (this.canvasElement) {
            this.ctx = this.canvasElement.getContext('2d');
        }

        return this.start();
    }

    /**
     * 请求摄像头权限并启动视频流
     * @returns {Promise<boolean>}
     */
    async start() {
        try {
            // 请求摄像头权限
            // 根据当前模式选择摄像头：手势识别用前置（用户看自己的手），视障辅助用后置
            const facingMode = (this._app && this._app._currentMode === 'blind' && this._app._isMobile)
                ? 'environment'
                : 'user';
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: this._app._isMobile ? 480 : 640 },
                    height: { ideal: this._app._isMobile ? 360 : 480 },
                },
                audio: false,
            });

            if (this.videoElement && this.stream) {
                this.videoElement.srcObject = this.stream;
                await this.videoElement.play();
                this._isActive = true;

                // 同步 canvas 尺寸
                this._syncCanvasSize();

                return true;
            }
        } catch (error) {
            console.error('[摄像头] 启动失败:', error);

            // 根据错误类型给出友好提示
            if (error.name === 'NotAllowedError') {
                throw new Error('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头。');
            } else if (error.name === 'NotFoundError') {
                throw new Error('未检测到摄像头设备，请确认设备已正确连接。');
            } else if (error.name === 'NotReadableError') {
                throw new Error('摄像头被其他应用占用，请关闭其他使用摄像头的程序后重试。');
            } else {
                throw new Error(`摄像头启动失败：${error.message}`);
            }
        }
        return false;
    }

    /**
     * 同步 canvas 尺寸与视频尺寸
     */
    _syncCanvasSize() {
        if (this.videoElement && this.canvasElement) {
            const updateSize = () => {
                this.canvasElement.width = this.videoElement.videoWidth || 640;
                this.canvasElement.height = this.videoElement.videoHeight || 480;
            };
            updateSize();

            // 视频元数据加载后再次同步
            this.videoElement.addEventListener('loadedmetadata', updateSize, { once: true });
        }
    }

    /**
     * 停止摄像头
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        this._isActive = false;
    }

    /**
     * 获取当前帧图像数据
     * @returns {ImageData|null}
     */
    getCurrentFrame() {
        if (!this.ctx || !this.videoElement || !this._isActive) return null;

        this.ctx.drawImage(this.videoElement, 0, 0);
        return this.ctx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    /**
     * 获取 canvas 2D 上下文
     * @returns {CanvasRenderingContext2D|null}
     */
    getContext() {
        return this.ctx;
    }

    /**
     * 摄像头是否活跃
     * @returns {boolean}
     */
    isActive() {
        return this._isActive;
    }
}

export { CameraManager };
