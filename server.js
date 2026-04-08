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
 * 精确特征检测器 - 基于三个核心特征
 * 正常页面特征：
 *   - edison_atlasservlet: "files_app"
 *   - edison_page_name: "edison_browse_atlas"
 *   - yaps_project: "edison_atlasservlet.files_app-edison"
 * 
 * 删除页面特征：
 *   - edison_atlasservlet: "file_viewer"
 *   - edison_page_name: "scl_oboe_folder"
 *   - yaps_project: "edison_atlasservlet.file_viewer-edison"
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[精确检测] 检查: ${url.substring(0, 50)}...`);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[精确检测] 状态: ${response.status}, 大小: ${html.length} 字符, 耗时: ${responseTime}ms`);

    // --- 提取三个核心特征 ---
    
    // 1. 提取edison_atlasservlet
    const extractAtlasservlet = (html) => {
      // 尝试从exceptionTags中提取（格式：edison_atlasservlet:files_app）
      const tagsPattern = /edison_atlasservlet:([^",\]]+)/;
      const tagsMatch = html.match(tagsPattern);
      
      // 尝试从JSON中提取（格式："edison_atlasservlet":"files_app"）
      const jsonPattern = /"edison_atlasservlet"\s*:\s*"([^"]+)"/;
      const jsonMatch = html.match(jsonPattern);
      
      return tagsMatch ? tagsMatch[1] : (jsonMatch ? jsonMatch[1] : null);
    };
    
    // 2. 提取edison_page_name
    const extractPageName = (html) => {
      // 尝试从exceptionTags中提取（格式：edison_page_name:edison_browse_atlas）
      const tagsPattern = /edison_page_name:([^",\]]+)/;
      const tagsMatch = html.match(tagsPattern);
      
      // 尝试从JSON中提取（格式："edison_page_name":"edison_browse_atlas"）
      const jsonPattern = /"edison_page_name"\s*:\s*"([^"]+)"/;
      const jsonMatch = html.match(jsonPattern);
      
      return tagsMatch ? tagsMatch[1] : (jsonMatch ? jsonMatch[1] : null);
    };
    
    // 3. 提取yaps_project
    const extractYapsProject = (html) => {
      // 从exceptionExtras中提取（格式："yaps_project":"edison_atlasservlet.files_app-edison"）
      const pattern = /"yaps_project"\s*:\s*"([^"]+)"/;
      const match = html.match(pattern);
      
      return match ? match[1] : null;
    };
    
    const edisonAtlasservlet = extractAtlasservlet(html);
    const edisonPageName = extractPageName(html);
    const yapsProject = extractYapsProject(html);
    
    console.log(`[精确检测-特征] atlasservlet: ${edisonAtlasservlet || '未找到'}, pageName: ${edisonPageName || '未找到'}, yapsProject: ${yapsProject || '未找到'}`);
    
    // --- 基于特征进行决策 ---
    
    // 情况1: 检测到删除页面特征组合
    const isDeletedPage = 
      (edisonAtlasservlet === 'file_viewer' && edisonPageName === 'scl_oboe_folder') ||
      (yapsProject === 'edison_atlasservlet.file_viewer-edison') ||
      (edisonAtlasservlet === 'file_viewer' && yapsProject === 'edison_atlasservlet.file_viewer-edison') ||
      (edisonPageName === 'scl_oboe_folder' && yapsProject === 'edison_atlasservlet.file_viewer-edison');
    
    // 情况2: 检测到正常页面特征组合
    const isNormalPage = 
      (edisonAtlasservlet === 'files_app' && edisonPageName === 'edison_browse_atlas') ||
      (yapsProject === 'edison_atlasservlet.files_app-edison') ||
      (edisonAtlasservlet === 'files_app' && yapsProject === 'edison_atlasservlet.files_app-edison') ||
      (edisonPageName === 'edison_browse_atlas' && yapsProject === 'edison_atlasservlet.files_app-edison');
    
    console.log(`[精确检测-判定] 删除页面: ${isDeletedPage}, 正常页面: ${isNormalPage}`);
    
    // --- 决策逻辑 ---
    
    if (isDeletedPage) {
      console.log(`[精确检测-结论] 页面已删除`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted (based on page features).',
        reason: 'PAGE_FEATURES_DELETED',
        confidence: 'HIGH',
        detection_method: 'feature_match',
        features: {
          edison_atlasservlet: edisonAtlasservlet,
          edison_page_name: edisonPageName,
          yaps_project: yapsProject
        }
      };
    }
    
    if (isNormalPage) {
      console.log(`[精确检测-结论] 页面正常`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid (based on page features).',
        reason: 'PAGE_FEATURES_NORMAL',
        confidence: 'HIGH',
        detection_method: 'feature_match',
        features: {
          edison_atlasservlet: edisonAtlasservlet,
          edison_page_name: edisonPageName,
          yaps_project: yapsProject
        }
      };
    }
    
    // 情况3: 特征不完整或未找到，但页面可访问
    if (response.status >= 200 && response.status < 300) {
      console.log(`[精确检测-结论] 页面可访问但特征不完整`);
      
      // 检查是否有明确的删除提示
      const hasDeletionNotice = 
        html.includes('此项目已删除') ||
        html.includes('This item was deleted') ||
        html.includes('deleted files') ||
        html.includes('已删除的文件');
      
      if (hasDeletionNotice) {
        console.log(`[精确检测-结论] 有删除提示，设为无效`);
        return {
          valid: false,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'This item has been deleted (found deletion notice).',
          reason: 'DELETION_NOTICE',
          confidence: 'MEDIUM',
          detection_method: 'fallback_notice',
          features: {
            edison_atlasservlet: edisonAtlasservlet,
            edison_page_name: edisonPageName,
            yaps_project: yapsProject
          }
        };
      }
      
      // 检查是否有文件内容
      const hasFileContent = 
        html.includes('file_list') ||
        html.includes('folder_contents') ||
        html.includes('shared_content') ||
        html.includes('查看文件夹') ||
        html.includes('下载文件') ||
        html.includes('download');
      
      if (hasFileContent) {
        console.log(`[精确检测-结论] 有文件内容，设为有效`);
        return {
          valid: true,
          status: response.status,
          timestamp: new Date().toISOString(),
          message: 'Link contains file or folder content.',
          reason: 'FILE_CONTENT',
          confidence: 'MEDIUM',
          detection_method: 'fallback_content',
          features: {
            edison_atlasservlet: edisonAtlasservlet,
            edison_page_name: edisonPageName,
            yaps_project: yapsProject
          }
        };
      }
      
      // 默认：可访问但无法确定
      console.log(`[精确检测-结论] 页面可访问但无法确定状态`);
      return {
        valid: true, // 保守设为有效
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible but page type is unclear.',
        reason: 'ACCESSIBLE_UNKNOWN',
        confidence: 'LOW',
        detection_method: 'fallback_accessible',
        features: {
          edison_atlasservlet: edisonAtlasservlet,
          edison_page_name: edisonPageName,
          yaps_project: yapsProject
        }
      };
    }
    
    // 情况4: HTTP错误
    console.log(`[精确检测-结论] 页面返回错误状态`);
    return {
      valid: false,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: `Link returned error status ${response.status}`,
      reason: `HTTP_${response.status}`,
      confidence: 'HIGH',
      detection_method: 'http_error',
      features: {
        edison_atlasservlet: edisonAtlasservlet,
        edison_page_name: edisonPageName,
        yaps_project: yapsProject
      }
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
      reason: reason,
      confidence: 'LOW',
      detection_method: 'error_fallback',
      features: null
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
    mode: 'exact_feature_match_v2',
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
  console.log('🚀 Dropbox 文件中心 - 精确特征匹配版');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔍 模式: 基于三个核心特征的精确匹配`);
  console.log('='.repeat(50));
  console.log('📊 检测特征:');
  console.log('  ✅ 正常页面特征:');
  console.log('    - edison_atlasservlet: "files_app"');
  console.log('    - edison_page_name: "edison_browse_atlas"');
  console.log('    - yaps_project: "edison_atlasservlet.files_app-edison"');
  console.log('  🗑️ 删除页面特征:');
  console.log('    - edison_atlasservlet: "file_viewer"');
  console.log('    - edison_page_name: "scl_oboe_folder"');
  console.log('    - yaps_project: "edison_atlasservlet.file_viewer-edison"');
  console.log('='.repeat(50));
  console.log(`👉 前端访问: http://localhost:${PORT}`);
  console.log(`🩺 健康检查: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(50));
});
