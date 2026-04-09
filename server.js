require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 手动配置的Dropbox永久分享链接
const MANUAL_SHARE_LINKS = {
    // 原来的 whalesbot 和 test 文件夹保持不变
    whalesbot: "https://www.dropbox.com/scl/fo/xxx/xxx?rlkey=xxx&dl=0", // 您原来的 whalesbot 链接
    
    // 新增三个 ENJOY AI 文件夹
    enjoy_ai_2024: "https://www.dropbox.com/scl/fo/eeqc5juvic7n5zk53brsg/AO2GEQnqWO7YYf51XIG9ges?rlkey=kuzygnod4zlqkdi6w7xo362ke&st=hdnsbxtc&dl=0",
    enjoy_ai_2025: "https://www.dropbox.com/scl/fo/luu9d5ouxb6t20nw854kj/AGngS2DwNoUnduQ6CkmX_fA?rlkey=wyddybmqhek79tltq2jt85b3a&st=i07qs1f5&dl=0",
    enjoy_ai_2026: "https://www.dropbox.com/scl/fo/luu9d5ouxb6t20nw854kj/AGngS2DwNoUnduQ6CkmX_fA?rlkey=wyddybmqhek79tltq2jt85b3a&st=ex63b32v&dl=0",
    
    // 原来的 test 文件夹保持不变
    test: "https://www.dropbox.com/scl/fo/xxx/xxx?rlkey=xxx&dl=0" // 您原来的 test 链接
};

// 链接状态缓存
let linkStatusCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 检测单个链接是否有效的函数 (增强版)
async function checkLinkValidity(url) {
  try {
    // 发送GET请求，获取页面内容以便分析
    const response = await axios.get(url, {
      timeout: 15000, // 15秒超时
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500; // 接受除服务器错误外的所有状态码
      }
    });
    
    const htmlContent = response.data;
    const isDropboxPage = htmlContent.includes('dropbox.com') || htmlContent.includes('Dropbox');
    
    if (!isDropboxPage) {
      // 如果不是Dropbox页面，可能重定向到了错误页
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: '链接未指向Dropbox有效页面',
        reason: 'NOT_DROPBOX'
      };
    }
    
    // 检查是否包含常见的失效提示关键词 (中英文)
    const failureIndicators = [
      '此项目已删除',
      '该项目已删除',
      '已删除',
      '不存在',
      'not found',
      'deleted',
      'removed',
      'no longer available',
      '您没有访问权限',
      'don\'t have permission',
      '找不到此文件',
      '文件不存在',
      'This file was deleted',
      'The file you\'re looking for',
      'couldn\'t be found',
      '已取消分享',
      '分享已取消',
      'shared link has been disabled',
      'shared link is not valid'
    ];
    
    const isContentDeleted = failureIndicators.some(indicator => 
      htmlContent.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (isContentDeleted) {
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: '链接指向的内容可能已被删除或无权访问',
        reason: 'CONTENT_DELETED_OR_NO_PERMISSION'
      };
    }
    
    // 额外检查：Dropbox特定的成功标识
    const successIndicators = [
      '正在加载',
      'loading',
      '查看文件夹',
      'view folder',
      '下载',
      'download',
      '文件',
      'files',
      '文件夹',
      'folder'
    ];
    
    const hasSuccessIndicator = successIndicators.some(indicator =>
      htmlContent.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasSuccessIndicator) {
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: '链接内容有效'
      };
    }
    
    // 默认情况下，如果页面是Dropbox但没有明显失败或成功标识，我们假设有效
    return {
      valid: true,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: '链接可访问',
      note: '未检测到明确的有效性标识，但页面可访问'
    };
    
  } catch (error) {
    console.error(`链接检测失败: ${url}`, error.message);
    
    // 根据错误类型提供更具体的失效原因
    let reason = 'NETWORK_ERROR';
    let message = '网络请求失败';
    
    if (error.code === 'ECONNABORTED') {
      reason = 'TIMEOUT';
      message = '请求超时';
    } else if (error.response) {
      reason = `HTTP_${error.response.status}`;
      message = `服务器返回错误: ${error.response.status}`;
    }
    
    return {
      valid: false,
      error: error.message,
      status: error.response?.status || 0,
      timestamp: new Date().toISOString(),
      message: message,
      reason: reason
    };
  }
}

// 获取链接状态（带缓存）
async function getLinkStatus(folderId) {
  const url = MANUAL_SHARE_LINKS[folderId];
  if (!url) {
    return { 
      valid: false, 
      error: '链接未配置', 
      timestamp: new Date().toISOString(),
      reason: 'NOT_CONFIGURED'
    };
  }

  const cacheKey = folderId;
  const now = Date.now();
  
  // 检查缓存
  if (linkStatusCache[cacheKey] && 
      now - linkStatusCache[cacheKey].timestamp < CACHE_DURATION) {
    return linkStatusCache[cacheKey];
  }

  // 重新检测
  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    mode: 'manual_links_with_validation',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// 获取链接的主要API
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  
  console.log(`请求链接: ${folderId} (IP: ${req.ip})`);
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: '文件夹不存在',
      message: `未配置的文件夹ID: '${folderId}'`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  // 检测链接是否有效
  const validity = await getLinkStatus(folderId);
  
  if (!validity.valid) {
    return res.status(503).json({
      error: '当前文件链接已失效',
      code: 'LINK_EXPIRED',
      status: validity.status,
      details: validity.error,
      timestamp: new Date().toISOString()
    });
  }
  
  const dropboxLink = MANUAL_SHARE_LINKS[folderId];
  
  res.json({
    folderId,
    url: dropboxLink,
    source: 'manual_preconfigured',
    note: '此链接为手动生成并预配置的Dropbox永久分享链接',
    timestamp: new Date().toISOString()
  });
});

// 新增：获取所有链接状态
app.get('/api/links/status', async (req, res) => {
  try {
    const linkStatus = {};
    
    // 并行检查所有链接
    const promises = Object.keys(MANUAL_SHARE_LINKS).map(async (key) => {
      linkStatus[key] = await getLinkStatus(key);
    });
    
    await Promise.all(promises);
    
    res.json({
      success: true,
      data: linkStatus,
      timestamp: new Date().toISOString(),
      cache: Object.keys(linkStatusCache).length > 0
    });
  } catch (error) {
    console.error('检测链接状态时出错:', error);
    res.status(500).json({
      success: false,
      error: '检测链接状态时出错',
      timestamp: new Date().toISOString()
    });
  }
});

// 列出所有可用文件夹
app.get('/api/folders', (req, res) => {
  const folderInfo = Object.keys(MANUAL_SHARE_LINKS).map(folderId => ({
    id: folderId,
    name: getFolderName(folderId),
    url: `/api/link/${folderId}`,
    configured: true
  }));
  
  res.json({
    folders: folderInfo,
    count: folderInfo.length,
    mode: 'manual_preconfigured_links',
    timestamp: new Date().toISOString()
  });
});

// 静态文件服务 - 放在所有API路由之后
app.use(express.static(path.join(__dirname, 'public')));

// 重定向根路径到前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 辅助函数：获取文件夹友好名称
function getFolderName(folderId) {
  const names = {
    'enjoy_ai': 'ENJOY AI',
    'whalesbot': 'WhalesBot',
    'test': 'Test 文件夹'
  };
  return names[folderId] || folderId;
}

// 处理未匹配的路由
app.use((req, res) => {
  res.status(404).json({
    error: '端点不存在',
    availableEndpoints: {
      health: '/api/health',
      getLink: '/api/link/:folderId',
      linksStatus: '/api/links/status',
      listFolders: '/api/folders',
      frontend: '/ (前端页面)'
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Dropbox永久链接服务已启动`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔗 已配置 ${Object.keys(MANUAL_SHARE_LINKS).length} 个永久链接`);
  console.log(`🔍 链接验证: 增强版（检测页面内容有效性）`);
  console.log(`=========================================`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`链接状态: http://localhost:${PORT}/api/links/status`);
  console.log(`测试链接: http://localhost:${PORT}/api/link/test`);
  console.log(`=========================================`);
});
