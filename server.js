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
 * 终极解决方案：通过检查"无JavaScript"版本来探测真实状态
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[检测器] 开始检查: ${url.substring(0, 60)}...`);

    // 1. 首先，正常获取页面（用户浏览器看到的内容）
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[检测器] 原始页面: 状态 ${response.status}, 大小 ${html.length} 字符`);

    // 2. 检查这是否是Dropbox的JavaScript动态渲染页面
    // 关键特征：包含"edison"和"require"相关代码
    const isDynamicPage = html.includes('edisonReactPageModule') || 
                          html.includes('require(') ||
                          html.includes('atlas/file_viewer');

    if (!isDynamicPage) {
      // 如果不是动态页面，回退到原有的文本检查逻辑
      console.log(`[检测器] 非动态页面，使用文本检查。`);
      if (html.includes('This item was deleted') || html.includes('此项目已删除')) {
        return {
          valid: false,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'This item has been deleted.',
          reason: 'CONTENT_DELETED'
        };
      }
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link appears valid.',
        reason: 'STATIC_PAGE_VALID'
      };
    }

    // 3. 重要：这是一个动态页面，我们需要检查它的"无JavaScript"版本
    console.log(`[检测器] 检测到动态页面，正在检查无JS版本...`);
    
    // 构建"无JavaScript"版本的URL
    const noscriptUrl = url.includes('?') ? 
                       `${url}&noscript=1` : 
                       `${url}?noscript=1`;
    
    try {
      const noscriptResponse = await axios.get(noscriptUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html'
        }
      });
      
      const noscriptHtml = noscriptResponse.data;
      const totalTime = Date.now() - startTime;
      
      console.log(`[检测器] 无JS页面: 状态 ${noscriptResponse.status}, 大小 ${noscriptHtml.length} 字符, 总耗时 ${totalTime}ms`);
      
      // 4. 在"无JavaScript"页面中搜索删除证据
      // 同时检查中英文版本的删除提示
      const deletionEvidence = 
        noscriptHtml.includes('This item was deleted') ||
        noscriptHtml.includes('此项目已删除') ||
        noscriptHtml.includes('deleted files') ||
        noscriptHtml.includes('已删除的文件') ||
        noscriptHtml.includes('couldn\'t find this item') ||
        noscriptHtml.includes('找不到此项目');
      
      if (deletionEvidence) {
        console.log(`[检测器-结论] 在无JS页面中发现删除证据，链接已失效。`);
        return {
          valid: false,
          status: noscriptResponse.status,
          timestamp: new Date().toISOString(),
          message: 'This item has been deleted (checked no-JS version).',
          reason: 'CONTENT_DELETED_NOSCRIPT',
          debug: { checkedNoscript: true }
        };
      }
      
      // 5. 如果没有删除证据，检查是否有正常内容
      const hasValidContent = 
        noscriptHtml.includes('file_viewer') ||
        noscriptHtml.includes('folder_contents') ||
        noscriptHtml.includes('shared with you') ||
        noscriptHtml.includes('查看文件夹');
      
      if (hasValidContent) {
        console.log(`[检测器-结论] 无JS页面显示有效内容，链接有效。`);
        return {
          valid: true,
          status: noscriptResponse.status,
          timestamp: new Date().toISOString(),
          message: 'Link is valid (no-JS version shows content).',
          reason: 'CONTENT_VALID_NOSCRIPT',
          debug: { checkedNoscript: true }
        };
      }
      
      // 6. 如果无JS页面也看不出什么，但原始页面可访问，保守地认为有效
      console.log(`[检测器-结论] 无法从无JS页面确定状态，但原始页面可访问，设为有效。`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible, but could not verify content via no-JS method.',
        reason: 'ACCESSIBLE_BUT_UNVERIFIED',
        note: 'No-JS page did not show clear deletion or valid content markers.'
      };
      
    } catch (noscriptError) {
      // 无JS版本请求失败，回退到原始页面检查
      console.log(`[检测器] 无JS版本检查失败: ${noscriptError.message}`);
      
      // 在原始页面中做最后的关键词检查
      if (html.includes('This item was deleted') || html.includes('此项目已删除')) {
        return {
          valid: false,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'This item has been deleted.',
          reason: 'CONTENT_DELETED'
        };
      }
      
      // 如果原始页面也没有删除标记，但可访问，则视为有效
      if (response.status >= 200 && response.status < 300) {
        return {
          valid: true,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'Link is accessible, but no-JS check failed.',
          reason: 'ACCESSIBLE_NOJS_FAILED',
          debug: { noscriptError: noscriptError.message }
        };
      }
      
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: `Link returned error status ${response.status}`,
        reason: `HTTP_${response.status}`
      };
    }

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
    mode: 'noscript_detection_v2',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// 获取单个链接
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
  console.log('🚀 Dropbox 文件中心 - 无JavaScript检测版');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔍 模式: 通过检查 &noscript=1 版本进行精确检测`);
  console.log('='.repeat(50));
});
