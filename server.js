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

// 手动配置的 Dropbox 永久分享链接
const MANUAL_SHARE_LINKS = {
  'enjoy_ai': 'https://www.dropbox.com/scl/fo/xhuafhd7lvzct5qou5exc/APsv0VSGbS0sL2h5q86sxrE?rlkey=wulgqtxyjifm67ymdhj881u66&st=h5z3paub&dl=0',
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0',
  'test': 'https://www.dropbox.com/scl/fo/jfm93u99iubtds6w4vg4w/AO7Ht-rwUHc7W5oaojNep2o?rlkey=bjvwfmx9tq8oa6v67iw3zyapp&st=o03vu2pi&dl=0'
};

// 链接状态缓存
let linkStatusCache = {};
const CACHE_DURATION = 3 * 60 * 1000; // 3 分钟缓存

/**
 * 强化版 Dropbox 链接有效性检测
 * 专门针对英文删除页面优化
 */
async function checkLinkValidity(url) {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const html = response.data;
    const normalizedHtml = html.replace(/['"`]/g, '"').toLowerCase();
    
    // 模式 1: 直接匹配删除页面的关键文本
    const deletionKeywords = [
      'this item was deleted',
      'this file was deleted',
      'this folder was deleted',
      'deleted files',
      'couldn\'t find this item',
      'item is no longer available',
      'has been deleted',
      'was deleted',
      'the file you\'re looking for couldn\'t be found'
    ];
    
    // 模式 2: 匹配删除页面的 HTML 结构特征
    const deletionHtmlPatterns = [
      /<h[1-6][^>]*>\s*this item was deleted\s*<\/h[1-6]>/i,
      /<div[^>]*class="[^"]*(error-title|deleted-title)[^"]*"[^>]*>/i,
      /<svg[^>]*(trash|deleted)[^>]*>/i,
      /class="[^"]*(trash|deleted-illustration|error-illustration)[^"]*"/i
    ];
    
    // 模式 3: 匹配删除页面的辅助文本
    const deletionContextText = [
      'you might be able to find it in your deleted files',
      'check your deleted files',
      'the owner may have deleted it',
      'ask the person who shared it with you'
    ];
    
    // 检查是否为删除页面
    const hasDeletionKeyword = deletionKeywords.some(keyword => 
      normalizedHtml.includes(keyword.toLowerCase())
    );
    
    const hasDeletionHtml = deletionHtmlPatterns.some(pattern => 
      pattern.test(html)
    );
    
    const hasDeletionContext = deletionContextText.some(text => 
      normalizedHtml.includes(text.toLowerCase())
    );
    
    // 调试日志
    console.log(`[检测] URL: ${url.substring(0, 50)}...`);
    console.log(`[检测结果] 关键词:${hasDeletionKeyword}, HTML特征:${hasDeletionHtml}, 上下文:${hasDeletionContext}`);
    
    // 如果检测到任何删除特征
    if (hasDeletionKeyword || hasDeletionHtml || hasDeletionContext) {
      console.log(`[结论] 页面已被删除`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted on Dropbox.',
        reason: 'CONTENT_DELETED',
        confidence: 'HIGH'
      };
    }
    
    // 检查正常页面的特征
    const validPageIndicators = [
      'data-reactid', // Dropbox React 应用标记
      'file_viewer',
      'folder_viewer',
      'download_button',
      'folder_contents',
      'file_list',
      'shared with you',
      'viewing shared folder'
    ];
    
    const hasValidIndicator = validPageIndicators.some(indicator => 
      html.includes(indicator)
    );
    
    if (hasValidIndicator) {
      console.log(`[结论] 页面有效`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and content is accessible.',
        reason: 'CONTENT_VALID',
        confidence: 'HIGH'
      };
    }
    
    // 如果没有明确信号，默认视为有效但记录警告
    console.log(`[结论] 页面状态不明确，默认视为有效`);
    return {
      valid: true,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: 'Link is accessible, but content state could not be definitively verified.',
      reason: 'ACCESSIBLE_BUT_UNVERIFIED',
      confidence: 'LOW',
      note: 'No strong indicators of deletion or valid content were found.'
    };
    
  } catch (error) {
    console.error(`链接检测失败: ${error.message}`);
    
    let reason = 'NETWORK_ERROR';
    let message = 'Network request failed.';
    
    if (error.code === 'ECONNABORTED') {
      reason = 'TIMEOUT';
      message = 'Request timed out.';
    } else if (error.response) {
      reason = `HTTP_${error.response.status}`;
      message = `Server returned error: ${error.response.status}`;
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
      error: 'Link not configured',
      timestamp: new Date().toISOString(),
      reason: 'NOT_CONFIGURED'
    };
  }

  const cacheKey = folderId;
  const now = Date.now();
  
  // 对于 test 文件夹，使用更短的缓存以便测试
  const cacheTime = folderId === 'test' ? 60000 : CACHE_DURATION;

  if (linkStatusCache[cacheKey] && 
      now - linkStatusCache[cacheKey].timestamp < cacheTime) {
    return linkStatusCache[cacheKey];
  }

  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    mode: 'enhanced_deletion_detection',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS),
    version: '2.0.0'
  });
});

// 获取单个链接
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: 'Folder not found',
      message: `Unconfigured folder ID: '${folderId}'`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  const validity = await getLinkStatus(folderId);
  
  if (!validity.valid) {
    return res.status(503).json({
      error: 'Link is not accessible',
      code: 'LINK_INVALID',
      status: validity.status,
      details: validity.message,
      reason: validity.reason,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    folderId,
    url: MANUAL_SHARE_LINKS[folderId],
    source: 'manual_preconfigured',
    validity: {
      valid: validity.valid,
      reason: validity.reason,
      message: validity.message
    },
    timestamp: new Date().toISOString()
  });
});

// 获取所有链接状态
app.get('/api/links/status', async (req, res) => {
  try {
    const linkStatus = {};
    
    const promises = Object.keys(MANUAL_SHARE_LINKS).map(async (key) => {
      linkStatus[key] = await getLinkStatus(key);
    });
    
    await Promise.all(promises);
    
    res.json({
      success: true,
      data: linkStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取链接状态时出错:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking link status',
      timestamp: new Date().toISOString()
    });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
app.listen(PORT, () => {
  console.log('=========================================');
  console.log('🚀 Dropbox 文件中心服务已启动');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔗 已配置 ${Object.keys(MANUAL_SHARE_LINKS).length} 个永久链接`);
  console.log(`🔍 检测模式: 增强型删除页面识别`);
  console.log('=========================================');
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`链接状态: http://localhost:${PORT}/api/links/status`);
  console.log('=========================================');
});
