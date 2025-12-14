// 更新功能测试文件
// 通过 window.ELIXIR.update 访问更新功能

(function() {
    // 确保 ELIXIR 对象存在
    if (!window.ELIXIR) {
        window.ELIXIR = {};
    }
    
    if (!window.ELIXIR.update) {
        window.ELIXIR.update = {};
    }
    
    // 导入更新模块（假设已经通过其他方式加载）
    const updateModule = window.ELIXIR.update;
    
    // 测试函数：获取更新进度
    function testGetUpdateProgress() {
        console.log('=== 测试获取更新进度 ===');
        
        try {
            const progress = updateModule.getUpdateProgress();
            
            console.log('更新状态:', progress.isUpdating ? '正在更新' : '空闲');
            console.log('当前步骤:', progress.currentStep);
            console.log('进度百分比:', progress.progressPercentage + '%');
            console.log('步骤描述:', progress.stepDescription);
            
            if (progress.error) {
                console.log('错误信息:', progress.error);
            }
            
            console.log('获取更新进度测试完成\n');
            return progress;
        } catch (error) {
            console.error('获取更新进度失败:', error);
            return null;
        }
    }
    
    // 测试函数：直接检查并下载更新
    async function testDirectCheckForUpdates() {
        console.log('=== 测试直接检查并下载更新 ===');
        
        try {
            console.log('开始检查更新...');
            const result = await updateModule.directCheckForUpdates();
            
            if (result.success) {
                if (result.needUpdate) {
                    console.log('✅ 发现新版本，已下载更新');
                    console.log('📊 本地MD5:', result.localMd5 || '无');
                    console.log('🌐 远程MD5:', result.remoteMd5 || '无');
                    console.log('🔒 是否强制更新:', result.isForced ? '是' : '否');
                    
                    if (result.content) {
                        console.log('📄 新内容已下载，可手动执行');
                    }
                } else {
                    console.log('✅ 当前已是最新版本，无需更新');
                }
            } else {
                console.error('❌ 检查更新失败:', result.error);
            }
            
            console.log('直接检查更新测试完成\n');
            return result;
        } catch (error) {
            console.error('❌ 检查更新时发生错误:', error);
            return null;
        }
    }
    
    // 测试函数：检查更新需求
    async function testCheckUpdateNeed() {
        console.log('=== 测试检查更新需求 ===');
        
        try {
            console.log('开始检查更新需求...');
            const result = await updateModule.checkUpdateNeed();
            
            if (result.success) {
                if (result.needUpdate) {
                    console.log('🔄 需要更新');
                    console.log('📊 本地MD5:', result.localMd5 || '无');
                    console.log('🌐 远程MD5:', result.remoteMd5 || '无');
                    console.log('🔒 是否强制更新:', result.isForced ? '是' : '否');
                } else {
                    console.log('✅ 当前已是最新版本，无需更新');
                }
            } else {
                console.error('❌ 检查更新需求失败:', result.error);
            }
            
            console.log('检查更新需求测试完成\n');
            return result;
        } catch (error) {
            console.error('❌ 检查更新需求时发生错误:', error);
            return null;
        }
    }
    
    // 监控更新进度
    function monitorUpdateProgress(duration = 30000) {
        console.log('=== 开始监控更新进度 ===');
        
        const startTime = Date.now();
        let intervalId;
        
        intervalId = setInterval(() => {
            const progress = updateModule.getUpdateProgress();
            const elapsed = Date.now() - startTime;
            
            console.log(`[${Math.floor(elapsed/1000)}s] 更新进度: ${progress.progressPercentage}% - ${progress.stepDescription}`);
            
            // 如果更新完成或超时，停止监控
            if (!progress.isUpdating || elapsed > duration) {
                clearInterval(intervalId);
                console.log('监控更新进度结束\n');
            }
        }, 1000);
        
        return intervalId;
    }
    
    // 完整的更新流程测试
    async function testCompleteUpdateFlow() {
        console.log('🚀 === 开始完整更新流程测试 ===');
        
        // 1. 先检查是否需要更新
        console.log('1. 检查更新需求...');
        const checkResult = await testCheckUpdateNeed();
        
        if (!checkResult || !checkResult.success) {
            console.error('❌ 检查更新需求失败，终止测试');
            return;
        }
        
        if (checkResult.needUpdate) {
            console.log('2. 发现新版本，开始下载更新...');
            
            // 2. 开始监控进度
            monitorUpdateProgress();
            
            // 3. 进行下载
            const downloadResult = await testDirectCheckForUpdates();
            
            if (downloadResult && downloadResult.success) {
                console.log('✅ 更新流程完成');
            } else {
                console.error('❌ 下载更新失败');
            }
        } else {
            console.log('✅ 当前已是最新版本，无需更新');
        }
        
        console.log('🎉 完整更新流程测试结束\n');
    }
    
    // 导出测试函数到全局对象
    window.ELIXIR.update.test = {
        // 单个功能测试
        getUpdateProgress: testGetUpdateProgress,
        directCheckForUpdates: testDirectCheckForUpdates,
        checkUpdateNeed: testCheckUpdateNeed,
        
        // 监控功能
        monitorUpdateProgress: monitorUpdateProgress,
        
        // 完整流程测试
        completeUpdateFlow: testCompleteUpdateFlow,
        
        // 快速测试所有功能
        runAllTests: async function() {
            console.log('🧪 === 开始运行所有更新功能测试 ===\n');
            
            // 测试获取进度
            await testGetUpdateProgress();
            
            // 测试检查需求
            await testCheckUpdateNeed();
            
            // 测试直接检查更新
            await testDirectCheckForUpdates();
            
            console.log('🎉 所有更新功能测试完成');
        }
    };
    
    console.log('✅ 更新测试模块已加载');
    console.log('📝 使用方法:');
    console.log('   - window.ELIXIR.update.test.getUpdateProgress() - 获取更新进度');
    console.log('   - window.ELIXIR.update.test.checkUpdateNeed() - 检查更新需求');
    console.log('   - window.ELIXIR.update.test.directCheckForUpdates() - 直接检查并下载更新');
    console.log('   - window.ELIXIR.update.test.completeUpdateFlow() - 完整更新流程');
    console.log('   - window.ELIXIR.update.test.runAllTests() - 运行所有测试');
    console.log('');
    
})();