# 云主机快速部署说明

适用场景：

- Ubuntu GPU 云主机
- Docker 已安装
- 你想快速安装 HeyGem / Duix.Avatar，并启动当前项目工作台

## 0. 必要前提

云主机必须能看到 NVIDIA GPU：

```bash
nvidia-smi
```

Docker 必须能调用 GPU：

```bash
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```

如果第二条失败，说明还缺 NVIDIA Container Toolkit。先修好 Docker GPU，再部署 HeyGem。

## 1. 上传或拉取本项目

推荐目录：

```bash
mkdir -p /data/projects
cd /data/projects
```

如果用 Git：

```bash
git clone 你的仓库地址 KrLongAI-master
```

如果用压缩包：

```bash
unzip KrLongAI-master.zip -d /data/projects
```

最终目录应为：

```text
/data/projects/KrLongAI-master
```

## 2. 执行一键安装

```bash
cd /data/projects/KrLongAI-master
chmod +x cloud_quick_install.sh
./cloud_quick_install.sh
```

脚本会做这些事：

1. 检查 GPU。
2. 检查 Docker GPU。
3. 创建目录：
   - `/data/apps`
   - `/data/duix_avatar_data`
   - `/data/projects`
4. 克隆 HeyGem / Duix.Avatar：
   - `/data/apps/Duix.Heygem`
5. 自动选择常见 Docker Compose 文件并启动。
6. 跑本项目测试。
7. 启动本项目工作台：
   - `custom_home_server.py`
   - 默认端口 `8765`
8. 运行 HeyGem 检查：
   - `heygem_runtime_audit.py`

## 3. 打开端口

在云厂商安全组放行：

```text
8765   本项目工作台
```

如果你只让本项目后端访问 HeyGem，下面两个端口可以不对公网开放：

```text
8383   HeyGem/Duix 视频生成服务
18180  HeyGem/Duix 语音/模型服务
```

浏览器打开：

```text
http://你的云主机IP:8765/
```

## 4. 常用检查命令

```bash
cd /data/projects/KrLongAI-master
python3 heygem_runtime_audit.py
python3 content_pipeline.py --case custom_home_case.sample.json
docker ps
```

查看本项目服务日志：

```bash
cd /data/projects/KrLongAI-master
tail -f logs/custom_home_server.out
tail -f logs/custom_home_server.err
```

## 5. 自定义目录或端口

如果你的项目不在默认目录：

```bash
PROJECT_DIR=/root/KrLongAI-master ./cloud_quick_install.sh
```

如果工作台端口想改成 `9000`：

```bash
WORKBENCH_PORT=9000 ./cloud_quick_install.sh
```

如果 Duix 仓库的 compose 文件路径不同：

```bash
COMPOSE_FILE=deploy/docker-compose-linux.yml ./cloud_quick_install.sh
```

## 6. 如果脚本卡在 Docker GPU 检查

说明 Docker 还不能使用 NVIDIA GPU。常见原因：

- 不是 GPU 云主机
- 驱动没装好
- Docker 没装 NVIDIA Container Toolkit
- Docker 服务没重启

先修好：

```bash
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```

这两个都通过后，再运行安装脚本。

## 7. 如果 HeyGem 服务没起来

检查：

```bash
cd /data/apps/Duix.Heygem
docker ps
docker logs 容器名 --tail=100
```

再运行：

```bash
cd /data/projects/KrLongAI-master
python3 heygem_runtime_audit.py
```

理想状态：

```text
Duix/HeyGem 视频生成服务 127.0.0.1:8383 OK
Duix/HeyGem 语音/模型服务 127.0.0.1:18180 OK
```

## 8. 下一步

当 HeyGem 检查通过后，就可以继续开发真实 API 适配：

- `heygem_client.py`
- `/api/heygem/generate`
- 工作台里的“生成 HeyGem 数字人视频”按钮
