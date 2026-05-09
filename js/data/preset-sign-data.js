/**
 * 预置手语训练数据生成器
 * 为 34 个常用中文手语词汇生成模拟 MediaPipe landmarks 数据
 * 每个词汇 18 个带噪声的变体样本
 */

const NOISE_LEVEL = 0.012;
const SAMPLES_PER_WORD = 18;

// 手指关节链定义：[CMC/MCP, PIP, DIP, TIP]
const FINGER_CHAINS = {
    thumb:  [1, 2, 3, 4],
    index:  [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring:   [13, 14, 15, 16],
    pinky:  [17, 18, 19, 20]
};

// 手掌基础坐标模板（右手，归一化坐标）
const BASE_POSE = {
    wrist: { x: 0.5, y: 0.85, z: 0 },
    // 手掌 MCP 关节（指根）
    mcps: {
        thumb:  { x: 0.38, y: 0.72, z: 0.01 },
        index:  { x: 0.42, y: 0.60, z: 0 },
        middle: { x: 0.48, y: 0.58, z: -0.01 },
        ring:   { x: 0.54, y: 0.60, z: 0 },
        pinky:  { x: 0.59, y: 0.64, z: 0.01 }
    }
};

// 手指方向向量（从 MCP 指向 TIP 的方向）
const FINGER_DIRS = {
    thumb:  { dx: -0.12, dy: -0.15, dz: 0.02 },
    index:  { dx: -0.02, dy: -0.22, dz: -0.01 },
    middle: { dx: 0.0,  dy: -0.23, dz: -0.02 },
    ring:   { dx: 0.02, dy: -0.21, dz: -0.01 },
    pinky:  { dx: 0.04, dy: -0.18, dz: 0.01 }
};

/**
 * 生成单根手指的 landmarks
 * @param {Object} mcp - MCP 关节坐标 {x,y,z}
 * @param {Object} dir - 方向向量 {dx,dy,dz}
 * @param {number} extension - 伸展程度 0(完全弯曲) ~ 1(完全伸直)
 * @param {number} curl - 弯曲角度系数 0~1
 * @param {number} spread - 横向展开角度
 */
function generateFinger(mcp, dir, extension, curl, spread) {
    const joints = [];
    const segLen = [0.35, 0.30, 0.25]; // 三段长度比例

    let cx = mcp.x, cy = mcp.y, cz = mcp.z;
    let vx = dir.dx, vy = dir.dy, vz = dir.dz;

    // 横向展开
    vx += spread * 0.05;

    for (let i = 0; i < 3; i++) {
        const len = segLen[i] * extension;
        // 弯曲效果：每段逐渐增加向下偏移
        const bendOffset = curl * (1 - extension) * 0.06 * (i + 1);

        cx += vx * len;
        cy += vy * len + bendOffset;
        cz += vz * len;

        joints.push({
            x: cx,
            y: cy,
            z: cz
        });
    }

    return joints; // [PIP, DIP, TIP]
}

/**
 * 根据手部姿态定义生成 21 个 landmarks
 * @param {Object} pose - 手部姿态定义
 * @param {Object} pose.thumb - {extension: 0~1, curl: 0~1, spread: 0~1}
 * @param {Object} pose.index - 同上
 * @param {Object} pose.middle - 同上
 * @param {Object} pose.ring - 同上
 * @param {Object} pose.pinky - 同上
 * @param {Object} [pose.wrist] - 手腕偏移 {dx, dy, dz}
 * @param {number} [noise] - 噪声级别
 */
function generateHandLandmarks(pose, noise = NOISE_LEVEL) {
    const landmarks = new Array(21);

    // 0: Wrist
    const wristOff = pose.wrist || { dx: 0, dy: 0, dz: 0 };
    landmarks[0] = {
        x: BASE_POSE.wrist.x + wristOff.dx + noiseVal(noise),
        y: BASE_POSE.wrist.y + wristOff.dy + noiseVal(noise),
        z: BASE_POSE.wrist.z + wristOff.dz + noiseVal(noise * 0.5)
    };

    // 每根手指
    for (const [name, chain] of Object.entries(FINGER_CHAINS)) {
        const fingerPose = pose[name] || { extension: 0.5, curl: 0.3, spread: 0 };
        const mcp = BASE_POSE.mcps[name];
        const dir = FINGER_DIRS[name];

        // 1: CMC (拇指) / MCP (其他手指)
        landmarks[chain[0]] = {
            x: mcp.x + noiseVal(noise),
            y: mcp.y + noiseVal(noise),
            z: mcp.z + noiseVal(noise * 0.5)
        };

        // 生成 PIP, DIP, TIP
        const joints = generateFinger(
            mcp, dir,
            fingerPose.extension,
            fingerPose.curl,
            fingerPose.spread || 0
        );

        for (let i = 0; i < 3; i++) {
            landmarks[chain[i + 1]] = {
                x: joints[i].x + noiseVal(noise),
                y: joints[i].y + noiseVal(noise),
                z: joints[i].z + noiseVal(noise * 0.5)
            };
        }
    }

    return landmarks;
}

/**
 * 生成随机噪声
 */
function noiseVal(level) {
    return (Math.random() - 0.5) * 2 * level;
}

/**
 * 添加全局随机偏移（模拟手在画面中不同位置）
 */
function addGlobalOffset(landmarks) {
    const ox = (Math.random() - 0.5) * 0.1;
    const oy = (Math.random() - 0.5) * 0.08;
    const or = (Math.random() - 0.5) * 0.15; // 轻微旋转

    return landmarks.map((lm, i) => {
        const dx = lm.x - 0.5;
        const dy = lm.y - 0.7;
        return {
            x: 0.5 + dx * Math.cos(or) - dy * Math.sin(or) + ox,
            y: 0.7 + dx * Math.sin(or) + dy * Math.cos(or) + oy,
            z: lm.z + noiseVal(0.005)
        };
    });
}

// ============================================================
// 34 个手语词汇的姿态定义
// 每个词汇定义：单手或双手姿态
// ============================================================

const SIGN_POSES = {
    '你好': {
        // 张开手掌，五指伸展
        hands: [{
            thumb:  { extension: 0.9, curl: 0.1, spread: 0.6 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.2 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: -0.2 },
            pinky:  { extension: 1.0, curl: 0.0, spread: -0.4 }
        }]
    },
    '谢谢': {
        // 五指并拢伸展，指尖碰下巴
        hands: [{
            thumb:  { extension: 0.8, curl: 0.1, spread: 0.1 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: 0.0 },
            pinky:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.15, dz: 0 }
        }]
    },
    '对不起': {
        // 握拳，拳心朝内
        hands: [{
            thumb:  { extension: 0.4, curl: 0.7, spread: 0.2 },
            index:  { extension: 0.1, curl: 0.9, spread: 0.0 },
            middle: { extension: 0.1, curl: 0.9, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.9, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.9, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.1, dz: 0 }
        }]
    },
    '没关系': {
        // 张开手掌，掌心向前推开
        hands: [{
            thumb:  { extension: 0.9, curl: 0.1, spread: 0.5 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.1 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: -0.1 },
            pinky:  { extension: 1.0, curl: 0.0, spread: -0.3 }
        }]
    },
    '再见': {
        // 挥手：张开手掌，手腕偏移
        hands: [{
            thumb:  { extension: 0.9, curl: 0.1, spread: 0.5 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.1 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: -0.1 },
            pinky:  { extension: 1.0, curl: 0.0, spread: -0.3 },
            wrist:  { dx: 0.1, dy: -0.05, dz: 0 }
        }]
    },
    '是': {
        // 竖起大拇指
        hands: [{
            thumb:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            index:  { extension: 0.1, curl: 0.85, spread: 0.0 },
            middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 }
        }]
    },
    '不是': {
        // 摇手：五指伸展，手掌左右摆
        hands: [{
            thumb:  { extension: 0.8, curl: 0.1, spread: 0.4 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: 0.0 },
            pinky:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            wrist:  { dx: -0.08, dy: 0, dz: 0 }
        }]
    },
    '好': {
        // OK 手势：拇指食指圈
        hands: [{
            thumb:  { extension: 0.6, curl: 0.5, spread: 0.3 },
            index:  { extension: 0.5, curl: 0.5, spread: 0.0 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: 0.0 },
            pinky:  { extension: 1.0, curl: 0.0, spread: -0.1 }
        }]
    },
    '不好': {
        // 大拇指朝下
        hands: [{
            thumb:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            index:  { extension: 0.1, curl: 0.9, spread: 0.0 },
            middle: { extension: 0.1, curl: 0.9, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.9, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.9, spread: 0.0 },
            wrist:  { dx: 0, dy: 0.05, dz: 0 }
        }]
    },
    '请': {
        // 五指并拢，掌心向上伸出
        hands: [{
            thumb:  { extension: 0.8, curl: 0.1, spread: 0.1 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: 0.0 },
            pinky:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            wrist:  { dx: 0.05, dy: -0.05, dz: 0 }
        }]
    },
    '帮忙': {
        // 双手握拳叠放
        hands: [
            {
                thumb:  { extension: 0.3, curl: 0.7, spread: 0.1 },
                index:  { extension: 0.15, curl: 0.85, spread: 0.0 },
                middle: { extension: 0.15, curl: 0.85, spread: 0.0 },
                ring:   { extension: 0.15, curl: 0.85, spread: 0.0 },
                pinky:  { extension: 0.15, curl: 0.85, spread: 0.0 }
            },
            {
                thumb:  { extension: 0.3, curl: 0.7, spread: 0.1 },
                index:  { extension: 0.15, curl: 0.85, spread: 0.0 },
                middle: { extension: 0.15, curl: 0.85, spread: 0.0 },
                ring:   { extension: 0.15, curl: 0.85, spread: 0.0 },
                pinky:  { extension: 0.15, curl: 0.85, spread: 0.0 },
                wrist:  { dx: 0.3, dy: -0.05, dz: 0 }
            }
        ]
    },
    '吃饭': {
        // 做拿筷子的动作：拇指食指伸出
        hands: [{
            thumb:  { extension: 0.8, curl: 0.2, spread: 0.3 },
            index:  { extension: 0.9, curl: 0.1, spread: -0.1 },
            middle: { extension: 0.2, curl: 0.8, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.9, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.9, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.08, dz: 0 }
        }]
    },
    '喝水': {
        // 手握杯子姿势
        hands: [{
            thumb:  { extension: 0.6, curl: 0.4, spread: 0.4 },
            index:  { extension: 0.3, curl: 0.7, spread: 0.0 },
            middle: { extension: 0.3, curl: 0.7, spread: 0.0 },
            ring:   { extension: 0.3, curl: 0.7, spread: 0.0 },
            pinky:  { extension: 0.3, curl: 0.7, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.1, dz: 0 }
        }]
    },
    '厕所': {
        // 食指中指伸出做走路状
        hands: [{
            thumb:  { extension: 0.3, curl: 0.6, spread: 0.0 },
            index:  { extension: 1.0, curl: 0.0, spread: -0.1 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.1 },
            ring:   { extension: 0.1, curl: 0.9, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.9, spread: 0.0 }
        }]
    },
    '家': {
        // 双手搭成屋顶形状
        hands: [
            {
                thumb:  { extension: 0.7, curl: 0.2, spread: 0.3 },
                index:  { extension: 1.0, curl: 0.0, spread: 0.3 },
                middle: { extension: 0.9, curl: 0.1, spread: 0.1 },
                ring:   { extension: 0.1, curl: 0.8, spread: 0.0 },
                pinky:  { extension: 0.1, curl: 0.8, spread: 0.0 }
            },
            {
                thumb:  { extension: 0.7, curl: 0.2, spread: -0.3 },
                index:  { extension: 1.0, curl: 0.0, spread: -0.3 },
                middle: { extension: 0.9, curl: 0.1, spread: -0.1 },
                ring:   { extension: 0.1, curl: 0.8, spread: 0.0 },
                pinky:  { extension: 0.1, curl: 0.8, spread: 0.0 },
                wrist:  { dx: 0.35, dy: 0, dz: 0 }
            }
        ]
    },
    '医院': {
        // 十字手势：食指中指交叉
        hands: [{
            thumb:  { extension: 0.3, curl: 0.6, spread: 0.0 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.9, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.9, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.05, dz: 0 }
        }]
    },
    '电话': {
        // 拿电话手势：拇指小指伸出
        hands: [{
            thumb:  { extension: 0.8, curl: 0.1, spread: 0.4 },
            index:  { extension: 0.1, curl: 0.85, spread: 0.0 },
            middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
            pinky:  { extension: 0.9, curl: 0.0, spread: -0.3 },
            wrist:  { dx: 0, dy: -0.08, dz: 0 }
        }]
    },
    '钱': {
        // 拇指食指搓动
        hands: [{
            thumb:  { extension: 0.7, curl: 0.3, spread: 0.2 },
            index:  { extension: 0.7, curl: 0.3, spread: 0.0 },
            middle: { extension: 0.2, curl: 0.8, spread: 0.0 },
            ring:   { extension: 0.2, curl: 0.8, spread: 0.0 },
            pinky:  { extension: 0.2, curl: 0.8, spread: 0.0 }
        }]
    },
    '名字': {
        // 飋指中指伸出在胸前划
        hands: [{
            thumb:  { extension: 0.3, curl: 0.6, spread: 0.0 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.9, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.9, spread: 0.0 },
            wrist:  { dx: 0.05, dy: -0.05, dz: 0 }
        }]
    },
    '我': {
        // 食指指自己胸口
        hands: [{
            thumb:  { extension: 0.3, curl: 0.5, spread: 0.2 },
            index:  { extension: 0.9, curl: 0.1, spread: 0.0 },
            middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.1, dz: 0 }
        }]
    },
    '你': {
        // 食指指向对方（向前）
        hands: [{
            thumb:  { extension: 0.4, curl: 0.4, spread: 0.3 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
            middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 },
            wrist:  { dx: 0.05, dy: 0, dz: 0 }
        }]
    },
    '他': {
        // 食指指向侧面
        hands: [{
            thumb:  { extension: 0.4, curl: 0.4, spread: 0.2 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.3 },
            middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 },
            wrist:  { dx: 0.1, dy: 0, dz: 0 }
        }]
    },
    '我们': {
        // 双手食指指自己再划圈
        hands: [
            {
                thumb:  { extension: 0.3, curl: 0.5, spread: 0.2 },
                index:  { extension: 0.9, curl: 0.1, spread: 0.0 },
                middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
                ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
                pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 },
                wrist:  { dx: 0, dy: -0.1, dz: 0 }
            },
            {
                thumb:  { extension: 0.3, curl: 0.5, spread: 0.2 },
                index:  { extension: 0.9, curl: 0.1, spread: 0.0 },
                middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
                ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
                pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 },
                wrist:  { dx: 0.3, dy: -0.1, dz: 0 }
            }
        ]
    },
    '什么': {
        // 双手摊开，掌心向上
        hands: [{
            thumb:  { extension: 0.8, curl: 0.1, spread: 0.4 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.2 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: -0.1 },
            pinky:  { extension: 1.0, curl: 0.0, spread: -0.3 },
            wrist:  { dx: 0, dy: -0.03, dz: 0 }
        }]
    },
    '哪里': {
        // 食指画圈，指向某方向
        hands: [{
            thumb:  { extension: 0.4, curl: 0.4, spread: 0.3 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.1 },
            middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 },
            wrist:  { dx: 0.08, dy: -0.03, dz: 0 }
        }]
    },
    '什么时候': {
        // 拍手腕（指向手腕）
        hands: [{
            thumb:  { extension: 0.7, curl: 0.2, spread: 0.3 },
            index:  { extension: 0.8, curl: 0.1, spread: 0.0 },
            middle: { extension: 0.8, curl: 0.1, spread: 0.0 },
            ring:   { extension: 0.2, curl: 0.7, spread: 0.0 },
            pinky:  { extension: 0.2, curl: 0.7, spread: 0.0 },
            wrist:  { dx: 0.05, dy: 0.05, dz: 0 }
        }]
    },
    '多少': {
        // 一手五指张开，一手食指伸出
        hands: [
            {
                thumb:  { extension: 0.9, curl: 0.1, spread: 0.5 },
                index:  { extension: 1.0, curl: 0.0, spread: 0.1 },
                middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
                ring:   { extension: 1.0, curl: 0.0, spread: -0.1 },
                pinky:  { extension: 1.0, curl: 0.0, spread: -0.3 }
            },
            {
                thumb:  { extension: 0.3, curl: 0.5, spread: 0.2 },
                index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
                middle: { extension: 0.1, curl: 0.85, spread: 0.0 },
                ring:   { extension: 0.1, curl: 0.85, spread: 0.0 },
                pinky:  { extension: 0.1, curl: 0.85, spread: 0.0 },
                wrist:  { dx: 0.3, dy: 0, dz: 0 }
            }
        ]
    },
    '不要': {
        // 双手交叉推开
        hands: [
            {
                thumb:  { extension: 0.8, curl: 0.1, spread: 0.4 },
                index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
                middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
                ring:   { extension: 1.0, curl: 0.0, spread: 0.0 },
                pinky:  { extension: 1.0, curl: 0.0, spread: 0.0 },
                wrist:  { dx: -0.05, dy: 0, dz: 0 }
            },
            {
                thumb:  { extension: 0.8, curl: 0.1, spread: -0.4 },
                index:  { extension: 1.0, curl: 0.0, spread: 0.0 },
                middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
                ring:   { extension: 1.0, curl: 0.0, spread: 0.0 },
                pinky:  { extension: 1.0, curl: 0.0, spread: 0.0 },
                wrist:  { dx: 0.35, dy: 0, dz: 0 }
            }
        ]
    },
    '想要': {
        // 双手向自己方向拉
        hands: [{
            thumb:  { extension: 0.7, curl: 0.3, spread: 0.3 },
            index:  { extension: 0.8, curl: 0.2, spread: 0.0 },
            middle: { extension: 0.8, curl: 0.2, spread: 0.0 },
            ring:   { extension: 0.8, curl: 0.2, spread: 0.0 },
            pinky:  { extension: 0.8, curl: 0.2, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.05, dz: 0 }
        }]
    },
    '开心': {
        // 双手举高张开五指
        hands: [{
            thumb:  { extension: 1.0, curl: 0.0, spread: 0.5 },
            index:  { extension: 1.0, curl: 0.0, spread: 0.2 },
            middle: { extension: 1.0, curl: 0.0, spread: 0.0 },
            ring:   { extension: 1.0, curl: 0.0, spread: -0.2 },
            pinky:  { extension: 1.0, curl: 0.0, spread: -0.4 },
            wrist:  { dx: 0, dy: -0.2, dz: 0 }
        }]
    },
    '难过': {
        // 双手握拳放在胸口
        hands: [{
            thumb:  { extension: 0.3, curl: 0.7, spread: 0.1 },
            index:  { extension: 0.15, curl: 0.85, spread: 0.0 },
            middle: { extension: 0.15, curl: 0.85, spread: 0.0 },
            ring:   { extension: 0.15, curl: 0.85, spread: 0.0 },
            pinky:  { extension: 0.15, curl: 0.85, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.12, dz: 0 }
        }]
    },
    '生气': {
        // 双手握拳，身体前倾
        hands: [{
            thumb:  { extension: 0.2, curl: 0.8, spread: 0.0 },
            index:  { extension: 0.1, curl: 0.95, spread: 0.0 },
            middle: { extension: 0.1, curl: 0.95, spread: 0.0 },
            ring:   { extension: 0.1, curl: 0.95, spread: 0.0 },
            pinky:  { extension: 0.1, curl: 0.95, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.05, dz: 0 }
        }]
    },
    '害怕': {
        // 双手缩在胸前，手指微曲
        hands: [{
            thumb:  { extension: 0.5, curl: 0.4, spread: 0.2 },
            index:  { extension: 0.5, curl: 0.4, spread: 0.0 },
            middle: { extension: 0.5, curl: 0.4, spread: 0.0 },
            ring:   { extension: 0.5, curl: 0.4, spread: 0.0 },
            pinky:  { extension: 0.5, curl: 0.4, spread: 0.0 },
            wrist:  { dx: 0, dy: -0.1, dz: 0 }
        }]
    },
    '喜欢': {
        hands: [
            {
                thumb:  { extension: 0.6, curl: 0.3, spread: 0.3 },
                index:  { extension: 0.7, curl: 0.2, spread: 0.0 },
                middle: { extension: 0.7, curl: 0.2, spread: 0.0 },
                ring:   { extension: 0.7, curl: 0.2, spread: 0.0 },
                pinky:  { extension: 0.7, curl: 0.2, spread: 0.0 },
                wrist:  { dx: 0, dy: -0.1, dz: 0 }
            },
            {
                thumb:  { extension: 0.6, curl: 0.3, spread: -0.3 },
                index:  { extension: 0.7, curl: 0.2, spread: 0.0 },
                middle: { extension: 0.7, curl: 0.2, spread: 0.0 },
                ring:   { extension: 0.7, curl: 0.2, spread: 0.0 },
                pinky:  { extension: 0.7, curl: 0.2, spread: 0.0 },
                wrist:  { dx: 0.3, dy: -0.1, dz: 0 }
            }
        ]
    },

    // ===== 数字 =====
    '一': { hands: [{ thumb: { extension: 0.3, curl: 0.5, spread: 0.2 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 0.1, curl: 0.9, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 } }] },
    '二': { hands: [{ thumb: { extension: 0.3, curl: 0.5, spread: 0.1 }, index: { extension: 1.0, curl: 0.0, spread: 0.1 }, middle: { extension: 1.0, curl: 0.0, spread: -0.1 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 } }] },
    '三': { hands: [{ thumb: { extension: 0.3, curl: 0.5, spread: 0.0 }, index: { extension: 1.0, curl: 0.0, spread: 0.1 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.1 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 } }] },
    '四': { hands: [{ thumb: { extension: 0.2, curl: 0.7, spread: 0.0 }, index: { extension: 1.0, curl: 0.0, spread: 0.1 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.1 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.2 } }] },
    '五': { hands: [{ thumb: { extension: 1.0, curl: 0.0, spread: 0.5 }, index: { extension: 1.0, curl: 0.0, spread: 0.2 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.2 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.4 } }] },
    '六': { hands: [{ thumb: { extension: 1.0, curl: 0.0, spread: 0.3 }, index: { extension: 1.0, curl: 0.0, spread: 0.2 }, middle: { extension: 0.1, curl: 0.9, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 } }] },
    '七': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.3 }, index: { extension: 0.1, curl: 0.8, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 } }] },
    '八': { hands: [{ thumb: { extension: 1.0, curl: 0.0, spread: 0.4 }, index: { extension: 1.0, curl: 0.0, spread: 0.3 }, middle: { extension: 1.0, curl: 0.0, spread: 0.1 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 } }] },
    '九': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.2 }, index: { extension: 0.1, curl: 0.85, spread: 0.0 }, middle: { extension: 0.1, curl: 0.85, spread: 0.0 }, ring: { extension: 0.1, curl: 0.85, spread: 0.0 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.2 } }] },
    '十': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.5, curl: 0.3, spread: 0.0 }, middle: { extension: 0.5, curl: 0.3, spread: 0.0 }, ring: { extension: 0.5, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },

    // ===== 时间 =====
    '今天': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '明天': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 }, wrist: { dx: 0.08, dy: -0.05, dz: 0 } }] },
    '昨天': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.2 }, index: { extension: 0.9, curl: 0.1, spread: 0.0 }, middle: { extension: 0.9, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: -0.08, dy: -0.05, dz: 0 } }] },
    '早上': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.4 }, index: { extension: 1.0, curl: 0.0, spread: 0.1 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.1 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.3 }, wrist: { dx: 0, dy: -0.15, dz: 0 } }] },
    '中午': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 0.1, curl: 0.85, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.85, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },
    '晚上': { hands: [{ thumb: { extension: 0.4, curl: 0.5, spread: 0.2 }, index: { extension: 0.2, curl: 0.8, spread: 0.0 }, middle: { extension: 0.2, curl: 0.8, spread: 0.0 }, ring: { extension: 0.2, curl: 0.8, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.8, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '现在': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: 0, dy: -0.03, dz: 0 } }] },
    '以后': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.2 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.8, curl: 0.1, spread: 0.0 }, pinky: { extension: 0.8, curl: 0.1, spread: 0.0 }, wrist: { dx: 0.1, dy: 0, dz: 0 } }] },

    // ===== 地点 =====
    '学校': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 1.0, curl: 0.0, spread: 0.1 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.1 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.2 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },
    '超市': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.4 }, index: { extension: 0.9, curl: 0.1, spread: 0.0 }, middle: { extension: 0.9, curl: 0.1, spread: 0.0 }, ring: { extension: 0.9, curl: 0.1, spread: 0.0 }, pinky: { extension: 0.9, curl: 0.1, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '银行': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.2 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 } }] },
    '公园': { hands: [{ thumb: { extension: 0.9, curl: 0.1, spread: 0.5 }, index: { extension: 1.0, curl: 0.0, spread: 0.2 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.2 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.4 }, wrist: { dx: 0.05, dy: -0.12, dz: 0 } }] },
    '公司': { hands: [{ thumb: { extension: 0.5, curl: 0.4, spread: 0.2 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },

    // ===== 动作 =====
    '去': { hands: [{ thumb: { extension: 0.4, curl: 0.4, spread: 0.2 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 }, wrist: { dx: 0.1, dy: 0, dz: 0 } }] },
    '来': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.3 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 }, wrist: { dx: -0.05, dy: 0, dz: 0 } }] },
    '坐': { hands: [{ thumb: { extension: 0.5, curl: 0.4, spread: 0.3 }, index: { extension: 0.4, curl: 0.5, spread: 0.0 }, middle: { extension: 0.4, curl: 0.5, spread: 0.0 }, ring: { extension: 0.4, curl: 0.5, spread: 0.0 }, pinky: { extension: 0.4, curl: 0.5, spread: 0.0 }, wrist: { dx: 0, dy: 0.03, dz: 0 } }] },
    '站': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.2 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '走': { hands: [{ thumb: { extension: 0.3, curl: 0.5, spread: 0.1 }, index: { extension: 0.8, curl: 0.1, spread: -0.1 }, middle: { extension: 0.8, curl: 0.1, spread: 0.1 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: 0.05, dy: 0, dz: 0 } }] },
    '睡觉': { hands: [{ thumb: { extension: 0.3, curl: 0.6, spread: 0.1 }, index: { extension: 0.2, curl: 0.8, spread: 0.0 }, middle: { extension: 0.2, curl: 0.8, spread: 0.0 }, ring: { extension: 0.2, curl: 0.8, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.8, spread: 0.0 }, wrist: { dx: 0, dy: -0.12, dz: 0 } }] },
    '工作': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: 0.05, dy: -0.03, dz: 0 } }] },
    '学习': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.9, curl: 0.1, spread: 0.0 }, middle: { extension: 0.9, curl: 0.1, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '看': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },
    '听': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.3 }, index: { extension: 0.4, curl: 0.5, spread: 0.0 }, middle: { extension: 0.4, curl: 0.5, spread: 0.0 }, ring: { extension: 0.4, curl: 0.5, spread: 0.0 }, pinky: { extension: 0.4, curl: 0.5, spread: 0.0 }, wrist: { dx: -0.1, dy: -0.08, dz: 0 } }] },
    '说': { hands: [{ thumb: { extension: 0.4, curl: 0.4, spread: 0.2 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '写': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.9, curl: 0.1, spread: 0.0 }, middle: { extension: 0.3, curl: 0.6, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0.05, dy: -0.05, dz: 0 } }] },
    '读': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.4, curl: 0.5, spread: 0.0 }, pinky: { extension: 0.4, curl: 0.5, spread: 0.0 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },
    '买': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.04, dz: 0 } }] },
    '卖': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.4 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: 0.05, dy: -0.04, dz: 0 } }] },
    '给': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.8, curl: 0.1, spread: 0.0 }, pinky: { extension: 0.8, curl: 0.1, spread: 0.0 }, wrist: { dx: 0.08, dy: 0, dz: 0 } }] },
    '问': { hands: [{ thumb: { extension: 0.4, curl: 0.4, spread: 0.2 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 0.1, curl: 0.85, spread: 0.0 }, ring: { extension: 0.1, curl: 0.85, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.85, spread: 0.0 }, wrist: { dx: 0.05, dy: -0.03, dz: 0 } }] },
    '打开': { hands: [{ thumb: { extension: 0.9, curl: 0.1, spread: 0.5 }, index: { extension: 1.0, curl: 0.0, spread: 0.2 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 } }] },
    '关闭': { hands: [{ thumb: { extension: 0.3, curl: 0.6, spread: 0.1 }, index: { extension: 0.2, curl: 0.8, spread: 0.0 }, middle: { extension: 0.2, curl: 0.8, spread: 0.0 }, ring: { extension: 0.2, curl: 0.8, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.8, spread: 0.0 } }] },
    '帮助': { hands: [
        { thumb: { extension: 0.3, curl: 0.7, spread: 0.1 }, index: { extension: 0.15, curl: 0.85, spread: 0.0 }, middle: { extension: 0.15, curl: 0.85, spread: 0.0 }, ring: { extension: 0.15, curl: 0.85, spread: 0.0 }, pinky: { extension: 0.15, curl: 0.85, spread: 0.0 } },
        { thumb: { extension: 0.3, curl: 0.7, spread: 0.1 }, index: { extension: 0.15, curl: 0.85, spread: 0.0 }, middle: { extension: 0.15, curl: 0.85, spread: 0.0 }, ring: { extension: 0.15, curl: 0.85, spread: 0.0 }, pinky: { extension: 0.15, curl: 0.85, spread: 0.0 }, wrist: { dx: 0.3, dy: -0.05, dz: 0 } }
    ]},
    '等待': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: 0, dy: -0.03, dz: 0 } }] },
    '休息': { hands: [{ thumb: { extension: 0.4, curl: 0.5, spread: 0.2 }, index: { extension: 0.3, curl: 0.6, spread: 0.0 }, middle: { extension: 0.3, curl: 0.6, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },
    '跑步': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.7, curl: 0.2, spread: -0.1 }, middle: { extension: 0.7, curl: 0.2, spread: 0.1 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0.08, dy: 0, dz: 0 } }] },
    '游泳': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.4 }, index: { extension: 0.9, curl: 0.0, spread: 0.1 }, middle: { extension: 0.9, curl: 0.0, spread: 0.0 }, ring: { extension: 0.9, curl: 0.0, spread: -0.1 }, pinky: { extension: 0.9, curl: 0.0, spread: -0.2 }, wrist: { dx: 0.05, dy: -0.03, dz: 0 } }] },
    '开车': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '拍照': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.4 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.3, curl: 0.6, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },

    // ===== 家庭 =====
    '爸爸': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.4 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },
    '妈妈': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '哥哥': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },
    '姐姐': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },
    '朋友': { hands: [
        { thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 } },
        { thumb: { extension: 0.7, curl: 0.2, spread: -0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: 0.3, dy: 0, dz: 0 } }
    ]},
    '孩子': { hands: [{ thumb: { extension: 0.5, curl: 0.4, spread: 0.2 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.04, dz: 0 } }] },

    // ===== 食物 =====
    '米饭': { hands: [{ thumb: { extension: 0.5, curl: 0.4, spread: 0.3 }, index: { extension: 0.4, curl: 0.5, spread: 0.0 }, middle: { extension: 0.4, curl: 0.5, spread: 0.0 }, ring: { extension: 0.4, curl: 0.5, spread: 0.0 }, pinky: { extension: 0.4, curl: 0.5, spread: 0.0 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },
    '面条': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.2 }, index: { extension: 0.9, curl: 0.1, spread: 0.0 }, middle: { extension: 0.9, curl: 0.1, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '水果': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.04, dz: 0 } }] },
    '茶': { hands: [{ thumb: { extension: 0.5, curl: 0.4, spread: 0.3 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },
    '牛奶': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: 0, dy: -0.07, dz: 0 } }] },

    // ===== 状态/形容 =====
    '累': { hands: [{ thumb: { extension: 0.3, curl: 0.6, spread: 0.1 }, index: { extension: 0.2, curl: 0.7, spread: 0.0 }, middle: { extension: 0.2, curl: 0.7, spread: 0.0 }, ring: { extension: 0.2, curl: 0.7, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.7, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '热': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.4 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '冷': { hands: [{ thumb: { extension: 0.2, curl: 0.7, spread: 0.0 }, index: { extension: 0.2, curl: 0.8, spread: 0.0 }, middle: { extension: 0.2, curl: 0.8, spread: 0.0 }, ring: { extension: 0.2, curl: 0.8, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.8, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '大': { hands: [{ thumb: { extension: 1.0, curl: 0.0, spread: 0.5 }, index: { extension: 1.0, curl: 0.0, spread: 0.3 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.3 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.5 } }] },
    '小': { hands: [{ thumb: { extension: 0.3, curl: 0.6, spread: 0.1 }, index: { extension: 0.3, curl: 0.6, spread: 0.0 }, middle: { extension: 0.3, curl: 0.6, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 } }] },
    '快': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: 0.1, dy: 0, dz: 0 } }] },
    '慢': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: -0.05, dy: 0, dz: 0 } }] },
    '漂亮': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.4 }, index: { extension: 0.9, curl: 0.0, spread: 0.1 }, middle: { extension: 0.9, curl: 0.0, spread: 0.0 }, ring: { extension: 0.9, curl: 0.0, spread: -0.1 }, pinky: { extension: 0.9, curl: 0.0, spread: -0.2 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },
    '厉害': { hands: [{ thumb: { extension: 1.0, curl: 0.0, spread: 0.3 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 0.1, curl: 0.9, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } }] },

    // ===== 物品 =====
    '手机': { hands: [{ thumb: { extension: 0.5, curl: 0.4, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '钥匙': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.3, curl: 0.6, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 } }] },
    '包': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '书': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.2 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.4, curl: 0.5, spread: 0.0 }, pinky: { extension: 0.4, curl: 0.5, spread: 0.0 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },
    '车': { hands: [{ thumb: { extension: 0.5, curl: 0.4, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0.05, dy: -0.04, dz: 0 } }] },
    '笔': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.9, curl: 0.1, spread: 0.0 }, middle: { extension: 0.4, curl: 0.5, spread: 0.0 }, ring: { extension: 0.4, curl: 0.5, spread: 0.0 }, pinky: { extension: 0.4, curl: 0.5, spread: 0.0 } }] },

    // ===== 身体 =====
    '头': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.15, dz: 0 } }] },
    '眼睛': { hands: [{ thumb: { extension: 0.4, curl: 0.4, spread: 0.2 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '嘴': { hands: [{ thumb: { extension: 0.4, curl: 0.4, spread: 0.2 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: 0, dy: -0.12, dz: 0 } }] },
    '耳朵': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.3 }, index: { extension: 0.4, curl: 0.5, spread: 0.0 }, middle: { extension: 0.4, curl: 0.5, spread: 0.0 }, ring: { extension: 0.4, curl: 0.5, spread: 0.0 }, pinky: { extension: 0.4, curl: 0.5, spread: 0.0 }, wrist: { dx: -0.1, dy: -0.1, dz: 0 } }] },
    '鼻子': { hands: [{ thumb: { extension: 0.5, curl: 0.3, spread: 0.2 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.12, dz: 0 } }] },

    // ===== 常用表达 =====
    '可以': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 } }] },
    '没有': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.3 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: -0.05, dy: 0, dz: 0 } }] },
    '有': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0.05, dy: 0, dz: 0 } }] },
    '知道': { hands: [{ thumb: { extension: 0.6, curl: 0.3, spread: 0.2 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] },
    '不知道': { hands: [{ thumb: { extension: 0.4, curl: 0.5, spread: 0.2 }, index: { extension: 0.3, curl: 0.6, spread: 0.0 }, middle: { extension: 0.3, curl: 0.6, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.04, dz: 0 } }] },
    '明白': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 }, wrist: { dx: 0, dy: -0.03, dz: 0 } }] },
    '谢谢': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.1 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: 0.0 }, pinky: { extension: 1.0, curl: 0.0, spread: 0.0 }, wrist: { dx: 0, dy: -0.15, dz: 0 } }] },
    '请': { hands: [{ thumb: { extension: 0.8, curl: 0.1, spread: 0.1 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: 0.0 }, pinky: { extension: 1.0, curl: 0.0, spread: 0.0 }, wrist: { dx: 0.05, dy: -0.05, dz: 0 } }] },
    '对不起': { hands: [{ thumb: { extension: 0.4, curl: 0.7, spread: 0.2 }, index: { extension: 0.1, curl: 0.9, spread: 0.0 }, middle: { extension: 0.1, curl: 0.9, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 0.1, curl: 0.9, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '没关系': { hands: [{ thumb: { extension: 0.9, curl: 0.1, spread: 0.5 }, index: { extension: 1.0, curl: 0.0, spread: 0.1 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.1 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.3 } }] },
    '欢迎': { hands: [{ thumb: { extension: 0.9, curl: 0.1, spread: 0.5 }, index: { extension: 1.0, curl: 0.0, spread: 0.2 }, middle: { extension: 1.0, curl: 0.0, spread: 0.0 }, ring: { extension: 1.0, curl: 0.0, spread: -0.2 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.4 }, wrist: { dx: 0.08, dy: -0.05, dz: 0 } }] },
    '恭喜': { hands: [
        { thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.08, dz: 0 } },
        { thumb: { extension: 0.7, curl: 0.2, spread: -0.3 }, index: { extension: 0.8, curl: 0.1, spread: 0.0 }, middle: { extension: 0.8, curl: 0.1, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0.3, dy: -0.08, dz: 0 } }
    ]},
    '加油': { hands: [{ thumb: { extension: 0.3, curl: 0.5, spread: 0.0 }, index: { extension: 1.0, curl: 0.0, spread: 0.0 }, middle: { extension: 0.1, curl: 0.9, spread: 0.0 }, ring: { extension: 0.1, curl: 0.9, spread: 0.0 }, pinky: { extension: 1.0, curl: 0.0, spread: -0.2 } }] },
    '安静': { hands: [{ thumb: { extension: 0.4, curl: 0.4, spread: 0.2 }, index: { extension: 0.5, curl: 0.4, spread: 0.0 }, middle: { extension: 0.5, curl: 0.4, spread: 0.0 }, ring: { extension: 0.5, curl: 0.4, spread: 0.0 }, pinky: { extension: 0.5, curl: 0.4, spread: 0.0 }, wrist: { dx: 0, dy: -0.1, dz: 0 } }] },
    '简单': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.7, curl: 0.2, spread: 0.0 }, middle: { extension: 0.7, curl: 0.2, spread: 0.0 }, ring: { extension: 0.7, curl: 0.2, spread: 0.0 }, pinky: { extension: 0.7, curl: 0.2, spread: 0.0 } }] },
    '困难': { hands: [{ thumb: { extension: 0.3, curl: 0.6, spread: 0.1 }, index: { extension: 0.3, curl: 0.6, spread: 0.0 }, middle: { extension: 0.3, curl: 0.6, spread: 0.0 }, ring: { extension: 0.3, curl: 0.6, spread: 0.0 }, pinky: { extension: 0.3, curl: 0.6, spread: 0.0 }, wrist: { dx: 0, dy: -0.06, dz: 0 } }] },
    '安全': { hands: [{ thumb: { extension: 0.7, curl: 0.2, spread: 0.3 }, index: { extension: 0.6, curl: 0.3, spread: 0.0 }, middle: { extension: 0.6, curl: 0.3, spread: 0.0 }, ring: { extension: 0.6, curl: 0.3, spread: 0.0 }, pinky: { extension: 0.6, curl: 0.3, spread: 0.0 }, wrist: { dx: 0, dy: -0.04, dz: 0 } }] },
    '危险': { hands: [{ thumb: { extension: 0.2, curl: 0.7, spread: 0.0 }, index: { extension: 0.2, curl: 0.8, spread: 0.0 }, middle: { extension: 0.2, curl: 0.8, spread: 0.0 }, ring: { extension: 0.2, curl: 0.8, spread: 0.0 }, pinky: { extension: 0.2, curl: 0.8, spread: 0.0 }, wrist: { dx: 0, dy: -0.05, dz: 0 } }] }
};

/**
 * 为单个词汇生成多个训练样本
 * @param {string} label - 词汇标签
 * @param {Object} poseDef - 姿态定义
 * @param {number} count - 样本数量
 * @returns {Array} landmarks 数组
 */
function generateSamplesForWord(label, poseDef, count = SAMPLES_PER_WORD) {
    const samples = [];

    for (let i = 0; i < count; i++) {
        const handLandmarks = [];

        for (const handPose of poseDef.hands) {
            const landmarks = generateHandLandmarks(handPose, NOISE_LEVEL);
            const withOffset = addGlobalOffset(landmarks);
            handLandmarks.push(withOffset);
        }

        samples.push({
            landmarks: handLandmarks,
            label: label
        });
    }

    return samples;
}

/**
 * 生成全部预置训练数据
 * @returns {Array} 所有训练样本
 */
function generateAllPresetData() {
    const allSamples = [];

    for (const [label, poseDef] of Object.entries(SIGN_POSES)) {
        const samples = generateSamplesForWord(label, poseDef);
        allSamples.push(...samples);
    }

    console.log(`[预置数据] 已生成 ${allSamples.length} 个样本，覆盖 ${Object.keys(SIGN_POSES).length} 个词汇`);
    return allSamples;
}

export { generateAllPresetData, generateSamplesForWord, SIGN_POSES };
