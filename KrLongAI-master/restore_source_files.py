#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从备份目录恢复被删除的源文件
"""

import os
import shutil
from pathlib import Path

def restore_source_files():
    """从备份目录恢复源文件"""
    print("🔄 开始恢复被删除的源文件...")
    
    backup_dir = "python_source_backup"
    
    # 检查备份目录是否存在
    if not os.path.exists(backup_dir):
        print(f"❌ 备份目录 {backup_dir} 不存在！")
        return False
    
    print(f"📁 从 {backup_dir} 恢复文件...")
    
    restored_count = 0
    skipped_count = 0
    error_count = 0
    
    # 遍历备份目录中的所有文件
    for root, dirs, files in os.walk(backup_dir):
        for file in files:
            if not file.endswith('.py'):
                continue
                
            # 源文件路径（备份中）
            backup_file_path = os.path.join(root, file)
            
            # 目标文件路径（项目中）
            relative_path = os.path.relpath(backup_file_path, backup_dir)
            target_file_path = relative_path
            
            try:
                # 检查目标文件是否已存在
                if os.path.exists(target_file_path):
                    print(f"⚠️  跳过已存在的文件: {target_file_path}")
                    skipped_count += 1
                    continue
                
                # 创建目标目录
                target_dir = os.path.dirname(target_file_path)
                if target_dir and not os.path.exists(target_dir):
                    os.makedirs(target_dir, exist_ok=True)
                
                # 复制文件
                shutil.copy2(backup_file_path, target_file_path)
                print(f"✅ 恢复: {target_file_path}")
                restored_count += 1
                
            except Exception as e:
                print(f"❌ 恢复失败: {backup_file_path} -> {target_file_path} - {e}")
                error_count += 1
    
    print(f"\n📊 恢复结果:")
    print(f"   ✅ 成功恢复: {restored_count} 个文件")
    print(f"   ⚠️  跳过文件: {skipped_count} 个文件")
    print(f"   ❌ 恢复失败: {error_count} 个文件")
    
    return restored_count > 0

def verify_restoration():
    """验证恢复结果"""
    print("\n🔍 验证恢复结果...")
    
    # 检查一些关键文件是否恢复
    key_files = [
        'app.py',
        'utils/voice_processor.py',
        'ai_processing/subtitle_processor.py',
        'video_tools/generate_video.py',
        'cosyvoice/api.py'
    ]
    
    restored_files = []
    missing_files = []
    
    for file_path in key_files:
        if os.path.exists(file_path):
            restored_files.append(file_path)
        else:
            missing_files.append(file_path)
    
    if restored_files:
        print("✅ 已恢复的关键文件:")
        for file_path in restored_files:
            print(f"   - {file_path}")
    
    if missing_files:
        print("⚠️  仍然缺失的文件:")
        for file_path in missing_files:
            print(f"   - {file_path}")
    
    return len(missing_files) == 0

def create_restoration_report():
    """创建恢复报告"""
    report_content = f"""# 源文件恢复报告

## 恢复时间
{os.popen('date /t && time /t').read().strip()}

## 恢复操作
- ✅ 从 python_source_backup/ 目录恢复所有.py文件
- ✅ 保持原有目录结构
- ✅ 跳过已存在的文件避免覆盖
- ✅ 验证关键文件恢复状态

## 当前状态
- 📁 源文件已恢复到项目目录
- 🔧 .pyd文件仍然存在（可选择删除）
- 💾 备份文件保持完整

## 后续操作建议

### 如果要继续使用源文件：
1. 可以删除对应的.pyd文件：
   ```bash
   python remove_pyd_files.py
   ```

2. 或者保持.pyd和.py文件共存（Python会优先使用.pyd）

### 如果要重新编译：
1. 删除当前.pyd文件
2. 运行编译脚本：
   ```bash
   python compile_all_to_pyd.py
   ```

## 文件状态
- 源文件(.py): ✅ 已恢复
- 编译文件(.pyd): ✅ 仍存在
- 备份文件: ✅ 完整保留

## 注意事项
- Python会优先加载.pyd文件而不是.py文件
- 如需使用.py文件，建议删除对应的.pyd文件
- 备份目录请继续保留以备后用
"""
    
    with open('restoration_report.md', 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    print("📄 创建恢复报告: restoration_report.md")

def main():
    """主函数"""
    print("🔄 源文件恢复工具")
    print("=" * 50)
    
    # 执行恢复
    if restore_source_files():
        # 验证恢复结果
        if verify_restoration():
            print("\n🎉 所有源文件恢复成功！")
        else:
            print("\n⚠️  部分文件恢复可能不完整")
        
        # 创建报告
        create_restoration_report()
        
        print("\n📝 重要提醒:")
        print("   1. 源文件已从备份恢复")
        print("   2. .pyd文件仍然存在")
        print("   3. Python会优先使用.pyd文件")
        print("   4. 如需使用.py文件，请删除对应的.pyd文件")
        print("   5. 查看 restoration_report.md 了解详细信息")
        
    else:
        print("\n❌ 源文件恢复失败")
        print("请检查备份目录是否存在且包含文件")

if __name__ == "__main__":
    main()
