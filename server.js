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

// Function to check if a single link is valid
async function checkLinkValidity(url) {
  try {
    const response = await axios.head(url, {
      timeout: 10000, // 10 second timeout
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });
    return {
      valid: true,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: 'Link is accessible'
    };
  } catch (error) {
    console.error(`Link check failed: ${url}`, error.message);
    return {
      valid: false,
      error: error.message,
      status: error.response?.status || 0,
      timestamp: new Date().toISOString(),
      message: 'Link may be invalid or unreachable'
    };
  }
}

// Get link status (with caching)
async function getLinkStatus(folderId) {
  const url = MANUAL_SHARE_LINKS[folderId];
  if (!url) {
    return { valid: false, error: 'Link not configured', timestamp: new Date().toISOString() };
  }

  const cacheKey = folderId;
  const now = Date.now();
  
  // Check cache
  if (linkStatusCache[cacheKey] && 
      now - linkStatusCache[cacheKey].timestamp < CACHE_DURATION) {
    return linkStatusCache[cacheKey];
  }

  // Re-check
  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    mode: 'manual_links_with_validation',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// Main API to get a file/folder link
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  
  console.log(`Link requested: ${folderId} (IP: ${req.ip})`);
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: 'Folder not found',
      message: `Unconfigured folder ID: '${folderId}'`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  const dropboxLink = MANUAL_SHARE_LINKS[folderId];
  
  res.json({
    folderId,
    url: dropboxLink,
    source: 'manual_preconfigured',
    note: 'This is a manually generated and pre-configured Dropbox permanent sharing link.',
    timestamp: new Date().toISOString()
  });
});

// Get status of all configured links
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
      timestamp: new Date().toISOString(),
      cache: Object.keys(linkStatusCache).length > 0
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
    mode: 'manual_preconfigured_links',
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
  console.log(`🔍 Link Validation: Simple Mode (Format Check)`);
  console.log(`=========================================`);
  console.log(`Frontend Page: http://localhost:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Links Status: http://localhost:${PORT}/api/links/status`);
  console.log(`Test Link: http://localhost:${PORT}/api/link/test`);
  console.log(`=========================================`);
});
