/**
 * ============================================================
 * Hello AI 无障碍辅助 - 主应用逻辑
 * ============================================================
 *
 * 模块说明：
 *   1. AccessibilityApp  - 主应用类，管理全局状态与生命周期
 *   2. ModuleLoader      - 功能模块动态加载器
 *
 * 已拆分的管理器模块（见 ./managers/ 目录）：
 *   - ToastManager      → ./managers/toast.js    通知提示管理
 *   - SettingsManager   → ./managers/settings.js  无障碍偏好设置管理
 *   - SpeechManager     → ./managers/speech.js    语音播报管理
 *   - CameraManager     → ./managers/camera.js    摄像头权限与视频流管理
 *
 * 设计原则：
 *   - 渐进增强：核心功能不依赖高级 API
 *   - 无障碍优先：所有交互均支持键盘操作
 *   - 状态持久化：用户偏好保存在 localStorage
 * ============================================================
 */

'use strict';

/* ============================================================
   工具类模块导入
   ============================================================ */
import { FeatureExtractor } from './utils/feature-extractor.js';
import { DynamicGestureRecognizer } from './utils/gesture-recognizer.js';
import { SignLanguageClassifier } from './utils/sign-classifier.js';

/* ============================================================
   管理器模块导入
   ============================================================ */
import { ToastManager } from './managers/toast.js';
import { SettingsManager } from './managers/settings.js';
import { SpeechManager } from './managers/speech.js';
import { CameraManager } from './managers/camera.js';
import { AuthManager } from './managers/auth.js';
import { apiClient } from './utils/api-client.js';

/* ============================================================
   辅助模式模块导入
   ============================================================ */
import { deafMethods } from './modules/deaf.js';
import { blindMethods } from './modules/blind.js';
import { cognitiveMethods } from './modules/cognitive.js';
import { physicalMethods } from './modules/physical.js';
import { elderlyMethods } from './modules/elderly.js';

/* ============================================================
   共享工具函数导入
   ============================================================ */
import { $, $$ } from './utils/dom.js';

/* ============================================================
   已拆分的管理器模块（见 ./managers/ 目录）：
     - ToastManager      → ./managers/toast.js
     - SettingsManager   → ./managers/settings.js
     - SpeechManager     → ./managers/speech.js
     - CameraManager     → ./managers/camera.js
   ============================================================ */

/* ============================================================
   ModuleLoader - 功能模块动态加载器
   ============================================================ */
class ModuleLoader {
    constructor() {
        this.modules = {};
        this.currentModule = null;
    }

    /**
     * 注册模块
     * @param {string} name - 模块名称
     * @param {Object} module - 模块对象，需包含 init/destroy 方法
     */
    register(name, module) {
        this.modules[name] = module;
    }

    /**
     * 加载并初始化模块
     * @param {string} name - 模块名称
     * @param {Object} context - 上下文对象（包含 app 引用等）
     * @returns {Promise<boolean>}
     */
    async load(name, context) {
        // 先销毁当前模块
        if (this.currentModule) {
            await this.unload();
        }

        const module = this.modules[name];
        if (!module) {
            console.warn(`[模块加载器] 模块 "${name}" 未注册`);
            return false;
        }

        try {
            console.log(`[模块加载器] 正在初始化模块 "${name}"...`);
            await module.init(context);
            this.currentModule = name;
            console.log(`[模块加载器] 模块 "${name}" 初始化成功`);
            return true;
        } catch (error) {
            console.error(`[模块加载器] 模块 "${name}" 初始化失败:`, error);
            if (context && context.app) {
                context.app.toast.show(`模块初始化失败: ${error.message}`, 'error', 5000);
            }
            return false;
        }
    }

    /**
     * 卸载当前模块
     */
    async unload() {
        if (this.currentModule) {
            const module = this.modules[this.currentModule];
            if (module && typeof module.destroy === 'function') {
                try {
                    await module.destroy();
                } catch (e) {
                    console.warn(`[模块加载器] 卸载模块 "${this.currentModule}" 时出错:`, e);
                }
            }
            this.currentModule = null;
        }
    }

    /**
     * 获取当前模块名称
     * @returns {string|null}
     */
    getCurrent() {
        return this.currentModule;
    }
}

/* ============================================================
   AccessibilityApp - 主应用类
   ============================================================ */

class AccessibilityApp {
    constructor() {
        // 管理器实例
        this.toast = new ToastManager();
        this.speech = new SpeechManager();
        this.settings = new SettingsManager();
        this.camera = new CameraManager(this);
        this.moduleLoader = new ModuleLoader();
        this.auth = new AuthManager(this.toast);

        // 当前状态
        this.currentMode = null;
        this.isInitialized = false;

        // 手势识别相关状态
        this._gestureRecognizer = null;
        this._gestureActive = false;
        this._gestureMode = null;
        this._gestureStableGesture = '';
        this._gestureBuffer = [];
        this._gestureAnimFrame = null;

        // 手语分类器
        this.signClassifier = new SignLanguageClassifier();
        this.dynamicRecognizer = new DynamicGestureRecognizer();
        this._signTrainingMode = false;
        this._signTrainingLabel = '';
        this._signTrainingCount = 0;
        this._signLastLandmarks = null;
        this._signSentence = '';  // 手语组合成的句子
        this._signSentenceTimeout = null;

        // 移动端检测
        this._isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // 视障辅助相关状态
        this._blindPrevFrame = null;
        this._blindRealtimeInterval = null;
        this._blindObstacleRunning = false;
        this._emergencyInfo = null;
        this._emergencyAddress = null;
        this._emergencyLat = null;
        this._emergencyLon = null;

        // 紧急联系人
        this._emergencyContacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');

        // 视障手势控制
        this._blindGestureActive = false;
        this._blindGestureInterval = null;
        this._blindLastGestureAction = '';
        this._blindGestureCooldown = false;

        // DOM 缓存
        this.dom = {};

        // PWA 安装提示
        this._deferredInstallPrompt = null;
        this._installPromptDismissed = false;
    }

    /**
     * 初始化应用
     */
    async init() {
        if (this.isInitialized) return;

        console.log('[Hello AI] 应用初始化中...');

        // 先隐藏骨架屏（不依赖任何初始化）
        const skeleton = document.getElementById('app-skeleton');
        if (skeleton) {
            skeleton.style.opacity = '0';
            setTimeout(() => skeleton.remove(), 500);
        }

        try {
            // 缓存 DOM 元素
            this._cacheDom();

            // 应用已保存的设置
            this._applySavedSettings();

            // 初始化手语分类器
            try {
                await this.signClassifier.init();
                this.dynamicRecognizer.init();
            } catch (e) {
                console.warn('[手语分类器] 初始化失败:', e);
            }

            // 绑定事件
            this._bindEvents();

            // 初始化认证管理器
            this.auth.init();
            this.auth.onAuthChange = (type) => {
                console.log('[Hello AI] 认证状态变化:', type);
            };

            // 初始化 PWA 安装提示
            this._initPWAInstallPrompt();

            // 注册内置模块
            this._registerModules();

            // 标记初始化完成
            this.isInitialized = true;

            console.log('[Hello AI] 应用初始化完成');

            // 语音导航由 index.html 的内联脚本处理，无需在此初始化

            // 监听内联脚本的 goHome 事件，执行应用状态清理
            window.addEventListener('app:goHome', () => {
                this._goHome();
            });
        } catch (e) {
            console.error('[Hello AI] 应用初始化失败:', e);
        }
    }

    /**
     * 缓存常用 DOM 元素
     */
    _cacheDom() {
        this.dom = {
            body: document.body,
            heroSection: $('.hero-section'),
            modesSection: $('#modes'),
            workspaceSection: $('#workspace'),
            workspaceTitle: $('#workspace-title'),
            workspaceBody: $('#workspace-body'),
            moduleContent: $('#module-content'),
            cameraContainer: $('#camera-container'),
            modeCards: $$('.mode-card'),
            btnBack: $('#btn-back'),
            btnSpeechToggle: $('#btn-speech-toggle'),
            btnContrastToggle: $('#btn-contrast-toggle'),
            btnFontToggle: $('#btn-font-toggle'),
        };
    }

    /**
     * 应用已保存的无障碍设置
     */
    _applySavedSettings() {
        // 高对比度
        if (this.settings.get('highContrast')) {
            this.dom.body.classList.add('high-contrast');
            this.dom.btnContrastToggle.classList.add('active');
        }

        // 大字体
        if (this.settings.get('largeFont')) {
            this.dom.body.classList.add('large-font');
            this.dom.btnFontToggle.classList.add('active');
        }

        // 语音设置
        this.speech.enabled = this.settings.get('speechEnabled');
        this.speech.setRate(this.settings.get('speechRate'));
        this.speech.setPitch(this.settings.get('speechPitch'));

        if (!this.speech.enabled) {
            this.dom.btnSpeechToggle.classList.remove('active');
        } else {
            this.dom.btnSpeechToggle.classList.add('active');
        }
    }

    /**
     * 绑定事件监听
     */
    _bindEvents() {
        const self = this;

        // 模式卡片点击/键盘事件
        this.dom.modeCards.forEach(card => {
            card.addEventListener('click', () => self._onModeSelect(card));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    self._onModeSelect(card);
                }
            });
        });

        // 返回按钮由 index.html 中的独立脚本和 inline onclick 处理，无需在此绑定

        // 语音开关
        this.dom.btnSpeechToggle.addEventListener('click', () => self._toggleSpeech());

        // 高对比度开关
        this.dom.btnContrastToggle.addEventListener('click', () => self._toggleContrast());

        // 大字体开关
        this.dom.btnFontToggle.addEventListener('click', () => self._toggleLargeFont());

        // 键盘快捷键
        document.addEventListener('keydown', (e) => self._onKeyDown(e));
    }

    /**
     * 初始化 PWA 安装提示
     * 监听 beforeinstallprompt 事件，延迟显示安装引导
     */
    _initPWAInstallPrompt() {
        // 检查是否已经安装过（安装后该事件不再触发）
        window.addEventListener('beforeinstallprompt', (e) => {
            // 阻止浏览器默认的安装提示
            e.preventDefault();

            // 保存事件引用，稍后使用
            this._deferredInstallPrompt = e;

            console.log('[PWA] 捕获到安装提示事件');

            // 检查用户是否已经拒绝过安装提示（本次会话内）
            if (!this._installPromptDismissed) {
                // 延迟 3 秒后显示安装提示，让用户先体验应用
                setTimeout(() => {
                    this._showInstallPrompt();
                }, 3000);
            }
        });

        // 监听安装完成事件
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] 应用已安装');
            this._deferredInstallPrompt = null;
            this.toast.show('应用已成功安装到桌面！', 'success');
        });

        // iOS 检测：Safari 不支持 beforeinstallprompt，需要手动引导
        if (this._isIOS() && !window.navigator.standalone) {
            setTimeout(() => this._showIOSInstallGuide(), 3000);
        }
    }

    /**
     * 检测是否为 iOS 设备
     */
    _isIOS() {
        const ua = navigator.userAgent;
        return /iphone|ipad|ipod/.test(ua.toLowerCase());
    }

    /**
     * 显示 iOS 专属安装引导
     */
    _showIOSInstallGuide() {
        const guide = document.createElement('div');
        guide.className = 'toast toast-info';
        guide.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:10000;max-width:320px;text-align:center;padding:16px 20px;';
        guide.innerHTML = `
            <div style="font-size:1.1em;margin-bottom:8px;">📲 添加到主屏幕</div>
            <div style="font-size:0.85em;opacity:0.9;">点击底部的 <b>分享</b> 按钮 → <b>添加到主屏幕</b></div>
            <div style="font-size:2em;margin:8px 0;">↗️</div>
        `;
        document.body.appendChild(guide);
        setTimeout(() => guide.remove(), 8000);
    }

    /**
     * 显示 PWA 安装提示 Toast
     */
    _showInstallPrompt() {
        if (!this._deferredInstallPrompt) return;

        const container = document.getElementById('toast-container');
        if (!container) return;

        // 创建安装提示 Toast
        const toast = document.createElement('div');
        toast.className = 'toast toast-info pwa-install-toast';
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <span class="pwa-install-text">将 Hello AI 添加到桌面，获得更好的使用体验</span>
            <div class="pwa-install-actions">
                <button class="pwa-install-btn" aria-label="立即安装">立即安装</button>
                <button class="pwa-install-dismiss" aria-label="暂不安装">暂不</button>
            </div>
        `;

        container.appendChild(toast);

        // 安装按钮点击
        const installBtn = toast.querySelector('.pwa-install-btn');
        installBtn.addEventListener('click', async () => {
            if (!this._deferredInstallPrompt) return;

            // 触发安装提示
            this._deferredInstallPrompt.prompt();

            // 等待用户响应
            const { outcome } = await this._deferredInstallPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('[PWA] 用户接受了安装提示');
            } else {
                console.log('[PWA] 用户拒绝了安装提示');
            }

            // 清除引用，prompt 只能调用一次
            this._deferredInstallPrompt = null;
            toast.remove();
        });

        // 暂不安装按钮点击
        const dismissBtn = toast.querySelector('.pwa-install-dismiss');
        dismissBtn.addEventListener('click', () => {
            this._installPromptDismissed = true;
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        });

        // 10 秒后自动消失
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(40px)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }
        }, 10000);
    }

    /**
     * 注册内置功能模块
     */
    _registerModules() {
        var self = this;
        function safeRegister(name, mod) {
            try { self.moduleLoader.register(name, mod); } catch(e) { console.error('[模块注册] ' + name + ' 失败:', e); }
        }

        // 视障辅助模块 - 增强版V2
        safeRegister('blind', {
            name: '视障辅助',
            icon: '&#128065;',
            needsCamera: true,
            init: async (ctx) => {
                ctx.app._showCamera();

                ctx.app._setModuleHTML(`
                    <div class="module-panel blind-panel">
                        <p class="module-hint">摄像头已启动，正在为您实时感知周围环境...</p>

                        <div class="blind-realtime-status" id="blind-realtime-status">
                            <div class="realtime-indicator">
                                <span class="indicator-dot" id="realtime-dot"></span>
                                <span class="indicator-text" id="realtime-text">实时感知中...</span>
                            </div>
                            <div class="realtime-info" id="realtime-info">
                                <div class="info-item"><span class="info-label">环境亮度</span><span class="info-value" id="info-brightness">--</span></div>
                                <div class="info-item"><span class="info-label">前方颜色</span><span class="info-value" id="info-color">--</span></div>
                                <div class="info-item"><span class="info-label">场景判断</span><span class="info-value" id="info-scene">--</span></div>
                                <div class="info-item"><span class="info-label">障碍检测</span><span class="info-value" id="info-obstacle">安全</span></div>
                            </div>
                        </div>

                        <div class="blind-gesture-hint">
                            <div class="gesture-hint-title">&#129306; 手势快捷操作</div>
                            <div class="gesture-hint-list">
                                <span>&#128070; 大拇指 = 好的</span>
                                <span>&#9994; 握拳 = 返回主页</span>
                                <span>&#9996; V字 = 朗读屏幕</span>
                                <span>&#128075; 张开 = 场景描述</span>
                                <span>&#128078; 朝下 = 停止</span>
                                <span>&#129304; 爱心 = 我爱你</span>
                                <span>&#9757; 指向 = 颜色识别</span>
                            </div>
                            <div class="gesture-hint-feedback" id="gesture-hint-feedback">等待手势...</div>
                        </div>

                        <div class="blind-features">
                            <div class="feature-card" role="button" tabindex="0" aria-label="屏幕朗读" onclick="app._blindReadScreen()">
                                <div class="feature-icon">&#128214;</div>
                                <h4>屏幕朗读</h4>
                                <p>朗读当前页面上的所有文字内容</p>
                            </div>
                            <div class="feature-card" role="button" tabindex="0" aria-label="详细场景描述" onclick="app._blindDescribeScene()">
                                <div class="feature-icon">&#127748;</div>
                                <h4>详细场景描述</h4>
                                <p>详细分析摄像头画面并语音描述</p>
                            </div>
                            <div class="feature-card" role="button" tabindex="0" aria-label="颜色识别" onclick="app._blindColorDetect()">
                                <div class="feature-icon">&#127912;</div>
                                <h4>颜色识别</h4>
                                <p>识别摄像头前方的主要颜色</p>
                            </div>
                            <div class="feature-card" role="button" tabindex="0" aria-label="光线检测" onclick="app._blindLightDetect()">
                                <div class="feature-icon">&#128161;</div>
                                <h4>光线检测</h4>
                                <p>持续检测环境光线亮度变化</p>
                            </div>
                            <div class="feature-card" role="button" tabindex="0" aria-label="障碍提醒" onclick="app._blindObstacleAlert()">
                                <div class="feature-icon">&#9888;&#65039;</div>
                                <h4>障碍提醒</h4>
                                <p>实时检测前方障碍物并语音提醒</p>
                            </div>
                            <div class="feature-card" role="button" tabindex="0" aria-label="紧急求助" onclick="app._blindEmergencyHelp()">
                                <div class="feature-icon">&#128222;</div>
                                <h4>紧急求助</h4>
                                <p>一键发送求助信息和精确位置</p>
                            </div>
                        </div>

                        <div class="blind-status" id="blind-status">
                            <span class="blind-status-icon">&#128064;</span>
                            <span class="blind-status-text">准备就绪，请选择功能</span>
                        </div>

                        <div class="blind-quick-actions">
                            <button class="module-btn" onclick="app._blindQuickGuide()">
                                &#128218; 快速引导
                            </button>
                            <button class="module-btn btn-secondary" onclick="app._blindRepeatLast()">
                                &#128260; 重复上一次
                            </button>
                        </div>
                        
                        <div class="sign-language-section">
                            <h4 class="guide-title">&#129504; 手语输入模式</h4>
                            <div class="sign-sentence" id="sign-sentence">
                                <div class="sentence-label">手语翻译：</div>
                                <div class="sentence-text" id="sign-sentence-text">等待手语输入...</div>
                            </div>
                            <div class="sign-controls">
                                <button class="module-btn btn-secondary" id="btn-sign-clear" onclick="app._signClearSentence()">
                                    &#128465; 清除句子
                                </button>
                                <button class="module-btn btn-secondary" id="btn-sign-speak" onclick="app._signSpeakSentence()">
                                    &#128266; 朗读句子
                                </button>
                            </div>
                        </div>
                        
                        <div class="sign-training-section">
                            <h4 class="guide-title">&#127891; 手语训练（自定义词汇）</h4>
                            <p class="training-hint">您可以训练系统识别自定义手语词汇。输入词汇名称，然后展示该手语动作并点击"采集样本"。</p>
                            <div class="training-controls">
                                <input type="text" id="sign-train-label" placeholder="输入手语词汇（如：吃饭）" 
                                    class="training-input" maxlength="20" aria-label="手语词汇名称">
                                <button class="module-btn" id="btn-sign-capture" onclick="app._signCaptureSample()">
                                    &#128247; 采集样本
                                </button>
                                <span class="training-count" id="sign-train-count">已采集: 0</span>
                            </div>
                            <div class="training-actions">
                                <button class="module-btn btn-secondary" onclick="app._signSaveTraining()">
                                    &#128190; 保存训练数据
                                </button>
                                <button class="module-btn btn-secondary" onclick="app._signExportTraining()">
                                    &#128229; 导出数据
                                </button>
                                <button class="module-btn btn-secondary" onclick="app._signImportTraining()">
                                    &#128228; 导入数据
                                </button>
                                <button class="module-btn btn-secondary" onclick="app._signImportVivoData()">
                                    &#128228; 导入vivo数据
                                </button>
                                <button class="module-btn btn-secondary" onclick="app._signClearTraining()" style="color:#e74c3c;">
                                    &#128465; 清除数据
                                </button>
                            </div>
                            <div class="training-list" id="sign-training-list"></div>
                        </div>

                        <div class="module-back-home">
                            <button class="module-btn btn-secondary" onclick="window.goHome && window.goHome()">
                                &#8592; 返回主页
                            </button>
                        </div>
                    </div>
                `);

                // 启动实时环境感知
                ctx.app._blindStartRealtimeSense();

                // 启动手势识别辅助操作
                ctx.app._blindStartGestureControl();

                ctx.app.speech.speak('视障辅助模式已启动。摄像头已开启，正在实时感知您的周围环境。系统会自动播报环境变化。您也可以点击下方功能按钮获取详细信息。');
            },
            destroy: async (ctx) => {
                if (ctx.app._blindLightInterval) {
                    clearInterval(ctx.app._blindLightInterval);
                    ctx.app._blindLightInterval = null;
                }
                if (ctx.app._blindRealtimeInterval) {
                    clearInterval(ctx.app._blindRealtimeInterval);
                    ctx.app._blindRealtimeInterval = null;
                }
                if (ctx.app._blindObstacleRunning) {
                    ctx.app._blindObstacleRunning = false;
                }
                if (ctx.app._obstacleFrameId) {
                    cancelAnimationFrame(ctx.app._obstacleFrameId);
                    ctx.app._obstacleFrameId = null;
                }
                ctx.app._blindStopGestureControl();
                ctx.app._hideCamera();
            }
        });

        // 听障辅助模块 - 增强版
        safeRegister('deaf', {
            name: '听障辅助',
            icon: '&#129306;',
            needsCamera: true,
            _handsInstance: null,
            _cameraInstance: null,
            _gestureHistory: [],
            _isListening: false,
            _lastGesture: '',
            _gestureBuffer: [],
            _stableGesture: '',
            
            init: async (ctx) => {
                const self = this;
                ctx.app._showCamera();
                
                ctx.app._setModuleHTML(`
                    <div class="module-panel deaf-panel">
                        <p class="module-hint">请将手放在摄像头前方，系统将实时识别您的手势并转换为文字和语音。</p>

                        <div class="deaf-layout">
                            <div class="deaf-main">
                                <div class="module-status" id="gesture-status">
                                    <span class="status-icon">&#129306;</span>
                                    <span class="status-text">等待手势输入...</span>
                                </div>
                                
                                <div class="gesture-display" id="gesture-display">
                                    <div class="gesture-recognized" id="gesture-recognized"></div>
                                    <div class="gesture-confidence" id="gesture-confidence"></div>
                                </div>
                                
                                <div class="module-controls">
                                    <button class="module-btn" id="btn-start-gesture" onclick="app._deafStartGesture()">
                                        &#9654; 开始识别
                                    </button>
                                    <button class="module-btn btn-secondary" id="btn-stop-gesture" onclick="app._deafStopGesture()" style="display:none;">
                                        &#9632; 停止识别
                                    </button>
                                    <button class="module-btn btn-secondary" onclick="app._deafSpeakLast()">
                                        &#9835; 朗读最后一条
                                    </button>
                                    <button class="module-btn btn-secondary" onclick="app._signSpeakSentence()">
                                        &#128172; 朗读句子
                                    </button>
                                    <button class="module-btn btn-secondary" onclick="app._deafClearHistory()">
                                        &#128465; 清除记录
                                    </button>
                                </div>
                            </div>
                            
                            <div class="deaf-sidebar">
                                <h4 class="sidebar-title">识别历史</h4>
                                <div class="gesture-history" id="gesture-history">
                                    <p class="history-empty">暂无识别记录</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="gesture-guide">
                            <h4 class="guide-title">支持的手势</h4>
                            <div class="guide-grid">
                                <div class="guide-item"><span class="guide-gesture">&#128070;</span><span class="guide-meaning">好的</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#9994;</span><span class="guide-meaning">握拳/停</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#128075;</span><span class="guide-meaning">你好</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#9996;</span><span class="guide-meaning">谢谢</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#128078;</span><span class="guide-meaning">不好</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#129304;</span><span class="guide-meaning">我爱你</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#9757;</span><span class="guide-meaning">指向上</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#129304;</span><span class="guide-meaning">加油</span></div>
                                <div class="guide-item"><span class="guide-gesture">&#128076;</span><span class="guide-meaning">OK/好</span></div>
                            </div>
                        </div>

                        <div class="module-back-home">
                            <button class="module-btn btn-secondary" onclick="window.goHome && window.goHome()">
                                &#8592; 返回主页
                            </button>
                        </div>
                    </div>
                `);

                // 不自动启动，等待用户点击"开始识别"按钮
                ctx.app.speech.speak('听障辅助模式已启动。请点击开始识别按钮。');
            },
            
            destroy: async (ctx) => {
                ctx.app._deafStopGesture();
                ctx.app._hideCamera();
            }
        });

        // 认知障碍辅助模块 - 增强版
        safeRegister('cognitive', {
            name: '认知障碍辅助',
            icon: '&#129504;',
            needsCamera: false,
            init: async (ctx) => {
                // 自动启用大字体和高对比度
                ctx.app.dom.body.classList.add('large-font', 'high-contrast');
                ctx.app.settings.update({ largeFont: true, highContrast: true });
                ctx.app.dom.btnFontToggle.classList.add('active');
                ctx.app.dom.btnContrastToggle.classList.add('active');
                
                ctx.app._setModuleHTML(`
                    <div class="module-panel cognitive-panel">
                        <p class="module-hint" style="font-size: 1.2em;">
                            您好！这里是您的贴心助手。<br>
                            请选择您想做的事情，我会一步步引导您。
                        </p>

                        <div class="cognitive-tasks">
                            <div class="task-card task-large" onclick="app._cognitiveStartTask('call')" tabindex="0" role="button" aria-label="打电话给家人">
                                <div class="task-icon">&#128222;</div>
                                <div class="task-label">打电话给家人</div>
                            </div>
                            <div class="task-card task-large" onclick="app._cognitiveStartTask('medicine')" tabindex="0" role="button" aria-label="吃药提醒">
                                <div class="task-icon">&#128138;</div>
                                <div class="task-label">吃药提醒</div>
                            </div>
                            <div class="task-card task-large" onclick="app._cognitiveStartTask('weather')" tabindex="0" role="button" aria-label="查看天气">
                                <div class="task-icon">&#9925;</div>
                                <div class="task-label">查看天气</div>
                            </div>
                            <div class="task-card task-large" onclick="app._cognitiveStartTask('walk')" tabindex="0" role="button" aria-label="出去散步">
                                <div class="task-icon">&#127939;</div>
                                <div class="task-label">出去散步</div>
                            </div>
                            <div class="task-card task-large" onclick="app._cognitiveStartTask('eat')" tabindex="0" role="button" aria-label="吃饭提醒">
                                <div class="task-icon">&#127858;</div>
                                <div class="task-label">吃饭提醒</div>
                            </div>
                            <div class="task-card task-large" onclick="app._cognitiveStartTask('emergency')" tabindex="0" role="button" aria-label="紧急求助">
                                <div class="task-icon">&#128680;</div>
                                <div class="task-label">紧急求助</div>
                            </div>
                        </div>

                        <div class="custom-tasks-section" style="margin-top:var(--space-xl);padding-top:var(--space-xl);border-top:1px solid var(--color-border);">
                            <h3 style="color:var(--color-accent);font-size:var(--fs-lg);margin-bottom:var(--space-md);text-align:center;">&#128203; 自定义工作流程</h3>
                            <p style="color:var(--color-text-secondary);text-align:center;margin-bottom:var(--space-lg);font-size:var(--fs-sm);">
                                家人可以为日常任务创建步骤引导，让操作更简单
                            </p>
                            <div id="custom-tasks-list" class="cognitive-tasks" style="margin-bottom:var(--space-lg);"></div>
                            <div style="text-align:center;">
                                <button class="module-btn" onclick="app._cognitiveShowCreateTask()" style="font-size:var(--fs-md);padding:var(--space-md) var(--space-xl);">
                                    &#10133; 创建新流程
                                </button>
                            </div>
                        </div>

                        <div id="cognitive-create-task" style="display:none;"></div>

                        <div class="cognitive-step-guide" id="cognitive-step-guide" style="display:none;">
                            <div class="step-header">
                                <span class="step-back" role="button" tabindex="0" aria-label="返回" onclick="app._cognitiveCancelTask()">&#8592; 返回</span>
                                <span class="step-progress" id="step-progress">步骤 1/3</span>
                            </div>
                            <div class="step-content" id="step-content"></div>
                            <div class="step-actions">
                                <button class="module-btn step-next-btn" id="step-next-btn" onclick="app._cognitiveNextStep()">
                                    下一步 &#8594;
                                </button>
                            </div>
                        </div>

                        <div class="cognitive-clock" id="cognitive-clock">
                            <div class="clock-time" id="clock-time"></div>
                            <div class="clock-date" id="clock-date"></div>
                        </div>

                        <div class="module-back-home">
                            <button class="module-btn btn-secondary" onclick="window.goHome && window.goHome()">
                                &#8592; 返回主页
                            </button>
                        </div>
                    </div>
                `);

                // 渲染自定义工作流程
                ctx.app._cognitiveRenderCustomTasks();
                
                // 启动时钟
                ctx.app._cognitiveStartClock();
                
                ctx.app.speech.speak('认知辅助模式已启动。界面已放大，文字更清晰。请选择您想做的事情。', { rate: 0.85 });
            },
            destroy: async (ctx) => {
                if (ctx.app._cognitiveClockInterval) {
                    clearInterval(ctx.app._cognitiveClockInterval);
                    ctx.app._cognitiveClockInterval = null;
                }
            }
        });

        // 肢体障碍辅助模块 - 增强版
        safeRegister('physical', {
            name: '肢体障碍辅助',
            icon: '&#129468;',
            needsCamera: false,
            init: async (ctx) => {
                ctx.app._physicalStartVoiceControl();
                
                ctx.app._setModuleHTML(`
                    <div class="module-panel physical-panel">
                        <p class="module-hint">语音控制已启用。您可以通过语音命令操作设备，无需使用双手。</p>
                        
                        <div class="voice-control-status" id="voice-control-status">
                            <div class="voice-wave" id="voice-wave">
                                <span></span><span></span><span></span><span></span><span></span>
                            </div>
                            <div class="voice-status-text" id="voice-status-text">正在聆听...</div>
                            <div class="voice-recognized" id="voice-recognized"></div>
                        </div>
                        
                        <div class="voice-commands-list">
                            <h4 class="commands-title">可用语音命令</h4>
                            <div class="commands-grid">
                                <div class="cmd-item">
                                    <span class="cmd-key">"返回"</span>
                                    <span class="cmd-desc">返回上一页</span>
                                </div>
                                <div class="cmd-item">
                                    <span class="cmd-key">"主页"</span>
                                    <span class="cmd-desc">回到首页</span>
                                </div>
                                <div class="cmd-item">
                                    <span class="cmd-key">"朗读"</span>
                                    <span class="cmd-desc">朗读当前页面</span>
                                </div>
                                <div class="cmd-item">
                                    <span class="cmd-key">"大字体"</span>
                                    <span class="cmd-desc">切换大字体</span>
                                </div>
                                <div class="cmd-item">
                                    <span class="cmd-key">"高对比度"</span>
                                    <span class="cmd-desc">切换高对比度</span>
                                </div>
                                <div class="cmd-item">
                                    <span class="cmd-key">"帮助"</span>
                                    <span class="cmd-desc">播放帮助信息</span>
                                </div>
                                <div class="cmd-item">
                                    <span class="cmd-key">"停止"</span>
                                    <span class="cmd-desc">停止语音播报</span>
                                </div>
                                <div class="cmd-item">
                                    <span class="cmd-key">"紧急求助"</span>
                                    <span class="cmd-desc">播报求助信息</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="physical-actions">
                            <button class="module-btn" id="btn-toggle-voice" onclick="app._physicalToggleVoice()">
                                &#9632; 暂停语音控制
                            </button>
                            <button class="module-btn btn-secondary" onclick="app._physicalSpeakHelp()">
                                &#128218; 帮助
                            </button>
                        </div>

                        <div class="module-back-home">
                            <button class="module-btn btn-secondary" onclick="window.goHome && window.goHome()">
                                &#8592; 返回主页
                            </button>
                        </div>
                    </div>
                `);
                
                ctx.app.speech.speak('肢体障碍辅助模式已启动。语音控制已开启，请说出您的指令。您可以说"帮助"来查看所有可用命令。');
            },
            destroy: async (ctx) => {
                ctx.app._physicalStopVoiceControl();
            }
        });

        // 老年人辅助模块 - 增强版
        safeRegister('elderly', {
            name: '老年人辅助',
            icon: '&#128116;',
            needsCamera: false,
            init: async (ctx) => {
                // 自动启用大字体模式
                ctx.app.dom.body.classList.add('large-font');
                ctx.app.settings.set('largeFont', true);
                ctx.app.dom.btnFontToggle.classList.add('active');
                
                const now = new Date();
                const greeting = now.getHours() < 12 ? '早上好' : now.getHours() < 18 ? '下午好' : '晚上好';
                const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
                const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

                ctx.app._setModuleHTML(`
                    <div class="module-panel elderly-panel">
                        <div class="elderly-greeting">
                            <div class="greeting-text">${greeting}！</div>
                            <div class="greeting-date">${dateStr}</div>
                            <div style="font-size:var(--fs-3xl);color:var(--color-accent);font-family:var(--font-display);font-weight:700;margin-top:var(--space-md);">${timeStr}</div>
                        </div>

                        <div class="elderly-quick-actions">
                            <div class="elderly-action" onclick="app._elderlyAction('emergency')" tabindex="0" role="button" aria-label="紧急求助">
                                <div class="elderly-action-icon">&#128680;</div>
                                <div class="elderly-action-label">紧急求助</div>
                            </div>
                            <div class="elderly-action" onclick="app._elderlyAction('family')" tabindex="0" role="button" aria-label="联系家人">
                                <div class="elderly-action-icon">&#128105;&#8205;&#128106;</div>
                                <div class="elderly-action-label">联系家人</div>
                            </div>
                            <div class="elderly-action" onclick="app._elderlyAction('medicine')" tabindex="0" role="button" aria-label="吃药提醒">
                                <div class="elderly-action-icon">&#128138;</div>
                                <div class="elderly-action-label">吃药提醒</div>
                            </div>
                            <div class="elderly-action" onclick="app._elderlyAction('weather')" tabindex="0" role="button" aria-label="今天天气">
                                <div class="elderly-action-icon">&#9925;</div>
                                <div class="elderly-action-label">今天天气</div>
                            </div>
                            <div class="elderly-action" onclick="app._elderlyAction('time')" tabindex="0" role="button" aria-label="现在几点">
                                <div class="elderly-action-icon">&#128339;</div>
                                <div class="elderly-action-label">现在几点</div>
                            </div>
                            <div class="elderly-action" onclick="app._elderlyAction('news')" tabindex="0" role="button" aria-label="听新闻">
                                <div class="elderly-action-icon">&#128240;</div>
                                <div class="elderly-action-label">听新闻</div>
                            </div>
                            <div class="elderly-action" onclick="app._elderlyAction('music')" tabindex="0" role="button" aria-label="听音乐">
                                <div class="elderly-action-icon">&#127925;</div>
                                <div class="elderly-action-label">听音乐</div>
                            </div>
                            <div class="elderly-action" onclick="app._elderlyAction('help')" tabindex="0" role="button" aria-label="帮助">
                                <div class="elderly-action-icon">&#128172;</div>
                                <div class="elderly-action-label">帮助</div>
                            </div>
                        </div>

                        <div class="elderly-message" id="elderly-message">
                            <p>点击上方的按钮，我来帮您。</p>
                        </div>

                        <div class="module-back-home">
                            <button class="module-btn btn-secondary" onclick="window.goHome && window.goHome()">
                                &#8592; 返回主页
                            </button>
                        </div>
                    </div>
                `);
                
                ctx.app.speech.speak(`${greeting}！今天是${dateStr}。有什么我可以帮您的吗？`, { rate: 0.8 });
            },
            destroy: async (ctx) => {
                ctx.app._elderlyStopMusic();
                // 保留大字体设置
            }
        });

        // 通用设置模块
        safeRegister('settings', {
            name: '通用设置',
            icon: '&#9881;',
            needsCamera: false,
            init: async (ctx) => {
                const rate = ctx.app.settings.get('speechRate');
                const pitch = ctx.app.settings.get('speechPitch');

                ctx.app._setModuleHTML(`
                    <div class="module-panel settings-panel">
                        <h3 class="settings-group-title">显示设置</h3>
                        <div class="settings-item">
                            <label>高对比度模式</label>
                            <button class="toggle-btn ${ctx.app.settings.get('highContrast') ? 'active' : ''}"
                                    aria-pressed="${ctx.app.settings.get('highContrast')}"
                                    onclick="app._toggleContrast(); this.classList.toggle('active'); this.setAttribute('aria-pressed', this.classList.contains('active'));">
                                ${ctx.app.settings.get('highContrast') ? '已开启' : '已关闭'}
                            </button>
                        </div>
                        <div class="settings-item">
                            <label>大字体模式</label>
                            <button class="toggle-btn ${ctx.app.settings.get('largeFont') ? 'active' : ''}"
                                    aria-pressed="${ctx.app.settings.get('largeFont')}"
                                    onclick="app._toggleLargeFont(); this.classList.toggle('active'); this.setAttribute('aria-pressed', this.classList.contains('active'));">
                                ${ctx.app.settings.get('largeFont') ? '已开启' : '已关闭'}
                            </button>
                        </div>

                        <h3 class="settings-group-title">语音设置</h3>
                        <div class="settings-item">
                            <label>语音播报</label>
                            <button class="toggle-btn ${ctx.app.speech.enabled ? 'active' : ''}"
                                    aria-pressed="${ctx.app.speech.enabled}"
                                    onclick="app._toggleSpeech(); this.classList.toggle('active'); this.setAttribute('aria-pressed', this.classList.contains('active'));">
                                ${ctx.app.speech.enabled ? '已开启' : '已关闭'}
                            </button>
                        </div>
                        <div class="settings-item">
                            <label>语速：<span id="rate-value">${rate.toFixed(1)}</span></label>
                            <input type="range" min="0.5" max="2.0" step="0.1" value="${rate}"
                                   class="settings-slider"
                                   aria-label="语速"
                                   aria-valuemin="0.5"
                                   aria-valuemax="2"
                                   oninput="document.getElementById('rate-value').textContent = parseFloat(this.value).toFixed(1); app.speech.setRate(parseFloat(this.value)); app.settings.set('speechRate', parseFloat(this.value));">
                        </div>
                        <div class="settings-item">
                            <label>音调：<span id="pitch-value">${pitch.toFixed(1)}</span></label>
                            <input type="range" min="0.5" max="2.0" step="0.1" value="${pitch}"
                                   class="settings-slider"
                                   aria-label="音调"
                                   aria-valuemin="0.5"
                                   aria-valuemax="2"
                                   oninput="document.getElementById('pitch-value').textContent = parseFloat(this.value).toFixed(1); app.speech.setPitch(parseFloat(this.value)); app.settings.set('speechPitch', parseFloat(this.value));">
                        </div>

                        <div class="settings-actions">
                            <button class="module-btn" onclick="app.speech.speak('设置已保存。当前语速为' + app.settings.get('speechRate') + '，音调为' + app.settings.get('speechPitch') + '。'); app.toast.show('设置已保存', 'success');">
                                保存设置
                            </button>
                            <button class="module-btn btn-secondary" onclick="app.settings.reset(); location.reload();">
                                恢复默认
                            </button>
                        </div>

                        <div class="module-back-home">
                            <button class="module-btn btn-secondary" onclick="window.goHome && window.goHome()">
                                &#8592; 返回主页
                            </button>
                        </div>
                    </div>
                `);
                ctx.app.speech.speak('通用设置已打开。您可以在这里调整显示和语音偏好。');
            },
            destroy: async () => {}
        });

        // 声音修复模块 - 为声带损伤人群提供语音增强输出
        safeRegister('voice-repair', {
            name: '声音修复',
            icon: '&#127908;',
            needsCamera: false,

            init: async function(ctx) {
                var app = ctx.app;
                var phrases = ['你好','谢谢','请帮帮我','我不舒服','请问洗手间在哪','我要喝水','我不明白','请说慢一点','再见','对不起','我需要去医院','请叫救护车','我迷路了','请再说一遍'];
                var phraseHTML = '';
                for (var i = 0; i < phrases.length; i++) {
                    phraseHTML += '<button class="phrase-btn" data-phrase="' + phrases[i] + '">' + phrases[i] + '</button>';
                }

                var html = '';
                html += '<div class="module-panel voice-repair-panel">';
                html += '<p class="module-hint" style="font-size:1.1em;">声音修复功能帮助您将含糊的语音转换为清晰的声音。<br>点击下方麦克风按钮开始说话，系统会识别您的话语并用清晰的声音播放出来。</p>';
                html += '<div class="voice-repair-main">';
                html += '<div class="voice-status" id="voice-status">点击麦克风开始说话</div>';
                html += '<div class="voice-input-area"><button class="mic-btn" id="btn-voice-mic" aria-label="按住说话"><span class="mic-icon">&#127908;</span><span class="mic-text">点击说话</span></button></div>';
                html += '<div class="voice-text-display" id="voice-text-display"><div class="voice-label">识别结果：</div><div class="voice-recognized" id="voice-recognized">等待语音输入...</div></div>';
                html += '<div class="voice-text-input"><label for="voice-manual-input">或直接输入文字：</label><div class="voice-input-row"><input type="text" id="voice-manual-input" placeholder="在这里输入文字..." maxlength="200" aria-label="手动输入文字"><button class="module-btn" id="btn-voice-speak" aria-label="朗读输入的文字">朗读</button></div></div>';
                html += '<div class="voice-quick-phrases"><div class="voice-label">常用短语（点击直接朗读）：</div><div class="phrase-grid" id="phrase-grid">' + phraseHTML + '</div></div>';
                html += '<div class="voice-settings"><div class="voice-label">语音设置：</div><div class="voice-setting-row"><label>语速：</label><input type="range" id="voice-rate" min="0.5" max="2.0" step="0.1" value="1.0" aria-label="语速"><span id="voice-rate-val">1.0</span></div><div class="voice-setting-row"><label>音调：</label><input type="range" id="voice-pitch" min="0.5" max="2.0" step="0.1" value="1.0" aria-label="音调"><span id="voice-pitch-val">1.0</span></div></div>';
                html += '<div class="voice-history"><div class="voice-label">历史记录：</div><div class="history-list" id="voice-history-list"></div></div>';
                html += '</div>';
                html += '<div class="module-back-home"><button class="module-btn btn-secondary" onclick="window.goHome && window.goHome()">&#8592; 返回主页</button></div>';
                html += '</div>';

                app._setModuleHTML(html);

                // 绑定事件
                var micBtn = document.getElementById('btn-voice-mic');
                var manualInput = document.getElementById('voice-manual-input');
                var speakBtn = document.getElementById('btn-voice-speak');
                var rateSlider = document.getElementById('voice-rate');
                var pitchSlider = document.getElementById('voice-pitch');
                var rateVal = document.getElementById('voice-rate-val');
                var pitchVal = document.getElementById('voice-pitch-val');
                var recognition = null;
                var isListening = false;

                var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                var recognition = null;
                var isListening = false;

                // 延迟创建 recognition，确保内联脚本的 recognition 已完全停止
                function initRecognition() {
                    if (recognition) return recognition;
                    if (!SR) return null;
                    try {
                        recognition = new SR();
                        recognition.lang = 'zh-CN';
                        recognition.continuous = false;
                        recognition.interimResults = true;

                        // 保存到 app 实例，供 _voiceRepairSpeak 访问
                        app._voiceRepairRecognition = recognition;
                        app._voiceRepairIsListening = false;

                        recognition.onresult = function(ev) {
                            // 防止回声：TTS 播报期间及结束后 1.5 秒内忽略识别结果
                            var now = Date.now();
                            var ttsFinished = app._voiceRepairTTSFinishedAt || 0;
                            if (app.speech.isSpeaking || (now - ttsFinished) < 1500) return;
                            var transcript = '';
                            for (var j = 0; j < ev.results.length; j++) transcript += ev.results[j][0].transcript;
                            var el = document.getElementById('voice-recognized');
                            if (el) el.textContent = transcript;
                            if (ev.results[ev.results.length - 1].isFinal) {
                                app._voiceRepairSpeak(transcript);
                                app._voiceRepairAddHistory(transcript);
                            }
                        };
                        recognition.onerror = function(ev) {
                            console.warn('[声音修复] 识别错误:', ev.error);
                            var st = document.getElementById('voice-status');
                            if (st) st.textContent = '识别出错: ' + ev.error;
                            isListening = false;
                            app._voiceRepairIsListening = false;
                            if (micBtn) micBtn.classList.remove('listening');
                        };
                        recognition.onend = function() {
                            // 如果正在播报或刚结束播报，不更新状态
                            var now = Date.now();
                            var ttsFinished = app._voiceRepairTTSFinishedAt || 0;
                            if (app.speech.isSpeaking || (now - ttsFinished) < 1500) return;
                            isListening = false;
                            app._voiceRepairIsListening = false;
                            if (micBtn) micBtn.classList.remove('listening');
                            var st = document.getElementById('voice-status');
                            if (st) st.textContent = '点击麦克风开始说话';
                        };
                        console.log('[声音修复] 语音识别已创建');
                        return recognition;
                    } catch (e) {
                        console.warn('[声音修复] 语音识别初始化失败:', e);
                        return null;
                    }
                }

                if (micBtn) {
                    micBtn.addEventListener('click', function() {
                        // 延迟创建 recognition，确保内联脚本的 recognition 已完全停止
                        var rec = initRecognition();
                        if (!rec) { app.toast.show('浏览器不支持语音识别，请手动输入', 'error'); return; }
                        if (isListening) {
                            try { rec.stop(); } catch(e) {}
                            isListening = false;
                            app._voiceRepairIsListening = false;
                            micBtn.classList.remove('listening');
                            var st = document.getElementById('voice-status');
                            if (st) st.textContent = '点击麦克风开始说话';
                        } else {
                            // 先取消正在播放的 TTS，防止回声
                            app.speech.stop();
                            app._voiceRepairTTSFinishedAt = Date.now();
                            var st = document.getElementById('voice-status');
                            if (st) st.textContent = '准备中...';
                            // 等待较长时间让扬声器残余声音消散，再启动识别
                            setTimeout(function() {
                                try {
                                    console.log('[声音修复] 尝试启动语音识别...');
                                    rec.start();
                                    isListening = true;
                                    app._voiceRepairIsListening = true;
                                    micBtn.classList.add('listening');
                                    var st = document.getElementById('voice-status');
                                    if (st) st.textContent = '正在聆听...请说话';
                                    console.log('[声音修复] 语音识别已启动');
                                } catch (e) {
                                    console.warn('[声音修复] 启动失败:', e);
                                    app.toast.show('无法启动语音识别: ' + e.message, 'error');
                                }
                            }, 1500);
                        }
                    });
                }

                if (speakBtn && manualInput) {
                    speakBtn.addEventListener('click', function() { var t = manualInput.value.trim(); if (t) { app._voiceRepairSpeak(t); app._voiceRepairAddHistory(t); manualInput.value = ''; } });
                    manualInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { var t = manualInput.value.trim(); if (t) { app._voiceRepairSpeak(t); app._voiceRepairAddHistory(t); manualInput.value = ''; } } });
                }

                var phraseGrid = document.getElementById('phrase-grid');
                if (phraseGrid) {
                    phraseGrid.addEventListener('click', function(e) {
                        var btn = e.target.closest('.phrase-btn');
                        if (btn) { app._voiceRepairSpeak(btn.dataset.phrase); app._voiceRepairAddHistory(btn.dataset.phrase); }
                    });
                }

                if (rateSlider && rateVal) rateSlider.addEventListener('input', function() { rateVal.textContent = parseFloat(rateSlider.value).toFixed(1); });
                if (pitchSlider && pitchVal) pitchSlider.addEventListener('input', function() { pitchVal.textContent = parseFloat(pitchSlider.value).toFixed(1); });

                // 不自动播报欢迎语，防止麦克风捕获回声；用户可点击麦克风开始
                app._voiceRepairTTSFinishedAt = 0;
            },

            destroy: async (ctx) => {
                // 退出时停止语音识别并清理状态
                if (ctx.app._voiceRepairRecognition) {
                    try { ctx.app._voiceRepairRecognition.stop(); } catch(e) {}
                    ctx.app._voiceRepairRecognition = null;
                }
                ctx.app._voiceRepairIsListening = false;
            }
        });
    }

    /**
     * 声音修复 - 朗读文字（播报时暂停语音识别，防止回声）
     */
    _voiceRepairSpeak(text) {
        if (!text) return;
        var rateEl = document.getElementById('voice-rate');
        var pitchEl = document.getElementById('voice-pitch');
        var rate = rateEl ? parseFloat(rateEl.value) : 1.0;
        var pitch = pitchEl ? parseFloat(pitchEl.value) : 1.0;

        // 暂停语音识别，防止 TTS 声音被录进去
        var recognition = this._voiceRepairRecognition;
        var wasListening = this._voiceRepairIsListening;
        if (recognition && wasListening) {
            try { recognition.stop(); } catch(e) {}
        }

        var self = this;
        this.speech.speak(text, {
            rate: rate,
            pitch: pitch,
            onEnd: function() {
                // 记录 TTS 结束时间，用于回声过滤
                self._voiceRepairTTSFinishedAt = Date.now();
                // 播报结束后等待缓冲区清空，再恢复语音识别
                if (recognition && wasListening) {
                    setTimeout(function() {
                        try {
                            recognition.start();
                            var micBtn = document.getElementById('btn-voice-mic');
                            if (micBtn) micBtn.classList.add('listening');
                            var st = document.getElementById('voice-status');
                            if (st) st.textContent = '正在聆听...请说话';
                        } catch(e) {}
                    }, 1200);
                }
            }
        });
        var el = document.getElementById('voice-recognized');
        if (el) el.textContent = text;
    }

    /**
     * 声音修复 - 添加历史记录
     */
    _voiceRepairAddHistory(text) {
        var list = document.getElementById('voice-history-list');
        if (!list) return;
        var item = document.createElement('div');
        item.className = 'history-item';
        var span = document.createElement('span');
        span.className = 'history-text';
        span.textContent = text;
        var btn = document.createElement('button');
        btn.className = 'history-replay';
        btn.setAttribute('aria-label', '重新朗读');
        btn.textContent = '\u{1F508}';
        var self = this;
        btn.addEventListener('click', function() { self._voiceRepairSpeak(text); });
        item.appendChild(span);
        item.appendChild(btn);
        list.prepend(item);
        while (list.children.length > 20) list.removeChild(list.lastChild);
    }


    /* ---------- 事件处理 ---------- */

    /**
     * 模式选择处理
     * @param {Element} card - 被选中的卡片元素
     */
    async _onModeSelect(card, skipSpeech = false) {
        const mode = card.dataset.mode;
        if (!mode) return;

        const title = card.querySelector('.card-title').textContent;

        // 如果是从语音导航触发的（skipSpeech=true），不重复播报
        if (!skipSpeech) {
            this.speech.speak(`正在进入${title}模式`);
        }

        // 保存当前模式
        this.currentMode = mode;
        this._currentMode = mode;  // 供 CameraManager 判断使用哪个摄像头
        this.settings.set('lastMode', mode);

        // 切换视图
        this._showWorkspace(title);

        // 加载模块
        const success = await this.moduleLoader.load(mode, { app: this });
        if (!success) {
            this.toast.show('模块加载失败，请稍后重试', 'error');
        }
    }

    /**
     * 键盘快捷键处理
     * @param {KeyboardEvent} e
     */
    _onKeyDown(e) {
        // Escape 返回主页
        if (e.key === 'Escape' && this.currentMode) {
            this._goHome();
        }
    }

    /* ---------- 视图切换 ---------- */

    /**
     * 显示功能工作区
     * @param {string} title - 工作区标题
     */
    _showWorkspace(title) {
        this.dom.heroSection.style.display = 'none';
        this.dom.modesSection.style.display = 'none';
        this.dom.workspaceSection.hidden = false;
        this.dom.workspaceTitle.innerHTML = title;

        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * 返回主页
     */
    _goHome() {
        // 先切换视图（确保用户立即看到反馈）
        this.dom.workspaceSection.hidden = true;
        this.dom.heroSection.style.display = '';
        this.dom.modesSection.style.display = '';
        this.dom.moduleContent.innerHTML = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // 异步卸载模块（不阻塞视图切换）
        this.moduleLoader.unload().catch(() => {});

        // 停止定时器
        if (this._blindLightInterval) { clearInterval(this._blindLightInterval); this._blindLightInterval = null; }
        if (this._blindRealtimeInterval) { clearInterval(this._blindRealtimeInterval); this._blindRealtimeInterval = null; }
        if (this._cognitiveClockInterval) { clearInterval(this._cognitiveClockInterval); this._cognitiveClockInterval = null; }
        if (this._obstacleFrameId) { cancelAnimationFrame(this._obstacleFrameId); this._obstacleFrameId = null; }

        this._blindObstacleRunning = false;
        this._gestureActive = false;
        this._gestureMode = null;
        if (this._gestureAnimFrame) { cancelAnimationFrame(this._gestureAnimFrame); this._gestureAnimFrame = null; }

        try { this._physicalStopVoiceControl(); } catch (e) {}

        clearTimeout(this._signSentenceTimeout);
        this._gestureBuffer = [];
        this._gestureStableGesture = '';
        this._signSentence = '';
        this._blindPrevFrame = null;
        try { if (this.dynamicRecognizer) this.dynamicRecognizer.reset(); } catch (e) {}

        // 清理手语训练状态
        this._signTrainingMode = false;
        this._signTrainingLabel = '';
        this._signTrainingCount = 0;

        this.currentMode = null;
        this._currentMode = null;
        try { this._hideCamera(); } catch (e) {}

        // 恢复大字体和高对比度设置（认知障碍模式会强制开启）
        if (!this.settings.get('largeFont')) {
            this.dom.body.classList.remove('large-font');
            this.dom.btnFontToggle.classList.remove('active');
        }
        if (!this.settings.get('highContrast')) {
            this.dom.body.classList.remove('high-contrast');
            this.dom.btnContrastToggle.classList.remove('active');
        }

        // 分发返回主页事件
        window.dispatchEvent(new CustomEvent('app:goHome'));
    }

    /**
     * 显示摄像头容器
     */
    _showCamera() {
        this.dom.cameraContainer.hidden = false;

        // 添加加载遮罩
        const existingOverlay = this.dom.cameraContainer.querySelector('.camera-loading-overlay');
        if (existingOverlay) existingOverlay.remove();
        const overlay = document.createElement('div');
        overlay.className = 'camera-loading-overlay';
        overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;border-radius:12px;';
        overlay.innerHTML = `
            <div style="width:60px;height:60px;border-radius:50%;border:3px solid #333;border-top-color:#c8a45c;animation:spin 1s linear infinite;"></div>
            <p style="color:#c8a45c;margin-top:16px;font-size:0.9rem;">正在启动摄像头...</p>
        `;
        this.dom.cameraContainer.style.position = 'relative';
        this.dom.cameraContainer.appendChild(overlay);

        this.camera.init().then(success => {
            if (success) {
                // 移除遮罩
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.style.opacity = '0';
                        overlay.style.transition = 'opacity 0.5s';
                        setTimeout(() => overlay.remove(), 500);
                    }
                }, 500);
                this.toast.show('摄像头已启动', 'success');
            }
        }).catch(err => {
            if (overlay.parentNode) overlay.remove();
            this.toast.show(err.message, 'error');
        });
    }

    /**
     * 隐藏摄像头容器
     */
    _hideCamera() {
        try {
            if (this.camera && this.camera.stream) {
                this.camera.stop();
            }
        } catch (e) {
            console.warn('[摄像头] 停止时出错:', e);
        }
        if (this.dom.cameraContainer) {
            this.dom.cameraContainer.hidden = true;
        }
    }

    /**
     * 设置模块内容 HTML
     * @param {string} html - HTML 内容
     */
    _setModuleHTML(html) {
        this.dom.moduleContent.innerHTML = html;
    }

    /* ---------- 设置切换 ---------- */

    /**
     * 切换语音播报
     */
    _toggleSpeech() {
        const enabled = this.speech.toggle();
        this.settings.set('speechEnabled', enabled);
        this.dom.btnSpeechToggle.classList.toggle('active', enabled);
        this.toast.show(enabled ? '语音播报已开启' : '语音播报已关闭', 'info');
    }

    /**
     * 切换高对比度模式
     */
    _toggleContrast() {
        const isOn = this.dom.body.classList.toggle('high-contrast');
        this.settings.set('highContrast', isOn);
        this.dom.btnContrastToggle.classList.toggle('active', isOn);
        this.toast.show(isOn ? '高对比度模式已开启' : '高对比度模式已关闭', 'info');
    }

    /**
     * 切换大字体模式
     */
    _toggleLargeFont() {
        const isOn = this.dom.body.classList.toggle('large-font');
        this.settings.set('largeFont', isOn);
        this.dom.btnFontToggle.classList.toggle('active', isOn);
        this.toast.show(isOn ? '大字体模式已开启' : '大字体模式已关闭', 'info');
    }

    /* ---------- 欢迎语音 ---------- */

    /**
     * 播报欢迎语
     */
    _speakWelcome() {
        const welcomeText = this._isMobile
            ? '欢迎使用 Hello AI 无障碍辅助。请选择功能模式。'
            : '欢迎使用 Hello AI 无障碍辅助。这是一款为残障人士设计的智能辅助工具。请选择一个功能模式开始使用。视障辅助可以帮助您感知周围环境，听障辅助可以将手语翻译为语音，认知辅助提供步骤引导，肢体障碍辅助支持语音控制。';
        this.speech.speak(welcomeText, { rate: this._isMobile ? 0.9 : 1.0 });
    }

    /* ---------- 听障辅助：手势识别相关方法 ---------- */

    /**
     * 初始化 MediaPipe Gesture Recognizer（官方预训练模型）
     */
    async _initGestureRecognizer() {
        // 如果模型已存在，验证是否可用
        if (this._gestureRecognizer) {
            try {
                // 简单验证：尝试调用一个方法确认模型可用
                const testResult = this._gestureRecognizer.recognizeForVideo(null, 0);
                // 如果没抛异常，模型可用
                console.log('[手势识别] 模型已缓存，直接使用');
                return true;
            } catch (e) {
                // 模型不可用，重置后重新加载
                console.warn('[手势识别] 缓存的模型不可用，重新加载:', e.message);
                this._gestureRecognizer = null;
            }
        }

        // 显示加载遮罩
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'model-loading-overlay';
        loadingOverlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: #f0ece4; font-family: var(--font-primary);
        `;
        loadingOverlay.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem; animation: pulse 1.5s ease-in-out infinite;">&#129306;</div>
                <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: #c8a45c;">正在加载手势识别模型</h3>
                <p style="font-size: 0.9rem; color: #a09a8e; margin-bottom: 1.5rem;">首次加载需要下载约 7MB，请耐心等待...</p>
                <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                    <div id="loading-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #c8a45c, #dbb96e); border-radius: 2px; transition: width 0.3s ease;"></div>
                </div>
                <p id="loading-status" style="font-size: 0.8rem; color: #9a9490; margin-top: 0.5rem;">准备中...</p>
                <button id="loading-cancel" style="margin-top: 1.5rem; padding: 0.5rem 1.5rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #a09a8e; cursor: pointer; font-size: 0.9rem;">取消加载</button>
            </div>
        `;
        document.body.appendChild(loadingOverlay);

        // 取消按钮和超时机制
        let loadingCancelled = false;
        const cancelBtn = document.getElementById('loading-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                loadingCancelled = true;
                loadingOverlay.remove();
                this.toast.show('已取消加载模型', 'info');
            });
        }

        // 30秒超时
        const loadingTimeout = setTimeout(() => {
            if (!loadingCancelled && loadingOverlay.parentNode) {
                loadingCancelled = true;
                loadingOverlay.remove();
                this.toast.show('模型加载超时，请检查网络后重试', 'error', 5000);
            }
        }, 30000);

        const updateProgress = (percent, status) => {
            if (loadingCancelled) return;
            const progressBar = document.getElementById('loading-progress');
            const statusText = document.getElementById('loading-status');
            if (progressBar) progressBar.style.width = percent + '%';
            if (statusText) statusText.textContent = status;
        };

        try {
            updateProgress(10, '加载引擎组件...');
            console.log('[手势识别] 开始加载...');

            // 使用本地文件（避免CDN被墙）
            let visionModule;
            let wasmPath;
            let modelPath;

            try {
                const basePath = this._getBasePath();
                visionModule = await import(basePath + 'libs/mediapipe/vision_bundle.mjs');
                wasmPath = basePath + 'libs/mediapipe/wasm';
                modelPath = basePath + 'libs/mediapipe/gesture_recognizer.task';
                console.log('[手势识别] 使用本地文件:', wasmPath);
            } catch (localErr) {
                console.warn('[手势识别] 本地文件加载失败，回退到CDN:', localErr.message);
                visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs');
                wasmPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
                modelPath = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
            }

            const { FilesetResolver, GestureRecognizer } = visionModule;

            if (loadingCancelled) return false;

            updateProgress(30, '加载 WASM 引擎...');
            const vision = await FilesetResolver.forVisionTasks(wasmPath);

            if (loadingCancelled) return false;

            const delegate = this._isMobile ? 'CPU' : 'GPU';
            updateProgress(50, '加载识别模型（' + delegate + '模式）...');

            this._gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: modelPath,
                    delegate: delegate
                },
                runningMode: "VIDEO",
                numHands: 2,
                minHandDetectionConfidence: 0.3,
                minHandPresenceConfidence: 0.3,
                minTrackingConfidence: 0.3
            });

            clearTimeout(loadingTimeout);
            updateProgress(100, '加载完成！');
            console.log('[手势识别] 加载成功（' + delegate + '模式）');

            // 延迟移除遮罩
            setTimeout(() => {
                if (loadingOverlay.parentNode) loadingOverlay.remove();
                this.toast.show('手势识别已就绪', 'success');
            }, 500);

            return true;
        } catch (error) {
            if (loadingCancelled) return false;
            console.error('[手势识别] 初始模式失败:', error);
            updateProgress(50, '尝试备用模式...');

            const fallbackDelegate = this._isMobile ? 'GPU' : 'CPU';
            try {
                const basePath = this._getBasePath();
                let visionModule, wasmPath, modelPath;
                try {
                    visionModule = await import(basePath + 'libs/mediapipe/vision_bundle.mjs');
                    wasmPath = basePath + 'libs/mediapipe/wasm';
                    modelPath = basePath + 'libs/mediapipe/gesture_recognizer.task';
                } catch (e) {
                    visionModule = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs');
                    wasmPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
                    modelPath = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
                }

                if (loadingCancelled) return false;

                const { FilesetResolver, GestureRecognizer } = visionModule;
                updateProgress(70, '加载备用引擎...');
                const vision = await FilesetResolver.forVisionTasks(wasmPath);

                if (loadingCancelled) return false;

                updateProgress(80, '加载备用模型...');
                this._gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: modelPath,
                        delegate: fallbackDelegate
                    },
                    runningMode: "VIDEO",
                    numHands: 2,
                    minHandDetectionConfidence: 0.3,
                    minHandPresenceConfidence: 0.3,
                    minTrackingConfidence: 0.3
                });

                clearTimeout(loadingTimeout);
                updateProgress(100, '加载完成！');
                setTimeout(() => {
                    if (loadingOverlay.parentNode) loadingOverlay.remove();
                    this.toast.show('手势识别已就绪（' + fallbackDelegate + '模式）', 'success');
                }, 500);
                return true;
            } catch (e2) {
                console.error('[手势识别] 降级模式也失败:', e2);
                clearTimeout(loadingTimeout);
                if (loadingOverlay.parentNode) loadingOverlay.remove();
                this.toast.show('模型加载失败: ' + e2.message, 'error', 5000);
                return false;
            }
        }
    }

    /**
     * 获取应用基础路径（用于加载本地资源文件）
     */
    _getBasePath() {
        const script = document.querySelector('script[src*="app.js"]');
        if (script) {
            const src = script.getAttribute('src');
            return src.substring(0, src.lastIndexOf('/') + 1).replace('/js/', '/');
        }
        return './';
    }

}

// 将辅助模式模块方法合并到 AccessibilityApp 原型上
// 这样模块中的 this 仍然指向 app 实例
Object.assign(AccessibilityApp.prototype,
    deafMethods,
    blindMethods,
    cognitiveMethods,
    physicalMethods,
    elderlyMethods
);

/* ============================================================
   应用启动
   ============================================================ */

// 创建全局应用实例（挂到 window 上，供 onclick 等内联事件使用）
const app = new AccessibilityApp();
window.app = app;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(err => {
        console.error('[Hello AI] 应用初始化失败:', err);
    });
});
