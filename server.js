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
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache for normal links

/**
 * DIRECT & ROBUST Link Checker
 * 1. Uses realistic browser headers to get the same page you see.
 * 2. Looks for EXACT text from the deletion page screenshot you provided.
 * 3. Provides detailed debug logs in Railway.
 */
async function checkLinkValidity(url) {
  const startTime = Date.now();
  try {
    console.log(`[Link Check] Fetching: ${url.substring(0, 80)}...`);

    // Key: Mimic a REAL web browser request
    const response = await axios.get(url, {
      timeout: 15000, // 15 seconds
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const html = response.data;
    const responseTime = Date.now() - startTime;
    const htmlLength = html.length;
    
    console.log(`[Link Check] Response: Status ${response.status}, Size ${htmlLength} chars, Time ${responseTime}ms`);

    // ----- CORE DETECTION: Look for the EXACT TEXT from your screenshot -----
    // Primary Evidence: The main deletion message
    const hasExactDeletionMessage = html.includes('This item was deleted');
    
    // Secondary Evidence: Supporting text commonly found on the same page
    const hasSupportingDeletionText = 
      html.includes('deleted files') ||
      html.includes('You might be able to find it') ||
      html.includes('Check deleted files') ||
      html.includes('The file you’re looking for');

    // Tertiary Evidence: Check for absence of normal file page markers
    // A normal Dropbox file/folder page has these, a deletion page does not.
    const hasNormalPageMarkers = 
      html.includes('file_viewer') ||
      html.includes('folder_viewer') ||
      html.includes('download_button') ||
      (html.includes('shared with you') && html.includes('dropbox.com'));

    // Debug Log - This is CRITICAL for diagnosis
    console.log(`[Link Check - Signals] ExactMsg:${hasExactDeletionMessage}, SupportText:${hasSupportingDeletionText}, NormalMarkers:${hasNormalPageMarkers}`);

    // ----- Decision Logic -----
    // STRONG SIGNAL: The exact phrase from your screenshot is present.
    if (hasExactDeletionMessage) {
      console.log(`[Link Check - Result] DEFINITELY DELETED. Found "This item was deleted".`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'This item has been deleted on Dropbox.',
        reason: 'CONTENT_DELETED',
        debug: { matched: 'exact_deletion_message' }
      };
    }

    // MODERATE SIGNAL: Has other deletion text but lacks normal page structure.
    if (hasSupportingDeletionText && !hasNormalPageMarkers) {
      console.log(`[Link Check - Result] LIKELY DELETED. Has deletion-related text, no normal page markers.`);
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link appears to point to a deleted or inaccessible item.',
        reason: 'LIKELY_DELETED',
        debug: { matched: 'supporting_text_no_normal_markers' }
      };
    }

    // POSITIVE SIGNAL: Has clear markers of a working file/folder page.
    if (hasNormalPageMarkers) {
      console.log(`[Link Check - Result] VALID. Contains normal file/folder page structure.`);
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link is valid and points to accessible content.',
        reason: 'CONTENT_VALID',
        debug: { matched: 'normal_page_markers' }
      };
    }

    // INCONCLUSIVE: Log a sample for debugging. This should not happen for the test link.
    const sample = html.substring(0, Math.min(300, htmlLength)).replace(/\s+/g, ' ');
    console.log(`[Link Check - Warning] INCONCLUSIVE. No clear signals. HTML Sample: ${sample}...`);
    
    // Default fallback: If we can't tell, and the page loaded (2xx status), assume it's OK but log a warning.
    // For the test case, you might want to change `valid: false` if it's consistently failing.
    if (response.status >= 200 && response.status < 300) {
      return {
        valid: true, // Conservative assumption: loaded but unrecognized
        status: response.status,
        timestamp: new Date().toISOString(),
        message: 'Link loaded but content type could not be verified.',
        reason: 'INDETERMINATE_BUT_LOADED',
        debug: { sample, note: 'No strong signals matched. Assuming valid.' }
      };
    } else {
      // Non-2xx status code
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: `Link returned an error status: ${response.status}`,
        reason: `HTTP_${response.status}`,
        debug: { sample }
      };
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[Link Check - Error] ${url}: ${error.message} (${responseTime}ms)`);
    
    let reason = 'NETWORK_ERROR';
    let message = 'Network request failed.';

    if (error.code === 'ECONNABORTED') {
      reason = 'TIMEOUT';
      message = 'Request timed out.';
    } else if (error.response) {
      reason = `HTTP_${error.response.status}`;
      message = `Dropbox returned error status: ${error.response.status}`;
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

/**
 * Get link status with caching.
 * Test folder has NO CACHE to force fresh checks every time.
 */
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

  // IMPORTANT: Disable cache for 'test' folder to see immediate results
  const cacheTime = folderId === 'test' ? 0 : CACHE_DURATION; // 0 = no cache for test

  if (cacheTime > 0 && linkStatusCache[cacheKey] && 
      (now - linkStatusCache[cacheKey].timestamp) < cacheTime) {
    console.log(`[Cache] Using cached result for "${folderId}"`);
    return linkStatusCache[cacheKey];
  }

  console.log(`[Cache] Fetching fresh status for "${folderId}"`);
  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status; // Still store, but cacheTime=0 means it's ignored next time
  return status;
}

// ----- API Endpoints -----
// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-file-center',
    mode: 'direct_text_matching_v2',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// Get a specific folder link
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

// Get status of ALL configured links
app.get('/api/links/status', async (req, res) => {
  try {
    const linkStatus = {};
    const folderIds = Object.keys(MANUAL_SHARE_LINKS);
    
    // Check all links in parallel
    const promises = folderIds.map(async (folderId) => {
      linkStatus[folderId] = await getLinkStatus(folderId);
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
  console.log('🚀 Dropbox File Center - Direct Text Matching Edition');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🔗 Configured Folders: ${Object.keys(MANUAL_SHARE_LINKS).join(', ')}`);
  console.log('='.repeat(50));
  console.log(`👉 Frontend:  http://localhost:${PORT}`);
  console.log(`🩺 Health:    http://localhost:${PORT}/api/health`);
  console.log(`📊 All Status: http://localhost:${PORT}/api/links/status`);
  console.log('='.repeat(50));
  console.log('💡 Check Railway logs for "[Link Check - Signals]" to debug.');
  console.log('='.repeat(50));
});
