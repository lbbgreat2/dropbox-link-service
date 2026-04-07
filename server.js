require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Manually Configured Dropbox Permanent Sharing Links
const MANUAL_SHARE_LINKS = {
  'enjoy_ai': 'https://www.dropbox.com/scl/fo/xhuafhd7lvzct5qou5exc/APsv0VSGbS0sL2h5q86sxrE?rlkey=wulgqtxyjifm67ymdhj881u66&st=h5z3paub&dl=0',
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0',
  'test': 'https://www.dropbox.com/scl/fo/jfm93u99iubtds6w4vg4w/AO7Ht-rwUHc7W5oaojNep2o?rlkey=bjvwfmx9tq8oa6v67iw3zyapp&st=o03vu2pi&dl=0'
};

// Link Status Cache
let linkStatusCache = {};

// SIMPLE & DIRECT: Check if Dropbox link shows deletion page
async function checkLinkValidity(url) {
  try {
    console.log(`[Simple Check] Testing: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const lowerHtml = html.toLowerCase();
    
    // 关键检测1: 直接查找删除文字 (根据您的截图)
    const hasDeletedText = 
      lowerHtml.includes('this item was deleted') ||
      lowerHtml.includes('this file was deleted') ||
      lowerHtml.includes('was deleted') ||
      lowerHtml.includes('deleted files') ||
      lowerHtml.includes('item is no longer available');
    
    // 关键检测2: 查找垃圾桶图标的常见HTML表示
    // Dropbox删除页面的垃圾桶通常有特定SVG路径或CSS类
    const hasTrashIcon = 
      html.includes('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z') || // 常见垃圾桶SVG路径
      html.includes('trash-can') ||
      html.includes('trash_icon') ||
      html.includes('icon-trash') ||
      html.includes('deleted-illustration');
    
    // 关键检测3: 查找删除页面的其他特征
    const hasDeletePageMarkers = 
      lowerHtml.includes('you might be able to find it in your deleted files') ||
      lowerHtml.includes('ask the person who shared it with you') ||
      lowerHtml.includes('check deleted files');
    
    // 如果是删除页面
    if (hasDeletedText || hasTrashIcon || hasDeletePageMarkers) {
      console.log(`[Simple Check] DETECTED AS DELETED - Reason: ${hasDeletedText ? 'Deleted text' : ''} ${hasTrashIcon ? 'Trash icon' : ''} ${hasDeletePageMarkers ? 'Delete markers' : ''}`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted on Dropbox',
        reason: 'DELETED',
        confidence: 'HIGH'
      };
    }
    
    // 检查是否是有效的内容页面
    // 有效的Dropbox分享页面通常有这些元素
    const hasValidContent =
      html.includes('file_viewer') ||
      html.includes('folder_viewer') ||
      html.includes('download_button') ||
      (html.includes('viewing') && html.includes('dropbox.com')) ||
      (html.includes('shared with you') && html.includes('dropbox.com'));
    
    if (hasValidContent) {
      console.log(`[Simple Check] DETECTED AS VALID - Has content markers`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and accessible',
        reason: 'VALID',
        confidence: 'HIGH'
      };
    }
    
    // 默认情况：如果没有明确信号，我们假设有效但记录警告
    console.log(`[Simple Check] UNCLEAR - No strong signals detected`);
    return {
      valid: true, // 保守假设：没有删除迹象就是有效
      status: response.status,
      timestamp: new Date().toISOString(),
      message: 'Link accessible, but content state unclear',
      reason: 'UNCLEAR_BUT_ACCESSIBLE',
      confidence: 'LOW'
    };

  } catch (error) {
    console.error(`[Simple Check] ERROR: ${url}`, error.message);
    
    return {
      valid: false,
      error: error.message,
      status: error.response?.status || 0,
      timestamp: new Date().toISOString(),
      message: 'Cannot access link',
      reason: error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR',
      confidence: 'HIGH'
    };
  }
}

// Get link status
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
  const CACHE_TIME = 2 * 60 * 1000; // 2分钟缓存，便于测试

  if (linkStatusCache[cacheKey] && 
      now - linkStatusCache[cacheKey].timestamp < CACHE_TIME) {
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
    service: 'dropbox-link-detector',
    mode: 'simple_deletion_detector',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// 获取链接
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: 'Folder not found',
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  const validity = await getLinkStatus(folderId);
  
  res.json({
    folderId,
    url: MANUAL_SHARE_LINKS[folderId],
    status: validity.valid ? 'valid' : 'invalid',
    reason: validity.reason,
    message: validity.message,
    timestamp: new Date().toISOString()
  });
});

// 获取所有链接状态
app.get('/api/links/status', async (req, res) => {
  try {
    const linkStatus = {};
    
    for (const key of Object.keys(MANUAL_SHARE_LINKS)) {
      linkStatus[key] = await getLinkStatus(key);
    }
    
    res.json({
      success: true,
      data: linkStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking links:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking links'
    });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
app.listen(PORT, () => {
  console.log(`=====================================`);
  console.log(`✅ Dropbox Link Checker Started`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔍 Mode: Simple Deletion Detector`);
  console.log(`📁 Links: ${Object.keys(MANUAL_SHARE_LINKS).length}`);
  console.log(`=====================================`);
});
