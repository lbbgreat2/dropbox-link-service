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
 * 基于PAGE_INIT_DATA特征的状态检测器
 * 核心原理：通过分析Dropbox页面中的PAGE_INIT_DATA对象特征来识别页面状态
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[特征检测器] 开始检查: ${url.substring(0, 50)}...`);

    // 获取页面HTML
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[特征检测器] 响应: 状态 ${response.status}, 大小 ${html.length} 字符, 耗时 ${responseTime}ms`);

    // --- 策略1: 字符串搜索法 ---
    const strategy1 = detectByStringSearch(html);
    
    // --- 策略2: 正则表达式法 ---
    const strategy2 = detectByRegex(html);
    
    // --- 策略3: 特征组合法 ---
    const strategy3 = detectByFeatureCombination(html);
    
    console.log(`[特征检测器-策略结果] 策略1:${strategy1}, 策略2:${strategy2}, 策略3:${strategy3}`);
    
    // --- 综合决策逻辑 ---
    const scores = {
      deleted: 0,
      normal: 0,
      unknown: 0
    };
    
    // 统计各策略结果
    [strategy1, strategy2, strategy3].forEach(result => {
      scores[result]++;
    });
    
    console.log(`[特征检测器-得分] 删除:${scores.deleted}, 正常:${scores.normal}, 未知:${scores.unknown}`);
    
    // 决策规则：至少有两个策略给出相同结论
    if (scores.deleted >= 2) {
      console.log(`[特征检测器-结论] 高置信度：页面已删除`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted (based on PAGE_INIT_DATA features).',
        reason: 'PAGE_FEATURE_DELETED',
        confidence: 'HIGH',
        detection_method: 'page_feature_analysis'
      };
    } else if (scores.normal >= 2) {
      console.log(`[特征检测器-结论] 高置信度：页面正常`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and contains normal file content.',
        reason: 'PAGE_FEATURE_NORMAL',
        confidence: 'HIGH',
        detection_method: 'page_feature_analysis'
      };
    } else if (scores.deleted === 1 && scores.normal === 0 && scores.unknown === 2) {
      // 只有一个策略检测到删除，但其他策略未知
      console.log(`[特征检测器-结论] 中等置信度：可能已删除`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item appears to be deleted (partial feature match).',
        reason: 'PAGE_FEATURE_POSSIBLY_DELETED',
        confidence: 'MEDIUM',
        detection_method: 'page_feature_analysis'
      };
    } else if (scores.normal === 1 && scores.deleted === 0 && scores.unknown === 2) {
      // 只有一个策略检测到正常，但其他策略未知
      console.log(`[特征检测器-结论] 中等置信度：可能正常`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link appears to be valid (partial feature match).',
        reason: 'PAGE_FEATURE_POSSIBLY_NORMAL',
        confidence: 'MEDIUM',
        detection_method: 'page_feature_analysis'
      };
    } else {
      // 无法确定，回退到HTTP状态检查
      console.log(`[特征检测器-结论] 置信度低：无法确定页面状态`);
      
      if (response.status >= 200 && response.status < 300) {
        return {
          valid: true,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'Link is accessible, but page type could not be determined.',
          reason: 'ACCESSIBLE_BUT_UNDETERMINED',
          confidence: 'LOW',
          detection_method: 'http_status_only'
        };
      } else {
        return {
          valid: false,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: `Link returned error status ${response.status}`,
          reason: `HTTP_${response.status}`,
          confidence: 'LOW',
          detection_method: 'http_status_only'
        };
      }
    }

  } catch (error) {
    console.error(`[特征检测器-错误] ${error.message}`);
    
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
      reason: reason,
      confidence: 'LOW',
      detection_method: 'error_fallback'
    };
  }
}

/**
 * 策略1: 字符串搜索法
 * 搜索HTML中是否同时包含特定字符串特征
 */
function detectByStringSearch(html) {
  // 删除页面特征
  const deletedPageFeatures = [
    '"file_viewer"',  // edison_atlasservlet
    'scl_oboe_folder' // edison_page_name
  ];
  
  // 正常页面特征
  const normalPageFeatures = [
    '"files_app"',        // edison_atlasservlet
    'edison_browse_atlas' // edison_page_name
  ];
  
  // 检查删除页面特征
  const deletedMatches = deletedPageFeatures.filter(feature => html.includes(feature));
  const deletedMatchCount = deletedMatches.length;
  
  // 检查正常页面特征
  const normalMatches = normalPageFeatures.filter(feature => html.includes(feature));
  const normalMatchCount = normalMatches.length;
  
  console.log(`[策略1-字符串搜索] 删除特征匹配: ${deletedMatchCount}/${deletedPageFeatures.length}, 正常特征匹配: ${normalMatchCount}/${normalPageFeatures.length}`);
  
  if (deletedMatchCount >= 2) {
    return 'deleted';
  } else if (normalMatchCount >= 2) {
    return 'normal';
  } else {
    return 'unknown';
  }
}

/**
 * 策略2: 正则表达式法
 * 使用正则表达式匹配PAGE_INIT_DATA中的特征值
 */
function detectByRegex(html) {
  // 定义特征正则表达式
  const featurePatterns = {
    edison_atlasservlet: /"edison_atlasservlet"\s*:\s*"([^"]+)"/i,
    edison_page_name: /"edison_page_name"\s*:\s*"([^"]+)"/i,
    yaps_project: /"yaps_project"\s*:\s*"([^"]+)"/i
  };
  
  const features = {};
  let matchCount = 0;
  
  // 提取特征
  for (const [key, pattern] of Object.entries(featurePatterns)) {
    const match = html.match(pattern);
    if (match && match[1]) {
      features[key] = match[1];
      matchCount++;
    }
  }
  
  console.log(`[策略2-正则匹配] 匹配到 ${matchCount} 个特征:`, features);
  
  if (matchCount === 0) {
    return 'unknown';
  }
  
  // 删除页面特征组合
  const deletedFeatureCombinations = [
    { edison_atlasservlet: 'file_viewer', edison_page_name: 'scl_oboe_folder' },
    { yaps_project: 'edison_atlasservlet.file_viewer-edison' }
  ];
  
  // 正常页面特征组合
  const normalFeatureCombinations = [
    { edison_atlasservlet: 'files_app', edison_page_name: 'edison_browse_atlas' },
    { yaps_project: 'edison_atlasservlet.files_app-edison' }
  ];
  
  // 检查删除页面特征
  let deletedScore = 0;
  for (const combo of deletedFeatureCombinations) {
    let matches = 0;
    for (const [key, value] of Object.entries(combo)) {
      if (features[key] === value) {
        matches++;
      }
    }
    if (matches === Object.keys(combo).length) {
      deletedScore++;
    }
  }
  
  // 检查正常页面特征
  let normalScore = 0;
  for (const combo of normalFeatureCombinations) {
    let matches = 0;
    for (const [key, value] of Object.entries(combo)) {
      if (features[key] === value) {
        matches++;
      }
    }
    if (matches === Object.keys(combo).length) {
      normalScore++;
    }
  }
  
  console.log(`[策略2-得分] 删除:${deletedScore}, 正常:${normalScore}`);
  
  if (deletedScore > normalScore) {
    return 'deleted';
  } else if (normalScore > deletedScore) {
    return 'normal';
  } else {
    return 'unknown';
  }
}

/**
 * 策略3: 特征组合法
 * 提取页面中的关键特征组合，计算得分
 */
function detectByFeatureCombination(html) {
  // 特征权重定义
  const featureWeights = {
    // 删除页面特征
    deleted: {
      'file_viewer': 3,  // edison_atlasservlet
      'scl_oboe_folder': 3,  // edison_page_name
      'scl_oboe_folder_bundle_amd': 2,  // 模块路径
      'edison_atlasservlet.file_viewer-edison': 2  // yaps_project
    },
    // 正常页面特征
    normal: {
      'files_app': 3,  // edison_atlasservlet
      'edison_browse_atlas': 3,  // edison_page_name
      'edison_browse_atlas_bundle_amd': 2,  // 模块路径
      'edison_atlasservlet.files_app-edison': 2  // yaps_project
    }
  };
  
  // 计算得分
  let deletedScore = 0;
  let normalScore = 0;
  
  // 检查删除页面特征
  for (const [feature, weight] of Object.entries(featureWeights.deleted)) {
    if (html.includes(feature)) {
      deletedScore += weight;
      console.log(`[策略3] 删除特征匹配: ${feature} (+${weight})`);
    }
  }
  
  // 检查正常页面特征
  for (const [feature, weight] of Object.entries(featureWeights.normal)) {
    if (html.includes(feature)) {
      normalScore += weight;
      console.log(`[策略3] 正常特征匹配: ${feature} (+${weight})`);
    }
  }
  
  console.log(`[策略3-得分] 删除:${deletedScore}, 正常:${normalScore}`);
  
  // 决策阈值
  const THRESHOLD = 3;
  
  if (deletedScore >= THRESHOLD && deletedScore > normalScore) {
    return 'deleted';
  } else if (normalScore >= THRESHOLD && normalScore > deletedScore) {
    return 'normal';
  } else {
    return 'unknown';
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
    mode: 'page_feature_detection_v1',
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
  console.log('🚀 Dropbox 文件中心 - 页面特征检测版');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔍 模式: 基于PAGE_INIT_DATA特征的页面状态识别`);
  console.log('='.repeat(50));
  console.log('📊 检测策略:');
  console.log('  1. 字符串搜索法 - 搜索关键特征字符串');
  console.log('  2. 正则表达式法 - 匹配特征值组合');
  console.log('  3. 特征组合法 - 加权得分系统');
  console.log('='.repeat(50));
});
