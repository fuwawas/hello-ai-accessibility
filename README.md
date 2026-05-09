# Hello AI 无障碍辅助

> 科技致善 — 让每个人都能平等地感受世界

面向听障、视障、认知障碍、肢体障碍及老年群体的无障碍辅助 PWA 应用。支持用户登录、云端同步、AI 场景描述等功能。

## ✨ 功能

| 模式 | 功能 | 技术 |
|------|------|------|
| 🗣️ 听障辅助 | 手势识别转语音、手语训练、自定义词汇 | MediaPipe + Web Speech |
| 👁️ 视障辅助 | 实时感知、场景描述、颜色/光线检测、障碍物提醒、紧急求助 | 摄像头 + 语音合成 + AI |
| 🧠 认知辅助 | 日常任务步骤引导（吃药、散步等）、实时时钟 | 任务模板 + 语音 |
| 🦿 肢体辅助 | 语音控制、命令识别 | Web Speech API |
| 👴 老年辅助 | 大按钮、语音交互、快捷操作 | 简化 UI + 语音 |

## 🚀 快速开始

### 本地运行

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/hello-ai-accessibility.git
cd hello-ai-accessibility

# 2. 安装依赖
npm install

# 3. 启动服务器
npm start

# 4. 打开浏览器
# http://localhost:3000
```

### Windows 用户

双击 `启动后端.bat` 即可自动安装依赖并启动服务器。

## 📱 PWA 支持

- 可添加到手机桌面，体验接近原生 App
- 首次访问后支持离线使用
- Service Worker 三级缓存策略

## 🛠️ 技术栈

**前端：**
- 手势识别：MediaPipe Hands + Gesture Recognizer
- 语音合成：Web Speech API (SpeechSynthesis)
- 语音识别：Web Speech API (SpeechRecognition)
- 数据存储：localStorage + 云端同步

**后端：**
- 运行时：Node.js + Express
- 数据库：SQLite (better-sqlite3)
- 认证：JWT + bcrypt
- AI：OpenAI API（可选）

## 🌐 在线访问

部署完成后，访问地址：`https://your-app.onrender.com`

## 📁 项目结构

```
hello-ai-accessibility/
├── index.html              # PWA 主应用入口
├── manifest.json           # PWA 配置
├── sw.js                   # Service Worker
├── server/                 # 后端服务
│   ├── index.js            # 服务器入口
│   ├── routes/             # API 路由
│   │   ├── auth.js         # 认证 API
│   │   ├── user.js         # 用户 API
│   │   ├── ai.js           # AI API
│   │   └── stats.js        # 统计 API
│   ├── models/             # 数据模型
│   └── middleware/          # 中间件
├── css/                    # 样式文件
├── js/                     # 前端脚本
│   ├── app.js              # 主应用
│   ├── managers/           # 管理器
│   │   └── auth.js         # 认证管理器
│   ├── modules/            # 功能模块
│   └── utils/              # 工具函数
│       └── api-client.js   # API 客户端
├── Dockerfile              # Docker 部署配置
├── render.yaml             # Render 部署配置
└── netlify.toml            # Netlify 配置（仅前端）
```

## 🚢 部署

### Render（推荐，免费）

1. Fork 本仓库到你的 GitHub
2. 登录 [Render.com](https://render.com)
3. New → Web Service → 选择你的仓库
4. Render 会自动检测 `render.yaml` 并部署
5. 部署完成后会获得一个 `.onrender.com` 域名

### Docker

```bash
docker build -t hello-ai .
docker run -p 3000:3000 hello-ai
```

### 其他平台

- **Vercel**：`npx vercel --prod`
- **Railway**：连接 GitHub 仓库即可
- **自己的服务器**：`npm start`

## 🔧 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
PORT=3000
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-xxx  # 可选，用于 AI 场景描述
```

## 📄 许可

MIT License

## 🙏 致谢

- [MediaPipe](https://mediapipe.dev/) - 手势识别引擎
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) - 语音合成与识别
- TRAE SOLO 挑战赛 - 「科技致善」赛道
