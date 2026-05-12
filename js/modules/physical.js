/** @module physical 肢体障碍辅助模块 */
/**
 * ============================================================
 * 肢体障碍辅助模块
 * 语音控制、命令执行、帮助播报
 * ============================================================
 */

'use strict';

import { $ } from '../utils/dom.js';

export const physicalMethods = {

    /**
     * 启动语音识别控制
     */
    _physicalStartVoiceControl() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.toast.show('您的浏览器不支持语音识别，建议使用 Chrome 浏览器', 'error', 5000);
            this.speech.speak('抱歉，您的浏览器不支持语音识别功能。请使用 Chrome 浏览器，或者点击下方按钮手动操作。');
            const statusEl = $('#voice-status-text');
            if (statusEl) statusEl.textContent = '浏览器不支持语音识别，请使用 Chrome';
            const waveEl = $('#voice-wave');
            if (waveEl) waveEl.style.display = 'none';
            return;
        }

        // 延迟启动，确保内联脚本的 recognition 已完全停止
        setTimeout(() => {
            console.log('[语音控制] 开始初始化语音识别...');
            this._initPhysicalRecognition(SpeechRecognition);
        }, 500);
    },

    _initPhysicalRecognition(SpeechRecognition) {
        this._physicalRecognition = new SpeechRecognition();
        this._physicalRecognition.lang = 'zh-CN';
        this._physicalRecognition.continuous = true;
        this._physicalRecognition.interimResults = true;

        this._physicalRecognition.onresult = (event) => {
            // 防止回声：TTS 播报期间及结束后 1 秒内忽略识别结果
            var now = Date.now();
            var ttsFinished = this._physicalTTSFinishedAt || 0;
            if (this.speech.isSpeaking || (now - ttsFinished) < 1000) {
                return;
            }

            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim();
            const isFinal = result.isFinal;

            console.log('[语音控制] 识别到:', transcript);

            // 更新识别显示
            const recognizedEl = $('#voice-recognized');
            if (recognizedEl) {
                recognizedEl.textContent = transcript;
            }

            // 更新波形动画
            const waveEl = $('#voice-wave');
            if (waveEl) {
                waveEl.classList.add('active');
                setTimeout(() => waveEl.classList.remove('active'), 1000);
            }

            if (isFinal) {
                this._physicalExecuteCommand(transcript);
            }
        };

        this._physicalRecognition.onerror = (event) => {
            console.warn('[语音控制] 识别错误:', event.error);
            if (event.error === 'not-allowed') {
                this.toast.show('麦克风权限被拒绝，请在浏览器设置中允许', 'error');
            }
        };

        this._physicalRecognition.onend = () => {
            // 自动重启（持续监听），但如果正在播报或刚结束播报则等待
            var now = Date.now();
            var ttsFinished = this._physicalTTSFinishedAt || 0;
            if (this._physicalVoiceActive && this.currentMode === 'physical' && !this.speech.isSpeaking && (now - ttsFinished) >= 1000) {
                try {
                    this._physicalRecognition.start();
                } catch (e) {
                    // 忽略已在运行的错误
                }
            }
        };

        this._physicalVoiceActive = true;
        this._physicalIsSpeaking = false;
        this._physicalTTSFinishedAt = 0;

        try {
            this._physicalRecognition.start();
            console.log('[语音控制] 语音识别已启动');
            const statusEl = $('#voice-status-text');
            if (statusEl) statusEl.textContent = '正在聆听...';
        } catch (e) {
            console.warn('[语音控制] 启动失败:', e);
            this.toast.show('语音识别启动失败: ' + e.message, 'error');
        }
    },

    /**
     * 停止语音识别控制
     */
    _physicalStopVoiceControl() {
        this._physicalVoiceActive = false;
        if (this._physicalRecognition) {
            try {
                this._physicalRecognition.stop();
            } catch (e) {
                console.warn('[语音控制] 停止识别时出错:', e);
            }
            this._physicalRecognition = null;
        }
    },

    /**
     * 切换语音控制开关
     */
    _physicalToggleVoice() {
        const btn = $('#btn-toggle-voice');
        if (this._physicalVoiceActive) {
            this._physicalStopVoiceControl();
            if (btn) btn.innerHTML = '&#9654; 开启语音控制';
            this.toast.show('语音控制已暂停', 'info');
        } else {
            this._physicalStartVoiceControl();
            if (btn) btn.innerHTML = '&#9632; 暂停语音控制';
            this.toast.show('语音控制已开启', 'success');
        }
    },

    /**
     * 执行语音命令
     */
    _physicalExecuteCommand(transcript) {
        const cmd = transcript.toLowerCase();
        const statusEl = $('#voice-status-text');

        if (statusEl) statusEl.textContent = `执行: ${transcript}`;

        // 播报语音时暂停识别，避免识别到自己的声音
        const speakAndResume = (text, options = {}) => {
            this._physicalIsSpeaking = true;

            // 暂停识别
            if (this._physicalRecognition) {
                try {
                    this._physicalRecognition.stop();
                } catch (e) {
                    console.warn('[语音控制] 暂停识别时出错:', e);
                }
            }

            this.speech.speak(text, {
                ...options,
                onEnd: () => {
                    this._physicalIsSpeaking = false;
                    this._physicalTTSFinishedAt = Date.now();
                    // 恢复识别
                    if (this._physicalVoiceActive && this.currentMode === 'physical' && this._physicalRecognition) {
                        try {
                            this._physicalRecognition.start();
                        } catch (e) {
                            console.warn('[语音控制] 恢复识别时出错:', e);
                        }
                    }
                    if (options.onEnd) options.onEnd();
                }
            });
        };

        if (cmd.includes('返回') || cmd.includes('后退')) {
            this._goHome();
            speakAndResume('已返回主页。');
        } else if (cmd.includes('主页') || cmd.includes('首页') || cmd.includes('回家')) {
            this._goHome();
            speakAndResume('已回到主页。');
        } else if (cmd.includes('朗读') || cmd.includes('读') || cmd.includes('念')) {
            this._blindReadScreen();
        } else if (cmd.includes('大字体') || cmd.includes('字体大') || cmd.includes('放大')) {
            this._toggleLargeFont();
            speakAndResume('已切换大字体模式。');
        } else if (cmd.includes('高对比度') || cmd.includes('对比度')) {
            this._toggleContrast();
            speakAndResume('已切换高对比度模式。');
        } else if (cmd.includes('帮助') || cmd.includes('怎么用') || cmd.includes('命令')) {
            this._physicalSpeakHelp();
        } else if (cmd.includes('停止') || cmd.includes('安静') || cmd.includes('暂停')) {
            this.speech.stop();
            speakAndResume('好的，已停止。');
        } else if (cmd.includes('紧急') || cmd.includes('求助') || cmd.includes('救命') || cmd.includes('帮忙')) {
            this._blindEmergencyHelp();
        } else if (cmd.includes('时间') || cmd.includes('几点')) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            speakAndResume(`现在是${timeStr}。`);
        } else if (cmd.includes('日期') || cmd.includes('今天') || cmd.includes('几号')) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            speakAndResume(`今天是${dateStr}。`);
        } else {
            speakAndResume(`抱歉，没有识别到"${transcript}"对应的命令。您可以说"帮助"查看可用命令。`);
        }
    },

    /**
     * 播放帮助信息
     */
    _physicalSpeakHelp() {
        const help = '肢体障碍辅助模式帮助。以下是可用的语音命令：返回或后退，回到主页。朗读，朗读当前页面内容。大字体，切换大字体模式。高对比度，切换高对比度模式。停止，停止语音播报。时间，播报当前时间。日期，播报今天日期。紧急求助，播报求助信息。帮助，播放本帮助信息。';

        // 播报帮助时暂停识别
        this._physicalIsSpeaking = true;
        if (this._physicalRecognition) {
            try {
                this._physicalRecognition.stop();
            } catch (e) {
                console.warn('[语音控制] 帮助播报暂停识别时出错:', e);
            }
        }

        this.speech.speak(help, {
            rate: 0.85,
            onEnd: () => {
                this._physicalIsSpeaking = false;
                this._physicalTTSFinishedAt = Date.now();
                if (this._physicalVoiceActive && this.currentMode === 'physical' && this._physicalRecognition) {
                    try {
                        this._physicalRecognition.start();
                    } catch (e) {
                        console.warn('[语音控制] 帮助播报后恢复识别时出错:', e);
                    }
                }
            }
        });
    }

};
