#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_NAME="KrLongAI-master"
PROJECT_DIR="${PROJECT_DIR:-/data/projects/${PROJECT_NAME}}"
APPS_DIR="${APPS_DIR:-/data/apps}"
DUIX_DIR="${DUIX_DIR:-${APPS_DIR}/Duix.Heygem}"
DUIX_DATA_DIR="${DUIX_DATA_DIR:-/data/duix_avatar_data}"
WORKBENCH_HOST="${WORKBENCH_HOST:-0.0.0.0}"
WORKBENCH_PORT="${WORKBENCH_PORT:-8765}"
COMPOSE_FILE="${COMPOSE_FILE:-}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令：$1"
    echo "请先安装 $1 后再运行。"
    exit 1
  fi
}

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  echo "缺少 Docker Compose。请安装 docker compose plugin 或 docker-compose。" >&2
  exit 1
}

choose_compose_file() {
  if [[ -n "${COMPOSE_FILE}" ]]; then
    echo "${COMPOSE_FILE}"
    return
  fi

  local candidates=(
    "deploy/docker-compose-linux.yml"
    "deploy/docker-compose-lite.yml"
    "docker-compose-linux.yml"
    "docker-compose-lite.yml"
    "docker-compose.yml"
  )

  for file in "${candidates[@]}"; do
    if [[ -f "${DUIX_DIR}/${file}" ]]; then
      echo "${file}"
      return
    fi
  done

  echo "未在 ${DUIX_DIR} 找到 docker-compose 文件。" >&2
  echo "请查看 Duix.Heygem 仓库的 deploy 目录，并用 COMPOSE_FILE=路径 指定。" >&2
  exit 1
}

check_gpu() {
  log "检查 NVIDIA GPU"
  if command -v nvidia-smi >/dev/null 2>&1; then
    nvidia-smi
  else
    echo "未找到 nvidia-smi。GPU 驱动可能未安装或云主机不是 GPU 实例。"
    exit 1
  fi

  log "检查 Docker GPU 能力"
  if docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi; then
    echo "Docker GPU 检查通过。"
  else
    echo "Docker 还不能调用 GPU。"
    echo "请安装 NVIDIA Container Toolkit 后再运行本脚本。"
    echo "参考：https://docs.docker.com/engine/containers/gpu/"
    exit 1
  fi
}

prepare_dirs() {
  log "创建工作目录"
  mkdir -p "${APPS_DIR}" "${DUIX_DATA_DIR}" "$(dirname "${PROJECT_DIR}")"
}

install_duix() {
  need_cmd git
  need_cmd docker

  log "获取 Duix.Heygem / HeyGem"
  if [[ ! -d "${DUIX_DIR}/.git" ]]; then
    git clone https://github.com/duixcom/Duix.Heygem.git "${DUIX_DIR}"
  else
    git -C "${DUIX_DIR}" pull --ff-only || true
  fi

  local compose_cmd
  compose_cmd="$(detect_compose)"
  local compose_file
  compose_file="$(choose_compose_file)"

  log "启动 Duix.Heygem：${compose_file}"
  cd "${DUIX_DIR}"
  ${compose_cmd} -f "${compose_file}" pull
  ${compose_cmd} -f "${compose_file}" up -d
}

install_project() {
  log "检查本项目目录"
  if [[ ! -d "${PROJECT_DIR}" ]]; then
    echo "未找到项目目录：${PROJECT_DIR}"
    echo "请先把 KrLongAI-master 上传或 git clone 到该目录。"
    echo "也可以运行时指定：PROJECT_DIR=/你的目录 bash cloud_quick_install.sh"
    exit 1
  fi

  need_cmd python3

  log "运行本项目测试"
  cd "${PROJECT_DIR}"
  python3 -m unittest test_custom_home_agent.py
  python3 -m py_compile custom_home_agent.py custom_home_server.py content_pipeline.py heygem_runtime_audit.py
}

start_workbench() {
  log "启动本项目工作台"
  cd "${PROJECT_DIR}"
  mkdir -p logs

  if pgrep -f "custom_home_server.py" >/dev/null 2>&1; then
    echo "检测到 custom_home_server.py 已在运行，跳过重复启动。"
  else
    nohup python3 custom_home_server.py --host "${WORKBENCH_HOST}" --port "${WORKBENCH_PORT}" \
      > logs/custom_home_server.out 2> logs/custom_home_server.err &
  fi

  sleep 2
  python3 heygem_runtime_audit.py || true
}

print_next_steps() {
  local ip_hint
  ip_hint="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"

  log "安装流程结束"
  echo "工作台地址："
  echo "  http://${ip_hint:-你的云主机IP}:${WORKBENCH_PORT}/"
  echo
  echo "请在云厂商安全组放行端口："
  echo "  ${WORKBENCH_PORT}  本项目工作台"
  echo "  8383  HeyGem/Duix 视频生成服务（可只允许内网/本机）"
  echo "  18180 HeyGem/Duix 语音/模型服务（可只允许内网/本机）"
  echo
  echo "常用检查命令："
  echo "  cd ${PROJECT_DIR}"
  echo "  python3 heygem_runtime_audit.py"
  echo "  python3 content_pipeline.py --case custom_home_case.sample.json"
  echo "  docker ps"
}

main() {
  prepare_dirs
  check_gpu
  install_duix
  install_project
  start_workbench
  print_next_steps
}

main "$@"
