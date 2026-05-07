/**
 * ============================================================
 * ToastManager - 通知提示管理
 * ============================================================
 *
 * 用途：管理应用内的轻量级通知提示（Toast 消息）。
 *       支持不同类型（info / success / error），
 *       自动定时消失，带淡出动画。
 *
 * 依赖：无外部依赖
 * ============================================================
 */

'use strict';

/* ============================================================
   ToastManager 类
   ============================================================ */
class ToastManager {
    constructor(containerId = 'toast-container') {
        this.container = document.getElementById(containerId);
        this.queue = [];
    }

    /**
     * 显示通知提示
     * @param {string} message - 提示消息
     * @param {'info'|'success'|'error'} [type='info'] - 提示类型
     * @param {number} [duration=3000] - 显示时长（毫秒）
     */
    show(message, type = 'info', duration = 3000) {
        if (!this.container) return;

        // 限制同时显示的 toast 数量
        while (this.container.children.length >= 5) {
            this.container.removeChild(this.container.firstChild);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');

        this.container.appendChild(toast);

        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

export { ToastManager };
