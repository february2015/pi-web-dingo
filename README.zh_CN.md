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

扩展会在加载时**自动探测**任意页面上的 pi dashboard —— 通过请求 `${origin}/api/sessions` 验证。dashboard 跑在 `http://localhost:8000`、内网 IP、或者公网隧道（FRP、ngrok、Cloudflare 等）都能识别。**端口或域名变了不用改 manifest**。

确认本地 dashboard 已启动后，再按下面方式加载扩展。

### 方式 A —— 加载预编译的 `dist/`（推荐普通用户使用）

仓库自带可直接加载的 `dist/` 目录。**不需要 Node.js 或构建步骤**。

1. **获取代码**。两种方式二选一：
   - git clone：
     ```bash
     git clone https://github.com/february2015/pi-web-dingo.git
     ```
   - 或者从 [Releases](https://github.com/february2015/pi-web-dingo/releases) 下载某个 tag 解压。

2. **确认本地 dashboard 已启动**。扩展只有在能访问 `/api/sessions` 时才会激活。先启动 dashboard（默认 `http://localhost:8000`），再在 Chrome 里打开它。

3. **打开 Chrome 扩展页**。新标签页访问 `chrome://extensions`。

4. **打开开发者模式**。在该页面右上角打开开关。

5. **加载已解压的扩展**。点击出现的 **加载已解压的扩展程序** 按钮，选择仓库里的 `dist/` 文件夹（里面直接包含 `manifest.json`）。

6. **钉住扩展**。点击 Chrome 工具栏的拼图图标，找到 **pi Web Dingo**，点旁边的图钉让药丸跨刷新可见。

7. **打开 dashboard**。访问 pi dashboard（比如 `http://localhost:8000`）。药丸应该在 ~1 秒内出现在右上角。如果没出现，看下面的 [故障排查](#故障排查)。

### 方式 B —— 从源码构建（推荐贡献者）

如果你要修改扩展源码并让改动体现在加载的 `dist/` 里，走这条路。

```bash
git clone https://github.com/february2015/pi-web-dingo.git
cd pi-web-dingo
npm install
npm run build
```

然后按方式 A 加载 `dist/`。每次改完源码都要再跑一次 `npm run build`，然后在 `chrome://extensions` 页面点扩展的 **重新加载** 按钮。

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

## 故障排查

**dashboard 上看不到药丸。**
在 dashboard 标签页按 F12 打开 DevTools → Console，然后刷新页面。如果完全看不到 `[dingo]` 日志，说明 content script 没加载——检查 `chrome://extensions` 是否有报错，并确认开发者模式已打开。如果看到 `[dingo] probe ...` 后面跟 `probe= false`，说明 dashboard 的 `/api/sessions` 没返回可识别的响应（HTTP 错误、HTML 登录页、或非 JSON）。先启动 dashboard，再刷新页面。

**"Manifest version 3 is not supported" 或类似加载错误。**
Chrome 版本太旧（MV3 需要 Chrome 88+）。升级 Chrome，或用 1.0 之前的 manifest。

**药丸位置不对 / 被 dashboard UI 遮住。**
沿视口右边缘拖动到任意位置，位置会按浏览器保存。如果药丸被模态框遮住，先点 dashboard 关掉模态框。

**`git pull` 后改动没生效。**
在 `chrome://extensions` 上点本扩展的 **重新加载** 图标。Chrome 把加载的版本和文件内容分开缓存。

**状态计数看起来过时。**
扩展每 5 秒轮询 `/api/sessions` 作为兑底。如果几秒后还没更新，另开一个 dashboard 标签看看——可能是 dashboard 服务本身记录变更较慢。

## 开发

```bash
npm run dev       # Vite 开发服务器（HMR）
npm run build     # tsc 类型检查 + 生产构建 → dist/
npm run preview   # 预览生产构建
```

仅 dev server 不够 —— Chrome 需要**构建后**的 `dist/` 目录。在 `chrome://extensions` 重新加载扩展前，记得先跑 `npm run build`。

## 配置

扩展在每个页面加载时探测 `/api/sessions` 来识别 dashboard，**不需要配置端口或域名**。如果探测失败（端点不存在、返回格式不对、CORS 拒绝），content script 会静默退出，页面不受影响。

如果以后 dashboard 改用别的 API 路径，改 `src/extension/content.tsx` 里的 `probeDashboard()` 然后重新构建。

## 许可证

MIT。
