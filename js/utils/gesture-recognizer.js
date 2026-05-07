/**
 * 动态手势序列识别器
 * 通过追踪多帧手势变化来识别动态手语
 * 原理：记录最近N帧的landmark序列，提取轨迹特征，用模板匹配识别
 */
class DynamicGestureRecognizer {
    constructor() {
        this.frameBuffer = [];          // 存储最近N帧的landmarks
        this.maxFrames = 15;            // 最多保留15帧（约0.5秒@30fps）
        this.minFrames = 5;             // 最少需要5帧才开始识别
        this.lastRecognized = '';       // 上次识别结果
        this.lastRecognizedTime = 0;    // 上次识别时间
        this.cooldownMs = 2000;         // 同一手势冷却2秒
        this.isReady = false;

        // 预置动态手势模板
        this.templates = this._buildTemplates();
    }

    init() {
        this.isReady = true;
        console.log(`[动态手势] 初始化完成，${Object.keys(this.templates).length} 个预置模板`);
    }

    /**
     * 每帧调用，传入当前帧的landmarks
     * @param {Array} landmarksArray - MediaPipe返回的landmarks数组
     * @returns {Object|null} { label: string, confidence: number } 或 null
     */
    processFrame(landmarksArray) {
        if (!this.isReady || !landmarksArray || landmarksArray.length === 0) {
            this.frameBuffer = [];
            return null;
        }

        // 提取当前帧的关键特征（轻量级，只用几个关键点）
        const hand = landmarksArray[0];
        const frameFeature = this._extractFrameFeature(hand);

        // 添加到缓冲区
        this.frameBuffer.push(frameFeature);
        if (this.frameBuffer.length > this.maxFrames) {
            this.frameBuffer.shift();
        }

        // 帧数不够，不识别
        if (this.frameBuffer.length < this.minFrames) return null;

        // 检测手势是否稳定（手在移动中）
        const motion = this._detectMotion();

        // 手势稳定时尝试匹配静态手势
        if (motion.type === 'stable') {
            return this._matchStaticTemplate(motion);
        }

        // 手势运动时尝试匹配动态手势
        if (motion.type === 'moving') {
            return this._matchDynamicTemplate(motion);
        }

        return null;
    }

    /**
     * 提取单帧关键特征（轻量级，用于轨迹分析）
     */
    _extractFrameFeature(hand) {
        if (!hand || hand.length < 21) return null;
        const wrist = hand[0];
        return {
            // 手掌中心位置（归一化）
            palmX: hand[9].x,
            palmY: hand[9].y,
            // 各指尖位置
            thumbTip: { x: hand[4].x, y: hand[4].y },
            indexTip: { x: hand[8].x, y: hand[8].y },
            middleTip: { x: hand[12].x, y: hand[12].y },
            ringTip: { x: hand[16].x, y: hand[16].y },
            pinkyTip: { x: hand[20].x, y: hand[20].y },
            // 手指状态（伸直/弯曲）
            fingers: this._getFingerStates(hand),
            // 时间戳
            time: Date.now()
        };
    }

    /**
     * 获取手指伸直/弯曲状态
     */
    _getFingerStates(hand) {
        const states = [];
        // 拇指
        const thumbDist = Math.hypot(hand[4].x - hand[2].x, hand[4].y - hand[2].y);
        states.push(thumbDist > 0.06 ? 1 : 0);
        // 其他四指
        const tips = [8, 12, 16, 20];
        const pips = [6, 10, 14, 18];
        for (let i = 0; i < 4; i++) {
            states.push(hand[tips[i]].y < hand[pips[i]].y ? 1 : 0);
        }
        return states; // [thumb, index, middle, ring, pinky]
    }

    /**
     * 检测手部运动类型
     */
    _detectMotion() {
        const frames = this.frameBuffer;
        const len = frames.length;
        if (len < 3) return { type: 'unknown' };

        // 计算手掌中心的移动距离
        let totalMove = 0;
        let maxMove = 0;
        let moveDir = { x: 0, y: 0 };

        for (let i = 1; i < len; i++) {
            const dx = frames[i].palmX - frames[i-1].palmX;
            const dy = frames[i].palmY - frames[i-1].palmY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            totalMove += dist;
            maxMove = Math.max(maxMove, dist);
            moveDir.x += dx;
            moveDir.y += dy;
        }

        const avgMove = totalMove / (len - 1);

        // 判断手指状态变化
        let fingerChanges = 0;
        for (let i = 1; i < len; i++) {
            for (let f = 0; f < 5; f++) {
                if (frames[i].fingers[f] !== frames[i-1].fingers[f]) {
                    fingerChanges++;
                }
            }
        }

        // 判断运动方向
        const mainDir = Math.abs(moveDir.x) > Math.abs(moveDir.y)
            ? (moveDir.x > 0 ? 'right' : 'left')
            : (moveDir.y > 0 ? 'down' : 'up');

        // 判断运动类型
        let type = 'stable';
        if (avgMove > 0.015) {
            type = 'moving';
        }

        // 获取当前手指状态（最后一帧）
        const currentFingers = frames[len-1].fingers;
        const fingerCount = currentFingers.reduce((a,b) => a+b, 0);

        return {
            type,
            avgMove,
            maxMove,
            totalMove,
            mainDir,
            fingerChanges,
            currentFingers,
            fingerCount,
            frames
        };
    }

    /**
     * 预置动态手势模板
     * 每个模板定义匹配条件和对应的中文词汇
     */
    _buildTemplates() {
        return {
            // ===== 动态手势（需要手部运动）=====
            '再见': {
                type: 'dynamic',
                // 手掌张开，左右挥动
                match: (motion) => {
                    return motion.fingerCount >= 4 &&
                           motion.avgMove > 0.01 &&
                           (motion.mainDir === 'left' || motion.mainDir === 'right') &&
                           motion.totalMove > 0.08;
                },
                confidence: 0.75
            },
            '不要': {
                type: 'dynamic',
                // 手掌张开，向前推（或左右快速摆手）
                match: (motion) => {
                    return motion.fingerCount >= 3 &&
                           motion.avgMove > 0.012 &&
                           motion.fingerChanges <= 3 &&
                           motion.totalMove > 0.06;
                },
                confidence: 0.65
            },
            '过来': {
                type: 'dynamic',
                // 手指弯曲向自己招手（手掌上下运动）
                match: (motion) => {
                    return motion.fingerCount <= 2 &&
                           motion.mainDir === 'down' &&
                           motion.avgMove > 0.01;
                },
                confidence: 0.6
            },
            // 吃饭 — 手放到嘴边（手向上移动+手指弯曲）
            '吃饭': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.mainDir === 'up' &&
                       motion.fingerCount <= 3 &&
                       motion.avgMove > 0.01 &&
                       motion.totalMove > 0.05;
                },
                confidence: 0.55
            },
            // 喝水 — 手做握杯动作（手指弯曲+手上下微动）
            '喝水': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerCount <= 2 &&
                       motion.mainDir === 'up' &&
                       motion.avgMove > 0.008 &&
                       motion.totalMove > 0.04;
                },
                confidence: 0.5
            },
            // 厕所 — T字形手势（水平挥手）
            '厕所': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerCount >= 3 &&
                       (motion.mainDir === 'left' || motion.mainDir === 'right') &&
                       motion.avgMove > 0.015 &&
                       motion.totalMove > 0.08;
                },
                confidence: 0.5
            },
            // 家 — 双手在头顶搭屋顶（简化：手向上移动+手指张开）
            '家': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.mainDir === 'up' &&
                       motion.fingerCount >= 3 &&
                       motion.avgMove > 0.012 &&
                       motion.totalMove > 0.06;
                },
                confidence: 0.45
            },
            // 医院 — 十字形手势（两手交叉，简化：手指交叉变化多）
            '医院': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerChanges >= 5 &&
                       motion.avgMove > 0.008 &&
                       motion.totalMove > 0.04;
                },
                confidence: 0.4
            },
            // 钱 — 拇指摩擦食指和中指（手指状态变化+微动）
            '钱': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerChanges >= 3 &&
                       motion.fingerCount <= 3 &&
                       motion.avgMove > 0.005 &&
                       motion.avgMove < 0.02;
                },
                confidence: 0.4
            },
            // 生气 — 握拳+手用力抖动
            '生气': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerCount === 0 &&
                       motion.avgMove > 0.015 &&
                       motion.maxMove > 0.03;
                },
                confidence: 0.55
            },
            // 难过 — 手在胸前向下移动
            '难过': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.mainDir === 'down' &&
                       motion.fingerCount <= 3 &&
                       motion.avgMove > 0.01 &&
                       motion.totalMove > 0.05;
                },
                confidence: 0.45
            },
            // 什么时候 — 两手翻转（简化：手指状态变化多+手左右移动）
            '什么时候': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerChanges >= 4 &&
                       (motion.mainDir === 'left' || motion.mainDir === 'right') &&
                       motion.avgMove > 0.01;
                },
                confidence: 0.4
            },
            // 什么 — 两手摊开（简化：手指张开+手向前推）
            '什么': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerCount >= 3 &&
                       motion.fingerChanges >= 2 &&
                       motion.avgMove > 0.01 &&
                       motion.totalMove > 0.05;
                },
                confidence: 0.4
            },
            // 对不起 — 手在胸前画圈（简化：手做圆周运动）
            '对不起': {
                type: 'dynamic',
                match: (motion) => {
                    return motion.fingerCount >= 2 &&
                       motion.avgMove > 0.012 &&
                       motion.totalMove > 0.08 &&
                       motion.maxMove > 0.025;
                },
                confidence: 0.4
            },

            // ===== 静态手势（手型稳定）=====
            '你好': {
                type: 'static',
                // 五指张开
                match: (motion) => {
                    return motion.fingerCount >= 4 && motion.avgMove < 0.008;
                },
                confidence: 0.7
            },
            '好的': {
                type: 'static',
                // 竖大拇指
                match: (motion) => {
                    return motion.currentFingers[0] === 1 &&
                           motion.fingerCount === 1 &&
                           motion.avgMove < 0.008;
                },
                confidence: 0.8
            },
            '谢谢': {
                type: 'static',
                // V字手势（食指+中指伸直）
                match: (motion) => {
                    return motion.currentFingers[1] === 1 &&
                           motion.currentFingers[2] === 1 &&
                           motion.fingerCount === 2 &&
                           motion.avgMove < 0.008;
                },
                confidence: 0.8
            },
            '我爱你': {
                type: 'static',
                // 拇指+食指+小指伸直（ILoveYou手势）
                match: (motion) => {
                    return motion.currentFingers[0] === 1 &&
                           motion.currentFingers[1] === 1 &&
                           motion.currentFingers[4] === 1 &&
                           motion.currentFingers[2] === 0 &&
                           motion.currentFingers[3] === 0 &&
                           motion.avgMove < 0.01;
                },
                confidence: 0.85
            },
            '想要': {
                type: 'static',
                // 两指或三指伸直，微微抓握
                match: (motion) => {
                    return motion.fingerCount === 2 &&
                           motion.currentFingers[1] === 1 &&
                           motion.currentFingers[2] === 1 &&
                           motion.avgMove < 0.01;
                },
                confidence: 0.55
            },
            '帮忙': {
                type: 'static',
                // 拇指弯曲，其他四指伸直
                match: (motion) => {
                    return motion.currentFingers[0] === 0 &&
                           motion.fingerCount >= 3 &&
                           motion.avgMove < 0.01;
                },
                confidence: 0.6
            },
            // 不好 / 停 — 大拇指朝下
            '不好': {
                type: 'static',
                match: (motion) => {
                    return motion.currentFingers[0] === 1 &&
                       motion.fingerCount === 1 &&
                       motion.avgMove < 0.008 &&
                       motion.frames[motion.frames.length-1].thumbTip.y > motion.frames[motion.frames.length-1].indexTip.y;
                },
                confidence: 0.7
            },
            // 指向上 — 食指伸直朝上
            '指向上': {
                type: 'static',
                match: (motion) => {
                    return motion.currentFingers[1] === 1 &&
                       motion.fingerCount === 1 &&
                       motion.avgMove < 0.008;
                },
                confidence: 0.65
            },
            // 握拳 — 所有手指弯曲
            '握拳': {
                type: 'static',
                match: (motion) => {
                    return motion.fingerCount === 0 && motion.avgMove < 0.008;
                },
                confidence: 0.7
            },
            // 加油 — 食指和小指伸直（摇滚手势）
            '加油': {
                type: 'static',
                match: (motion) => {
                    return motion.currentFingers[1] === 1 &&
                       motion.currentFingers[4] === 1 &&
                       motion.fingerCount === 2 &&
                       motion.avgMove < 0.008;
                },
                confidence: 0.75
            },
            // 数字三 — 三根手指伸直
            '三': {
                type: 'static',
                match: (motion) => {
                    return motion.currentFingers[1] === 1 &&
                       motion.currentFingers[2] === 1 &&
                       motion.currentFingers[3] === 1 &&
                       motion.fingerCount === 3 &&
                       motion.avgMove < 0.008;
                },
                confidence: 0.65
            },
            // 数字四 — 四根手指伸直
            '四': {
                type: 'static',
                match: (motion) => {
                    return motion.fingerCount >= 4 &&
                       motion.currentFingers[0] === 0 &&
                       motion.avgMove < 0.008;
                },
                confidence: 0.65
            },
            // OK — 拇指和食指形成圆圈
            '好的呀': {
                type: 'static',
                match: (motion) => {
                    const last = motion.frames[motion.frames.length-1];
                    if (!last) return false;
                    const dist = Math.hypot(last.thumbTip.x - last.indexTip.x, last.thumbTip.y - last.indexTip.y);
                    return dist < 0.06 && motion.fingerCount <= 2 && motion.avgMove < 0.01;
                },
                confidence: 0.7
            },
            // 电话 — 拇指和小指伸直，放在耳边（动态：手移向耳朵方向）
            '电话': {
                type: 'static',
                match: (motion) => {
                    return motion.currentFingers[0] === 1 &&
                       motion.currentFingers[4] === 1 &&
                       motion.currentFingers[1] === 0 &&
                       motion.currentFingers[2] === 0 &&
                       motion.currentFingers[3] === 0 &&
                       motion.avgMove < 0.01;
                },
                confidence: 0.7
            },
            // 开心 — 两手或单手张开摇摆（这里用单手张开+微动）
            '开心': {
                type: 'static',
                match: (motion) => {
                    return motion.fingerCount >= 4 &&
                       motion.avgMove >= 0.005 && motion.avgMove < 0.015 &&
                       motion.fingerChanges <= 2;
                },
                confidence: 0.5
            },
            // 害怕 — 五指张开但手在微微颤抖
            '害怕': {
                type: 'static',
                match: (motion) => {
                    return motion.fingerCount >= 4 &&
                       motion.avgMove >= 0.003 && motion.avgMove < 0.012 &&
                       motion.maxMove < 0.03;
                },
                confidence: 0.45
            },
            // 请 — 双手合十（单手简化：五指并拢微微弯曲）
            '请': {
                type: 'static',
                match: (motion) => {
                    return motion.fingerCount >= 3 &&
                       motion.fingerCount <= 4 &&
                       motion.currentFingers[0] === 0 &&
                       motion.avgMove < 0.008;
                },
                confidence: 0.5
            },
            // 喜欢 — 手指指向自己的心口（简化：握拳+微动）
            '喜欢': {
                type: 'static',
                match: (motion) => {
                    return motion.fingerCount <= 1 &&
                       motion.avgMove < 0.01 &&
                       motion.currentFingers[0] === 0;
                },
                confidence: 0.45
            }
        };
    }

    /**
     * 匹配静态手势模板
     */
    _matchStaticTemplate(motion) {
        const now = Date.now();
        let bestMatch = null;
        let bestConf = 0;

        for (const [label, template] of Object.entries(this.templates)) {
            if (template.type !== 'static') continue;
            try {
                if (template.match(motion)) {
                    const conf = template.confidence * (1 - motion.avgMove * 20);
                    if (conf > bestConf) {
                        bestConf = conf;
                        bestMatch = label;
                    }
                }
            } catch(e) {
                console.warn('[动态手势] 静态模板匹配出错:', e);
            }
        }

        if (bestMatch && bestConf >= 0.4) {
            // 冷却检查
            if (bestMatch === this.lastRecognized && (now - this.lastRecognizedTime) < this.cooldownMs) {
                return null;
            }
            this.lastRecognized = bestMatch;
            this.lastRecognizedTime = now;
            this.frameBuffer = []; // 识别成功后清空缓冲区
            return { label: bestMatch, confidence: bestConf };
        }

        return null;
    }

    /**
     * 匹配动态手势模板
     */
    _matchDynamicTemplate(motion) {
        const now = Date.now();
        let bestMatch = null;
        let bestConf = 0;

        for (const [label, template] of Object.entries(this.templates)) {
            if (template.type !== 'dynamic') continue;
            try {
                if (template.match(motion)) {
                    if (template.confidence > bestConf) {
                        bestConf = template.confidence;
                        bestMatch = label;
                    }
                }
            } catch(e) {
                console.warn('[动态手势] 动态模板匹配出错:', e);
            }
        }

        if (bestMatch && bestConf >= 0.4) {
            // 冷却检查
            if (bestMatch === this.lastRecognized && (now - this.lastRecognizedTime) < this.cooldownMs) {
                return null;
            }
            this.lastRecognized = bestMatch;
            this.lastRecognizedTime = now;
            this.frameBuffer = []; // 识别成功后清空缓冲区
            return { label: bestMatch, confidence: bestConf };
        }

        return null;
    }

    /**
     * 重置状态
     */
    reset() {
        this.frameBuffer = [];
        this.lastRecognized = '';
        this.lastRecognizedTime = 0;
    }
}

export { DynamicGestureRecognizer };
