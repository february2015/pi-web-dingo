# pi Web Dingo

[English](README.md) · [简体中文](README.zh_CN.md)

一个 Chrome 浏览器扩展，在 [pi](https://github.com/) dashboard 上浮动显示一个 session 状态药丸，让你可以一眼看出哪些 session 需要你的处理，并能一键跳转过去，不用在界面里翻找。

![药丸截图占位](docs/screenshot.png)

## 功能

- 🛰 **实时状态药丸** 悬浮在 dashboard 上 —— 一眼看出有多少 session 在运行、出错、等待输入，或安静地闲置。
- 🎯 **快速跳转** —— 悬停展开面板，点击固定面板，点击卡片直接跳到对应 session。
- 🔔 **可选提示音** —— session 结束并需要你处理时播放。
- 🎨 配色与 [`dsh-dingo`](https://github.com/) 完全对齐，两者视觉一致。
- 🌐 本地化：英文 + 简体中文，根据 Chrome 当前语言自动切换。

## 安装

扩展默认监听运行在 **`http://localhost:8000`**（或 `http://127.0.0.1:8000`）的 pi dashboard。安装前请确保本地 dashboard 已启动。

### 方式 A —— 加载预编译的 `dist/`（推荐普通用户使用）

仓库自带可直接加载的 `dist/` 目录。

1. 下载或 clone 本仓库。
2. 在 Chrome 中打开 `chrome://extensions`。
3. 打开右上角的 **开发者模式** 开关。
4. 点击 **加载已解压的扩展程序**。
5. 选择仓库里的 `dist/` 文件夹。
6. 在 Chrome 工具栏拼图图标里把扩展钉住，🐕 图标就会一直显示。

### 方式 B —— 从源码构建（推荐贡献者）

```bash
git clone https://github.com/<your-username>/pi-web-dingo.git
cd pi-web-dingo
npm install
npm run build
```

然后按方式 A 加载 `dist/`。

## 使用

- **悬停药丸** → 面板展开，按状态严重程度排序（最紧急的在前）。
- **单击药丸** → 面板固定常开。再点一次取消固定。固定状态会跨页面刷新保留。
- **点击卡片** → 立即跳到该 session，面板自动收起。
- **拖动药丸** → 沿视口右边缘任意移动。位置会记住。

### 状态颜色

| 状态桶 | 颜色 | 含义 |
|---|---|---|
| Error | 🔴 红 | Session 出错结束（最近 30 秒内） |
| Question | 🟠 琥珀 | Session 在等你的输入 |
| Draft | 🟣 紫 | 离屏 session 有未发送输入 |
| Answered | 🟢 绿 | 已完成，未读 |
| Waiting | 🟢 青绿 | 后台任务 / 子任务仍在运行 |
| Intermediate | 🔵 青 | 正在流式输出 |
| Running | 🔵 蓝 | 正在流式但还没输出 |
| Normal | ⚪ 灰 | 闲置且已读 |

## 项目结构

```
pi-web-dingo/
├── dist/                 # 构建产物（已提交，直接加载到 Chrome 即可）
├── icons/                # 扩展工具栏图标源 PNG
├── public/
│   ├── manifest.json     # MV3 manifest
│   └── _locales/
│       ├── en/messages.json
│       └── zh_CN/messages.json
├── src/
│   ├── client/           # React UI（药丸 + 面板）
│   └── extension/        # 内容脚本 + background service worker
├── vite.config.ts        # Vite 构建 + 静态资源拷贝
└── package.json
```

## 开发

```bash
npm run dev       # Vite 开发服务器（HMR）
npm run build     # tsc 类型检查 + 生产构建 → dist/
npm run preview   # 预览生产构建
```

仅 dev server 不够 —— Chrome 需要**构建后**的 `dist/` 目录。在 `chrome://extensions` 重新加载扩展前，记得先跑 `npm run build`。

## 配置

默认匹配 `http://localhost:8000` 和 `http://127.0.0.1:8000`。要切换到其他端口或域名，编辑 `public/manifest.json` 里的 `matches` 和 `host_permissions` 数组，然后重新构建。

## 许可证

MIT。
