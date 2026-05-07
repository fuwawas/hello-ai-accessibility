/**
 * 手语分类器（KNN + 自定义训练 + IndexedDB 持久化）
 */
import { FeatureExtractor } from './feature-extractor.js';
import { DataAdapter } from './data-adapter.js';

class SignLanguageClassifier {
    constructor() {
        this.k = 5;  // KNN的k值
        this.samples = [];  // { features: Float32Array, label: string }
        this.featureExtractor = new FeatureExtractor();
        this.dataAdapter = new DataAdapter();
        this.isReady = false;
        this.TRAINING_DATA_VERSION = 3;  // 版本号，改变后自动清除旧数据
    }

    /**
     * 初始化：加载预置词汇 + 用户自定义词汇
     */
    async init() {
        // 检查训练数据版本，版本不匹配则清除旧数据（彻底解决旧数据残留问题）
        const savedVersion = localStorage.getItem('sign_training_version');
        if (savedVersion !== String(this.TRAINING_DATA_VERSION)) {
            console.log('[手语分类器] 数据版本不匹配，自动清除旧数据');
            await this.clear();
            localStorage.setItem('sign_training_version', String(this.TRAINING_DATA_VERSION));
        }

        // 加载用户自定义数据
        await this._loadFromIndexedDB();

        // 如果没有自定义数据，加载预置词汇
        if (this.samples.length === 0) {
            this._loadPresetVocabulary();
        }

        this.isReady = true;
        console.log(`[手语分类器] 初始化完成，共 ${this.samples.length} 个样本`);
    }

    /**
     * 预置中国手语常用词汇（基于特征描述）
     */
    _loadPresetVocabulary() {
        // 预置词汇使用标记，实际识别时通过 MediaPipe Gesture Recognizer + 自定义算法
        // 这里存储的是标签列表，用于 UI 显示
        this.presetLabels = [
            '你好', '谢谢', '对不起', '没关系', '再见',
            '是', '不是', '好', '不好', '请',
            '帮忙', '吃饭', '喝水', '厕所',
            '家', '医院', '电话', '钱', '名字',
            '我', '你', '他', '我们', '什么',
            '哪里', '什么时候', '多少', '不要', '想要',
            '开心', '难过', '生气', '害怕', '喜欢'
        ];
        console.log(`[手语分类器] 已加载 ${this.presetLabels.length} 个预置词汇标签`);
    }

    /**
     * 分类：给定 landmarks，返回最可能的标签
     * @returns {Object|null} { label: string, confidence: number, distance: number }
     */
    classify(landmarksArray) {
        if (!this.isReady || this.samples.length === 0) return null;

        const feature = this.featureExtractor.extractDual(landmarksArray);
        if (!feature) return null;

        // KNN 分类
        const distances = [];
        for (const sample of this.samples) {
            const dist = this._euclideanDistance(feature, sample.features);
            distances.push({ label: sample.label, distance: dist });
        }

        // 按距离排序，取前k个
        distances.sort((a, b) => a.distance - b.distance);
        const topK = distances.slice(0, Math.min(this.k, distances.length));

        // 投票
        const votes = {};
        for (const item of topK) {
            const weight = 1 / (item.distance + 0.0001);  // 反距离加权
            votes[item.label] = (votes[item.label] || 0) + weight;
        }

        // 找到得票最高的
        let bestLabel = null;
        let bestScore = 0;
        let totalScore = 0;
        for (const [label, score] of Object.entries(votes)) {
            totalScore += score;
            if (score > bestScore) {
                bestScore = score;
                bestLabel = label;
            }
        }

        if (!bestLabel) return null;

        const confidence = bestScore / totalScore;
        const avgDistance = topK.reduce((sum, item) => sum + item.distance, 0) / topK.length;
        const minDistance = topK[0].distance;

        // 调试日志
        console.log(`[KNN] 候选: ${bestLabel}, 置信度: ${(confidence * 100).toFixed(1)}%, 平均距离: ${avgDistance.toFixed(4)}, 最近距离: ${minDistance.toFixed(4)}, 样本总数: ${this.samples.length}`);

        // 最低置信度阈值
        if (confidence < 0.35) return null;

        return {
            label: bestLabel,
            confidence: confidence,
            distance: avgDistance
        };
    }

    /**
     * 添加训练样本
     */
    addSample(landmarksArray, label) {
        const feature = this.featureExtractor.extractDual(landmarksArray);
        if (!feature) return false;
        this.samples.push({ features: feature, label: label });
        return true;
    }

    /**
     * 保存到 IndexedDB
     */
    async save() {
        try {
            const db = await this._openDB();
            const tx = db.transaction('signLanguage', 'readwrite');
            const store = tx.objectStore('signLanguage');
            store.clear();
            for (const sample of this.samples) {
                store.add({
                    features: Array.from(sample.features),
                    label: sample.label
                });
            }
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = reject;
            });
            console.log(`[手语分类器] 已保存 ${this.samples.length} 个样本`);
        } catch (e) {
            console.error('[手语分类器] 保存失败:', e);
        }
    }

    /**
     * 从 IndexedDB 加载
     */
    async _loadFromIndexedDB() {
        try {
            const db = await this._openDB();
            const tx = db.transaction('signLanguage', 'readonly');
            const store = tx.objectStore('signLanguage');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.samples = request.result.map(item => ({
                        features: new Float32Array(item.features),
                        label: item.label
                    }));
                    resolve();
                };
                request.onerror = reject;
            });
        } catch (e) {
            console.warn('[手语分类器] 加载失败:', e);
        }
    }

    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('HelloAI_Accessibility', 2);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('signLanguage')) {
                    db.createObjectStore('signLanguage');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 导出训练数据为 JSON
     */
    exportData() {
        return JSON.stringify(this.samples.map(s => ({
            features: Array.from(s.features),
            label: s.label
        })));
    }

    /**
     * 导入训练数据
     */
    importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            this.samples = data.map(item => ({
                features: new Float32Array(item.features),
                label: item.label
            }));
            return true;
        } catch (e) {
            console.error('[手语分类器] 导入失败:', e);
            return false;
        }
    }

    /**
     * 导入vivo格式的训练数据
     * @param {string|Object} data - vivo格式数据
     * @returns {Promise<Object>} 导入结果
     */
    async importVivoData(data) {
        try {
            const result = await this.dataAdapter.importVivoData(data, this);
            if (result.success) {
                console.log(`[手语分类器] vivo数据导入成功: ${result.imported}条，总计: ${result.total}条`);
            }
            return result;
        } catch (e) {
            console.error('[手语分类器] vivo数据导入失败:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * 验证数据格式
     * @param {string|Object} data - 原始数据
     * @returns {Object} 验证结果
     */
    validateData(data) {
        return this.dataAdapter.validateData(data);
    }

    /**
     * 清除所有训练数据（内存 + IndexedDB）
     */
    async clear() {
        this.samples = [];
        try {
            const db = await this._openDB();
            const tx = db.transaction('signLanguage', 'readwrite');
            const store = tx.objectStore('signLanguage');
            store.clear();
            await new Promise((resolve, reject) => {
                tx.oncomplete = resolve;
                tx.onerror = reject;
            });
            console.log('[手语分类器] 已清除所有训练数据（含IndexedDB）');
        } catch (e) {
            console.warn('[手语分类器] 清除IndexedDB失败:', e);
        }
    }

    _euclideanDistance(a, b) {
        let sum = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
}

export { SignLanguageClassifier };
