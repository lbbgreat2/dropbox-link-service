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

// 手动配置的Dropbox永久分享链接 - 移除enjoy_ai
const MANUAL_SHARE_LINKS = {
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0',
  'test': 'https://www.dropbox.com/scl/fo/jfm93u99iubtds6w4vg4w/AO7Ht-rwUHc7W5oaojNep2o?rlkey=bjvwfmx9tq8oa6v67iw3zyapp&st=o03vu2pi&dl=0'
  // enjoy_ai 已完全移除，改为分级菜单结构
};

// ============ ENJOY AI 分级链接配置 ============
// 这里用嵌套结构替代原来的扁平链接
const ENJOY_AI_HIERARCHICAL_LINKS = {
  '2025': {
    'battle_of_tribes': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'cyber_city': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'geometric_forest': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'sample_solution': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'skyline_adventures': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    }
  },
  '2026': {
    'battle_of_tribes': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'cyber_city': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'geometric_forest': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'sample_solution': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'skyline_adventures': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    }
  }
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
    available_folders: Object.keys(MANUAL_SHARE_LINKS),
    hierarchical_links_available: true
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

// 新增：获取ENJOY AI分级链接结构
app.get('/api/hierarchical/enjoy_ai', (req, res) => {
  res.json({
    success: true,
    data: ENJOY_AI_HIERARCHICAL_LINKS,
    timestamp: new Date().toISOString(),
    note: '分级链接结构，请通过 /api/hierarchical/link 端点获取具体链接'
  });
});

// 新增：获取分级链接的具体文档
app.get('/api/hierarchical/link', async (req, res) => {
  const { year, project, docType } = req.query;
  
  if (!year || !project || !docType) {
    return res.status(400).json({
      error: '缺少必要参数',
      message: '需要year, project, docType参数',
      example: '/api/hierarchical/link?year=2025&project=battle_of_tribes&docType=competition_rule',
      available_years: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS)
    });
  }
  
  // 检查年份参数有效性
  if (!ENJOY_AI_HIERARCHICAL_LINKS[year]) {
    return res.status(404).json({
      error: '年份不存在',
      available_years: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS)
    });
  }
  
  // 检查项目参数有效性
  if (!ENJOY_AI_HIERARCHICAL_LINKS[year][project]) {
    return res.status(404).json({
      error: '项目不存在',
      available_projects: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS[year])
    });
  }
  
  const url = ENJOY_AI_HIERARCHICAL_LINKS[year][project][docType];
  
  // 检查链接是否已配置
  if (!url) {
    return res.status(404).json({
      error: '文档类型不存在或链接未配置',
      available_docTypes: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS[year][project]),
      note: '请在server.js的ENJOY_AI_HIERARCHICAL_LINKS中配置此链接'
    });
  }
  
  // 检测链接有效性
  const validity = await checkLinkValidity(url);
  
  if (!validity.valid) {
    return res.status(503).json({
      error: '当前文件链接已失效',
      code: 'LINK_EXPIRED',
      year,
      project,
      docType,
      status: validity.status,
      details: validity.error,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    year,
    project,
    docType,
    url,
    name: getDocumentName(year, project, docType),
    validity: validity,
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
    hierarchical_available: true,
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
    'whalesbot': 'WhalesBot',
    'test': 'Test 文件夹'
    // enjoy_ai 已移除
  };
  return names[folderId] || folderId;
}

// 辅助函数：获取文档友好名称
function getDocumentName(year, project, docType) {
  const projectNames = {
    'battle_of_tribes': 'Battle of Tribes',
    'cyber_city': 'Cyber City',
    'geometric_forest': 'Geometric Forest',
    'sample_solution': 'Sample Solution',
    'skyline_adventures': 'Skyline Adventures'
  };
  
  const docTypeNames = {
    'competition_rule': 'Competition Rule',
    'field_setup_guide': 'Field Setup Guide'
  };
  
  return `${year} - ${projectNames[project] || project} - ${docTypeNames[docType] || docType}`;
}

// 处理未匹配的路由
app.use((req, res) => {
  res.status(404).json({
    error: '端点不存在',
    availableEndpoints: {
      health: '/api/health',
      getLink: '/api/link/:folderId',
      hierarchicalStructure: '/api/hierarchical/enjoy_ai',
      hierarchicalLink: '/api/hierarchical/link?year=X&project=Y&docType=Z',
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
  console.log(`🌳 ENJOY AI已改为分级菜单结构 (${Object.keys(ENJOY_AI_HIERARCHICAL_LINKS).length} 个年份)`);
  console.log(`🔍 链接验证: 增强版（检测页面内容有效性）`);
  console.log(`=========================================`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`链接状态: http://localhost:${PORT}/api/links/status`);
  console.log(`测试链接: http://localhost:${PORT}/api/link/test`);
  console.log(`ENJOY AI分级结构: http://localhost:${PORT}/api/hierarchical/enjoy_ai`);
  console.log(`=========================================`);
});
