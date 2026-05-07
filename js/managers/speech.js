/**
 * ============================================================
 * SpeechManager - 语音播报管理
 * ============================================================
 *
 * 用途：基于 Web Speech API 的语音播报管理器。
 *       支持中文语音自动选择、语速/音调调节、手机端语音解锁、
 *       播放队列管理等功能。
 *
 * 依赖：无外部依赖（仅使用浏览器原生 Web Speech API）
 * ============================================================
 */

'use strict';

/* ============================================================
   SpeechManager 类
   ============================================================ */
class SpeechManager {
    constructor() {
        this.synth = window.speechSynthesis || null;
        this.enabled = true;
        this.rate = 1.0;       // 语速（0.5 ~ 2.0）
        this.pitch = 1.0;      // 音调（0.5 ~ 2.0）
        this.volume = 1.0;     // 音量（0 ~ 1.0）
        this.lang = 'zh-CN';   // 语言
        this._currentUtterance = null;
        this.isSpeaking = false;  // 全局播报状态（供语音识别模块检查）
        this._speechUnlocked = false;  // 手机端语音是否已解锁
        this._pendingQueue = [];  // 待播放队列
        this._unlockSpeech();  // 尝试解锁语音
        this._initVoices();    // 预加载语音列表
    }

    /**
     * 预加载语音列表（手机端 voices 异步加载）
     */
    _initVoices() {
        if (!this.synth) return;
        this._loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this._loadVoices();
        }
    }

    _loadVoices() {
        this._voices = this.synth.getVoices();
        if (this._voices.length > 0) {
            this._zhVoice = this._voices.find(v => v.lang.startsWith('zh')) || null;
            console.log('[语音播报] 已加载 ' + this._voices.length + ' 个语音，中文语音: ' + (this._zhVoice ? this._zhVoice.name : '无'));
        }
    }

    /**
     * 解锁手机端语音
     */
    _unlockSpeech() {
        if (this._speechUnlocked) return;
        const unlock = () => {
            if (this.synth && !this._speechUnlocked) {
                this._speechUnlocked = true;
                console.log('[语音播报] 语音已解锁');
                // 播放队列中暂存的文本
                while (this._pendingQueue.length > 0) {
                    const item = this._pendingQueue.shift();
                    this._doSpeak(item.text, item.options);
                }
            }
        };
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
        document.addEventListener('touchend', unlock, { once: true });
    }

    /**
     * 朗读文本
     */
    speak(text, options = {}) {
        if (!this.synth || !this.enabled) return;

        // 手机端语音未解锁时，加入队列等待
        if (!this._speechUnlocked && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            // 只保留最后一条（避免积压太多）
            this._pendingQueue = [{ text, options }];
            console.log('[语音播报] 等待用户交互解锁语音...');
            return;
        }

        this._doSpeak(text, options);
    }

    /**
     * 实际执行语音播报
     */
    _doSpeak(text, options = {}) {
        // 取消当前正在播放的
        this.synth.cancel();

        this.isSpeaking = true;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.lang;
        utterance.rate = options.rate ?? this.rate;
        utterance.pitch = options.pitch ?? this.pitch;
        utterance.volume = this.volume;

        // 设置中文语音
        if (this._zhVoice) {
            utterance.voice = this._zhVoice;
        }

        utterance.onend = () => {
            this.isSpeaking = false;
            if (options.onEnd) options.onEnd();
        };

        utterance.onerror = (e) => {
            this.isSpeaking = false;
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
                console.warn('[语音播报] 出错:', e.error);
            }
            // 确保 onEnd 回调被调用，避免调用方状态泄漏
            if (options.onEnd) {
                try { options.onEnd(); } catch (cbErr) { console.warn('[语音播报] onEnd回调出错:', cbErr); }
            }
        };

        this._currentUtterance = utterance;
        this.synth.speak(utterance);
    }

    /**
     * 停止当前朗读
     */
    stop() {
        if (this.synth) {
            this.synth.cancel();
        }
        this._currentUtterance = null;
        this.isSpeaking = false;
    }

    /**
     * 切换语音开关
     * @returns {boolean} 切换后的状态
     */
    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stop();
        }
        return this.enabled;
    }

    /**
     * 更新语速
     * @param {number} rate - 新语速
     */
    setRate(rate) {
        this.rate = Math.max(0.5, Math.min(2.0, rate));
    }

    /**
     * 更新音调
     * @param {number} pitch - 新音调
     */
    setPitch(pitch) {
        this.pitch = Math.max(0.5, Math.min(2.0, pitch));
    }
}

export { SpeechManager };
