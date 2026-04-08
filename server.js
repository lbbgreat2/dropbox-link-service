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
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 链接有效性检测函数（使用您提供的代码）
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[检测器] 检查: ${url.substring(0, 50)}...`);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[检测器] 响应: 状态 ${response.status}, 大小 ${html.length} 字符, 耗时 ${responseTime}ms`);

    // 1. 修正：使用更精确的正则表达式匹配真正的noscript标签
    // 确保匹配 <noscript> 标签，并且里面包含 noscript=1
    const noscriptMatch = html.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/i);
    const hasNoscriptRedirect = noscriptMatch && 
                               /noscript=1/i.test(noscriptMatch[1]) &&
                               /http-equiv=["']?refresh["']?/i.test(noscriptMatch[1]);

    // 2. 同时检查删除页面的其他特征
    const hasDeletionText = 
      html.includes('此项目已删除') ||
      html.includes('This item was deleted') ||
      html.includes('deleted files') ||
      html.includes('已删除的文件') ||
      html.includes('找不到此项目');

    // 3. 检查正常页面特征
    const hasNormalContent = 
      html.includes('file_viewer') ||
      html.includes('folder_contents') ||
      html.includes('shared with you') ||
      html.includes('查看文件夹') ||
      html.includes('下载') ||
      html.includes('download');

    console.log(`[检测器-特征] Noscript重定向:${hasNoscriptRedirect}, 删除文本:${hasDeletionText}, 正常内容:${hasNormalContent}`);

    // 决策逻辑
    if (hasNoscriptRedirect || hasDeletionText) {
      // 如果是删除页面，应该没有正常内容
      if (!hasNormalContent) {
        console.log(`[检测器-结论] 检测到删除特征，设为无效`);
        return {
          valid: false,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'This item has been deleted.',
          reason: 'CONTENT_DELETED'
        };
      }
    }

    // 如果有正常内容，或者页面可访问但没有删除特征，设为有效
    if (hasNormalContent || (response.status >= 200 && response.status < 300)) {
      console.log(`[检测器-结论] 页面可访问，设为有效`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible and appears valid.',
        reason: 'CONTENT_VALID'
      };
    }

    return {
      valid: false,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: `Link returned error status ${response.status}`,
      reason: `HTTP_${response.status}`
    };

  } catch (error) {
    console.error(`[检测器-错误] ${error.message}`);
    
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

  if (linkStatusCache[cacheKey] && 
      (now - linkStatusCache[cacheKey].timestamp) < CACHE_DURATION) {
    return linkStatusCache[cacheKey];
  }

  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// ----- API 端点 -----
// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-file-center',
    mode: 'noscript_enhanced_detection',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// 获取特定文件夹链接状态
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: 'Folder not found',
      message: `Folder ID '${folderId}' is not configured.`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  const validity = await getLinkStatus(folderId);
  
  res.json({
    folderId,
    url: MANUAL_SHARE_LINKS[folderId],
    status_check: validity,
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
    console.error('[API 错误] /api/links/status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check link statuses.',
      timestamp: new Date().toISOString()
    });
  }
});

// ----- 提供前端文件 -----
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Dropbox 文件中心 - 增强检测版');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔍 检测模式: Noscript重定向 + 文本特征`);
  console.log('='.repeat(50));
  console.log(`👉 前端访问: http://localhost:${PORT}`);
  console.log(`🩺 健康检查: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(50));
});
