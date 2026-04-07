require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    mode: 'manual_links_simple',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// 获取链接的主要API
app.get('/api/link/:folderId', (req, res) => {
  const folderId = req.params.folderId;
  
  console.log(`请求链接: ${folderId} (IP: ${req.ip})`);
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: '文件夹不存在',
      message: `未配置的文件夹ID: '${folderId}'`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
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

// 简化版链接状态检查（不依赖外部API）
app.get('/api/links/status', (req, res) => {
  try {
    const linkStatus = {};
    
    // 检查每个配置的链接（仅验证格式）
    Object.keys(MANUAL_SHARE_LINKS).forEach(key => {
      const url = MANUAL_SHARE_LINKS[key];
      linkStatus[key] = {
        valid: url && url.startsWith('https://www.dropbox.com/'),
        status: 200,
        timestamp: new Date().toISOString(),
        note: '基础格式验证通过'
      };
    });
    
    res.json({
      success: true,
      data: linkStatus,
      timestamp: new Date().toISOString(),
      note: '简化验证模式（不检测实际可达性）'
    });
  } catch (error) {
    console.error('生成链接状态时出错:', error);
    res.status(500).json({
      success: false,
      error: '生成链接状态时出错',
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
  console.log(`🔍 链接验证: 简化模式（无外部依赖）`);
  console.log(`=========================================`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`链接状态: http://localhost:${PORT}/api/links/status`);
  console.log(`测试链接: http://localhost:${PORT}/api/link/apps_software`);
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
      listFolders: '/api/folders',
      frontend: '/ (前端页面)'
    }
  });
});
