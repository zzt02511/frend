# 非标定制家居同城获客智能体 MVP

这是当前仓库里可直接运行的行业化 MVP。它不依赖缺失的 `utils/`、CosyVoice、数字人模型资源，先实现“定制家居案例 -> 短视频口播内容包 -> 项目保存”的核心商业验证链路。

## 已实现能力

- 定制家居专属输入：城市、区域、小区、户型、面积、预算、柜类、板材、五金、封边、风格、业主痛点、门店卖点、活动引导。
- 5 类内容栏目：装修避坑、案例讲解、价格解释、工艺展示、本地信任。
- 每条内容输出：
  - 15-45 秒口播脚本
  - 3 个短视频标题
  - 1 条封面文案
  - 评论区/私信引导
  - 私信关键词
  - 合规风险提示
  - 剪辑分镜建议
  - LLM 二次改写提示词
  - 内容评分
  - 一键改写稿
  - 小红书图文笔记
  - 小红书视频素材搭配方案
- 风险表达检测：会提示 `0甲醛`、`零甲醛`、`绝对环保`、`全网最低`、`保证成交`、`省50%` 等高风险话术。
- 本地项目管理：
  - 直接打开 HTML 时，项目保存到浏览器 `localStorage`。
  - 通过 `custom_home_server.py` 启动时，项目保存到 `custom_home_projects/*.json`。
- 真实素材工作流：
  - 可登记实拍图片/视频素材说明。
  - 通过本地服务打开时，可把图片/视频上传到 `custom_home_materials/<项目名>/`。
  - 小红书图文和视频方案会引用这些真实素材，而不是只生成空泛文案。
- 云主机能力：
  - 可配置远程 HeyGem/Duix 地址。
  - 可配置远程 TTS/语音地址。
  - 可把每条口播脚本提交到云端生成语音或数字人口播任务。

## 打开可视化工作台

直接用浏览器打开：

```text
custom_home_agent.html
```

这种方式不需要启动服务，也不需要安装依赖。项目数据只保存在当前浏览器。

推荐使用本地服务方式：

```bat
cd /d D:\AI\KrLongAI-master
D:\Python312\python.exe custom_home_server.py --port 8765
```

然后访问：

```text
http://127.0.0.1:8765/
```

这种方式支持把内容项目保存为本地 JSON 文件：

```text
D:\AI\KrLongAI-master\custom_home_projects
```

上传的实拍图片/视频会保存到：

```text
D:\AI\KrLongAI-master\custom_home_materials
```

## 命令行生成

使用内置样例：

```bat
D:\Python312\python.exe custom_home_agent.py --input custom_home_case.sample.json --output custom_home_scripts.md
```

输出 JSON：

```bat
D:\Python312\python.exe custom_home_agent.py --input custom_home_case.sample.json --json
```

快速生成 3 条默认内容：

```bat
D:\Python312\python.exe custom_home_agent.py --quantity 3
```

运行测试：

```bat
D:\Python312\python.exe -m unittest test_custom_home_agent.py
```

## 推荐演示流程

1. 启动 `custom_home_server.py`。
2. 打开 `http://127.0.0.1:8765/`。
3. 填写一个真实门店案例：小区、户型、面积、风格、预算表达、痛点和卖点。
4. 如需配置云主机、AI 改写或素材精修默认值，打开 `custom_home_settings.html`。
5. 生成 10 条内容。
6. 使用“一键改写”或可选的“AI 改写”。
7. 上传真实完工图、板材/五金特写、安装现场视频，或先填写素材说明。
8. 复制小红书图文笔记，或按“小红书视频素材搭配”去剪视频。
9. 人工挑选 3-5 条最适合拍摄/发布的内容。
10. 如果云主机已启动 HeyGem/Duix，在内容卡片点击“提交 HeyGem 数字人”。
11. 点击“保存项目”，形成可复用的本地 JSON 案例档案。
12. 发布后记录评论、私信、留资、到店、量尺预约，判断门店是否愿意为月度稳定内容输出付费。

## 后续接入 KrLongAI 主链路

完整资源包补齐后，可以把本 MVP 的输出接到原有链路：

1. `script` 作为数字人口播文案。
2. `titles` 作为发布标题候选。
3. `cover` 作为封面大字。
4. `comment_prompt` 和 `dm_keyword` 作为发布运营话术。
5. `compliance_notes` 作为发布前人工复核提示。
6. `storyboard` 作为剪辑镜头清单。
7. `llm_prompt` 作为接入 OpenAI/通义/豆包/DeepSeek 时的二次改写提示词。
8. `score` 作为人工筛选优先级。
9. `rewritten_script` 作为一键改写后的门店顾问口播文案。
10. `xiaohongshu_note` 作为小红书图文笔记草稿。
11. `xiaohongshu_video_plan` 作为实拍素材剪辑搭配建议。

第一阶段仍建议人工发布，不先接自动发布模块，以降低平台风控和接口失效风险。
