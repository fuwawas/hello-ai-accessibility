/**
 * 手语训练数据适配器
 * 支持多种数据格式导入，包括vivo提供的训练数据
 */

class DataAdapter {
    constructor() {
        // 支持的数据格式
        this.supportedFormats = {
            'hello-ai': this._parseHelloAIFormat.bind(this),
            'vivo': this._parseVivoFormat.bind(this),
            'generic': this._parseGenericFormat.bind(this)
        };
    }

    /**
     * 自动检测并导入数据
     * @param {string|Object} data - 原始数据
     * @returns {Object} { samples: Array, format: string, count: number }
     */
    async importData(data) {
        let parsed = null;
        let detectedFormat = 'unknown';

        // 尝试解析JSON
        let jsonData;
        if (typeof data === 'string') {
            try {
                jsonData = JSON.parse(data);
            } catch (e) {
                throw new Error('数据格式错误：无法解析JSON');
            }
        } else {
            jsonData = data;
        }

        // 检测数据格式
        if (this._isHelloAIFormat(jsonData)) {
            detectedFormat = 'hello-ai';
            parsed = this._parseHelloAIFormat(jsonData);
        } else if (this._isVivoFormat(jsonData)) {
            detectedFormat = 'vivo';
            parsed = this._parseVivoFormat(jsonData);
        } else if (this._isGenericFormat(jsonData)) {
            detectedFormat = 'generic';
            parsed = this._parseGenericFormat(jsonData);
        } else {
            throw new Error('不支持的数据格式，请检查数据结构');
        }

        return {
            samples: parsed,
            format: detectedFormat,
            count: parsed.length
        };
    }

    /**
     * 检测是否为Hello AI格式
     */
    _isHelloAIFormat(data) {
        // Hello AI格式：数组，每个元素包含features和label
        return Array.isArray(data) &&
               data.length > 0 &&
               data[0].features &&
               data[0].label;
    }

    /**
     * 检测是否为vivo格式
     * vivo格式可能包含以下字段：
     * - landmarks: 手部关键点数据
     * - gesture: 手势标签
     * - sign_language: 手语标签
     */
    _isVivoFormat(data) {
        // vivo格式可能是对象，包含data或samples字段
        if (data && typeof data === 'object') {
            // 检查是否包含vivo特有的字段
            if (data.version && data.samples) {
                return true;
            }
            if (data.data && Array.isArray(data.data)) {
                return data.data.some(item =>
                    item.landmarks ||
                    item.gesture ||
                    item.sign_language ||
                    item.keypoints
                );
            }
        }
        return false;
    }

    /**
     * 检测是否为通用格式
     */
    _isGenericFormat(data) {
        // 通用格式：数组，每个元素包含landmarks和label
        return Array.isArray(data) &&
               data.length > 0 &&
               (data[0].landmarks || data[0].keypoints) &&
               (data[0].label || data[0].gesture || data[0].sign);
    }

    /**
     * 解析Hello AI格式
     */
    _parseHelloAIFormat(data) {
        return data.map(item => ({
            features: new Float32Array(item.features),
            label: item.label
        }));
    }

    /**
     * 解析vivo格式
     */
    _parseVivoFormat(data) {
        const samples = [];
        const items = data.samples || data.data || [];

        for (const item of items) {
            // 提取关键点
            let landmarks = null;
            if (item.landmarks) {
                landmarks = item.landmarks;
            } else if (item.keypoints) {
                landmarks = item.keypoints;
            } else if (item.key_points) {
                landmarks = item.key_points;
            }

            // 提取标签
            let label = null;
            if (item.sign_language) {
                label = item.sign_language;
            } else if (item.gesture) {
                label = item.gesture;
            } else if (item.label) {
                label = item.label;
            } else if (item.sign) {
                label = item.sign;
            }

            if (landmarks && label) {
                // 转换关键点格式
                const convertedLandmarks = this._convertLandmarks(landmarks);
                if (convertedLandmarks) {
                    samples.push({
                        landmarks: convertedLandmarks,
                        label: label
                    });
                }
            }
        }

        return samples;
    }

    /**
     * 解析通用格式
     */
    _parseGenericFormat(data) {
        return data.map(item => {
            const landmarks = item.landmarks || item.keypoints;
            const label = item.label || item.gesture || item.sign;

            if (landmarks && label) {
                return {
                    landmarks: this._convertLandmarks(landmarks),
                    label: label
                };
            }
            return null;
        }).filter(item => item !== null);
    }

    /**
     * 转换关键点格式为标准格式
     * 标准格式：[{x, y, z}, ...] 共21个点
     */
    _convertLandmarks(landmarks) {
        // 如果已经是标准格式
        if (Array.isArray(landmarks) && landmarks.length === 21) {
            if (landmarks[0].x !== undefined && landmarks[0].y !== undefined) {
                return landmarks;
            }
        }

        // 如果是扁平数组 [x1, y1, z1, x2, y2, z2, ...]
        if (Array.isArray(landmarks) && landmarks.length === 63) {
            const converted = [];
            for (let i = 0; i < 21; i++) {
                converted.push({
                    x: landmarks[i * 3],
                    y: landmarks[i * 3 + 1],
                    z: landmarks[i * 3 + 2] || 0
                });
            }
            return converted;
        }

        // 如果是对象格式 {hand_0: [...], hand_1: [...]}
        if (landmarks && typeof landmarks === 'object') {
            const hands = [];
            if (landmarks.hand_0) {
                hands.push(this._convertLandmarks(landmarks.hand_0));
            }
            if (landmarks.hand_1) {
                hands.push(this._convertLandmarks(landmarks.hand_1));
            }
            return hands.length > 0 ? hands : null;
        }

        return null;
    }

    /**
     * 将导入的样本转换为分类器可用的格式
     * @param {Array} samples - 导入的样本
     * @param {FeatureExtractor} featureExtractor - 特征提取器
     * @returns {Array} 转换后的样本
     */
    convertToClassifierFormat(samples, featureExtractor) {
        return samples.map(sample => {
            // 如果已经有特征向量
            if (sample.features) {
                return {
                    features: sample.features,
                    label: sample.label
                };
            }

            // 如果有关键点数据，需要提取特征
            if (sample.landmarks) {
                let landmarksArray = sample.landmarks;

                // 确保是数组格式
                if (!Array.isArray(landmarksArray)) {
                    landmarksArray = [landmarksArray];
                }

                const features = featureExtractor.extractDual(landmarksArray);
                if (features) {
                    return {
                        features: features,
                        label: sample.label
                    };
                }
            }

            return null;
        }).filter(item => item !== null);
    }

    /**
     * 批量导入vivo数据
     * @param {string|Object} data - vivo数据
     * @param {SignLanguageClassifier} classifier - 分类器实例
     * @returns {Object} 导入结果
     */
    async importVivoData(data, classifier) {
        try {
            const result = await this.importData(data);

            if (result.format !== 'vivo' && result.format !== 'generic') {
                throw new Error('数据格式不匹配，期望vivo格式');
            }

            // 转换为分类器格式
            const convertedSamples = this.convertToClassifierFormat(
                result.samples,
                classifier.featureExtractor
            );

            // 添加到分类器
            for (const sample of convertedSamples) {
                classifier.samples.push(sample);
            }

            // 保存到IndexedDB
            await classifier.save();

            return {
                success: true,
                format: result.format,
                imported: convertedSamples.length,
                total: classifier.samples.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 验证数据格式
     * @param {string|Object} data - 原始数据
     * @returns {Object} 验证结果
     */
    validateData(data) {
        try {
            let jsonData;
            if (typeof data === 'string') {
                jsonData = JSON.parse(data);
            } else {
                jsonData = data;
            }

            const format = this._detectFormat(jsonData);
            const itemCount = this._getItemCount(jsonData);

            return {
                valid: true,
                format: format,
                itemCount: itemCount,
                message: `检测到${format}格式，包含${itemCount}条数据`
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                message: '数据格式验证失败'
            };
        }
    }

    /**
     * 检测数据格式
     */
    _detectFormat(data) {
        if (this._isHelloAIFormat(data)) return 'hello-ai';
        if (this._isVivoFormat(data)) return 'vivo';
        if (this._isGenericFormat(data)) return 'generic';
        return 'unknown';
    }

    /**
     * 获取数据条数
     */
    _getItemCount(data) {
        if (Array.isArray(data)) return data.length;
        if (data.samples) return data.samples.length;
        if (data.data) return data.data.length;
        return 0;
    }
}

export { DataAdapter };