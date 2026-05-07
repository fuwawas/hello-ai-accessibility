/**
 * ============================================================
 * SettingsManager - 无障碍偏好设置管理
 * ============================================================
 *
 * 用途：管理用户的无障碍偏好设置（高对比度、大字体、语音参数等）。
 *       设置自动持久化到 localStorage，支持读取、更新、批量更新和重置。
 *
 * 依赖：无外部依赖（仅使用浏览器原生 localStorage API）
 * ============================================================
 */

'use strict';

/* ============================================================
   SettingsManager 类
   ============================================================ */
class SettingsManager {
    constructor() {
        this.storageKey = 'hello-ai-accessibility-settings';
        this.defaults = {
            highContrast: false,    // 高对比度模式
            largeFont: false,       // 大字体模式
            speechEnabled: true,    // 语音播报开关
            speechRate: 1.0,        // 语音语速
            speechPitch: 1.0,       // 语音音调
            lastMode: null,         // 上次使用的模式
        };
        this.settings = this._load();
    }

    /**
     * 从 localStorage 加载设置
     * @returns {Object} 用户设置
     */
    _load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                return { ...this.defaults, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('[设置管理] 加载设置失败:', e);
        }
        return { ...this.defaults };
    }

    /**
     * 保存设置到 localStorage
     */
    _save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('[设置管理] 保存设置失败:', e);
        }
    }

    /**
     * 获取指定设置项
     * @param {string} key - 设置项名称
     * @returns {*} 设置值
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * 更新设置项
     * @param {string} key - 设置项名称
     * @param {*} value - 设置值
     */
    set(key, value) {
        this.settings[key] = value;
        this._save();
    }

    /**
     * 批量更新设置
     * @param {Object} updates - 要更新的键值对
     */
    update(updates) {
        Object.assign(this.settings, updates);
        this._save();
    }

    /**
     * 重置为默认设置
     */
    reset() {
        this.settings = { ...this.defaults };
        this._save();
    }
}

export { SettingsManager };
