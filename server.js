require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 只保留这两个文件夹
const MANUAL_SHARE_LINKS = {
  'enjoy_ai': 'https://www.dropbox.com/scl/fo/xhuafhd7lvzct5qou5exc/APsv0VSGbS0sL2h5q86sxrE?rlkey=wulgqtxyjifm67ymdhj881u66&st=h5z3paub&dl=0',
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0'
};

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    available_folders: Object.keys(MANUAL_SHARE_LINKS)
  });
});

// 获取链接
app.get('/api/link/:folderId', (req, res) => {
  const folderId = req.params.folderId;
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: '文件夹不存在',
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  res.json({
    folderId,
    url: MANUAL_SHARE_LINKS[folderId]
  });
});

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 启动
app.listen(PORT, () => {
  console.log(`✅ 服务运行中，端口: ${PORT}`);
  console.log(`📁 可用文件夹: ${Object.keys(MANUAL_SHARE_LINKS).join(', ')}`);
});