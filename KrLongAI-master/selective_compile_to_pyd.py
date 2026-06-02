#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
选择性编译Python文件为.pyd格式，排除数字人相关文件
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
import tempfile
import importlib.util

def identify_digital_human_files():
    """识别数字人相关的文件"""
    # 数字人相关的关键词
    digital_human_keywords = [
        'avatar', 'digital_human', 'tuilionnx', 'face', 'mouth', 'eye',
        'expression', 'emotion', 'gesture', 'pose', 'animation',
        'wav2lip', 'sadtalker', 'faceswap', 'deepfake'
    ]
    
    # 数字人相关的目录
    digital_human_dirs = {
        'tuilionnx',  # 数字人主目录
        'face',       # 人脸相关
        'avatar',     # 头像相关
    }
    
    # 数字人相关的文件模式
    digital_human_patterns = [
        '*avatar*', '*face*', '*mouth*', '*eye*', '*expression*',
        '*emotion*', '*gesture*', '*pose*', '*animation*',
        '*wav2lip*', '*sadtalker*', '*digital_human*'
    ]
    
    digital_human_files = set()
    
    # 遍历所有Python文件
    for root, dirs, files in os.walk('.'):
        # 跳过备份和临时目录
        if any(skip in root for skip in ['python_source_backup', 'build', 'temp', '__pycache__']):
            continue
            
        # 检查目录是否是数字人相关
        path_parts = Path(root).parts
        if any(part.lower() in digital_human_dirs for part in path_parts):
            for file in files:
                if file.endswith('.py'):
                    digital_human_files.add(os.path.join(root, file))
            continue
        
        # 检查文件名是否包含数字人关键词
        for file in files:
            if not file.endswith('.py'):
                continue
                
            file_path = os.path.join(root, file)
            file_lower = file.lower()
            
            # 检查文件名关键词
            if any(keyword in file_lower for keyword in digital_human_keywords):
                digital_human_files.add(file_path)
                continue
            
            # 检查文件内容关键词（简单检查）
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read(1000).lower()  # 只读前1000字符
                    if any(keyword in content for keyword in digital_human_keywords):
                        digital_human_files.add(file_path)
            except:
                pass
    
    return digital_human_files

def get_compilable_files():
    """获取可编译的Python文件（排除数字人相关）"""
    print("🔍 分析项目文件结构...")
    
    # 获取数字人相关文件
    digital_human_files = identify_digital_human_files()
    print(f"识别到 {len(digital_human_files)} 个数字人相关文件")
    
    # 排除的目录
    exclude_dirs = {
        '__pycache__', '.git', 'venv', 'env', 'node_modules', 'dist', 
        'build', '.pytest_cache', 'miniconda3', 'py312', 'AI-vue-project',
        'python_source_backup', 'temp', 'logs'
    }
    
    # 排除的文件
    exclude_files = {
        'setup.py', 'compile_all_to_pyd.py', 'test_*.py', '*_test.py',
        'selective_compile_to_pyd.py', 'fix_*.py', 'restore_*.py',
        'remove_*.py', 'cleanup_*.py', 'install_*.py', 'safe_launcher.py'
    }
    
    # 必须保留的文件（不编译）
    keep_original = {
        '__init__.py',  # 包初始化文件
        'config.py',    # 配置文件
        'combined_launcher.py',  # 主启动文件
    }
    
    compilable_files = []
    keep_files = []
    digital_human_kept = []
    
    for root, dirs, files in os.walk('.'):
        # 过滤目录
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if not file.endswith('.py'):
                continue
                
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path)
            
            # 检查是否在排除列表中
            if any(exclude in file for exclude in exclude_files):
                continue
            
            # 检查是否需要保留原文件
            if file in keep_original:
                keep_files.append(rel_path)
                continue
            
            # 检查是否是数字人相关文件
            if rel_path in digital_human_files or any(dh_file.endswith(rel_path) for dh_file in digital_human_files):
                digital_human_kept.append(rel_path)
                continue
            
            # 检查文件名是否包含无效字符（如连字符）
            if '-' in rel_path or not file.replace('.py', '').replace('_', '').isalnum():
                keep_files.append(rel_path)
                continue
            
            compilable_files.append(rel_path)
    
    print(f"\n📊 文件分析结果:")
    print(f"   可编译文件: {len(compilable_files)} 个")
    print(f"   保留原文件: {len(keep_files)} 个")
    print(f"   数字人文件: {len(digital_human_kept)} 个")
    
    if digital_human_kept:
        print(f"\n🤖 保留的数字人相关文件:")
        for file in digital_human_kept[:10]:
            print(f"   - {file}")
        if len(digital_human_kept) > 10:
            print(f"   ... 还有 {len(digital_human_kept) - 10} 个文件")
    
    return compilable_files, keep_files + digital_human_kept

def check_and_install_dependencies():
    """检查并安装编译依赖"""
    print("🔍 检查编译依赖...")
    
    required_packages = {
        'Cython': 'cython',
        'setuptools': 'setuptools',
        'wheel': 'wheel',
        'numpy': 'numpy'
    }
    
    missing_packages = []
    
    for display_name, package_name in required_packages.items():
        try:
            if package_name == 'Cython':
                import Cython
                print(f"✅ {display_name} 已安装 (版本: {Cython.__version__})")
            else:
                __import__(package_name)
                print(f"✅ {display_name} 已安装")
        except ImportError:
            missing_packages.append(package_name)
            print(f"❌ {display_name} 未安装")
    
    if missing_packages:
        print(f"📦 正在安装缺失的包: {', '.join(missing_packages)}")
        try:
            cmd = [sys.executable, '-m', 'pip', 'install'] + missing_packages
            subprocess.check_call(cmd)
            print("✅ 所有依赖安装完成")
        except subprocess.CalledProcessError as e:
            print(f"❌ 安装依赖失败: {e}")
            return False
    
    return True

def create_setup_script(py_files):
    """创建编译脚本"""
    setup_content = f'''
import os
import sys
from setuptools import setup, Extension
from Cython.Build import cythonize
from Cython.Distutils import build_ext
import numpy

# 编译选项
compiler_directives = {{
    'language_level': 3,
    'boundscheck': False,
    'wraparound': False,
    'initializedcheck': False,
    'cdivision': True,
    'embedsignature': True,
}}

# 要编译的文件
py_files = {py_files}

# 创建扩展模块
extensions = []
for py_file in py_files:
    module_name = py_file.replace('/', '.').replace('\\\\', '.').replace('.py', '')
    ext = Extension(
        module_name,
        [py_file],
        include_dirs=[numpy.get_include()],
        define_macros=[('NPY_NO_DEPRECATED_API', 'NPY_1_7_API_VERSION')],
    )
    extensions.append(ext)

setup(
    ext_modules=cythonize(
        extensions,
        compiler_directives=compiler_directives,
        build_dir="build"
    ),
    zip_safe=False,
    include_dirs=[numpy.get_include()],
)
'''
    
    return setup_content

def backup_source_files(py_files, keep_files):
    """备份源文件"""
    backup_dir = "python_source_backup_selective"
    
    # 清理旧备份
    if os.path.exists(backup_dir):
        shutil.rmtree(backup_dir)
    
    os.makedirs(backup_dir, exist_ok=True)
    
    all_files = py_files + keep_files
    print(f"💾 备份 {len(all_files)} 个源文件...")
    
    for py_file in all_files:
        src_path = py_file
        dst_path = os.path.join(backup_dir, py_file)
        
        # 创建目录结构
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        
        # 复制文件
        if os.path.exists(src_path):
            shutil.copy2(src_path, dst_path)
    
    print(f"✅ 源文件已备份到: {backup_dir}")

def compile_files_in_batches(py_files, batch_size=15):
    """分批编译文件，跳过有问题的文件"""
    if not py_files:
        print("❌ 没有找到需要编译的文件")
        return False
    
    print(f"🔨 开始分批编译 {len(py_files)} 个文件...")
    
    successful_files = []
    failed_files = []
    
    # 分批处理
    for i in range(0, len(py_files), batch_size):
        batch = py_files[i:i + batch_size]
        print(f"\n📦 编译批次 {i//batch_size + 1}/{(len(py_files) + batch_size - 1)//batch_size} ({len(batch)} 个文件)")
        
        batch_success, batch_failed = compile_single_batch(batch)
        successful_files.extend(batch_success)
        failed_files.extend(batch_failed)
    
    print(f"\n📊 编译结果:")
    print(f"   ✅ 成功: {len(successful_files)} 个文件")
    print(f"   ❌ 失败: {len(failed_files)} 个文件")
    
    if failed_files:
        print(f"\n⚠️  以下文件编译失败，将保留原格式:")
        for failed_file in failed_files[:10]:
            print(f"   - {failed_file}")
        if len(failed_files) > 10:
            print(f"   ... 还有 {len(failed_files) - 10} 个文件")
    
    return len(successful_files) > 0

def compile_single_batch(py_files):
    """编译单个批次的文件"""
    successful_files = []
    failed_files = []
    
    # 创建临时编译目录
    temp_dir = "temp_compile_selective"
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    try:
        # 复制文件到临时目录
        temp_files = []
        for py_file in py_files:
            temp_file = os.path.join(temp_dir, py_file)
            os.makedirs(os.path.dirname(temp_file), exist_ok=True)
            shutil.copy2(py_file, temp_file)
            temp_files.append(py_file)
        
        # 创建setup.py
        setup_content = create_setup_script(temp_files)
        setup_path = os.path.join(temp_dir, 'setup.py')
        with open(setup_path, 'w', encoding='utf-8') as f:
            f.write(setup_content)
        
        # 切换到临时目录编译
        original_cwd = os.getcwd()
        os.chdir(temp_dir)
        
        # 编译命令
        cmd = [sys.executable, 'setup.py', 'build_ext', '--inplace']
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            # 复制.pyd文件回原目录
            pyd_count = 0
            for root, dirs, files in os.walk('.'):
                for file in files:
                    if file.endswith(('.pyd', '.so')):
                        src_pyd = os.path.join(root, file)
                        
                        # 计算目标路径
                        rel_path = os.path.relpath(src_pyd)
                        dst_pyd = os.path.join(original_cwd, rel_path)
                        
                        # 创建目标目录
                        os.makedirs(os.path.dirname(dst_pyd), exist_ok=True)
                        
                        # 复制.pyd文件
                        shutil.copy2(src_pyd, dst_pyd)
                        pyd_count += 1
            
            os.chdir(original_cwd)
            print(f"   ✅ 批次成功: {pyd_count} 个.pyd文件")
            successful_files = py_files.copy()
        else:
            os.chdir(original_cwd)
            print(f"   ❌ 批次失败，尝试单个文件编译...")
            
            # 如果批次失败，尝试单个文件编译
            for py_file in py_files:
                if compile_single_file(py_file):
                    successful_files.append(py_file)
                else:
                    failed_files.append(py_file)
            
    except Exception as e:
        if 'original_cwd' in locals():
            os.chdir(original_cwd)
        print(f"   ❌ 批次编译出错: {e}")
        failed_files = py_files.copy()
    finally:
        # 清理临时目录
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
    
    return successful_files, failed_files

def compile_single_file(py_file):
    """编译单个文件"""
    temp_dir = "temp_single_compile_selective"
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    try:
        # 复制文件到临时目录
        temp_file = os.path.join(temp_dir, py_file)
        os.makedirs(os.path.dirname(temp_file), exist_ok=True)
        shutil.copy2(py_file, temp_file)
        
        # 创建setup.py
        setup_content = create_setup_script([py_file])
        setup_path = os.path.join(temp_dir, 'setup.py')
        with open(setup_path, 'w', encoding='utf-8') as f:
            f.write(setup_content)
        
        # 切换到临时目录编译
        original_cwd = os.getcwd()
        os.chdir(temp_dir)
        
        # 编译命令
        cmd = [sys.executable, 'setup.py', 'build_ext', '--inplace']
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            # 复制.pyd文件回原目录
            for root, dirs, files in os.walk('.'):
                for file in files:
                    if file.endswith(('.pyd', '.so')):
                        src_pyd = os.path.join(root, file)
                        
                        # 计算目标路径
                        rel_path = os.path.relpath(src_pyd)
                        dst_pyd = os.path.join(original_cwd, rel_path)
                        
                        # 创建目标目录
                        os.makedirs(os.path.dirname(dst_pyd), exist_ok=True)
                        
                        # 复制.pyd文件
                        shutil.copy2(src_pyd, dst_pyd)
            
            os.chdir(original_cwd)
            return True
        else:
            os.chdir(original_cwd)
            return False
            
    except Exception as e:
        if 'original_cwd' in locals():
            os.chdir(original_cwd)
        return False
    finally:
        # 清理临时目录
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

def remove_compiled_source_files(py_files):
    """删除已编译的源文件"""
    print("🗑️  删除已编译的源文件...")
    
    removed_count = 0
    for py_file in py_files:
        if os.path.exists(py_file):
            # 检查对应的.pyd文件是否存在
            pyd_file = py_file.replace('.py', '.cp312-win_amd64.pyd')
            if not os.path.exists(pyd_file):
                pyd_file = py_file.replace('.py', '.pyd')
            
            if os.path.exists(pyd_file):
                os.remove(py_file)
                removed_count += 1
                print(f"   删除: {py_file}")
            else:
                print(f"   保留: {py_file} (未找到对应的.pyd文件)")
    
    print(f"✅ 删除了 {removed_count} 个已编译的源文件")

def create_import_helper():
    """创建导入辅助文件"""
    helper_content = '''# -*- coding: utf-8 -*-
"""
选择性编译后的导入辅助
数字人相关功能仍使用.py源文件，其他功能使用.pyd文件
"""

import os
import sys
import importlib.util

def import_pyd_module(module_name, pyd_path):
    """动态导入.pyd模块"""
    try:
        spec = importlib.util.spec_from_file_location(module_name, pyd_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        print(f"导入.pyd模块失败: {module_name} - {e}")
        return None

def list_compiled_files():
    """列出编译后的文件"""
    pyd_files = []
    py_files = []
    
    for root, dirs, files in os.walk('.'):
        if 'python_source_backup' in root:
            continue
        for file in files:
            if file.endswith('.pyd'):
                pyd_files.append(os.path.join(root, file))
            elif file.endswith('.py'):
                py_files.append(os.path.join(root, file))
    
    return pyd_files, py_files

def check_digital_human_status():
    """检查数字人功能状态"""
    digital_human_files = [
        'tuilionnx/app.py',
        'tuilionnx/run.py',
        'tuilionnx/jm_onnx.py',
        'tuilionnx/lstmsync_func.py'
    ]
    
    print("🤖 数字人功能状态:")
    for file in digital_human_files:
        if os.path.exists(file):
            print(f"   ✅ {file} (源文件)")
        else:
            print(f"   ❌ {file} (缺失)")

if __name__ == "__main__":
    print("📊 选择性编译状态报告:")
    pyd_files, py_files = list_compiled_files()
    print(f"   .pyd文件: {len(pyd_files)} 个")
    print(f"   .py文件: {len(py_files)} 个")
    
    check_digital_human_status()
'''
    
    with open('selective_pyd_helper.py', 'w', encoding='utf-8') as f:
        f.write(helper_content)
    
    print("📄 创建导入辅助文件: selective_pyd_helper.py")

def main():
    """主函数"""
    print("🚀 开始选择性编译Python文件为.pyd格式")
    print("🤖 数字人相关文件将保留为.py格式")
    print("=" * 60)
    
    # 检查依赖
    if not check_and_install_dependencies():
        print("❌ 依赖检查失败，编译终止")
        return
    
    # 获取文件列表
    compilable_files, keep_files = get_compilable_files()
    
    if not compilable_files:
        print("❌ 没有找到可编译的Python文件")
        return
    
    # 备份源文件
    backup_source_files(compilable_files, keep_files)
    
    # 编译文件
    if compile_files_in_batches(compilable_files):
        # 删除已编译的源文件
        remove_compiled_source_files(compilable_files)
        
        # 创建导入辅助文件
        create_import_helper()
        
        print("\n🎉 选择性编译完成!")
        print("📝 重要说明:")
        print("   1. 数字人相关文件保留为.py格式，可正常编辑")
        print("   2. 其他文件已编译为.pyd格式，运行更快")
        print("   3. 源文件备份在 python_source_backup_selective/ 目录")
        print("   4. 使用 python combined_launcher.py 启动系统")
        print("   5. 数字人功能完全保留，可正常使用和修改")
        
    else:
        print("\n❌ 编译失败，系统保持原状")

if __name__ == "__main__":
    main()
