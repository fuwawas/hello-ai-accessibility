/** @module cognitive 认知障碍辅助模块 */
/**
 * ============================================================
 * 认知障碍辅助模块
 * 任务引导、步骤式操作、时钟显示
 * ============================================================
 */

'use strict';

import { $ } from '../utils/dom.js';

export const cognitiveMethods = {

    /**
     * 任务配置
     */
    _cognitiveTasks: {
        call: {
            name: '打电话给家人',
            icon: '&#128222;',
            steps: [
                { text: '您想打电话给谁？', options: ['儿子', '女儿', '老伴', '朋友'], speak: '您想打电话给谁？可以选择儿子、女儿、老伴或朋友。' },
                { text: '正在拨打电话...', options: [], speak: '好的，正在为您拨打电话。请稍等。' },
                { text: '电话已接通！请对着手机说话。', options: ['挂断'], speak: '电话已接通，请对着手机说话。通话结束后可以点击挂断。' }
            ]
        },
        medicine: {
            name: '吃药提醒',
            icon: '&#128138;',
            steps: [
                { text: '请确认您要吃的药物：', options: ['降压药', '降糖药', '感冒药', '维生素'], speak: '请确认您要吃的药物。' },
                { text: '请拿好药物和水杯。', options: ['准备好了'], speak: '请拿好药物和一杯温水。准备好后请点击准备好了。' },
                { text: '请现在服药。服药后请喝一些水。', options: ['吃完了'], speak: '请现在服药。吃完后喝一些水。吃完后请点击吃完了。做得很好！' }
            ]
        },
        weather: {
            name: '查看天气',
            icon: '&#9925;',
            steps: [
                { text: '正在获取天气信息...', options: [], speak: '正在为您查询今天的天气。' },
                { text: '正在查询中，请稍候...', options: ['知道了'], speak: '正在查询天气信息，请稍候。', _fetchWeather: true },
                { text: '需要其他帮助吗？', options: ['返回'], speak: '还需要其他帮助吗？' }
            ]
        },
        walk: {
            name: '出去散步',
            icon: '&#127939;',
            steps: [
                { text: '出去散步是个好主意！请先做好准备。', options: ['准备好了'], speak: '出去散步是个好主意！请穿好鞋子，带上手机和钥匙。' },
                { text: '出门前检查：手机？钥匙？水杯？', options: ['都带好了'], speak: '出门前请检查：手机带了吗？钥匙带了吗？水杯带了吗？' },
                { text: '很好！祝您散步愉快！注意安全，走累了就休息。', options: ['回来了'], speak: '很好！祝您散步愉快！注意安全，走累了就休息。回来后点击回来了。' }
            ]
        },
        eat: {
            name: '吃饭提醒',
            icon: '&#127858;',
            steps: [
                { text: '该吃饭了！您想吃什么？', options: ['米饭', '面条', '包子', '随便'], speak: '该吃饭了！您想吃什么？' },
                { text: '好的，请去准备食物。注意营养均衡。', options: ['吃完了'], speak: '好的，请去准备食物。记得多吃蔬菜，营养均衡。' },
                { text: '吃得好！记得喝一些水。', options: ['好的'], speak: '吃得好！记得饭后喝一些温水，有助于消化。' }
            ]
        },
        emergency: {
            name: '紧急求助',
            icon: '&#128680;',
            steps: [
                { text: '紧急求助模式已启动！', options: [], speak: '紧急求助模式已启动！请不要慌张。' },
                { text: '正在通知您的紧急联系人...同时发送位置信息。', options: [], speak: '正在通知您的紧急联系人。同时正在发送您的位置信息。' },
                { text: '求助信息已发送！请保持冷静，等待帮助到来。', options: ['取消求助'], speak: '求助信息已发送！请保持冷静，待在安全的地方，等待帮助到来。' }
            ]
        }
    },

    /**
     * 启动时钟显示
     */
    _cognitiveStartClock() {
        const updateTime = () => {
            const now = new Date();
            const timeEl = $('#clock-time');
            const dateEl = $('#clock-date');
            if (timeEl) {
                timeEl.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            }
            if (dateEl) {
                dateEl.textContent = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
            }
        };

        updateTime();
        this._cognitiveClockInterval = setInterval(updateTime, 10000);
    },

    /**
     * 开始任务
     */
    _cognitiveStartTask(taskId) {
        const task = this._cognitiveTasks[taskId];
        if (!task) return;

        this._cognitiveCurrentTask = taskId;
        this._cognitiveCurrentStep = 0;

        // 隐藏任务选择，显示步骤引导
        const tasksEl = document.querySelector('.cognitive-tasks');
        const guideEl = $('#cognitive-step-guide');
        if (tasksEl) tasksEl.style.display = 'none';
        if (guideEl) guideEl.style.display = '';

        this._cognitiveShowStep();
    },

    /**
     * 显示当前步骤
     */
    _cognitiveShowStep() {
        const task = this._cognitiveTasks[this._cognitiveCurrentTask];
        if (!task) return;

        const step = task.steps[this._cognitiveCurrentStep];
        const progressEl = $('#step-progress');
        const contentEl = $('#step-content');
        const nextBtn = $('#step-next-btn');

        if (progressEl) progressEl.textContent = `步骤 ${this._cognitiveCurrentStep + 1}/${task.steps.length}`;

        if (contentEl) {
            let html = `<p class="step-text">${step.text}</p>`;
            if (step.options && step.options.length > 0) {
                html += '<div class="step-options">';
                step.options.forEach((opt, idx) => {
                    const safeOpt = opt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                    html += `<button class="step-option-btn" data-option="${safeOpt}">${safeOpt}</button>`;
                });
                html += '</div>';
            }
            contentEl.innerHTML = html;
            // 使用事件委托绑定选项点击
            const optionsContainer = contentEl.querySelector('.step-options');
            if (optionsContainer) {
                optionsContainer.addEventListener('click', (e) => {
                    const btn = e.target.closest('.step-option-btn');
                    if (btn) this._cognitiveSelectOption(btn.dataset.option);
                });
            }
        }

        if (nextBtn) {
            nextBtn.textContent = this._cognitiveCurrentStep >= task.steps.length - 1 ? '完成 ✓' : '下一步 →';
        }

        // 语音播报
        if (step.speak) {
            this.speech.speak(step.speak, { rate: 0.85 });
        }

        // 如果是天气步骤，异步获取真实天气
        if (step._fetchWeather) {
            this._cognitiveFetchWeather(contentEl, step);
        }
    },

    /**
     * 认知模块 - 获取真实天气
     */
    async _cognitiveFetchWeather(contentEl, step) {
        try {
            const response = await fetch('https://wttr.in/?format=j1&lang=zh', {
                signal: AbortSignal.timeout(8000)
            });
            const data = await response.json();
            const current = data.current_condition[0];
            const today = data.weather[0];
            const temp = current.temp_C;
            const desc = current.lang_zh && current.lang_zh[0] ? current.lang_zh[0].value : current.weatherDesc[0].value;
            const maxTemp = today.maxtempC;
            const minTemp = today.mintempC;

            const weatherText = `今天天气${desc}，温度${minTemp}到${maxTemp}度，当前${temp}度。适合${parseInt(temp) > 15 ? '外出活动' : '待在室内'}。`;
            if (contentEl) {
                const stepTextEl = contentEl.querySelector('.step-text');
                if (stepTextEl) stepTextEl.textContent = weatherText;
            }
            this.speech.speak(weatherText, { rate: 0.85 });
        } catch (e) {
            console.warn('[认知天气] 获取失败:', e);
            if (contentEl) {
                const stepTextEl = contentEl.querySelector('.step-text');
                if (stepTextEl) stepTextEl.textContent = '无法获取天气信息，请检查网络。';
            }
            this.speech.speak('抱歉，无法获取天气信息。请检查网络连接。', { rate: 0.85 });
        }
    },

    /**
     * 选择选项
     */
    _cognitiveSelectOption(option) {
        if (this._cognitiveStepLocked) return;
        this._cognitiveStepLocked = true;
        setTimeout(() => { this._cognitiveStepLocked = false; }, 1500);

        this.speech.speak(`您选择了${option}。`, { rate: 0.85 });

        // 自动进入下一步
        setTimeout(() => this._cognitiveNextStep(), 1500);
    },

    /**
     * 下一步
     */
    _cognitiveNextStep() {
        const task = this._cognitiveTasks[this._cognitiveCurrentTask];
        if (!task) return;

        if (this._cognitiveCurrentStep >= task.steps.length - 1) {
            // 任务完成
            this.speech.speak(`${task.name}已完成。做得很好！`, { rate: 0.85 });
            this.toast.show(`${task.name} - 已完成`, 'success');
            this._cognitiveCancelTask();
            return;
        }

        this._cognitiveCurrentStep++;
        this._cognitiveShowStep();
    },

    /**
     * 取消任务
     */
    _cognitiveCancelTask() {
        this._cognitiveCurrentTask = null;
        this._cognitiveCurrentStep = 0;

        const tasksEl = document.querySelector('.cognitive-tasks');
        const guideEl = $('#cognitive-step-guide');
        if (tasksEl) tasksEl.style.display = '';
        if (guideEl) guideEl.style.display = 'none';
    },

    /* ---------- 自定义工作流程 ---------- */

    /**
     * 加载自定义工作流程列表
     */
    _cognitiveLoadCustomTasks() {
        try {
            return JSON.parse(localStorage.getItem('cognitive-custom-tasks') || '[]');
        } catch (e) {
            return [];
        }
    },

    /**
     * 保存自定义工作流程列表
     */
    _cognitiveSaveCustomTasks(tasks) {
        localStorage.setItem('cognitive-custom-tasks', JSON.stringify(tasks));
    },

    /**
     * 显示创建工作流程界面
     */
    _cognitiveShowCreateTask() {
        const tasksEl = document.querySelector('.cognitive-tasks');
        const createEl = $('#cognitive-create-task');
        if (tasksEl) tasksEl.style.display = 'none';
        if (createEl) {
            createEl.style.display = '';
            createEl.innerHTML = `
                <div class="create-task-panel">
                    <h3 style="color:var(--color-accent);font-size:var(--fs-lg);margin-bottom:var(--space-lg);">创建工作流程</h3>
                    <p style="color:var(--color-text-secondary);margin-bottom:var(--space-lg);font-size:var(--fs-md);line-height:1.8;">
                        为家人或自己创建一个简单的工作流程，每一步都会语音提示。
                    </p>
                    <div class="create-task-form">
                        <label style="color:var(--color-text-primary);font-size:var(--fs-md);display:block;margin-bottom:var(--space-sm);">流程名称</label>
                        <input type="text" id="custom-task-name" placeholder="例如：洗碗、出门准备、整理床铺"
                            class="training-input" maxlength="20" aria-label="流程名称"
                            style="width:100%;font-size:var(--fs-lg);padding:var(--space-md);margin-bottom:var(--space-lg);">

                        <label style="color:var(--color-text-primary);font-size:var(--fs-md);display:block;margin-bottom:var(--space-sm);">步骤列表</label>
                        <div id="custom-steps-list" style="margin-bottom:var(--space-lg);"></div>

                        <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-xl);">
                            <button class="module-btn" onclick="app._cognitiveAddStep()" style="font-size:var(--fs-md);padding:var(--space-md) var(--space-xl);">
                                &#10133; 添加步骤
                            </button>
                        </div>

                        <div style="display:flex;gap:var(--space-md);justify-content:center;">
                            <button class="module-btn" onclick="app._cognitiveSaveCustomTask()" style="font-size:var(--fs-lg);padding:var(--space-md) var(--space-3xl);">
                                &#128190; 保存流程
                            </button>
                            <button class="module-btn btn-secondary" onclick="app._cognitiveCancelCreate()" style="font-size:var(--fs-md);padding:var(--space-md) var(--space-xl);">
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            `;
            // 默认添加3个空步骤
            this._customSteps = ['', '', ''];
            this._cognitiveRenderSteps();
            this.speech.speak('创建工作流程。请输入流程名称，然后添加每一步的说明。');
        }
    },

    /**
     * 渲染步骤编辑列表
     */
    _cognitiveRenderSteps() {
        const listEl = $('#custom-steps-list');
        if (!listEl) return;
        listEl.innerHTML = this._customSteps.map((step, i) => `
            <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-sm);align-items:center;">
                <span style="color:var(--color-accent);font-size:var(--fs-lg);font-weight:700;min-width:36px;">${i + 1}</span>
                <input type="text" value="${step}" placeholder="第 ${i + 1} 步做什么？"
                    class="training-input" style="flex:1;font-size:var(--fs-md);padding:var(--space-sm) var(--space-md);"
                    onchange="app._customSteps[${i}] = this.value"
                    aria-label="第 ${i + 1} 步">
                <button class="module-btn btn-secondary" onclick="app._cognitiveRemoveStep(${i})"
                    style="padding:var(--space-sm);min-width:48px;font-size:var(--fs-md);"
                    aria-label="删除第 ${i + 1} 步">&#128465;</button>
            </div>
        `).join('');
    },

    /**
     * 添加步骤
     */
    _cognitiveAddStep() {
        this._customSteps.push('');
        this._cognitiveRenderSteps();
        this.speech.speak(`已添加第 ${this._customSteps.length} 步。`);
    },

    /**
     * 删除步骤
     */
    _cognitiveRemoveStep(index) {
        if (this._customSteps.length <= 2) {
            this.toast.show('至少需要2个步骤', 'error');
            return;
        }
        this._customSteps.splice(index, 1);
        this._cognitiveRenderSteps();
    },

    /**
     * 保存自定义工作流程
     */
    _cognitiveSaveCustomTask() {
        const nameInput = $('#custom-task-name');
        if (!nameInput) return;
        const name = nameInput.value.trim();
        if (!name) {
            this.toast.show('请输入流程名称', 'error');
            return;
        }

        // 收集步骤内容
        const stepInputs = document.querySelectorAll('#custom-steps-list input');
        const steps = Array.from(stepInputs).map(el => el.value.trim()).filter(Boolean);

        if (steps.length < 2) {
            this.toast.show('至少需要2个有效步骤', 'error');
            return;
        }

        const customTasks = this._cognitiveLoadCustomTasks();
        customTasks.push({
            id: 'custom-' + Date.now(),
            name: name,
            icon: '&#128203;',
            steps: steps.map((text, i) => ({
                text: `第 ${i + 1} 步：${text}`,
                options: ['完成了'],
                speak: `第 ${i + 1} 步，${text}。完成后请点击"完成了"。`
            })),
            createdAt: Date.now()
        });
        this._cognitiveSaveCustomTasks(customTasks);

        this.toast.show(`工作流程"${name}"已保存`, 'success');
        this.speech.speak(`工作流程${name}已保存，共${steps.length}个步骤。`);
        this._cognitiveRenderCustomTasks();
        this._cognitiveCancelCreate();
    },

    /**
     * 取消创建
     */
    _cognitiveCancelCreate() {
        const tasksEl = document.querySelector('.cognitive-tasks');
        const createEl = $('#cognitive-create-task');
        if (tasksEl) tasksEl.style.display = '';
        if (createEl) createEl.style.display = 'none';
    },

    /**
     * 渲染自定义工作流程列表
     */
    _cognitiveRenderCustomTasks() {
        const listEl = $('#custom-tasks-list');
        if (!listEl) return;
        const customTasks = this._cognitiveLoadCustomTasks();

        if (customTasks.length === 0) {
            listEl.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;font-size:var(--fs-md);padding:var(--space-lg);">还没有自定义流程</p>';
            return;
        }

        listEl.innerHTML = customTasks.map(task => `
            <div class="task-card task-large" onclick="app._cognitiveStartCustomTask('${task.id}')" tabindex="0" role="button" aria-label="${task.name}">
                <div class="task-icon">${task.icon || '&#128203;'}</div>
                <div class="task-label">${task.name}</div>
                <div style="font-size:var(--fs-xs);color:var(--color-text-muted);">${task.steps.length} 步</div>
            </div>
        `).join('');
    },

    /**
     * 启动自定义工作流程
     */
    _cognitiveStartCustomTask(taskId) {
        const customTasks = this._cognitiveLoadCustomTasks();
        const task = customTasks.find(t => t.id === taskId);
        if (!task) return;

        // 临时注册为任务
        this._cognitiveTasks[taskId] = task;
        this._cognitiveStartTask(taskId);
    },

    /**
     * 删除自定义工作流程
     */
    _cognitiveDeleteCustomTask(taskId) {
        const customTasks = this._cognitiveLoadCustomTasks();
        const filtered = customTasks.filter(t => t.id !== taskId);
        this._cognitiveSaveCustomTasks(filtered);
        this._cognitiveRenderCustomTasks();
        this.toast.show('已删除', 'info');
    }

};
