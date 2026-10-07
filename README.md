# TWallpaper Studio（Windows）

基于 [crashmax-dev/twallpaper](https://github.com/crashmax-dev/twallpaper) 的 Windows 离线壁纸制作软件。原项目作者：**Vitalij Ryndin（crashmax-dev）**；原网页：[twallpaper.js.org](https://twallpaper.js.org)。本仓库提供 Windows 桌面适配与图片导出功能，保留原项目的 MIT 版权声明。

## 制作说明

本项目的 Windows 桌面适配、功能开发、导出问题修复与打包使用 **OpenAI Codex** 制作。

## 使用

从 [GitHub Releases](https://github.com/wataa2333/twallpaper-studio/releases/latest) 下载 `TWallpaper-Studio-1.0.1-Windows.exe`，双击即可使用，无需安装 Node.js，也无需联网。

1. 选择原站配色，或用色盘、HEX 输入设置 1–4 个颜色。
2. 选择图案，调整大小、透明度、模糊、混合模式或遮罩。可关闭图案生成纯渐变。
3. 输入宽高，或选择 1080p、2K、4K、8K、超宽和竖屏预设。
4. 通过动画、滚轮或“下一个位置”找到喜欢的画面，然后点“导出壁纸”。PNG 为无损格式，JPEG 为高质量格式。

导出捕获点击时的渐变画面，并按目标像素尺寸渲染完整图案；预览保持目标宽高比，图案比例与导出一致。动画用于预览，导出为静态壁纸图片。F11 在软件内切换全屏预览，Escape 退出。

左侧面板可滚动。“配置 JSON”提供复制、保存和导入，设置会自动保存在当前电脑。配置包括颜色、图案、分辨率、混合模式、动画设置及当前渐变位置。也支持导入原网页保存的配置：其图案 URL 会匹配为内置图案。

尺寸边长可设为 1–16384 像素，总像素最多 6400 万；上限以内仍受电脑内存和图形能力影响。

## 保留的原站功能

- 全部 19 套配色，包括原站的三色配色；随机颜色与自定义颜色。
- 全部 19 种 SVG 图案，离线内置。
- FPS（1–360）、tails（5–90）、自动动画、滚轮动画、下一个位置。
- 图案开关、mask、size、opacity、blur、background。
- normal / overlay / hard-light / soft-light 混合模式。
- JSON 复制与下载、重置、项目源码链接、全屏预览、WebGL 渲染。

桌面版把图案开关设为独立选项，避免折叠设置面板意外改变壁纸；原站背景颜色实际仅在遮罩模式下可见，界面据此启用背景颜色控件。

## 开发和构建

安装 Node.js（含 npm）后，在此目录运行：

```powershell
npm ci
npm run build
npm start
npm test
npm run dist
```

`npm test` 在独立测试配置目录中检查全部配色、SVG 加载、配置校验、WebGL 渲染和快照，并实际生成 1080p、竖屏、4K、8K 和非标准尺寸壁纸到 `artifacts/`。另外将 4K 导出缩小后与 CSS 预览作像素比较，覆盖纯渐变、四种混合模式、遮罩和模糊。测试窗口完成后自动关闭。

## 1.0.1 修复

旧版本通过隐藏窗口截图导出，大尺寸窗口受到 Windows 限制和显示缩放影响，可能将局部画面放大成目标尺寸。1.0.1 改为在目标像素尺寸的 Canvas 上合成完整渐变和图案，导出不再依赖窗口尺寸或显示缩放。

## 源码与许可

原项目：[crashmax-dev/twallpaper](https://github.com/crashmax-dev/twallpaper)。本次参考版本：`b0469c19035436c20bf4b2b1628d77e4d86c4fa1`。

原渲染源码保留在 `vendor/twallpaper/` 与 `vendor/webgl/`，全部配色和图案列表在 `vendor/`，图案资源在 `public/patterns/`。桌面界面在 `src/app.ts`，Windows 主进程和导出逻辑在 `desktop/main.cjs`。

保留原项目的 MIT 版权声明，见 `THIRD_PARTY_LICENSE.txt`。程序尚未进行代码签名。

