/**
 * 手语特征提取器
 * 将 21 个手部关键点转换为特征向量
 * 特征组成：归一化坐标(63) + 手指弯曲角度(5) + 指尖到腕部距离(5) + 指尖间距离(10) = 83/手
 */
class FeatureExtractor {
    /**
     * 从手部关键点提取特征向量
     * @param {Array} landmarks - 21个手部关键点 [{x,y,z}, ...]
     * @returns {Float32Array} 83维特征向量（单手）
     */
    extract(landmarks) {
        if (!landmarks || landmarks.length < 21) return null;

        const wrist = landmarks[0];
        const features = [];

        // 1. 归一化坐标（以腕部为中心，缩放到单位大小）
        for (let i = 0; i < 21; i++) {
            features.push(landmarks[i].x - wrist.x);
            features.push(landmarks[i].y - wrist.y);
            features.push(landmarks[i].z - wrist.z);
        }

        // 2. 手指弯曲角度（5个手指，每个0-180度）
        const fingerJoints = [
            [1, 2, 3, 4],     // 拇指
            [5, 6, 7, 8],     // 食指
            [9, 10, 11, 12],  // 中指
            [13, 14, 15, 16], // 无名指
            [17, 18, 19, 20]  // 小指
        ];
        for (const joints of fingerJoints) {
            const angle = this._computeAngle(
                landmarks[joints[0]], landmarks[joints[1]], landmarks[joints[2]]
            );
            features.push(angle);
        }

        // 3. 指尖到腕部的距离（5个指尖）
        const tips = [4, 8, 12, 16, 20];
        for (const tip of tips) {
            const dist = this._distance(landmarks[tip], wrist);
            features.push(dist);
        }

        // 4. 指尖之间的距离（10对）
        for (let i = 0; i < tips.length; i++) {
            for (let j = i + 1; j < tips.length; j++) {
                const dist = this._distance(landmarks[tips[i]], landmarks[tips[j]]);
                features.push(dist);
            }
        }

        return new Float32Array(features);
    }

    /**
     * 从双手提取特征向量（166维）
     */
    extractDual(landmarksArray) {
        if (!landmarksArray || landmarksArray.length === 0) return null;

        const f1 = this.extract(landmarksArray[0]);
        if (!f1) return null;

        if (landmarksArray.length >= 2) {
            const f2 = this.extract(landmarksArray[1]);
            if (f2) {
                // 拼接两只手的特征：83 + 83 = 166
                const combined = new Float32Array(166);
                combined.set(f1, 0);
                combined.set(f2, 83);
                return combined;
            }
        }

        // 单手：83维，后面补0
        const padded = new Float32Array(166);
        padded.set(f1, 0);
        return padded;
    }

    _computeAngle(a, b, c) {
        const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
        const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
        const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
        const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
        const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
        if (magBA === 0 || magBC === 0) return 0;
        const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
        return Math.acos(cosAngle) * (180 / Math.PI);
    }

    _distance(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
}

export { FeatureExtractor };
