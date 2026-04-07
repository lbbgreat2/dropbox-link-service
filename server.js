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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Direct and Effective Link Checker
async function checkLinkValidity(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000, // 10 seconds
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const lowerHtml = html.toLowerCase();

    // CORE DETECTION: Look for the trash can / deletion page
    // 1. Keywords from the deletion page you screenshot
    const hasDeletedText = 
      lowerHtml.includes('this item was deleted') ||
      lowerHtml.includes('this file was deleted') ||
      lowerHtml.includes('was deleted') ||
      lowerHtml.includes('deleted files');

    // 2. HTML markers for the trash can icon
    const hasTrashIcon = 
      html.includes('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z') || // Common trash SVG
      html.includes('trash-can') ||
      html.includes('icon-trash');

    // 3. Other indicators of the deletion page layout
    const isDeletePage = hasDeletedText || hasTrashIcon;

    if (isDeletePage) {
      console.log(`[检测] 链接已删除: ${url.substring(0, 60)}...`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted on Dropbox.',
        reason: 'DELETED'
      };
    }

    // If not a delete page, check for signs of a valid page
    const hasValidContent = 
      html.includes('file_viewer') ||
      html.includes('folder_viewer') ||
      html.includes('download_button') ||
      (html.includes('shared with you') && html.includes('dropbox.com'));

    if (hasValidContent) {
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and accessible.',
        reason: 'VALID'
      };
    }

    // Default: accessible but unclear
    return {
      valid: true,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: 'Link is accessible.',
      reason: 'ACCESSIBLE'
    };

  } catch (error) {
    console.error(`Link check error: ${error.message}`);
    
    return {
      valid: false,
      error: error.message,
      status: error.response?.status || 0,
      timestamp: new Date().toISOString(),
      message: 'Cannot access this link.',
      reason: error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR'
    };
  }
}

// Get link status with cache
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
      now - linkStatusCache[cacheKey].timestamp < CACHE_DURATION) {
    return linkStatusCache[cacheKey];
  }

  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    mode: 'direct_deletion_detector',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// Get a specific link
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
  
  res.json({
    folderId,
    url: MANUAL_SHARE_LINKS[folderId],
    status: validity,
    timestamp: new Date().toISOString()
  });
});

// Get status of all links
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
    console.error('Error checking link status:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking link status',
      timestamp: new Date().toISOString()
    });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Dropbox File Center Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔍 Detector: Direct Delete Page Detection`);
  console.log(`=========================================`);
});
