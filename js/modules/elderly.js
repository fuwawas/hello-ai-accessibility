/** @module elderly 老年人辅助模块 */
/**
 * ============================================================
 * 老年人辅助模块
 * 简化操作界面、大按钮、语音播报
 * ============================================================
 */

'use strict';

import { $ } from '../utils/dom.js';

export const elderlyMethods = {

    /**
     * 老年人辅助 - 执行操作
     */
    _elderlyAction(action) {
        const msgEl = $('#elderly-message');
        const setMessage = (html) => {
            if (msgEl) msgEl.innerHTML = `<p>${html}</p>`;
        };

        switch (action) {
            case 'emergency':
                setMessage('&#128680; 正在发送紧急求助信息...<br>请保持冷静，帮助马上就到。');
                this.speech.speak('紧急求助已启动。正在通知您的紧急联系人。请保持冷静。', { rate: 0.8 });
                if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
                // 复用盲人模块的紧急求助
                this._blindEmergencyHelp();
                break;

            case 'family':
                setMessage('&#128105;&#8205;&#128106; 正在为您联系家人...<br>请稍等片刻。');
                this.speech.speak('正在为您联系家人，请稍等。', { rate: 0.8 });
                // 如果有紧急联系人，直接拨打电话
                if (this._emergencyContacts && this._emergencyContacts.length > 0) {
                    const contact = this._emergencyContacts[0];
                    setTimeout(() => {
                        window.location.href = `tel:${contact.phone}`;
                    }, 1500);
                } else {
                    setMessage('&#128105;&#8205;&#128106; 还没有设置家人联系方式。<br>请在视障辅助模式的紧急求助中添加联系人。');
                    this.speech.speak('还没有设置家人联系方式。请让家人帮您在设置中添加紧急联系人。', { rate: 0.8 });
                }
                break;

            case 'medicine':
                this._elderlyMedicineReminder();
                break;

            case 'weather':
                setMessage('&#9925; 正在获取天气信息...');
                this.speech.speak('正在为您查询天气，请稍等。', { rate: 0.8 });
                this._elderlyFetchWeather(msgEl);
                break;

            case 'news':
                setMessage('&#128240; 正在为您播报今日新闻...<br>科技致善，AI助力无障碍生活。');
                this.speech.speak('今日新闻摘要。科技致善，AI助力无障碍生活。越来越多的智能辅助工具正在帮助残障人士更好地融入社会。', { rate: 0.8 });
                break;

            case 'music':
                setMessage('&#127925; 为您播放舒缓音乐...<br>放松心情，享受美好时光。');
                this.speech.speak('正在为您播放舒缓的音乐。放松心情，享受美好时光。', { rate: 0.8 });
                break;

            case 'time':
                const now = new Date();
                const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                setMessage(`&#128339; 现在是 <strong>${timeStr}</strong>`);
                this.speech.speak(`现在是${timeStr}。`, { rate: 0.8 });
                break;

            case 'help':
                setMessage('&#128172; 您可以点击上方的按钮来使用各种功能。<br>紧急求助、联系家人、吃药提醒等等。<br>有什么需要随时告诉我！');
                this.speech.speak('您可以点击屏幕上的大按钮来使用各种功能。包括紧急求助、联系家人、吃药提醒、查看天气、听新闻和听音乐。有什么需要随时告诉我！', { rate: 0.75 });
                break;
        }
    },

    /**
     * 老年人 - 吃药提醒
     */
    _elderlyMedicineReminder() {
        const msgEl = $('#elderly-message');
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        // 读取已保存的药物列表
        let medicines = [];
        try {
            medicines = JSON.parse(localStorage.getItem('elderly-medicines') || '[]');
        } catch (e) {}

        if (medicines.length === 0) {
            if (msgEl) msgEl.innerHTML = `
                <p>&#128138; <strong>吃药提醒</strong></p>
                <p>还没有设置药物信息。请输入您常吃的药物名称：</p>
                <div style="display:flex;gap:0.5em;margin-top:0.5em;">
                    <input type="text" id="medicine-input" placeholder="例如：降压药" class="training-input" style="flex:1;font-size:var(--fs-lg);">
                    <button class="module-btn" onclick="app._elderlySaveMedicine()" style="font-size:var(--fs-md);">保存</button>
                </div>
            `;
            this.speech.speak('还没有设置药物信息。请输入您常吃的药物名称，然后点击保存。', { rate: 0.8 });
        } else {
            const medicineList = medicines.map(m => `<span style="color:var(--color-accent);font-weight:700;">${m}</span>`).join('、');
            if (msgEl) msgEl.innerHTML = `
                <p>&#128138; <strong>吃药提醒 - ${timeStr}</strong></p>
                <p>您今天需要吃的药物：${medicineList}</p>
                <p>请按时服药，多喝温水。</p>
                <button class="module-btn" onclick="app._elderlyClearMedicines()" style="font-size:var(--fs-sm);margin-top:0.5em;">清除药物列表</button>
            `;
            this.speech.speak(`现在是${timeStr}，您今天需要吃的药物有：${medicines.join('、')}。请按时服药，多喝温水。`, { rate: 0.8 });
        }
    },

    /**
     * 保存药物信息
     */
    _elderlySaveMedicine() {
        const input = $('#medicine-input');
        if (!input || !input.value.trim()) return;
        const medicine = input.value.trim();

        let medicines = [];
        try {
            medicines = JSON.parse(localStorage.getItem('elderly-medicines') || '[]');
        } catch (e) {}

        if (medicines.includes(medicine)) {
            this.toast.show('这个药物已经在列表中了', 'info');
            return;
        }

        medicines.push(medicine);
        localStorage.setItem('elderly-medicines', JSON.stringify(medicines));

        this.toast.show(`已添加：${medicine}`, 'success');
        this.speech.speak(`已添加药物${medicine}。`, { rate: 0.8 });

        // 刷新显示
        this._elderlyMedicineReminder();
    },

    /**
     * 获取真实天气信息
     */
    async _elderlyFetchWeather(msgEl) {
        try {
            // 使用 wttr.in 免费天气 API（支持中文）
            const response = await fetch('https://wttr.in/?format=j1&lang=zh', {
                signal: AbortSignal.timeout(8000)
            });
            const data = await response.json();
            const current = data.current_condition[0];
            const today = data.weather[0];
            const temp = current.temp_C;
            const feelsLike = current.FeelsLikeC;
            const humidity = current.humidity;
            const desc = current.lang_zh && current.lang_zh[0] ? current.lang_zh[0].value : current.weatherDesc[0].value;
            const maxTemp = today.maxtempC;
            const minTemp = today.mintempC;

            const weatherHtml = `&#9925; <strong>今天天气：${desc}</strong><br>当前温度 ${temp}°C，体感 ${feelsLike}°C<br>今日 ${minTemp}°C ~ ${maxTemp}°C，湿度 ${humidity}%`;
            if (msgEl) msgEl.innerHTML = `<p>${weatherHtml}</p>`;
            this.speech.speak(`今天天气${desc}，当前温度${temp}度，体感温度${feelsLike}度。今日温度${minTemp}到${maxTemp}度。`, { rate: 0.8 });
        } catch (e) {
            console.warn('[天气] 获取失败:', e);
            if (msgEl) msgEl.innerHTML = '<p>&#9925; 无法获取天气信息，请检查网络连接。</p>';
            this.speech.speak('抱歉，无法获取天气信息。请检查网络连接后重试。', { rate: 0.8 });
        }
    },

    /**
     * 清除药物列表
     */
    _elderlyClearMedicines() {
        localStorage.removeItem('elderly-medicines');
        this.toast.show('药物列表已清除', 'info');
        this.speech.speak('药物列表已清除。', { rate: 0.8 });
        this._elderlyMedicineReminder();
    }

};
