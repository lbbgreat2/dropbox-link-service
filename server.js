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
app.use(express.static(path.join(__dirname, 'public')));

// 手动配置的Dropbox永久分享链接
const MANUAL_SHARE_LINKS = {
  'apps_software': 'https://www.dropbox.com/scl/fo/ucvn6oqj3e3cpr8shkkwg/AGMNnNzHEoNKYKG6p_zhyQk?rlkey=2opal5oyhm48ahh9c6trtichv&st=2unua7bt&dl=0',
  'enjoy_ai': 'https://www.dropbox.com/scl/fo/xhuafhd7lvzct5qou5exc/APsv0VSGbS0sL2h5q86sxrE?rlkey=wulgqtxyjifm67ymdhj881u66&st=h5z3paub&dl=0',
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0',
  'air_headshot': 'https://www.dropbox.com/scl/fi/u5j4u3b09cldwyzxdm9ic/air-headshot.mp4?rlkey=7qth0k667hgx2a1os4dx0cn3w&st=cgk8vyzm&dl=0'
};

// 缓存链接状态，减少API调用
let linkStatusCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 检测链接是否有效的函数
async function checkLinkValidity(url) {
  try {
    // 只发送HEAD请求，检查链接是否可访问（不下载内容）
    const response = await axios.head(url, {
      timeout: 10000, // 10秒超时
      maxRedirects: 5,
      validateStatus: function (status) {
        // 2xx 和 3xx 状态码都视为有效
        return status >= 200 && status < 400;
      }
    });
    return {
      valid: true,
      status: response.status,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`链接检测失败: ${url}`, error.message);
    return {
      valid: false,
      error: error.message,
      status: error.response?.status || 0,
      timestamp: new Date().toISOString()
    };
  }
}

// 获取链接状态（带缓存）
async function getLinkStatus(folderId) {
  const url = MANUAL_SHARE_LINKS[folderId];
  if (!url) {
    return { valid: false, error: '链接未配置', timestamp: new Date().toISOString() };
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

// 新增API端点：获取所有链接状态
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

// 修改原有的获取单个链接的API，加入检测
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: '链接不存在',
      code: 'LINK_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }
  
  // 先检测链接是否有效
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
  
  // 链接有效，返回
  res.json({
    folderId,
    url: MANUAL_SHARE_LINKS[folderId],
    valid: true,
    status: validity.status,
    timestamp: new Date().toISOString()
  });
});

// 手动刷新链接状态缓存
app.post('/api/links/refresh', (req, res) => {
  linkStatusCache = {}; // 清空缓存
  res.json({
    success: true,
    message: '链接状态缓存已刷新',
    timestamp: new Date().toISOString()
  });
});

// 列出所有可用文件夹
app.get('/api/folders', (req, res) => {
  const folderInfo = Object.keys(MANUAL_SHARE_LINKS).map(folderId => ({
    id: folderId,
    name: getFolderName(folderId),
    url: `/api/link/${folderId}`,
    statusUrl: `/api/links/status`
  }));
  
  res.json({
    folders: folderInfo,
    count: folderInfo.length,
    mode: 'manual_preconfigured_links_with_validation',
    timestamp: new Date().toISOString()
  });
});

// 重定向根路径到前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 辅助函数：获取文件夹友好名称
function getFolderName(folderId) {
  const names = {
    'apps_software': 'Apps and Softwares',
    'enjoy_ai': 'ENJOY AI',
    'whalesbot': 'WhalesBot',
    'air_headshot': 'air headshot.mp4'
  };
  return names[folderId] || folderId;
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Dropbox永久链接服务已启动`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 已配置 ${Object.keys(MANUAL_SHARE_LINKS).length} 个永久链接`);
  console.log(`🔍 链接验证功能: 已启用`);
  console.log(`=========================================`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`链接状态: http://localhost:${PORT}/api/links/status`);
  console.log(`=========================================`);
});

// 处理未匹配的路由
app.use((req, res) => {
  res.status(404).json({
    error: '端点不存在',
    availableEndpoints: {
      health: '/api/health',
      getLink: '/api/link/:folderId',
      linksStatus: '/api/links/status',
      refreshCache: '/api/links/refresh (POST)',
      listFolders: '/api/folders',
      frontend: '/ (前端页面)'
    }
  });
});

// 导出app用于测试
module.exports = app;
