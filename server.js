require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 手动配置的Dropbox永久分享链接 (最终版，仅此两项)
const MANUAL_SHARE_LINKS = {
  'enjoy_ai': 'https://www.dropbox.com/scl/fo/xhuafhd7lvzct5qou5exc/APsv0VSGbS0sL2h5q86sxrE?rlkey=wulgqtxyjifm67ymdhj881u66&st=h5z3paub&dl=0',
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0'
};

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS) // 此处应只返回 ["enjoy_ai", "whalesbot"]
  });
});

// 获取单个链接的API
app.get('/api/link/:folderId', (req, res) => {
  const folderId = req.params.folderId;
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: '请求的文件夹不存在',
      message: `文件夹ID '${folderId}' 未配置`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  res.json({
    folderId,
    url: MANUAL_SHARE_LINKS[folderId],
    timestamp: new Date().toISOString()
  });
});

// 静态文件服务 (请确保此项在所有API路由定义之后)
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Dropbox永久链接服务已启动`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔗 已配置 ${Object.keys(MANUAL_SHARE_LINKS).length} 个永久链接`);
  console.log(`📁 可用文件夹: ${Object.keys(MANUAL_SHARE_LINKS).join(', ')}`);
  console.log(`=========================================`);
});
