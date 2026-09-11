# NB/T 11773—2025 风力发电机组内附件技术规范 · 互动学习课程

基于《NB/T 11773—2025 风力发电机组内附件技术规范》制作的互动学习网站，支持四种学习模式：

- **讲解**：按章节图文精讲（9 章 38 屏），规范号可点击直达课程内知识库
- **答题**：216 道选择题（判断/单选/多选），答完即时解析，出处可点击查看条款原文
- **填空**：81 道填空题，支持全角/半角容错，可按"错题/未答/全对"筛选
- **统计**：章节正确率、掌握度、错题回顾

## 技术要点

- 原生 HTML/CSS/JavaScript，无任何外部依赖，可离线使用（PWA + Service Worker）
- 知识库 `data/kb.js` 由 `_verify/build_kb.js` 从 `_extract/clean.txt` 自动生成，条款 100% 可回溯
- 单文件版 `NBT11773-2025课程-单文件版.html` 可单独双击打开

## 在线地址

https://wangzhen110.github.io/nbt11773-course/

## 本地运行

```bash
# 任意静态服务器即可，如 Python：
python -m http.server 8000
# 打开 http://localhost:8000
```

## 改题流程

修改 `data/ch01.js` ~ `data/ch09.js`（选择题）、`data/fill.js`（填空题）→ 运行 `_verify/build_kb.js` 重建知识库 → 运行 `_verify/verify_all.js` 校验 → `git push origin master`，GitHub Pages 自动构建部署。

## 目录结构

```
内附件技术规范课程/
├── index.html            主页面（四模式）
├── app.js                交互逻辑
├── style.css             样式
├── manifest.json         PWA 清单
├── sw.js                 Service Worker（离线缓存）
├── data/
│   ├── ch01~ch09.js      各章讲解 + 选择题
│   ├── fill.js           填空题
│   └── kb.js             知识库（自动生成）
└── NBT11773-2025课程-单文件版.html
```

## 题库数据

- 选择题 216 道：范围与引用文件 31 / 术语 7 / 材料 30 / 工艺 51 / 防腐 26 / 装配 20 / 检验 16 / 包装运输 18 / 综合易错 17
- 填空题 81 道，覆盖各章关键数值与术语
- 知识库：123 条条款 + 20 个章节/表格/图条目 + 46 条引用规范速查
