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
 * 精确检测器 - 修复 <script nonce> 误识别问题
 * 核心修正：
 * 1. 更精确的匹配：只匹配真正的 <noscript> 标签
 * 2. 避免误匹配：排除 <script nonce> 和其他相似内容
 * 3. 多重验证：结合文本、内容和状态码
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[检测器] 检查链接: ${url.substring(0, 50)}...`);

    // 获取页面
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[检测器] 响应: 状态 ${response.status}, 大小 ${html.length} 字符, 耗时 ${responseTime}ms`);

    // --- 核心修正 1: 更精确的匹配 ---
    // 只匹配真正的 <noscript> 标签
    const noscriptMatches = html.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi) || [];
    let hasValidNoscriptRedirect = false;
    let noscriptContent = '';

    for (const match of noscriptMatches) {
      // 提取 <noscript> 标签内的内容
      const contentMatch = match.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/i);
      if (contentMatch && contentMatch[1]) {
        const content = contentMatch[1];
        // 检查是否是真正的删除页面特征
        if (content.includes('noscript=1') && content.includes('refresh')) {
          hasValidNoscriptRedirect = true;
          noscriptContent = content;
          break;
        }
      }
    }

    // --- 核心修正 2: 避免误匹配 ---
    // 同时检查删除页面的其他特征
    const hasDeletionText = 
      /此项目已删除/i.test(html) ||
      /This item was deleted/i.test(html) ||
      /deleted files/i.test(html) ||
      /已删除的文件/i.test(html) ||
      /找不到此项目/i.test(html) ||
      /couldn['\u2019]t find this item/i.test(html);

    // --- 核心修正 3: 多重验证 ---
    // 检查正常页面特征
    const hasNormalContent = 
      /file_viewer|folder_viewer/i.test(html) ||
      /shared with you|shared by/i.test(html) ||
      /download-?button/i.test(html) ||
      /file-?list|folder-?contents/i.test(html) ||
      /viewing shared folder/i.test(html);

    // 调试信息
    console.log(`[检测器-特征] 有效Noscript重定向:${hasValidNoscriptRedirect}, 删除文本:${hasDeletionText}, 正常内容:${hasNormalContent}`);
    
    if (hasValidNoscriptRedirect && noscriptContent) {
      console.log(`[检测器] Noscript内容: ${noscriptContent.substring(0, 100)}...`);
    }

    // --- 决策逻辑 ---
    // 情况1: 检测到明确的删除特征
    if (hasValidNoscriptRedirect || hasDeletionText) {
      // 如果有删除特征但没有正常内容，判定为已删除
      if (!hasNormalContent) {
        console.log(`[检测器-结论] 检测到删除特征，无正常内容，设为无效`);
        return {
          valid: false,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'This item has been deleted.',
          reason: 'CONTENT_DELETED'
        };
      }
      
      // 如果有删除特征但同时也正常内容，需要进一步判断
      // 记录警告，但暂时设为有效
      console.log(`[检测器-警告] 检测到删除特征但也有正常内容，设为有效`);
    }

    // 情况2: 有正常内容
    if (hasNormalContent) {
      console.log(`[检测器-结论] 检测到正常内容，设为有效`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link contains valid file or folder content.',
        reason: 'CONTENT_VALID'
      };
    }

    // 情况3: 页面可访问但没有明确特征
    if (response.status >= 200 && response.status < 300) {
      console.log(`[检测器-结论] 页面可访问但无明确特征，保守设为有效`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible but content type is unclear.',
        reason: 'ACCESSIBLE_NO_CLEAR_SIGNALS'
      };
    }

    // 情况4: HTTP错误
    console.log(`[检测器-结论] 页面返回错误状态，设为无效`);
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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-file-center',
    mode: 'precise_detection_v8',
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
  console.log('🚀 Dropbox 文件中心 - 精确检测版');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔍 模式: 精确匹配，修复 <script nonce> 误识别问题`);
  console.log('='.repeat(50));
});
