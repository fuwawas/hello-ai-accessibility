/**
 * 认证管理器 - 处理用户登录/注册
 */
import { apiClient } from '../utils/api-client.js';

export class AuthManager {
    constructor(toast) {
        this.toast = toast;
        this.modal = null;
        this.userMenu = null;
        this.onAuthChange = null;
    }

    init() {
        this.modal = document.getElementById('auth-modal');
        this.userMenu = document.getElementById('user-menu');

        this.bindEvents();
        this.updateUI();
    }

    bindEvents() {
        // 用户按钮
        const btnUser = document.getElementById('btn-user');
        if (btnUser) {
            btnUser.addEventListener('click', () => {
                if (apiClient.isLoggedIn()) {
                    this.toggleUserMenu();
                } else {
                    this.showAuthModal();
                }
            });
        }

        // 关闭模态框
        const modalClose = document.getElementById('auth-modal-close');
        const modalOverlay = document.getElementById('auth-modal-overlay');
        if (modalClose) modalClose.addEventListener('click', () => this.hideAuthModal());
        if (modalOverlay) modalOverlay.addEventListener('click', () => this.hideAuthModal());

        // 切换登录/注册
        const showRegister = document.getElementById('show-register');
        const showLogin = document.getElementById('show-login');
        if (showRegister) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleForm('register');
            });
        }
        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleForm('login');
            });
        }

        // 登录按钮
        const btnLogin = document.getElementById('btn-login');
        if (btnLogin) {
            btnLogin.addEventListener('click', () => this.handleLogin());
        }

        // 注册按钮
        const btnRegister = document.getElementById('btn-register');
        if (btnRegister) {
            btnRegister.addEventListener('click', () => this.handleRegister());
        }

        // Enter 键提交
        const loginPassword = document.getElementById('login-password');
        const regPassword = document.getElementById('reg-password');
        if (loginPassword) {
            loginPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
        }
        if (regPassword) {
            regPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleRegister();
            });
        }

        // 菜单项
        const menuLogout = document.getElementById('menu-logout');
        if (menuLogout) {
            menuLogout.addEventListener('click', () => this.handleLogout());
        }

        const menuSyncSettings = document.getElementById('menu-sync-settings');
        if (menuSyncSettings) {
            menuSyncSettings.addEventListener('click', () => this.handleSyncSettings());
        }

        const menuLoadSettings = document.getElementById('menu-load-settings');
        if (menuLoadSettings) {
            menuLoadSettings.addEventListener('click', () => this.handleLoadSettings());
        }

        const menuStats = document.getElementById('menu-stats');
        if (menuStats) {
            menuStats.addEventListener('click', () => this.handleShowStats());
        }

        // 点击外部关闭菜单
        document.addEventListener('click', (e) => {
            if (this.userMenu && !e.target.closest('.user-btn') && !e.target.closest('.user-menu')) {
                this.userMenu.style.display = 'none';
            }
        });

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAuthModal();
                if (this.userMenu) this.userMenu.style.display = 'none';
            }
        });
    }

    showAuthModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            this.toggleForm('login');
            document.getElementById('login-username')?.focus();
        }
    }

    hideAuthModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    toggleForm(form) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (form === 'register') {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            document.getElementById('reg-username')?.focus();
        } else {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            document.getElementById('login-username')?.focus();
        }
    }

    toggleUserMenu() {
        if (this.userMenu) {
            const isVisible = this.userMenu.style.display !== 'none';
            this.userMenu.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                this.updateMenuInfo();
            }
        }
    }

    async handleLogin() {
        const username = document.getElementById('login-username')?.value?.trim();
        const password = document.getElementById('login-password')?.value;

        if (!username || !password) {
            this.toast?.show('请输入用户名和密码', 'warning');
            return;
        }

        const btn = document.getElementById('btn-login');
        btn.disabled = true;
        btn.textContent = '登录中...';

        try {
            await apiClient.login(username, password);
            this.toast?.show('登录成功！', 'success');
            this.hideAuthModal();
            this.updateUI();
            this.clearForms();

            if (this.onAuthChange) {
                this.onAuthChange('login');
            }
        } catch (err) {
            this.toast?.show(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '登录';
        }
    }

    async handleRegister() {
        const username = document.getElementById('reg-username')?.value?.trim();
        const password = document.getElementById('reg-password')?.value;
        const nickname = document.getElementById('reg-nickname')?.value?.trim();
        const disabilityType = document.getElementById('reg-disability')?.value;

        if (!username || !password) {
            this.toast?.show('请输入用户名和密码', 'warning');
            return;
        }

        if (username.length < 3) {
            this.toast?.show('用户名至少3个字符', 'warning');
            return;
        }

        if (password.length < 6) {
            this.toast?.show('密码至少6个字符', 'warning');
            return;
        }

        const btn = document.getElementById('btn-register');
        btn.disabled = true;
        btn.textContent = '注册中...';

        try {
            await apiClient.register(username, password, {
                nickname: nickname || username,
                disability_type: disabilityType
            });
            this.toast?.show('注册成功！', 'success');
            this.hideAuthModal();
            this.updateUI();
            this.clearForms();

            if (this.onAuthChange) {
                this.onAuthChange('register');
            }
        } catch (err) {
            this.toast?.show(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '注册';
        }
    }

    handleLogout() {
        apiClient.logout();
        this.userMenu.style.display = 'none';
        this.toast?.show('已退出登录', 'info');
        this.updateUI();

        if (this.onAuthChange) {
            this.onAuthChange('logout');
        }
    }

    async handleSyncSettings() {
        if (!apiClient.isLoggedIn()) {
            this.toast?.show('请先登录', 'warning');
            return;
        }

        try {
            // 从 localStorage 获取当前设置
            const settings = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('setting_') || key.startsWith('preference_')) {
                    settings[key] = localStorage.getItem(key);
                }
            }

            await apiClient.saveSettings(settings);
            this.toast?.show('设置已同步到云端', 'success');
        } catch (err) {
            this.toast?.show('同步失败: ' + err.message, 'error');
        }

        this.userMenu.style.display = 'none';
    }

    async handleLoadSettings() {
        if (!apiClient.isLoggedIn()) {
            this.toast?.show('请先登录', 'warning');
            return;
        }

        try {
            const data = await apiClient.getSettings();
            const settings = data.settings;

            // 应用设置到 localStorage
            Object.entries(settings).forEach(([key, value]) => {
                localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
            });

            this.toast?.show('云端设置已加载', 'success');
        } catch (err) {
            this.toast?.show('加载失败: ' + err.message, 'error');
        }

        this.userMenu.style.display = 'none';
    }

    async handleShowStats() {
        if (!apiClient.isLoggedIn()) {
            this.toast?.show('请先登录', 'warning');
            return;
        }

        try {
            const stats = await apiClient.getUserStats();
            const message = `总使用次数: ${stats.total}\n今日使用: ${stats.today}`;
            this.toast?.show(message, 'info', 5000);
        } catch (err) {
            this.toast?.show('获取统计失败', 'error');
        }

        this.userMenu.style.display = 'none';
    }

    updateUI() {
        const btnUser = document.getElementById('btn-user');
        const btnLabel = document.getElementById('user-btn-label');

        if (btnUser && btnLabel) {
            if (apiClient.isLoggedIn()) {
                btnUser.classList.add('logged-in');
                btnLabel.textContent = apiClient.user?.nickname || apiClient.user?.username || '用户';
            } else {
                btnUser.classList.remove('logged-in');
                btnLabel.textContent = '登录';
            }
        }
    }

    updateMenuInfo() {
        const userName = document.getElementById('menu-user-name');
        const userType = document.getElementById('menu-user-type');

        if (apiClient.user) {
            if (userName) userName.textContent = apiClient.user.nickname || apiClient.user.username;

            const typeMap = {
                general: '通用模式',
                blind: '视障模式',
                deaf: '听障模式',
                cognitive: '认知辅助',
                physical: '肢体辅助',
                elderly: '老年模式'
            };
            if (userType) userType.textContent = typeMap[apiClient.user.disability_type] || '通用模式';
        }
    }

    clearForms() {
        const inputs = ['login-username', 'login-password', 'reg-username', 'reg-password', 'reg-nickname'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
}
