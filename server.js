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

/**
 * 终极精确检测器 - 基于无JS页面特征
 * 策略：直接检查 &noscript=1 版本的页面内容
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[精确检测] 检查: ${url.substring(0, 50)}...`);

    // 1. 首先，尝试获取无JavaScript版本
    const noscriptUrl = url.includes('?') ? 
                       `${url}&noscript=1` : 
                       `${url}?noscript=1`;
    
    console.log(`[精确检测] 获取无JS版本: ${noscriptUrl.substring(0, 60)}...`);
    
    const noscriptResponse = await axios.get(noscriptUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });
    
    const noscriptHtml = noscriptResponse.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[精确检测] 无JS页面: 状态 ${noscriptResponse.status}, 大小 ${noscriptHtml.length} 字符, 耗时 ${responseTime}ms`);

    // 2. 检查删除页面的确切特征
    // 特征1: 包含垃圾桶图标相关的SVG路径
    const hasTrashIcon = 
      /M6 19c0 1\.1\.9 2 2 2h8c1\.1 0 2-\.9 2-2V7H6v12z/.test(noscriptHtml) || // 常见垃圾桶SVG路径
      /d="M6 19c0 1\.1\.9 2 2 2h8c1\.1 0 2-\.9 2-2V7H6v12z"/.test(noscriptHtml) ||
      /<svg[^>]*trash[^>]*>/.test(noscriptHtml) ||
      /class="[^"]*trash[^"]*"/i.test(noscriptHtml) ||
      /class="[^"]*delete[^"]*"/i.test(noscriptHtml);
    
    // 特征2: 删除页面标题和描述文本
    const hasDeletionText = 
      /此项目已删除/.test(noscriptHtml) || // 中文删除文本
      /This item was deleted/i.test(noscriptHtml) || // 英文删除文本
      /deleted files/i.test(noscriptHtml) ||
      /已删除的文件/.test(noscriptHtml) ||
      /找不到此项目/.test(noscriptHtml) ||
      /couldn['\u2019]t find this item/i.test(noscriptHtml);
    
    // 特征3: 删除页面的按钮文本
    const hasDeletionButton = 
      /查看已删除的文件/.test(noscriptHtml) ||
      /Check deleted files/i.test(noscriptHtml) ||
      /You might be able to find it/i.test(noscriptHtml);
    
    console.log(`[精确检测-特征] 垃圾桶图标:${hasTrashIcon}, 删除文本:${hasDeletionText}, 删除按钮:${hasDeletionButton}`);
    
    // 3. 如果发现任何删除特征，判定为已删除
    if (hasTrashIcon || hasDeletionText || hasDeletionButton) {
      console.log(`[精确检测-结论] 已确认: 链接已删除`);
      return {
        valid: false,
        status: noscriptResponse.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted on Dropbox.',
        reason: 'CONTENT_DELETED',
        debug: {
          hasTrashIcon,
          hasDeletionText,
          hasDeletionButton
        }
      };
    }
    
    // 4. 检查正常页面的特征
    const hasNormalContent = 
      /file_viewer|folder_viewer/i.test(noscriptHtml) ||
      /shared with you|shared by/i.test(noscriptHtml) ||
      /download-?button/i.test(noscriptHtml) ||
      /file-?list|folder-?contents/i.test(noscriptHtml);
    
    if (hasNormalContent) {
      console.log(`[精确检测-结论] 已确认: 链接有效`);
      return {
        valid: true,
        status: noscriptResponse.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and accessible.',
        reason: 'CONTENT_VALID',
        debug: { hasNormalContent: true }
      };
    }
    
    // 5. 如果没有明确特征，记录部分HTML用于调试
    const sample = noscriptHtml.substring(0, Math.min(300, noscriptHtml.length)).replace(/\s+/g, ' ');
    console.log(`[精确检测-警告] 无明确特征，HTML样本: ${sample}...`);
    
    // 如果HTTP状态是2xx，保守地设为有效
    if (noscriptResponse.status >= 200 && noscriptResponse.status < 300) {
      return {
        valid: true,
        status: noscriptResponse.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible, but no clear content markers found.',
        reason: 'ACCESSIBLE_NO_MARKERS',
        debug: { sample }
      };
    }
    
    return {
      valid: false,
      status: noscriptResponse.status,
      timestamp: new Date().toISOString(),
      message: `Link returned error status ${noscriptResponse.status}`,
      reason: `HTTP_${noscriptResponse.status}`
    };

  } catch (error) {
    console.error(`[精确检测-错误] ${error.message}`);
    
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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-file-center',
    mode: 'icon_based_detection_v4',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

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
  console.log('🚀 Dropbox 文件中心 - 图标特征检测版');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔍 模式: 基于垃圾桶图标和文本的精确检测`);
  console.log('='.repeat(50));
});
