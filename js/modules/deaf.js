/** @module deaf 听障辅助模块 */
/**
 * ============================================================
 * 听障辅助模块
 * 手势识别转语音、手语训练、自定义词汇
 * ============================================================
 */

'use strict';

import { $ } from '../utils/dom.js';

export const deafMethods = {

    /**
     * 启动手势识别（听障模块用）
     */
    async _deafStartGesture() {
        if (this._gestureActive) return;

        const video = $('#camera-video');
        const canvas = $('#camera-canvas');
        if (!video || !canvas) {
            this.toast.show('摄像头未就绪', 'error');
            return;
        }

        const success = await this._initGestureRecognizer();
        if (!success) return;

        this._gestureActive = true;
        this._gestureMode = 'deaf';
        this._gestureStableGesture = '';
        this._gestureBuffer = [];

        // 设置 canvas 尺寸（确保视频已就绪）
        const setCanvasSize = () => {
            const vw = video.videoWidth || video.offsetWidth || 480;
            const vh = video.videoHeight || video.offsetHeight || 360;
            canvas.width = vw;
            canvas.height = vh;
            console.log('[手势识别] Canvas 尺寸:', vw, 'x', vh);
        };

        // 先尝试立即设置，如果视频还没就绪则等待
        if (video.videoWidth > 0) {
            setCanvasSize();
        } else {
            video.addEventListener('loadedmetadata', setCanvasSize, { once: true });
            // 兜底：1秒后强制设置
            setTimeout(setCanvasSize, 1000);
        }

        let lastVideoTime = -1;
        let frameCount = 0;
        let lastDetectTime = 0;
        let _timestampBase = performance.now(); // 时间戳基准，确保严格递增
        let _lastTimestamp = 0;
        let _consecutiveErrors = 0;

        const detectLoop = () => {
            if (!this._gestureActive) return;

            const now = performance.now();

            // 每100ms检测一次（降低手机CPU压力），且视频必须就绪
            if (video.readyState >= 2 && now - lastDetectTime > 100) {
                lastDetectTime = now;
                frameCount++;

                try {
                    // 使用 performance.now() 差值作为 timestamp，确保严格递增
                    const timestamp = Math.round(now - _timestampBase);
                    if (timestamp <= _lastTimestamp) {
                        // 跳过此帧，避免时间戳倒退
                        this._gestureAnimFrame = requestAnimationFrame(detectLoop);
                        return;
                    }
                    _lastTimestamp = timestamp;
                    const results = this._gestureRecognizer.recognizeForVideo(video, timestamp);
                    _consecutiveErrors = 0;
                    this._onGestureResults(results, 'deaf');

                    // 更新调试面板（用当前结果，不额外调用）
                    if (frameCount % 10 === 0) {
                        const dbgReady = $('#dbg-ready');
                        const dbgSize = $('#dbg-size');
                        const dbgFrames = $('#dbg-frames');
                        const dbgHands = $('#dbg-hands');
                        const dbgSamples = $('#dbg-samples');
                        const dbgKnn = $('#dbg-knn');
                        if (dbgReady) dbgReady.textContent = video.readyState + '/4';
                        if (dbgSize) dbgSize.textContent = video.videoWidth + 'x' + video.videoHeight;
                        if (dbgFrames) dbgFrames.textContent = frameCount;
                        if (dbgHands) {
                            const hc = results.landmarks ? results.landmarks.length : 0;
                            dbgHands.textContent = hc;
                        }
                        if (dbgSamples) {
                            const sc = this.signClassifier;
                            if (sc && sc.samples.length > 0) {
                                const counts = {};
                                sc.samples.forEach(s => counts[s.label] = (counts[s.label] || 0) + 1);
                                dbgSamples.textContent = sc.samples.length + '个 [' + Object.entries(counts).map(([k,v]) => k+':'+v).join(', ') + ']';
                            } else {
                                dbgSamples.textContent = '0';
                            }
                        }
                        // 尝试KNN分类并显示结果
                        if (dbgKnn && this.signClassifier && this.signClassifier.samples.length > 0 && results.landmarks && results.landmarks.length > 0) {
                            const knn = this.signClassifier.classify(results.landmarks);
                            dbgKnn.textContent = knn ? knn.label + '(' + (knn.confidence * 100).toFixed(0) + '%)' : '无匹配';
                        } else if (dbgKnn) {
                            dbgKnn.textContent = this.signClassifier && this.signClassifier.samples.length > 0 ? '等待手部...' : '无训练数据';
                        }
                        // 显示动态手势识别结果
                        const dbgDyn = $('#dbg-dynamic');
                        if (dbgDyn && this.dynamicRecognizer && this.dynamicRecognizer.isReady && results.landmarks && results.landmarks.length > 0) {
                            const dynResult = this.dynamicRecognizer.processFrame(results.landmarks);
                            dbgDyn.textContent = dynResult ? dynResult.label + '(' + (dynResult.confidence * 100).toFixed(0) + '%)' : '识别中...';
                        } else if (dbgDyn) {
                            dbgDyn.textContent = this.dynamicRecognizer && this.dynamicRecognizer.isReady ? '等待手部...' : '未初始化';
                        }
                    }
                } catch (e) {
                    _consecutiveErrors++;
                    // 时间戳错误时重置基准
                    if (e.message && e.message.includes('timestamp')) {
                        _timestampBase = performance.now();
                        _lastTimestamp = 0;
                    }
                    // 连续出错超过10次，尝试重置识别器
                    if (_consecutiveErrors > 10) {
                        _consecutiveErrors = 0;
                        console.warn('[手势识别] 连续出错过多，尝试重置识别器');
                        this._gestureRecognizer = null;
                        this._initGestureRecognizer().then(ok => {
                            if (ok) {
                                _timestampBase = performance.now();
                                _lastTimestamp = 0;
                                this.toast.show('识别器已重置', 'info');
                            }
                        });
                    }
                }
            }

            this._gestureAnimFrame = requestAnimationFrame(detectLoop);
        };

        // 等待视频就绪
        const waitForVideo = () => {
            if (video.readyState >= 2) {
                detectLoop();
                this.toast.show('手势识别已启动', 'success');
                this.speech.speak('手势识别已启动，请将手放在摄像头前。');

                const startBtn = $('#btn-start-gesture');
                const stopBtn = $('#btn-stop-gesture');
                const statusText = $('.status-text');
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = '';
                if (statusText) statusText.textContent = '手势识别运行中...';
            } else {
                setTimeout(waitForVideo, 300);
            }
        };
        waitForVideo();
    },

    /**
     * 停止手势识别
     */
    _deafStopGesture() {
        this._gestureActive = false;
        this._gestureMode = null;
        this._gestureBuffer = [];
        this._gestureStableGesture = '';
        if (this.dynamicRecognizer) this.dynamicRecognizer.reset();
        if (this._gestureAnimFrame) {
            cancelAnimationFrame(this._gestureAnimFrame);
            this._gestureAnimFrame = null;
        }

        const startBtn = $('#btn-start-gesture');
        const stopBtn = $('#btn-stop-gesture');
        const statusText = $('.status-text');
        if (startBtn) startBtn.style.display = '';
        if (stopBtn) stopBtn.style.display = 'none';
        if (statusText) statusText.textContent = '手势识别已停止';
    },

    /**
     * 处理手势识别结果（统一方法，使用官方 GestureRecognizer）
     */
    _onGestureResults(results, mode) {
        const canvas = $('#camera-canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        const video = $('#camera-video');

        // 绘制视频帧
        if (ctx && video) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const gestures = results.gestures;
        const landmarks = results.landmarks;

        const statusText = mode === 'deaf' ? $('.status-text') : null;
        const gestureRecognized = mode === 'deaf' ? $('#gesture-recognized') : null;
        const gestureConfidence = mode === 'deaf' ? $('#gesture-confidence') : null;

        // 只要检测到手部 landmarks 就继续处理（手势识别结果可以为空，KNN 会兜底）
        if (!landmarks || landmarks.length === 0) {
            this._gestureBuffer = [];
            if (statusText) statusText.textContent = '请将手放在摄像头前...';
            if (gestureRecognized) gestureRecognized.textContent = '';
            if (gestureConfidence) gestureConfidence.textContent = '';
            return;
        }

        // 保存 landmarks 供手语训练采集使用
        this._signLastLandmarks = landmarks;

        // 绘制手部关键点和连接线
        if (ctx && landmarks) {
            const HAND_CONNECTIONS_CUSTOM = [
                [0,1],[1,2],[2,3],[3,4],
                [0,5],[5,6],[6,7],[7,8],
                [0,9],[9,10],[10,11],[11,12],
                [0,13],[13,14],[14,15],[15,16],
                [0,17],[17,18],[18,19],[19,20],
                [5,9],[9,13],[13,17]
            ];
            const FINGERTIPS = [4, 8, 12, 16, 20];

            for (const hand of landmarks) {
                // 连接线
                ctx.strokeStyle = 'rgba(200, 164, 92, 0.8)';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                for (const [s, e] of HAND_CONNECTIONS_CUSTOM) {
                    ctx.beginPath();
                    ctx.moveTo(hand[s].x * canvas.width, hand[s].y * canvas.height);
                    ctx.lineTo(hand[e].x * canvas.width, hand[e].y * canvas.height);
                    ctx.stroke();
                }
                // 关键点
                for (let i = 0; i < hand.length; i++) {
                    const x = hand[i].x * canvas.width;
                    const y = hand[i].y * canvas.height;
                    const isTip = FINGERTIPS.includes(i);
                    const r = isTip ? 7 : 4;
                    ctx.beginPath();
                    ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
                    ctx.fillStyle = isTip ? 'rgba(232, 196, 74, 0.4)' : 'rgba(200, 164, 92, 0.3)';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x, y, r, 0, 2 * Math.PI);
                    ctx.fillStyle = isTip ? '#e8c44a' : '#c8a45c';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(x, y, Math.max(1, r - 3), 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(255,255,255,0.8)';
                    ctx.fill();
                }
            }
        }

        // 获取标准手势识别结果
        let chineseName = '';
        let score = 0;

        // 动态手势序列识别（独立于标准手势和KNN）
        if (mode === 'deaf' && this.dynamicRecognizer) {
            const dynResult = this.dynamicRecognizer.processFrame(landmarks);
            if (dynResult && dynResult.confidence >= 0.4) {
                chineseName = dynResult.label;
                score = dynResult.confidence;
                console.log('[动态手势] 识别到:', chineseName, '置信度:', (dynResult.confidence * 100).toFixed(0) + '%');
            }
        }

        if (gestures && gestures.length > 0 && gestures[0] && gestures[0][0]) {
            const gesture = gestures[0][0];
            let gestureName = gesture.categoryName;
            score = gesture.score;

            // 标准手势置信度太低则忽略（避免误识别为 Open_Palm 等）
            if (score < 0.6) {
                gestureName = 'None';
            }

            // 映射到中文
            const nameMap = {
                'None': '',
                'Closed_Fist': '握拳',
                'Open_Palm': '你好',
                'Pointing_Up': '指向上',
                'Thumb_Down': '不好',
                'Thumb_Up': '好的',
                'Victory': '谢谢',
                'ILoveYou': '我爱你'
            };

            chineseName = nameMap[gestureName] || '';

            // 当官方模型返回 None 时，用 landmarks 自定义判断更多手势
            if (!chineseName && landmarks && landmarks.length > 0) {
                const customGesture = this._customGestureFromLandmarks(landmarks);
                if (customGesture) {
                    chineseName = customGesture.name;
                    score = customGesture.confidence;
                }
            }
        }

        // 如果有用户训练数据，智能选择：标准手势和KNN取置信度更高的
        if (this.signClassifier && this.signClassifier.samples.length > 0 && landmarks) {
            const knnResult = this.signClassifier.classify(landmarks);
            if (knnResult) {
                if (!chineseName) {
                    // 标准手势没匹配到，KNN 置信度 >= 35% 即可触发
                    if (knnResult.confidence >= 0.35) {
                        chineseName = knnResult.label;
                        score = knnResult.confidence;
                    }
                } else if (knnResult.confidence > score + 0.15) {
                    // 标准手势匹配到了，但KNN置信度高 15% 以上才覆盖
                    chineseName = knnResult.label;
                    score = knnResult.confidence;
                }
            }
        }

        if (!chineseName) {
            // 不要清空 buffer！用"未知"标记，避免打断连续帧计数
            this._gestureBuffer.push('__none__');
            if (this._gestureBuffer.length > 5) this._gestureBuffer.shift();
            if (statusText) statusText.textContent = '正在分析手势...';
            return;
        }

        // 立即更新视觉反馈（不需要等待稳定）
        if (mode === 'deaf' && gestureRecognized) {
            gestureRecognized.textContent = chineseName;
        }
        if (mode === 'deaf' && gestureConfidence) {
            gestureConfidence.textContent = `置信度: ${Math.round(score * 100)}%`;
        }
        if (statusText) statusText.textContent = `识别到: ${chineseName}`;

        // 稳定性检测（缓冲区缩小到 5 帧，更快响应）
        this._gestureBuffer.push(chineseName);
        if (this._gestureBuffer.length > 5) this._gestureBuffer.shift();

        // 统计时排除"未知"帧
        const meaningfulFrames = this._gestureBuffer.filter(g => g !== '__none__');
        const sameCount = meaningfulFrames.filter(g => g === chineseName).length;

        // 冷却 1.5 秒（更快速的实时反馈）
        const now = Date.now();
        const isCooldownOver = chineseName !== this._gestureStableGesture ||
                                (now - (this._gestureLastTriggerTime || 0)) > 1500;

        // 需 2 帧稳定触发（减少误触发）
        if (sameCount >= 2 && isCooldownOver) {
            this._gestureStableGesture = chineseName;
            this._gestureLastTriggerTime = now;

            if (mode === 'deaf') {
                if (gestureRecognized) {
                    gestureRecognized.style.animation = 'none';
                    gestureRecognized.offsetHeight;
                    gestureRecognized.style.animation = 'fadeInUp 0.3s ease-out';
                }
                this._deafAddToHistory(chineseName);
                // 实时语音输出
                this.speech.speak(chineseName);
                if (navigator.vibrate) navigator.vibrate(100);
                // 手语句子组合
                this._processSignLanguageResult(chineseName, score);
            } else if (mode === 'blind') {
                this._executeBlindGestureAction(chineseName);
            }
        }
    },

    /**
     * 自定义手势判断（补充官方模型不支持的手势）
     * 通过分析 landmarks 关键点来判断
     */
    _customGestureFromLandmarks(landmarksArray) {
        if (!landmarksArray || landmarksArray.length === 0) return null;

        const hand = landmarksArray[0];
        const wrist = hand[0];

        // 分析手指状态
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerPips = [3, 6, 10, 14, 18];
        const fingerMcps = [2, 5, 9, 13, 17];
        const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
        const fingers = {};

        // 拇指：tip 到 mcp 的距离 vs ip 到 mcp 的距离
        const thumbTip = hand[4], thumbIp = hand[3], thumbMcp = hand[2];
        const thumbDist = Math.hypot(thumbTip.x - thumbMcp.x, thumbTip.y - thumbMcp.y);
        const thumbIpDist = Math.hypot(thumbIp.x - thumbMcp.x, thumbIp.y - thumbMcp.y);
        fingers.thumb = thumbDist > thumbIpDist * 1.15;

        // 其他四指
        for (let i = 1; i < 5; i++) {
            const tip = hand[fingerTips[i]];
            const pip = hand[fingerPips[i]];
            const mcp = hand[fingerMcps[i]];
            const tipUp = tip.y < pip.y;
            const tipFar = Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
            fingers[fingerNames[i]] = tipUp && tipFar;
        }

        const count = Object.values(fingers).filter(Boolean).length;
        const { thumb, index, middle, ring, pinky } = fingers;

        // OK 手势：拇指和食指形成圆圈
        if (!middle && !ring && !pinky) {
            const okDist = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y);
            if (okDist < 0.07) {
                return { name: '好的', confidence: 0.85 };
            }
        }

        // 数字手势：三（三根手指）
        if (!thumb && index && middle && ring && !pinky) {
            return { name: '三', confidence: 0.8 };
        }

        // 数字手势：四
        if (!thumb && index && middle && ring && pinky) {
            return { name: '四', confidence: 0.8 };
        }

        // 摇滚手势：食指+小指
        if (!thumb && index && !middle && !ring && pinky) {
            return { name: '加油', confidence: 0.85 };
        }

        // 大拇指+食指（非OK）：点赞
        if (thumb && index && !middle && !ring && !pinky) {
            const okDist = Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y);
            if (okDist >= 0.07) {
                return { name: '好', confidence: 0.75 };
            }
        }

        // 拇指朝下
        if (!index && !middle && !ring && !pinky && hand[4].y > hand[3].y && hand[3].y > hand[2].y) {
            return { name: '不好', confidence: 0.8 };
        }

        return null;
    },

    /**
     * 添加手势到历史记录
     */
    _deafAddToHistory(gestureName) {
        const safeName = gestureName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
        const historyEl = $('#gesture-history');
        if (!historyEl) return;

        // 移除空提示
        const emptyMsg = historyEl.querySelector('.history-empty');
        if (emptyMsg) emptyMsg.remove();

        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span class="history-time">${time}</span>
            <span class="history-gesture">${safeName}</span>
            <button class="history-speak-btn" aria-label="朗读${safeName}">&#9835;</button>
        `;
        item.querySelector('.history-speak-btn').addEventListener('click', () => {
            this.speech.speak(gestureName);
        });

        historyEl.insertBefore(item, historyEl.firstChild);

        // 限制历史记录数量
        while (historyEl.children.length > 20) {
            historyEl.removeChild(historyEl.lastChild);
        }
    },

    /**
     * 朗读最后一条识别结果
     */
    _deafSpeakLast() {
        const historyEl = $('#gesture-history');
        if (!historyEl) return;

        const firstItem = historyEl.querySelector('.history-gesture');
        if (firstItem) {
            this.speech.speak(`最后识别的手势是：${firstItem.textContent}`);
        } else {
            this.toast.show('暂无识别记录', 'info');
        }
    },

    /**
     * 清除手势历史
     */
    _deafClearHistory() {
        const historyEl = $('#gesture-history');
        if (historyEl) {
            historyEl.innerHTML = '<p class="history-empty">暂无识别记录</p>';
        }
        this.toast.show('历史记录已清除', 'info');
    },

    /* ---------- 手语输入相关方法 ---------- */

    /**
     * 手语识别结果处理（在 _onGestureResults 中调用）
     */
    _processSignLanguageResult(chineseName, confidence) {
        // 添加到手语句子（chineseName 已经在 _onGestureResults 中经过 KNN 处理，这里不再重复）
        if (chineseName && chineseName !== '未知') {
            this._signSentence += chineseName;

            const sentenceEl = $('#sign-sentence-text');
            if (sentenceEl) {
                sentenceEl.textContent = this._signSentence;
                sentenceEl.style.animation = 'none';
                sentenceEl.offsetHeight;
                sentenceEl.style.animation = 'fadeInUp 0.3s ease-out';
            }

            // 5秒无新输入则自动清空
            clearTimeout(this._signSentenceTimeout);
            this._signSentenceTimeout = setTimeout(() => {
                if (this._signSentence) {
                    this.speech.speak(this._signSentence);
                    this._signSentence = '';
                    if (sentenceEl) sentenceEl.textContent = '等待手语输入...';
                }
            }, 5000);
        }
    },

    /**
     * 清除手语句子
     */
    _signClearSentence() {
        this._signSentence = '';
        clearTimeout(this._signSentenceTimeout);
        const sentenceEl = $('#sign-sentence-text');
        if (sentenceEl) sentenceEl.textContent = '等待手语输入...';
        this.toast.show('句子已清除', 'info');
    },

    /**
     * 朗读手语句子
     */
    _signSpeakSentence() {
        if (this._signSentence) {
            this.speech.speak(this._signSentence);
        } else {
            this.toast.show('暂无手语内容', 'info');
        }
    },

    /**
     * 采集手语训练样本
     */
    async _signCaptureSample() {
        const labelInput = $('#sign-train-label');
        if (!labelInput) return;

        const label = labelInput.value.trim();
        if (!label) {
            this.toast.show('请先输入手语词汇名称', 'error');
            return;
        }

        // 获取当前帧的 landmarks
        if (!this._signLastLandmarks || this._signLastLandmarks.length === 0) {
            this.toast.show('未检测到手部，请将手放在摄像头前再采集', 'error');
            return;
        }

        const success = this.signClassifier.addSample(this._signLastLandmarks, label);
        if (success) {
            this._signTrainingCount++;
            const countEl = $('#sign-train-count');
            if (countEl) countEl.textContent = `已采集: ${this._signTrainingCount}`;

            if (navigator.vibrate) navigator.vibrate(50);
            this.toast.show(`已采集"${label}"的第 ${this._signTrainingCount} 个样本（建议采集15-20个）`, 'success');

            // 更新训练列表
            this._updateTrainingList();
        }
    },

    /**
     * 保存训练数据
     */
    async _signSaveTraining() {
        await this.signClassifier.save();
        this._signTrainingCount = this.signClassifier.samples.length;
        const countEl = $('#sign-train-count');
        if (countEl) countEl.textContent = `已采集: ${this._signTrainingCount}`;
        this._updateTrainingList();
        this.toast.show(`训练数据已保存（共 ${this.signClassifier.samples.length} 个样本）`, 'success');
    },

    /**
     * 导出训练数据
     */
    _signExportTraining() {
        const data = this.signClassifier.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sign-language-training.json';
        a.click();
        URL.revokeObjectURL(url);
        this.toast.show('训练数据已导出', 'success');
    },

    /**
     * 导入训练数据
     */
    _signImportTraining() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const success = this.signClassifier.importData(ev.target.result);
                if (success) {
                    this._signTrainingCount = this.signClassifier.samples.length;
                    const countEl = $('#sign-train-count');
                    if (countEl) countEl.textContent = `已采集: ${this._signTrainingCount}`;
                    this._updateTrainingList();
                    this.toast.show(`已导入 ${this.signClassifier.samples.length} 个样本`, 'success');
                } else {
                    this.toast.show('导入失败，文件格式不正确', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    /**
     * 导入vivo训练数据
     */
    async _signImportVivoData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    // 先验证数据格式
                    const validation = this.signClassifier.validateData(ev.target.result);
                    if (!validation.valid) {
                        this.toast.show(`数据格式错误: ${validation.message}`, 'error');
                        return;
                    }

                    this.toast.show(`检测到${validation.format}格式，正在导入...`, 'info');

                    // 导入数据
                    const result = await this.signClassifier.importVivoData(ev.target.result);

                    if (result.success) {
                        this._signTrainingCount = this.signClassifier.samples.length;
                        const countEl = $('#sign-train-count');
                        if (countEl) countEl.textContent = `已采集: ${this._signTrainingCount}`;
                        this._updateTrainingList();
                        this.toast.show(`成功导入 ${result.imported} 条${result.format}格式数据`, 'success');
                    } else {
                        this.toast.show(`导入失败: ${result.error}`, 'error');
                    }
                } catch (error) {
                    this.toast.show(`导入出错: ${error.message}`, 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    /**
     * 清除训练数据
     */
    async _signClearTraining() {
        // 使用应用内 toast 确认而非浏览器 confirm（更无障碍）
        this._signClearPending = true;
        this.toast.show('再次点击"清除数据"确认清除所有训练数据', 'info', 5000);
        setTimeout(() => { this._signClearPending = false; }, 5000);
        if (!this._signClearConfirmed) {
            this._signClearConfirmed = true;
            setTimeout(() => { this._signClearConfirmed = false; }, 5000);
            return;
        }
        this._signClearConfirmed = false;
        {
            await this.signClassifier.clear();
            this._signTrainingCount = 0;
            const countEl = $('#sign-train-count');
            if (countEl) countEl.textContent = '已采集: 0';
            this._updateTrainingList();
            this.toast.show('训练数据已清除', 'info');
        }
    },

    /**
     * 更新训练列表显示
     */
    _updateTrainingList() {
        const listEl = $('#sign-training-list');
        if (!listEl) return;

        // 统计每个标签的样本数
        const labelCounts = {};
        for (const sample of this.signClassifier.samples) {
            labelCounts[sample.label] = (labelCounts[sample.label] || 0) + 1;
        }

        if (Object.keys(labelCounts).length === 0) {
            listEl.innerHTML = '<p class="history-empty">暂无训练数据</p>';
            return;
        }

        listEl.innerHTML = Object.entries(labelCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => {
                const safeLabel = label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                return `
                <div class="training-item">
                    <span class="training-label">${safeLabel}</span>
                    <span class="training-count-badge">${count} 个样本</span>
                </div>
            `}).join('');
    }

};
