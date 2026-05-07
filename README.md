# Hello AI 无障碍辅助

> 科技致善 — 让每个人都能平等地感受世界

面向听障、视障、认知障碍、肢体障碍及老年群体的无障碍辅助 PWA 应用。纯浏览器端运行，无需后端服务器。

## ✨ 功能

| 模式 | 功能 | 技术 |
|------|------|------|
| 🗣️ 听障辅助 | 手势识别转语音、手语训练、自定义词汇 | MediaPipe + Web Speech |
| 👁️ 视障辅助 | 实时感知、场景描述、颜色/光线检测、障碍物提醒、紧急求助 | 摄像头 + 语音合成 |
| 🧠 认知辅助 | 日常任务步骤引导（吃药、散步等）、实时时钟 | 任务模板 + 语音 |
| 🦿 肢体辅助 | 语音控制、命令识别 | Web Speech API |
| 👴 老年辅助 | 大按钮、语音交互、快捷操作 | 简化 UI + 语音 |

## 🚀 快速开始

1. 克隆仓库
2. 用本地服务器打开（需要 HTTPS 或 localhost）
   ```bash
   # Python
   python -m http.server 8080

   # Node.js
   npx serve .
   ```
3. 在浏览器中打开 `http://localhost:8080`

## 📱 PWA 支持

- 可添加到手机桌面，体验接近原生 App
- 首次访问后支持离线使用
- Service Worker 三级缓存策略：
  - **MediaPipe 模型**：Cache First（大文件缓存后离线可用）
  - **HTML 页面**：Network First（优先最新内容）
  - **静态资源**：Stale While Revalidate（快速加载 + 后台更新）

## 🛠️ 技术栈

- **手势识别**：MediaPipe Hands + Gesture Recognizer
- **语音合成**：Web Speech API (SpeechSynthesis)
- **语音识别**：Web Speech API (SpeechRecognition)
- **数据存储**：localStorage
- **离线缓存**：Service Worker
- **手语分类**：KNN + 动态手势序列识别
- **零依赖**：纯 HTML/CSS/JS，无构建工具

## 📁 项目结构

```
hello-ai-accessibility/
├── index.html              # PWA 主应用入口
├── manifest.json           # PWA 配置（图标、快捷方式）
├── sw.js                   # Service Worker（三级缓存策略）
├── netlify.toml            # Netlify 部署配置
├── css/
│   └── style.css           # 莱卡暗金色调样式（CSS 变量体系）
├── js/
│   ├── app.js              # 主应用入口（AccessibilityApp 类）
│   ├── managers/
│   │   ├── toast.js        # 通知提示管理器
│   │   ├── settings.js     # 无障碍偏好设置管理器
│   │   ├── speech.js       # 语音播报管理器
│   │   └── camera.js       # 摄像头管理器
│   ├── modules/
│   │   ├── blind.js        # 视障辅助模块
│   │   ├── deaf.js         # 听障辅助模块
│   │   ├── cognitive.js    # 认知障碍辅助模块
│   │   ├── physical.js     # 肢体障碍辅助模块
│   │   └── elderly.js      # 老年人辅助模块
│   └── utils/
│       ├── dom.js          # 共享 DOM 与图像工具函数
│       ├── feature-extractor.js   # 手语特征提取
│       ├── gesture-recognizer.js  # 动态手势识别（32 个预置模板）
│       └── sign-classifier.js     # KNN 分类器
├── landing/
│   └── index.html          # 产品落地页
├── assets/                 # 背景图片与图标
└── libs/mediapipe/         # MediaPipe WASM 模型（本地打包）
```

## 🌐 浏览器兼容

| 功能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| 基础功能 | ✅ | ✅ | ✅ | ✅ |
| 手势识别 (MediaPipe) | ✅ | ✅ | ⚠️ | ✅ |
| 语音合成 | ✅ | ✅ | ✅ | ✅ |
| 语音识别 | ✅ | ⚠️ | ❌ | ✅ |
| PWA 安装 | ✅ | ✅ | ⚠️ | ✅ |

> ⚠️ = 部分支持 | ❌ = 不支持

## 🚢 部署

本项目为纯静态站点，可部署到任意静态托管服务：

**Netlify（推荐）**
```bash
# 已包含 netlify.toml 配置
# 直接拖拽项目文件夹到 Netlify Drop 即可部署
```

**Vercel**
```bash
npx vercel --prod
```

**GitHub Pages**
1. 推送到 GitHub 仓库
2. Settings → Pages → Source: Deploy from a branch
3. 选择 main 分支，根目录 /

## 📄 许可

MIT License

## 🙏 致谢

- [MediaPipe](https://mediapipe.dev/) - 手势识别引擎
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - 语音合成与识别
- TRAE SOLO 挑战赛 - 「科技致善」赛道
