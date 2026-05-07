/** @module blind 视障辅助模块 */
/**
 * ============================================================
 * 视障辅助模块
 * 屏幕朗读、场景描述、颜色识别、光线检测、障碍物提醒、紧急求助
 * ============================================================
 */

'use strict';

import { $, getVideoFrame, avgBrightness, getBrightnessLevel } from '../utils/dom.js';

export const blindMethods = {

    /**
     * 视障模式 - 根据手势执行操作
     */
    _executeBlindGestureAction(gestureName) {
        let actionText = '';

        // 立即语音反馈
        this.speech.speak(gestureName);

        switch (gestureName) {
            case '好的':
                actionText = '确认';
                break;
            case '握拳':
                actionText = '返回主页';
                setTimeout(() => this._goHome(), 800);
                break;
            case '谢谢':
                actionText = '朗读屏幕';
                this._blindReadScreen();
                break;
            case '你好':
                actionText = '场景描述';
                this._blindDescribeScene();
                break;
            case '不好':
                actionText = '停止';
                this.speech.stop();
                break;
            case '我爱你':
                actionText = '我爱你';
                break;
            case '指向上':
                actionText = '颜色识别';
                this._blindColorDetect();
                break;
            default:
                actionText = gestureName;
        }

        // 更新反馈
        const hintFeedback = $('#gesture-hint-feedback');
        if (hintFeedback) {
            hintFeedback.textContent = `${gestureName} → ${actionText}`;
            hintFeedback.style.color = '#c8a45c';
            setTimeout(() => {
                if (hintFeedback) {
                    hintFeedback.textContent = '等待手势...';
                    hintFeedback.style.color = '';
                }
            }, 3000);
        }

        if (navigator.vibrate) navigator.vibrate(150);
    },

    /**
     * 屏幕朗读 - 朗读页面上的文字内容
     */
    _blindReadScreen() {
        const mainContent = document.querySelector('main');
        if (!mainContent) return;

        const text = mainContent.innerText
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 500);

        this.speech.speak(`当前页面内容：${text}`);
        this._updateBlindStatus('正在朗读屏幕内容...');
    },

    /**
     * 场景描述 - 分析摄像头画面
     */
    _blindDescribeScene() {
        const video = $('#camera-video');
        if (!video || !this.camera.isActive()) {
            this.toast.show('摄像头未就绪', 'error');
            return;
        }

        const frame = getVideoFrame(video, 320, 240);
        if (!frame) return;
        const brightness = avgBrightness(frame.imageData.data, 16);
        const { desc } = getBrightnessLevel(brightness);

        this.speech.speak(desc);
        this._updateBlindStatus(desc);
    },

    /**
     * 颜色识别 - 识别摄像头前方主要颜色
     */
    _blindColorDetect() {
        const video = $('#camera-video');
        if (!video || !this.camera.isActive()) {
            this.toast.show('摄像头未就绪', 'error');
            return;
        }

        const frame = getVideoFrame(video, 320, 240);
        if (!frame) return;
        const data = frame.imageData.data;

        // 采样中心区域颜色
        const fw = frame.width || 320, fh = frame.height || 240;
        const centerX = Math.round(fw / 2), centerY = Math.round(fh / 2), radius = Math.round(Math.min(fw, fh) / 6);
        let rSum = 0, gSum = 0, bSum = 0, count = 0;

        for (let y = centerY - radius; y < centerY + radius; y += 4) {
            for (let x = centerX - radius; x < centerX + radius; x += 4) {
                if (y < 0 || y >= fh || x < 0 || x >= fw) continue;
                const idx = (y * fw + x) * 4;
                rSum += data[idx];
                gSum += data[idx + 1];
                bSum += data[idx + 2];
                count++;
            }
        }

        const rAvg = Math.round(rSum / count);
        const gAvg = Math.round(gSum / count);
        const bAvg = Math.round(bSum / count);

        const colorName = this._getColorName(rAvg, gAvg, bAvg);

        this.speech.speak(`检测到的主要颜色是${colorName}。RGB值：红${rAvg}，绿${gAvg}，蓝${bAvg}。`);
        this._updateBlindStatus(`检测到颜色: ${colorName}`);
    },

    /**
     * 根据RGB值获取颜色名称
     */
    _getColorName(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;

        // 灰色判断
        if (diff < 30) {
            if (max > 200) return '白色';
            if (max > 150) return '浅灰色';
            if (max > 80) return '灰色';
            if (max > 30) return '深灰色';
            return '黑色';
        }

        let h = 0;
        if (max === r) h = ((g - b) / diff) % 6;
        else if (max === g) h = (b - r) / diff + 2;
        else h = (r - g) / diff + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;

        const l = (max + min) / 2;
        const denom = 255 - Math.abs(2 * l - 255);
        const s = denom === 0 ? 0 : diff / denom;

        let prefix = '';
        if (l < 80) prefix = '深';
        else if (l > 200) prefix = '浅';

        if (s < 0.15) return prefix + '灰色';

        if (h < 15 || h >= 345) return prefix + '红色';
        if (h < 45) return prefix + '橙色';
        if (h < 70) return prefix + '黄色';
        if (h < 160) return prefix + '绿色';
        if (h < 200) return prefix + '青色';
        if (h < 260) return prefix + '蓝色';
        if (h < 290) return prefix + '紫色';
        return prefix + '粉色';
    },

    /**
     * 光线检测 - 持续检测环境亮度
     */
    _blindLightDetect() {
        if (this._blindLightInterval) {
            clearInterval(this._blindLightInterval);
            this._blindLightInterval = null;
            this.speech.speak('光线检测已停止。');
            this._updateBlindStatus('光线检测已停止');
            return;
        }

        this.speech.speak('光线检测已启动，将每隔3秒播报一次环境亮度。再次点击可停止。');

        const detect = () => {
            const video = $('#camera-video');
            if (!video || !this.camera.isActive()) {
                clearInterval(this._blindLightInterval);
                return;
            }

            const frame = getVideoFrame(video, 160, 120);
            if (!frame) return;
            const brightness = avgBrightness(frame.imageData.data, 32);
            const { level } = getBrightnessLevel(brightness);

            this.speech.speak(`当前环境亮度${level}，数值${brightness}。`);
            this._updateBlindStatus(`光线: ${level} (${brightness})`);
        };

        detect(); // 立即执行一次
        this._blindLightInterval = setInterval(detect, 3000);
    },

    /**
     * 障碍物提醒
     */
    _blindObstacleAlert() {
        this.speech.speak('障碍检测功能已启动。系统将通过摄像头分析前方画面，当检测到可能的障碍物时，会发出语音提醒。请注意，此功能为辅助参考，不能完全替代导盲设备。');
        this._updateBlindStatus('障碍检测运行中...');

        // 简单的运动检测
        let prevFrame = null;
        this._blindObstacleRunning = true;
        const checkFrame = () => {
            if (!this._blindObstacleRunning || this.currentMode !== 'blind') return;

            const video = $('#camera-video');
            if (!video) return;

            const frame = getVideoFrame(video, 160, 120);
            if (!frame) return;
            const currentFrame = frame.imageData;

            if (prevFrame) {
                let diff = 0;
                for (let i = 0; i < currentFrame.data.length; i += 16) {
                    diff += Math.abs(currentFrame.data[i] - prevFrame.data[i]);
                }
                diff = diff / (currentFrame.data.length / 16);

                if (diff > 30) {
                    this.speech.speak('注意，前方检测到变化，可能有障碍物或移动物体。');
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                }
            }

            prevFrame = currentFrame;

            this._obstacleFrameId = requestAnimationFrame(checkFrame);
        };

        checkFrame();
    },

    /**
     * 紧急求助 - 增强版（含精确地名）
     */
    _blindEmergencyHelp() {
        this.speech.speak('紧急求助模式已启动。正在获取您的精确位置...');
        this._updateBlindStatus('正在获取位置...');

        if (navigator.vibrate) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }

        if (!navigator.geolocation) {
            this.speech.speak('您的浏览器不支持定位功能。请手动告知他人您的位置。');
            this._updateBlindStatus('定位不可用');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lon = pos.coords.longitude.toFixed(6);

                this.speech.speak('位置已获取，正在转换为具体地址...');

                // 使用免费反向地理编码 API
                let address = '';
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&accept-language=zh-CN`,
                        { signal: (function() { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })() }
                    );
                    const data = await response.json();
                    if (data && data.display_name) {
                        address = data.display_name;
                    }
                } catch (e1) {
                    console.warn('[紧急求助] Nominatim API失败，尝试备用方案:', e1);
                }

                // 备用方案：使用免费 API
                if (!address) {
                    try {
                        const response = await fetch(
                            `https://cn.apihz.cn/api/other/jwjuhe2.php?id=88888888&lx=2&lat=${lat}&lng=${lon}`,
                            { signal: (function() { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })() }
                        );
                        const data = await response.json();
                        if (data && data.address) {
                            address = data.address;
                        }
                    } catch (e2) {
                        console.warn('[紧急求助] 备用API也失败:', e2);
                    }
                }

                // 如果都失败，使用经纬度
                if (!address) {
                    address = `纬度${lat}，经度${lon}`;
                }

                // 构建求助信息
                const helpInfo = `紧急求助！我是视障人士，需要帮助。我的当前位置：${address}。坐标：纬度${lat}，经度${lon}。请尽快前来协助。`;

                this.speech.speak(`紧急求助信息已生成。您的位置是：${address}。`);
                this._updateBlindStatus(`位置: ${address}`);

                // 显示求助信息面板
                const statusEl = $('#blind-status');
                if (statusEl) {
                    statusEl.innerHTML = `
                        <span class="blind-status-icon">&#128680;</span>
                        <div class="emergency-info">
                            <p><strong>紧急求助信息</strong></p>
                            <p class="emergency-address">${address}</p>
                            <p class="emergency-coords">坐标: ${lat}, ${lon}</p>
                            <div class="emergency-actions">
                                <button class="module-btn" onclick="app._blindCopyHelpInfo()" style="font-size:0.9em; padding:0.5em 1.5em;">
                                    &#128203; 复制信息
                                </button>
                                <button class="module-btn" onclick="app._blindSendSMS()" style="font-size:0.9em; padding:0.5em 1.5em;">
                                    &#128172; 发送短信
                                </button>
                                <button class="module-btn" onclick="app._blindCallEmergency()" style="font-size:0.9em; padding:0.5em 1.5em;">
                                    &#128222; 拨打120
                                </button>
                            </div>
                            <div class="emergency-contacts" id="emergency-contacts-panel">
                                <h5>紧急联系人</h5>
                                <div id="emergency-contacts-list"></div>
                                <button class="module-btn btn-secondary" onclick="app._addEmergencyContact()" style="font-size:0.85em; margin-top:0.5em;">
                                    &#10133; 添加联系人
                                </button>
                            </div>
                        </div>
                    `;

                    // 渲染联系人列表
                    this._renderEmergencyContacts();
                }

                // 保存求助信息供后续使用
                this._emergencyInfo = helpInfo;
                this._emergencyAddress = address;
                this._emergencyLat = lat;
                this._emergencyLon = lon;

                // 再次震动提醒
                if (navigator.vibrate) {
                    navigator.vibrate([300, 100, 300]);
                }
            },
            (error) => {
                let msg = '无法获取位置信息。';
                if (error.code === 1) msg = '定位权限被拒绝，请在浏览器设置中允许定位。';
                else if (error.code === 2) msg = '无法获取位置信号，请移动到开阔区域重试。';
                else if (error.code === 3) msg = '定位超时，请稍后重试。';
                this.speech.speak(msg);
                this._updateBlindStatus('定位失败');
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    },

    /**
     * 复制求助信息到剪贴板
     */
    _blindCopyHelpInfo() {
        if (this._emergencyInfo) {
            navigator.clipboard.writeText(this._emergencyInfo).then(() => {
                this.toast.show('求助信息已复制到剪贴板', 'success');
                this.speech.speak('求助信息已复制到剪贴板，您可以粘贴发送给家人或朋友。');
            }).catch(() => {
                this.toast.show('复制失败，请手动复制', 'error');
            });
        }
    },

    /**
     * 发送短信（优先发给紧急联系人）
     */
    _blindSendSMS() {
        if (this._emergencyContacts.length > 0) {
            // 有紧急联系人，让用户选择
            const contactList = this._emergencyContacts.map((c, i) =>
                `${i + 1}. ${c.name} (${c.phone})`
            ).join('  ');

            this.speech.speak(`请选择要发送短信的联系人。${contactList}。您可以说联系人编号。`);

            // 在紧急面板中显示选择按钮
            const panel = $('#emergency-contacts-panel');
            if (panel) {
                const smsBtns = document.createElement('div');
                smsBtns.className = 'sms-contact-buttons';
                smsBtns.innerHTML = this._emergencyContacts.map((c, i) => `
                    <button class="module-btn" onclick="app._smsContact(${i})" style="font-size:0.85em;">
                        &#128172; 发给${c.name}
                    </button>
                `).join('');
                panel.appendChild(smsBtns);
            }
        } else {
            // 没有紧急联系人，使用通用短信
            if (this._emergencyInfo) {
                const smsUrl = `sms:?body=${encodeURIComponent(this._emergencyInfo)}`;
                window.open(smsUrl, '_blank');
                this.speech.speak('正在打开短信发送界面，请选择收件人后发送。');
            } else {
                this.toast.show('请先触发紧急求助以生成求助信息', 'info');
            }
        }
    },

    /**
     * 拨打急救电话
     */
    _blindCallEmergency() {
        this.speech.speak('正在拨打急救电话120。');
        window.location.href = 'tel:120';
    },

    /**
     * 渲染紧急联系人列表
     */
    _renderEmergencyContacts() {
        const listEl = $('#emergency-contacts-list');
        if (!listEl) return;

        if (this._emergencyContacts.length === 0) {
            listEl.innerHTML = '<p style="font-size:0.85em; color:var(--color-text-muted);">暂未设置紧急联系人，点击下方添加</p>';
            return;
        }

        listEl.innerHTML = this._emergencyContacts.map((contact, i) => `
            <div class="contact-item">
                <div class="contact-info">
                    <span class="contact-name">${contact.name}</span>
                    <span class="contact-phone">${contact.phone}</span>
                </div>
                <div class="contact-actions">
                    <button class="contact-btn" onclick="app._callContact(${i})" title="拨打电话">&#128222;</button>
                    <button class="contact-btn" onclick="app._smsContact(${i})" title="发送短信">&#128172;</button>
                    <button class="contact-btn contact-delete" onclick="app._deleteContact(${i})" title="删除">&#128465;</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * 添加紧急联系人
     */
    _addEmergencyContact() {
        // 使用内联输入方式（不使用 prompt）
        const panel = $('#emergency-contacts-panel');
        if (!panel || panel.querySelector('.add-contact-form')) return;

        const form = document.createElement('div');
        form.className = 'add-contact-form';
        form.innerHTML = `
            <input type="text" id="contact-name-input" placeholder="姓名（如：妈妈）" class="training-input" maxlength="20" aria-label="联系人姓名">
            <input type="tel" id="contact-phone-input" placeholder="手机号（如：13800138000）" class="training-input" maxlength="15" aria-label="联系人电话">
            <div style="display:flex;gap:0.5em;margin-top:0.5em;">
                <button class="module-btn" onclick="app._saveContact()" style="font-size:0.85em;">保存</button>
                <button class="module-btn btn-secondary" onclick="this.closest('.add-contact-form').remove()" style="font-size:0.85em;">取消</button>
            </div>
        `;
        panel.appendChild(form);
        document.getElementById('contact-name-input').focus();
    },

    /**
     * 保存联系人
     */
    _saveContact() {
        const nameInput = $('#contact-name-input');
        const phoneInput = $('#contact-phone-input');
        if (!nameInput || !phoneInput) return;

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();

        if (!name) {
            this.toast.show('请输入联系人姓名', 'error');
            return;
        }
        if (!phone || !/^1\d{10}$/.test(phone)) {
            this.toast.show('请输入正确的手机号', 'error');
            return;
        }

        this._emergencyContacts.push({ name, phone });
        localStorage.setItem('emergencyContacts', JSON.stringify(this._emergencyContacts));

        this._renderEmergencyContacts();
        this.toast.show(`已添加联系人：${name}`, 'success');
        this.speech.speak(`已添加紧急联系人${name}`);
    },

    /**
     * 删除联系人
     */
    _deleteContact(index) {
        const contact = this._emergencyContacts[index];
        if (!contact) return;

        this._emergencyContacts.splice(index, 1);
        localStorage.setItem('emergencyContacts', JSON.stringify(this._emergencyContacts));
        this._renderEmergencyContacts();
        this.toast.show(`已删除联系人：${contact.name}`, 'info');
    },

    /**
     * 拨打联系人电话（手机端会跳转到拨号界面）
     */
    _callContact(index) {
        const contact = this._emergencyContacts[index];
        if (!contact) return;

        this.speech.speak(`正在拨打${contact.name}的电话`);
        window.location.href = `tel:${contact.phone}`;
    },

    /**
     * 给联系人发送短信（手机端会跳转到短信界面）
     */
    _smsContact(index) {
        const contact = this._emergencyContacts[index];
        if (!contact) return;

        const message = this._emergencyInfo || '我需要帮助，请尽快联系我。';
        const smsUrl = `sms:${contact.phone}?body=${encodeURIComponent(message)}`;
        window.open(smsUrl, '_blank');
        this.speech.speak(`正在打开短信界面，发送给${contact.name}`);
    },

    /**
     * 快速引导
     */
    _blindQuickGuide() {
        const guide = '视障辅助模式使用指南。第一，屏幕朗读功能可以朗读当前页面的文字内容。第二，场景描述功能可以分析摄像头画面并描述环境。第三，颜色识别功能可以告诉您前方物体的颜色。第四，光线检测功能会持续播报环境亮度。第五，障碍提醒功能可以检测前方变化。第六，紧急求助功能可以播报求助信息。按 Escape 键可以返回主页。';
        this.speech.speak(guide, { rate: 0.85 });
    },

    /**
     * 重复上一次朗读
     */
    _blindRepeatLast() {
        this.speech.speak('正在重复上一次内容...');
        // 由于 Web Speech API 不保存历史，这里重新播报状态
        const statusText = $('.blind-status-text');
        if (statusText && statusText.textContent !== '准备就绪，请选择功能') {
            this.speech.speak(statusText.textContent);
        } else {
            this.speech.speak('没有上一次的朗读记录。');
        }
    },

    /**
     * 更新视障辅助状态栏
     */
    _updateBlindStatus(text) {
        const statusText = $('.blind-status-text');
        if (statusText) {
            statusText.textContent = text;
        }
    },

    /**
     * 启动实时环境感知
     */
    _blindStartRealtimeSense() {
        this._blindPrevFrame = null;
        this._blindRealtimeInterval = setInterval(() => {
            if (!this.camera.isActive() || this.currentMode !== 'blind') return;

            const video = $('#camera-video');
            if (!video) return;

            const frame = getVideoFrame(video, 160, 120);
            if (!frame) return;
            const { imageData } = frame;
            const data = imageData.data;

            // 1. 计算平均亮度
            const brightness = avgBrightness(data, 32);
            const { level: brightnessLevel } = getBrightnessLevel(brightness);
            const brightnessEl = $('#info-brightness');
            if (brightnessEl) brightnessEl.textContent = `${brightnessLevel} (${brightness})`;

            // 2. 识别中心区域颜色
            const fw = frame.width || 160, fh = frame.height || 120;
            const centerX = Math.round(fw / 2), centerY = Math.round(fh / 2), radius = Math.round(Math.min(fw, fh) / 6);
            let rSum = 0, gSum = 0, bSum = 0, colorCount = 0;
            for (let y = centerY - radius; y < centerY + radius; y += 4) {
                for (let x = centerX - radius; x < centerX + radius; x += 4) {
                    if (y < 0 || y >= fh || x < 0 || x >= fw) continue;
                    const idx = (y * fw + x) * 4;
                    rSum += data[idx];
                    gSum += data[idx + 1];
                    bSum += data[idx + 2];
                    colorCount++;
                }
            }
            const rAvg = Math.round(rSum / colorCount);
            const gAvg = Math.round(gSum / colorCount);
            const bAvg = Math.round(bSum / colorCount);
            const colorName = this._getColorName(rAvg, gAvg, bAvg);
            const colorEl = $('#info-color');
            if (colorEl) colorEl.textContent = colorName;

            // 3. 场景判断
            let sceneDesc = '';
            if (brightness > 180) sceneDesc = '户外/强光环境';
            else if (brightness > 120) sceneDesc = '室内正常';
            else if (brightness > 60) sceneDesc = '室内较暗';
            else sceneDesc = '光线不足';
            const sceneEl = $('#info-scene');
            if (sceneEl) sceneEl.textContent = sceneDesc;

            // 4. 障碍物检测（帧差法）
            const obstacleEl = $('#info-obstacle');
            if (this._blindPrevFrame) {
                let diff = 0;
                for (let i = 0; i < data.length; i += 32) {
                    diff += Math.abs(data[i] - this._blindPrevFrame[i]);
                }
                diff = diff / (data.length / 32);

                if (diff > 25) {
                    if (obstacleEl) {
                        obstacleEl.textContent = '检测到变化';
                        obstacleEl.style.color = '#e74c3c';
                    }
                    // 只在变化较大时播报
                    if (diff > 35) {
                        this.speech.speak('注意，前方检测到变化。');
                        if (navigator.vibrate) navigator.vibrate(200);
                    }
                } else {
                    if (obstacleEl) {
                        obstacleEl.textContent = '安全';
                        obstacleEl.style.color = '#4caf50';
                    }
                }
            }

            this._blindPrevFrame = new Uint8ClampedArray(data);

            // 更新指示灯
            const dotEl = $('#realtime-dot');
            if (dotEl) dotEl.classList.add('active');

        }, 2000); // 每2秒更新一次

        // 立即执行一次
        setTimeout(() => {
            const dotEl = $('#realtime-dot');
            const textEl = $('#realtime-text');
            if (dotEl) dotEl.classList.add('active');
            if (textEl) textEl.textContent = '实时感知中...';
        }, 500);
    },

    /**
     * 视障辅助 - 启动手势控制
     */
    async _blindStartGestureControl() {
        const video = $('#camera-video');
        const canvas = $('#camera-canvas');
        if (!video || !canvas) return;

        const success = await this._initGestureRecognizer();
        if (!success) return;

        this._gestureActive = true;
        this._gestureMode = 'blind';
        this._gestureStableGesture = '';
        this._gestureBuffer = [];

        // 设置 canvas 尺寸（确保视频已就绪）
        const setCanvasSize = () => {
            const vw = video.videoWidth || video.offsetWidth || 480;
            const vh = video.videoHeight || video.offsetHeight || 360;
            canvas.width = vw;
            canvas.height = vh;
        };
        if (video.videoWidth > 0) {
            setCanvasSize();
        } else {
            video.addEventListener('loadedmetadata', setCanvasSize, { once: true });
            setTimeout(setCanvasSize, 1000);
        }

        let frameCount = 0;
        let lastDetectTime = 0;
        let _tsBase = performance.now();
        let _lastTs = 0;

        const detectLoop = () => {
            if (!this._gestureActive) return;
            const now = performance.now();
            if (video.readyState >= 2 && now - lastDetectTime > 150) {
                lastDetectTime = now;
                frameCount++;
                try {
                    const ts = Math.round(now - _tsBase);
                    if (ts <= _lastTs) {
                        this._gestureAnimFrame = requestAnimationFrame(detectLoop);
                        return;
                    }
                    _lastTs = ts;
                    const results = this._gestureRecognizer.recognizeForVideo(video, ts);
                    this._onGestureResults(results, 'blind');
                } catch (e) {
                    if (e.message && e.message.includes('timestamp')) {
                        _tsBase = performance.now();
                        _lastTs = 0;
                    }
                }
            }
            this._gestureAnimFrame = requestAnimationFrame(detectLoop);
        };

        const waitForVideo = () => {
            if (video.readyState >= 2) {
                detectLoop();
                this.speech.speak('手势控制已启动。大拇指确认，握拳返回，张开手掌描述场景。');
            } else {
                setTimeout(waitForVideo, 300);
            }
        };
        waitForVideo();
    },

    /**
     * 视障辅助 - 停止手势控制
     */
    _blindStopGestureControl() {
        if (this._gestureMode === 'blind') {
            this._gestureActive = false;
            this._gestureMode = null;
            if (this._gestureAnimFrame) {
                cancelAnimationFrame(this._gestureAnimFrame);
                this._gestureAnimFrame = null;
            }
        }
    }

};
