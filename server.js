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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * UNIVERSAL & ROBUST Link Validator
 * Applies the SAME logic to ALL folders.
 * Uses multi-signal analysis for higher accuracy.
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[Validator] Checking: ${url.substring(0, 60)}...`);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    
    console.log(`[Validator] Response: Status ${response.status}, Size ${html.length} chars, Time ${responseTime}ms`);

    // --- Phase 1: Collect All Signals ---
    const signals = {
      // Negative Signals (suggest INVALID link)
      httpError: response.status >= 400, // 4xx or 5xx status
      hasDeletionText: /This item was deleted|deleted files|couldn['’]t find this item|item is no longer available/i.test(html),
      hasPermissionText: /don['’]t have permission|you need access|shared link has been disabled/i.test(html),
      hasNotFoundText: /error 404|page not found|doesn['’]t exist/i.test(html),

      // Positive Signals (suggest VALID link)
      httpSuccess: response.status >= 200 && response.status < 300,
      hasFileViewer: /file-viewer|folder-viewer|file_viewer|folder_viewer/i.test(html),
      hasSharedContext: /shared with you|shared by|viewing shared folder/i.test(html),
      hasDownloadElement: /download-button|download_button|download file/i.test(html),
      hasFileList: /file-list|file_list|folder-contents/i.test(html)
    };

    // Log signals for debugging
    console.log(`[Validator-Signals]`, {
      neg: `HTTPErr:${signals.httpError}, Del:${signals.hasDeletionText}, Perm:${signals.hasPermissionText}, 404:${signals.hasNotFoundText}`,
      pos: `HTTPSuccess:${signals.httpSuccess}, Viewer:${signals.hasFileViewer}, Shared:${signals.hasSharedContext}, Dnld:${signals.hasDownloadElement}, List:${signals.hasFileList}`
    });

    // --- Phase 2: Decision Logic (Same for all folders) ---
    // STRONG NEGATIVE: Any of these almost certainly means the link is dead.
    if (signals.hasDeletionText || signals.hasPermissionText || signals.hasNotFoundText) {
      console.log(`[Validator-Result] INVALID. Found strong negative evidence.`);
      let reason = 'CONTENT_DELETED';
      let message = 'This item has been deleted or is no longer accessible.';
      
      if (signals.hasPermissionText) {
        reason = 'NO_PERMISSION';
        message = 'You do not have permission to access this item.';
      } else if (signals.hasNotFoundText) {
        reason = 'NOT_FOUND';
        message = 'The requested item could not be found (404).';
      }
      
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: message,
        reason: reason
      };
    }

    // STRONG POSITIVE: Clear signs of a working shared folder/page.
    if (signals.hasFileViewer || (signals.hasSharedContext && (signals.hasDownloadElement || signals.hasFileList))) {
      console.log(`[Validator-Result] VALID. Found strong positive evidence of a working page.`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and points to an accessible Dropbox item.',
        reason: 'CONTENT_VALID'
      };
    }

    // WEAK POSITIVE: Page loaded successfully (2xx) but no super clear markers.
    // This is the common case for many simple shared pages.
    if (signals.httpSuccess) {
      console.log(`[Validator-Result] LIKELY VALID. Page loaded successfully (${response.status}), no negative signals.`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is accessible and appears to be valid.',
        reason: 'ACCESSIBLE_NO_RED_FLAGS',
        note: 'Page loaded without errors, but no definitive content markers were identified.'
      };
    }

    // HTTP ERROR: Non-2xx status code without specific error text matched above.
    if (signals.httpError) {
      console.log(`[Validator-Result] INVALID. HTTP error status ${response.status}.`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: `Dropbox returned an error (HTTP ${response.status}).`,
        reason: `HTTP_${response.status}`
      };
    }

    // FALLBACK: Should rarely happen.
    console.log(`[Validator-Result] INDETERMINATE. Using conservative default (invalid).`);
    return {
      valid: false,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: 'Unable to determine link status with confidence.',
      reason: 'INDETERMINATE'
    };

  } catch (error) {
    console.error(`[Validator-Error] ${error.message}`);
    
    let reason = 'NETWORK_ERROR';
    let message = 'Could not connect to Dropbox.';

    if (error.code === 'ECONNABORTED') {
      reason = 'TIMEOUT';
      message = 'Connection to Dropbox timed out.';
    } else if (error.response) {
      reason = `HTTP_${error.response.status}`;
      message = `Dropbox responded with an error (${error.response.status}).`;
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

// Get link status (with cache)
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

// ----- API Endpoints -----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-link-validator',
    mode: 'universal_signal_based',
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
    validity: validity,
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
  console.log('🚀 Dropbox Link Validator - Universal Signal-Based');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔍 Mode: Same robust logic for ALL ${Object.keys(MANUAL_SHARE_LINKS).length} folders`);
  console.log('='.repeat(50));
});
