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
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * ULTIMATE DETECTOR v3 - 解决“页面伪装”问题
 * 策略：结合请求头伪装 + 内容深度验证
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[Detector] 检测: ${url.substring(0, 60)}...`);

    // 关键：使用与您浏览器几乎一致的请求头
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9', // 明确要求英文页面
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[Detector] 响应: 状态${response.status}, 大小${html.length}字符, 耗时${responseTime}ms`);

    // --- 阶段1: 寻找删除页面的“铁证” ---
    const deletionProof = {
      // 1. 主标题 (来自您的截图)
      hasExactMessage: html.includes('This item was deleted'),
      // 2. 辅助描述 (来自您的截图)
      hasDescription: html.includes('You might be able to find it in your deleted files'),
      // 3. 按钮文字 (来自您的截图)
      hasButtonText: html.includes('Check deleted files'),
      // 4. 垃圾桶图标的SVG路径 (常见)
      hasTrashSvg: html.includes('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z')
    };

    // --- 阶段2: 检查“看起来正常”的页面标记 ---
    const normalPageIndicators = {
      // 这些是Dropbox正常页面的结构标记
      hasFileViewer: html.includes('file_viewer'),
      hasFolderViewer: html.includes('folder_viewer'),
      hasReactId: html.includes('data-reactid'),
      // 这些是正常页面应有的“实质内容”
      hasDownloadButton: /download-?button/i.test(html),
      hasFileList: /file-?list|folder-?contents/i.test(html),
      hasSharedText: html.includes('shared with you') || html.includes('shared by'),
      hasActualFileName: /\.(pdf|docx?|xlsx?|pptx?|jpg|png|mp4|zip)/i.test(html)
    };

    // 调试输出
    console.log(`[Detector-证据] 删除痕迹: 标题=${deletionProof.hasExactMessage}, 描述=${deletionProof.hasDescription}, 按钮=${deletionProof.hasButtonText}`);
    console.log(`[Detector-证据] 正常标记: 查看器=${normalPageIndicators.hasFileViewer||normalPageIndicators.hasFolderViewer}, 下载按钮=${normalPageIndicators.hasDownloadButton}, 文件列表=${normalPageIndicators.hasFileList}, 具体文件=${normalPageIndicators.hasActualFileName}`);

    // --- 决策逻辑 ---
    // 1. 如果找到任何删除的铁证，直接判为无效
    if (deletionProof.hasExactMessage || deletionProof.hasDescription || deletionProof.hasButtonText) {
      console.log(`[Detector-结论] 确认为删除页面。`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted on Dropbox.',
        reason: 'CONTENT_DELETED',
        debug: { matched: 'deletion_proof' }
      };
    }

    // 2. 检查“页面伪装”情况
    // 如果页面有正常页面的结构标记（如file_viewer），但没有实质内容（如下载按钮、文件列表）
    // 这很可能就是您遇到的“伪装删除页”
    const hasStructure = normalPageIndicators.hasFileViewer || normalPageIndicators.hasFolderViewer || normalPageIndicators.hasReactId;
    const hasSubstance = normalPageIndicators.hasDownloadButton || normalPageIndicators.hasFileList || normalPageIndicators.hasActualFileName;
    
    if (hasStructure && !hasSubstance) {
      console.log(`[Detector-结论] 疑似“伪装页面”。有结构无内容，判为无效。`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link structure suggests a deleted or inaccessible page.',
        reason: 'LIKELY_DELETED_NO_CONTENT',
        debug: { hasStructure, hasSubstance }
      };
    }

    // 3. 如果既有结构又有实质内容，则是真正的有效页面
    if (hasSubstance) {
      console.log(`[Detector-结论] 确认为有效文件页面。`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and points to accessible content.',
        reason: 'CONTENT_VALID_WITH_SUBSTANCE',
        debug: { hasSubstance }
      };
    }

    // 4. 如果既无删除证据，也无明确的有效内容，则根据HTTP状态码判断
    if (response.status >= 200 && response.status < 300) {
      console.log(`[Detector-结论] 页面可访问但无法确定类型，保守判为有效。`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible but content type is unclear.',
        reason: 'ACCESSIBLE_UNKNOWN_TYPE',
        debug: { note: 'No definitive signals found' }
      };
    } else {
      // 非2xx状态码
      console.log(`[Detector-结论] 页面返回错误状态。`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: `Link returned error status ${response.status}.`,
        reason: `HTTP_${response.status}`
      };
    }

  } catch (error) {
    console.error(`[Detector-错误] ${error.message}`);
    
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

// Get link status (with cache disabled for 'test')
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

  // 对test文件夹禁用缓存
  const cacheTime = folderId === 'test' ? 0 : CACHE_DURATION;

  if (cacheTime > 0 && linkStatusCache[cacheKey] && 
      (now - linkStatusCache[cacheKey].timestamp) < cacheTime) {
    return linkStatusCache[cacheKey];
  }

  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// ----- API Endpoints -----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-file-center',
    version: 'anti-camouflage-v3',
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
    console.error('[API Error] /api/links/status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check link statuses.',
      timestamp: new Date().toISOString()
    });
  }
});

// ----- Serve Frontend -----
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Dropbox 文件中心 - 反伪装检测版');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔍 模式: 结构+内容双重验证`);
  console.log('='.repeat(50));
});
