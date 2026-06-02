#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
启动CosyVoice API服务
"""

import os
import sys
import subprocess
import time

def start_cosyvoice_api():
    """启动CosyVoice API服务"""
    print("🎤 启动CosyVoice API服务...")
    
    # 切换到cosyvoice目录
    cosyvoice_dir = "cosyvoice"
    if not os.path.exists(cosyvoice_dir):
        print("❌ CosyVoice目录不存在")
        return False
    
    os.chdir(cosyvoice_dir)
    
    # 检查API文件
    api_pyd = "api.cp312-win_amd64.pyd"
    account_file = "account.txt"
    
    if not os.path.exists(api_pyd):
        print(f"❌ 未找到编译后的API文件: {api_pyd}")
        return False
    
    if not os.path.exists(account_file):
        print(f"❌ 未找到账户文件: {account_file}")
        return False
    
    try:
        # 设置环境变量
        env = os.environ.copy()
        env['PYTHONPATH'] = os.getcwd()
        
        print(f"✅ 找到API文件: {api_pyd}")
        print(f"✅ 找到账户文件: {account_file}")
        
        # 启动API服务
        # 由于api.py已经被编译成.pyd，我们需要导入它
        print("正在启动API服务...")
        
        # 方法1: 直接导入编译后的模块
        try:
            import api
            print("✅ API模块导入成功")
            print("🎉 CosyVoice API服务启动成功!")
            print("   服务地址: http://localhost:9880")
            print("   文档地址: http://localhost:9880/docs")
            
            # 保持服务运行
            print("按 Ctrl+C 停止服务...")
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n🛑 服务已停止")
            return True
        except Exception as e:
            print(f"❌ API模块导入失败: {e}")
            return False
            
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        return False

if __name__ == "__main__":
    start_cosyvoice_api()
