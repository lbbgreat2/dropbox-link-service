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
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache for faster testing

/**
 * ULTIMATE Dropbox Link Validity Checker
 * Uses a multi-signal approach to determine link state.
 * 1. Checks HTTP response status and headers.
 * 2. Analyzes HTML content for failure/success indicators.
 * 3. Makes a final decision based on combined evidence.
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  let response;

  try {
    // Step 1: Attempt to fetch the page with a realistic browser header
    response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      // We accept most statuses; we'll decide validity based on content
      validateStatus: function (status) {
        return status < 500; // Don't fail on client errors (4xx)
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const html = response.data;
    const lowerHtml = html.toLowerCase();
    const checkDuration = Date.now() - startTime;

    console.log(`[Link Check] ${url} -> Status: ${response.status}, Size: ${html.length} chars, Time: ${checkDuration}ms`);

    // Step 2: Collect signals from the response
    const signals = {
      // Strong negative signals (link is broken/deleted)
      isDeleted: [
        'this item was deleted',
        'this file was deleted',
        'couldn\'t find this item',
        'the file you’re looking for couldn’t be found',
        'item is no longer available',
        'has been deleted',
        'was deleted',
        'deleted files',
        'this folder was deleted',
        'this shared file or folder'
      ].some(term => lowerHtml.includes(term.toLowerCase())),

      hasNoPermission: [
        'don’t have permission',
        'don\'t have permission',
        'you need access',
        'ask for access',
        'shared link has been disabled',
        'link is disabled',
        'no longer has access',
        'access denied'
      ].some(term => lowerHtml.includes(term.toLowerCase())),

      isNotFoundPage: [
        'error 404',
        'page not found',
        'not found',
        'doesn’t exist',
        'doesn\'t exist'
      ].some(term => lowerHtml.includes(term.toLowerCase())),

      // Strong positive signals (link is working)
      hasFileList: html.includes('folder_contents') || html.includes('files_list') || html.includes('file_list'),
      hasDownloadButton: html.includes('download_button') || html.includes('download-button') || (html.includes('download') && html.includes('data-reactid')),
      hasDropboxViewer: html.includes('data-reactid') && (html.includes('file_viewer') || html.includes('folder_viewer')),

      // HTTP Status signal
      httpStatus: response.status
    };

    // Debug log of collected signals
    console.log(`[Signals] Deleted:${signals.isDeleted}, NoPerm:${signals.hasNoPermission}, NotFnd:${signals.isNotFoundPage}, Files:${signals.hasFileList}, DnldBtn:${signals.hasDownloadButton}, Viewer:${signals.hasDropboxViewer}, HTTP:${signals.httpStatus}`);

    // Step 3: Decision Logic - Prioritize negative signals
    if (signals.isDeleted) {
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'The shared item has been deleted on Dropbox.',
        reason: 'CONTENT_DELETED',
        checkDuration: checkDuration
      };
    }

    if (signals.hasNoPermission) {
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'You do not have permission to access this item.',
        reason: 'NO_PERMISSION',
        checkDuration: checkDuration
      };
    }

    if (signals.isNotFoundPage && response.status === 404) {
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'The shared link points to a non-existent page (404).',
        reason: 'NOT_FOUND',
        checkDuration: checkDuration
      };
    }

    // Step 4: Check for positive signals of a working page
    // A working Dropbox share page typically has React markers and/or file list
    if (signals.hasDropboxViewer || signals.hasFileList || signals.hasDownloadButton) {
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and the shared content appears accessible.',
        reason: 'CONTENT_VALID',
        checkDuration: checkDuration
      };
    }

    // Step 5: Ambiguous case - No clear signals
    // If we got a 2xx status but no clear indicators, we need to be cautious.
    // Could be a loading page, a captcha, or a page we don't recognize.
    console.log(`[Warning] Ambiguous page for ${url}. No clear validity signals detected.`);
    if (response.status >= 200 && response.status < 300) {
      // 2xx status but unclear content - tentatively mark as valid but with note
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible, but content state could not be definitively verified.',
        reason: 'ACCESSIBLE_BUT_UNVERIFIED',
        checkDuration: checkDuration
      };
    } else {
      // 4xx status (e.g., 403, 404) without clear messages
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: `Link returned status ${response.status} and no recognizable content.`,
        reason: `HTTP_${response.status}`,
        checkDuration: checkDuration
      };
    }

  } catch (error) {
    const checkDuration = Date.now() - startTime;
    console.error(`[Link Check Error] ${url}:`, error.message);

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
      checkDuration: checkDuration
    };
  }
}

// Get link status (with caching and force refresh option)
async function getLinkStatus(folderId, forceRefresh = false) {
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

  // Allow shorter cache for 'test' folder to facilitate testing
  const cacheTime = folderId === 'test' ? 60000 : CACHE_DURATION; // 1 min for test, 3 min for others

  if (!forceRefresh && linkStatusCache[cacheKey] &&
    now - linkStatusCache[cacheKey].timestamp < cacheTime) {
    console.log(`[Cache] Using cached status for "${folderId}" (${Math.round((now - linkStatusCache[cacheKey].timestamp)/1000)}s old)`);
    return linkStatusCache[cacheKey];
  }

  console.log(`[Cache] Fetching fresh status for "${folderId}"`);
  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    mode: 'enhanced_multi_signal_validation',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS),
    note: 'Uses multi-signal analysis for better accuracy.'
  });
});

// Main API to get a file/folder link
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  const force = req.query.force === 'true'; // Optional force refresh parameter

  console.log(`Link requested: ${folderId} (IP: ${req.ip})`);

  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({
      error: 'Folder not found',
      message: `Unconfigured folder ID: '${folderId}'`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }

  const validity = await getLinkStatus(folderId, force);

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

  const dropboxLink = MANUAL_SHARE_LINKS[folderId];

  res.json({
    folderId,
    url: dropboxLink,
    source: 'manual_preconfigured',
    status_check: {
      valid: validity.valid,
      reason: validity.reason,
      check_duration_ms: validity.checkDuration
    },
    timestamp: new Date().toISOString()
  });
});

// Get status of all configured links
app.get('/api/links/status', async (req, res) => {
  const force = req.query.force === 'true';
  try {
    const linkStatus = {};

    const promises = Object.keys(MANUAL_SHARE_LINKS).map(async (key) => {
      linkStatus[key] = await getLinkStatus(key, force);
    });

    await Promise.all(promises);

    res.json({
      success: true,
      data: linkStatus,
      timestamp: new Date().toISOString(),
      force_refreshed: force
    });
  } catch (error) {
    console.error('Error checking link status:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking link status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Force immediate re-check of a specific link (bypasses cache)
app.get('/api/links/check/:folderId', async (req, res) => {
  const folderId = req.params.folderId;

  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({
      success: false,
      error: 'Folder not found',
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }

  try {
    const status = await getLinkStatus(folderId, true); // Force refresh
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
      note: 'Forced fresh check performed.'
    });
  } catch (error) {
    console.error(`Force check failed for ${folderId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Forced check failed',
      details: error.message
    });
  }
});

// List all available folders
app.get('/api/folders', (req, res) => {
  const folderInfo = Object.keys(MANUAL_SHARE_LINKS).map(folderId => ({
    id: folderId,
    name: getFolderName(folderId),
    url: `/api/link/${folderId}`,
    configured: true
  }));

  res.json({
    folders: folderInfo,
    count: folderInfo.length,
    timestamp: new Date().toISOString()
  });
});

// Static file service - Placed AFTER all API route definitions
app.use(express.static(path.join(__dirname, 'public')));

// Root path redirects to frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper: Get friendly folder name
function getFolderName(folderId) {
  const names = {
    'enjoy_ai': 'ENJOY AI',
    'whalesbot': 'WhalesBot',
    'test': 'Test Folder'
  };
  return names[folderId] || folderId;
}

// Handle unmatched routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      health: '/api/health',
      getLink: '/api/link/:folderId',
      linksStatus: '/api/links/status',
      forceCheck: '/api/links/check/:folderId',
      listFolders: '/api/folders',
      frontend: '/ (Frontend Page)'
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Dropbox Permanent Link Service Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Configured ${Object.keys(MANUAL_SHARE_LINKS).length} permanent links`);
  console.log(`🔍 Link Validation: ULTIMATE (Multi-Signal Analysis)`);
  console.log(`=========================================`);
  console.log(`Frontend Page: http://localhost:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Links Status: http://localhost:${PORT}/api/links/status`);
  console.log(`Test Link: http://localhost:${PORT}/api/link/test`);
  console.log(`=========================================`);
});
