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

// 手动配置的Dropbox永久分享链接 - 移除enjoy_ai
const MANUAL_SHARE_LINKS = {
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0',
  'test': 'https://www.dropbox.com/scl/fo/jfm93u99iubtds6w4vg4w/AO7Ht-rwUHc7W5oaojNep2o?rlkey=bjvwfmx9tq8oa6v67iw3zyapp&st=o03vu2pi&dl=0'
  // enjoy_ai 已完全移除，改为分级菜单结构
};

// ============ ENJOY AI 分级链接配置 ============
// 这里用嵌套结构替代原来的扁平链接
const ENJOY_AI_HIERARCHICAL_LINKS = {
  '2025': {
    'battle_of_tribes': {
      'competition_rule': 'https://www.dropbox.com/scl/fi/pbj8vegug489ur8bwpl70/Battle-of-Tribes_Competition-Rule.pdf?rlkey=3z4eeul5yxsx6nxipy4r4dlen&st=hhxyouae&dl=0', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/259f0847zk3vu32h7cz0g/Battle-of-Tribes_Field-Setup-Guide.pdf?rlkey=j9d8ldm5pc3h7fj60pjcy09xq&st=pfs252wz&dl=0'  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'cyber_city': {
      'competition_rule': 'https://www.dropbox.com/scl/fi/r0jo3jkwlgeh7k8p0o7w6/Cyber-City_Competition-Rule.pdf?rlkey=cqwjdgtyy7csx1eckv8ga3q4u&st=nfbsytf3&dl=0', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/ysvasz9s1disf8zogwwl2/Cyber-City_Field-Setup-Guide.pdf?rlkey=8xea6hi4mmgov6dn5x446u5gd&st=gf8zwt2f&dl=0'  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'geometric_forest': {
      'competition_rule': 'https://www.dropbox.com/scl/fi/an9zebpfmqwr3xyby997n/Geometric-Forest_Competition-Rule.pdf?rlkey=femmzsm1boubkwinz5kjfjpe5&st=mxoc7mgj&dl=0', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/bzhlxz9zt27v7d91wyrzd/Geometric-Forest_Field-Setup-Guide.pdf?rlkey=y6q032umevx2i9d27ezs09z5k&st=eyrrviuq&dl=0'  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'sample_solution': {
      'competition_rule': '', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': ''  // TODO: 请在此处替换为实际的Dropbox链接
    },
    'skyline_adventures': {
      'competition_rule': 'https://www.dropbox.com/scl/fi/ckmmfz1485hyp6ci0whtv/Skyline-Adventures_Competition-Rule.pdf?rlkey=g3x7abbi7g1a0id0omqtv4wor&st=18c7bdqs&dl=0', // TODO: 请在此处替换为实际的Dropbox链接
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/qe5178gkwy975vpf0qutw/Skyline-Adventures_Field-Setup-Guide.pdf?rlkey=rpz2kbnby7udqp8moen05o980&st=rpq6hdu3&dl=0'  // TODO: 请在此处替换为实际的Dropbox链接
    }
  },
  '2026': {
  'drone_cup': {
    'parts_list': 'https://www.dropbox.com/scl/fi/2cokg585k9ayyu41mykun/EA-P10-25-PART-LIST.pdf?rlkey=rl87rg1cn11lbyuhngaicugee&st=uqv13tvs&dl=0',
    'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/03gcdquvrs08ou70di1lp/ENJOY-AI-2026-Drone-Cup-Rules-Scoring-Sheet.pdf?rlkey=vu6l2n0gfqk58yls3o7jcrgeg&st=ytvxlbfa&dl=0'
  },
  'mining_expedition': {
    'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/9f96q35r2nbt95nm2t8pc/2026ver.-Mining-Expedition-Competition-Rule-1.pdf?rlkey=dv3x7qo7s3vfo0lvbh2thdfoq&st=m77t5ahp&dl=0',
    'field_setup_guide': 'https://www.dropbox.com/scl/fi/mzy44dpqa97chaq6csgio/Mining-Expedition-Competition-Field-Setup-Guide.pdf?rlkey=o7e4djjzfw0vhyiwuvdtjzojh&st=oisb7be2&dl=0',
    'parts_list': 'https://www.dropbox.com/scl/fi/6pk2fecja7xlmhuo1l3c1/EA-P4-25-Building-Parts-List.pdf?rlkey=ioteom2itpe5axbwejeqtnwm7&st=81y1121l&dl=0',
    'video_full_competition_round': '', // TODO: 请在此处替换为实际的Dropbox链接
    'program_reference': '', // TODO: 请在此处替换为实际的Dropbox链接
    'parts_list2': '' // TODO: 请在此处替换为实际的Dropbox链接
  },
  'inventions_trail': {
    'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/5qprcf8ezy26gqpey5tnp/compeition-rule.pdf?rlkey=ktvu3885ph0vw8yr6b2d1pr2a&st=qmiin83o&dl=0',
    'parts_list': 'https://www.dropbox.com/scl/fi/4tb83c3w9zzjfhfxz56ux/EA-P1-26-EN-Parts-List-260212.pdf?rlkey=gcj1tcf0q0lku4tigv2gka13e&st=mmaq57g7&dl=0',
    'video_competition_rules': 'https://www.dropbox.com/scl/fi/rjhc2q9cddevj2h8dwfqr/ENJOY-AI-2026-Inventions-Trail-Competition-Rules.mp4?rlkey=2sr8ixwpx93g6awtcc4tklv0r&st=b0ws6wk4&dl=0',
    'video_full_competition_round': 'https://www.dropbox.com/scl/fi/318zktxprqe8dv9cpk6tr/Enjoy-AI-2026-Inventions-Trail-full-competition-round.mp4?rlkey=sw8ccmwoylc28s96te6luvenf&st=n4t77o73&dl=0',
    'field_setup_guide': 'https://www.dropbox.com/scl/fo/uv1aqaoopgly0tyuyit4i/AFuwkxQHWJ9vW22o75xCdJE?rlkey=9p52ziaha7snk8lmthpwtdh9u&st=kvxtyiic&dl=0',
    'product_list': 'https://www.dropbox.com/scl/fo/7oj3k7pc0tk4whhw7twjx/AKvxOsp6Is0_lYh0orNvrms?rlkey=8tjej12f7vkka9zjmfhvcy6zo&st=wm1m4bi0&dl=0',
    'program_reference': 'https://www.dropbox.com/scl/fo/lqj1yp7e15w760sgg4oo1/AJQmPDtNZSocYvMg88rlAhs?rlkey=0009ly68xuzkp5dvcjl6s1ipa&st=1w7bjhor&dl=0',
    'solution_construction_manual': 'https://www.dropbox.com/scl/fi/k4e3nc9nb738e1wzl054p/Enjoy-AI-2026-Inventions-Trail-Competition-Solution-Demonstration-Manual.pdf?rlkey=ehr2zgwafwwjpxrevqnsgtu8y&st=5tckg3ay&dl=0',
    'air_pump_user_manual': 'https://www.dropbox.com/scl/fi/r8irw71cbf3bz2z2mdkgg/Air-pump-user-manual.pdf?rlkey=e0koldinv5qozowf7gtca88by&st=96p9s3ze&dl=0'
  },
  'battle_of_stars': {
    'competition_rules': 'https://www.dropbox.com/scl/fo/p8wld9w2b7bzy7znpmz3q/AMxFA6RSBnu6HF8K2kz62eM?rlkey=zmzvdoku6q1uxwpk90mtv44g6&st=o3zp4629&dl=0',
    'field_setup_guide': 'https://www.dropbox.com/scl/fi/pixz66quabudq32b56krw/ENJOY-AI-2026-Battle-of-stars-field-setup-guide.pdf?rlkey=qc5hnk5objvm0h5b0ibah2qk1&st=qolnnqdp&dl=0',
    'parts_list': 'https://www.dropbox.com/scl/fi/f8u1nm8d7yus903srm8v2/EA-P2-26-EN-Parts-List.pdf?rlkey=uhrtvyp8vqdmj9vvh5bhm85x6&st=dpjgg35w&dl=0',
    'video_competition_rules': 'https://www.dropbox.com/scl/fi/mauxwany05050stfngdl0/2026-Battle-of-Stars-Competition-Rules.mp4?rlkey=ljg7amefvy8dgqe19nl66p73x&st=0lmk4erc&dl=0',
    'video_full_competition_round': 'https://www.dropbox.com/scl/fi/2qr9nquqz1byy2ikjhcw1/2026-Battle-of-Stars-Full-Competition-Round.mp4?rlkey=0ofvjxgjb6rit7vb48nscvj0x&st=0ubxut8k&dl=0',
    'controller_user_manual': 'https://www.dropbox.com/scl/fi/d9x3wpqd6l65psiv9ohu0/MC102-User-Guide-V1.1_241014.pdf?rlkey=qseqp57zl99iaq4510paaqxes&st=3n1nm6u5&dl=0',
    'product_list': 'https://www.dropbox.com/scl/fi/y0mabux20g4dxmcsinfwu/AI-Module-3s-Quick-Start-Product-List.pdf?rlkey=2voj08i6skowk4o3nrcz5s0ax&st=5ag84g0c&dl=0',
    'program_reference': 'https://www.dropbox.com/scl/fo/70u4d6crex7mmkhp7zxms/ALj9a5V5xnF8RN2JkLHXGj4?rlkey=c8m8mi36wlw3jj8tiyz2nb9le&st=mdaj8uvv&dl=0',
    'solution_construction_manual': 'https://www.dropbox.com/scl/fi/pkuncpsh5jzittha4u1ms/Battle-of-stars-Solution-Construction-Manual.pdf?rlkey=wb8pbqdbzn9ba6f6gtaui3cus&st=p33nx0kf&dl=0'
  },
  'skyline_adventure': {
    'competition_rule': 'https://www.dropbox.com/scl/fo/gl3pgideoqq84z6qw1fjs/AFjsE7V6zI7bYXzPusZbpa4?rlkey=auihwdlhy1z5wulhn4851w6et&st=ph4xrig8&dl=0',
    'field_setup_guide': 'https://www.dropbox.com/scl/fi/as7b7huhcqicgio4anjwq/ENJOY-AI-2026-Skyline-Adventures-Competition-Field-up-Guide.pdf?rlkey=epdkryoxv4orf2pccdjn83ny9&st=0wgovay3&dl=0',
    'parts_list': 'https://www.dropbox.com/scl/fo/vhuq1z0hfgi72nl7wmro5/AMsZGJ6QhHCDW-K_Rm6GlL8?rlkey=m8jy5d4gebr7soii8vyti70j6&st=eygt0mpa&dl=0',
    'video_competition_rules': 'https://www.dropbox.com/scl/fi/c99jphn5fcba0pf5thaed/ENJOY-AI-2026-Skyline-Adventures-Competition-Rules.mp4?rlkey=33sk9ljligp4mosig6ercvumc&st=crqfjm7z&dl=0',
    'video_full_competition_round': 'https://www.dropbox.com/scl/fi/z3wrh67ikct9j7u872rla/2026-Skyline-Adventure-Full-Competition-Round.mp4?rlkey=sgwghmpnb1xzunycu49140ud4&st=udn2pgvb&dl=0',
    'controller_user_manual': 'https://www.dropbox.com/scl/fi/0pyomgux7z3ztujpzj5d6/WhalesBot-Eagle_User-Guide_V1.0.pdf?rlkey=rcl7bq0nk9wawm28mt1sgc1k4&st=0laml4cd&dl=0',
    'product_list': 'https://www.dropbox.com/scl/fi/85yhg5c0msq2ukij9fjkk/Eagle-1003-Quick-Start-Product-List.pdf?rlkey=pa3zyk23phgw8993892m67kvn&st=t76v3q5u&dl=0',
    'program_reference': 'https://www.dropbox.com/scl/fo/q6eu9ww622umlxxjoj5e3/AJeabNJgkxllD8T2OGSbvYw?rlkey=o7ve809qywc2otl8pw65zd84a&st=uv4uc0kg&dl=0'
  },
  'ancient_civilizations': {
    'competition_rules_field_setup_guide': 'https://www.dropbox.com/scl/fo/abnf2uufaifqhbr0mmplb/AHITzxaVbJ9qhSVuhl1mbwY?rlkey=bt61eqfrwsvofpkzacf2g42kx&st=qjvrvbh1&dl=0',
    'parts_list': 'https://www.dropbox.com/scl/fi/gppfrtuhsdybsfz222xu7/EA-Y1-26-EN-parts-list.pdf?rlkey=3o407jonxacdrc86wj7khxw1h&st=7efo5qic&dl=0',
    'video_competition_rules': 'https://www.dropbox.com/scl/fi/jtb4vilmbdv7teovma13q/ENJOY-AI-2026-Ancient-Civilizations-Full-Competition-Round.mp4?rlkey=hzr3f43yzcrybhq8kseaium7p&st=05vbykir&dl=0',
    'video_full_competition_round': 'https://www.dropbox.com/scl/fi/4ieo2ia6vmlxubl5ydza0/2026-Ancient-civilization-Full-Competition-Round.mp4?rlkey=lyjjv6gtts1mdny826ghyy4t8&st=x2los35r&dl=0',
    'product_list': 'https://www.dropbox.com/scl/fi/vodwge1rqu635ufkloddo/U20-pro-Part-List.png?rlkey=h1s0hapcsmhxsyz3y229ttnuo&st=xv2kxpba&dl=0',
    'program_reference': 'https://www.dropbox.com/scl/fo/0riwu037fopipwxu2g69b/AMhRKMnD4YvQKy-NYvahGRo?rlkey=o3jdtjg6ede669s2twmt8i7a6&st=n3o3csff&dl=0',
    'solution_construction_manual': 'https://www.dropbox.com/scl/fo/ux6ed7i9hxs63hxg7diai/AOfvq1fUQtdlR9gYnKDew-c?rlkey=v8b0xrki0ivmcd6xwis6lk0s9&st=xrsqfkwm&dl=0'
  }
}

// 链接状态缓存
let linkStatusCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 检测单个链接是否有效的函数 (增强版)
async function checkLinkValidity(url) {
  try {
    // 发送GET请求，获取页面内容以便分析
    const response = await axios.get(url, {
      timeout: 15000, // 15秒超时
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500; // 接受除服务器错误外的所有状态码
      }
    });
    
    const htmlContent = response.data;
    const isDropboxPage = htmlContent.includes('dropbox.com') || htmlContent.includes('Dropbox');
    
    if (!isDropboxPage) {
      // 如果不是Dropbox页面，可能重定向到了错误页
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: '链接未指向Dropbox有效页面',
        reason: 'NOT_DROPBOX'
      };
    }
    
    // 检查是否包含常见的失效提示关键词 (中英文)
    const failureIndicators = [
      '此项目已删除',
      '该项目已删除',
      '已删除',
      '不存在',
      'not found',
      'deleted',
      'removed',
      'no longer available',
      '您没有访问权限',
      'don\'t have permission',
      '找不到此文件',
      '文件不存在',
      'This file was deleted',
      'The file you\'re looking for',
      'couldn\'t be found',
      '已取消分享',
      '分享已取消',
      'shared link has been disabled',
      'shared link is not valid'
    ];
    
    const isContentDeleted = failureIndicators.some(indicator => 
      htmlContent.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (isContentDeleted) {
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: '链接指向的内容可能已被删除或无权访问',
        reason: 'CONTENT_DELETED_OR_NO_PERMISSION'
      };
    }
    
    // 额外检查：Dropbox特定的成功标识
    const successIndicators = [
      '正在加载',
      'loading',
      '查看文件夹',
      'view folder',
      '下载',
      'download',
      '文件',
      'files',
      '文件夹',
      'folder'
    ];
    
    const hasSuccessIndicator = successIndicators.some(indicator =>
      htmlContent.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasSuccessIndicator) {
      return {
        valid: true,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: '链接内容有效'
      };
    }
    
    // 默认情况下，如果页面是Dropbox但没有明显失败或成功标识，我们假设有效
    return {
      valid: true,
      status: response.status,
      timestamp: new Date().toISOString(),
      message: '链接可访问',
      note: '未检测到明确的有效性标识，但页面可访问'
    };
    
  } catch (error) {
    console.error(`链接检测失败: ${url}`, error.message);
    
    // 根据错误类型提供更具体的失效原因
    let reason = 'NETWORK_ERROR';
    let message = '网络请求失败';
    
    if (error.code === 'ECONNABORTED') {
      reason = 'TIMEOUT';
      message = '请求超时';
    } else if (error.response) {
      reason = `HTTP_${error.response.status}`;
      message = `服务器返回错误: ${error.response.status}`;
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

// 获取链接状态（带缓存）
async function getLinkStatus(folderId) {
  const url = MANUAL_SHARE_LINKS[folderId];
  if (!url) {
    return { 
      valid: false, 
      error: '链接未配置', 
      timestamp: new Date().toISOString(),
      reason: 'NOT_CONFIGURED'
    };
  }

  const cacheKey = folderId;
  const now = Date.now();
  
  // 检查缓存
  if (linkStatusCache[cacheKey] && 
      now - linkStatusCache[cacheKey].timestamp < CACHE_DURATION) {
    return linkStatusCache[cacheKey];
  }

  // 重新检测
  const status = await checkLinkValidity(url);
  linkStatusCache[cacheKey] = status;
  return status;
}

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dropbox-permanent-link-service',
    mode: 'manual_links_with_validation',
    timestamp: new Date().toISOString(),
    available_folders: Object.keys(MANUAL_SHARE_LINKS),
    hierarchical_links_available: true
  });
});

// 获取链接的主要API
app.get('/api/link/:folderId', async (req, res) => {
  const folderId = req.params.folderId;
  
  console.log(`请求链接: ${folderId} (IP: ${req.ip})`);
  
  if (!MANUAL_SHARE_LINKS[folderId]) {
    return res.status(404).json({ 
      error: '文件夹不存在',
      message: `未配置的文件夹ID: '${folderId}'`,
      available_ids: Object.keys(MANUAL_SHARE_LINKS)
    });
  }
  
  // 检测链接是否有效
  const validity = await getLinkStatus(folderId);
  
  if (!validity.valid) {
    return res.status(503).json({
      error: '当前文件链接已失效',
      code: 'LINK_EXPIRED',
      status: validity.status,
      details: validity.error,
      timestamp: new Date().toISOString()
    });
  }
  
  const dropboxLink = MANUAL_SHARE_LINKS[folderId];
  
  res.json({
    folderId,
    url: dropboxLink,
    source: 'manual_preconfigured',
    note: '此链接为手动生成并预配置的Dropbox永久分享链接',
    timestamp: new Date().toISOString()
  });
});

// 新增：获取ENJOY AI分级链接结构
app.get('/api/hierarchical/enjoy_ai', (req, res) => {
  res.json({
    success: true,
    data: ENJOY_AI_HIERARCHICAL_LINKS,
    timestamp: new Date().toISOString(),
    note: '分级链接结构，请通过 /api/hierarchical/link 端点获取具体链接'
  });
});

// 新增：获取分级链接的具体文档
app.get('/api/hierarchical/link', async (req, res) => {
  const { year, project, docType } = req.query;
  
  if (!year || !project || !docType) {
    return res.status(400).json({
      error: '缺少必要参数',
      message: '需要year, project, docType参数',
      example: '/api/hierarchical/link?year=2025&project=battle_of_tribes&docType=competition_rule',
      available_years: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS)
    });
  }
  
  // 检查年份参数有效性
  if (!ENJOY_AI_HIERARCHICAL_LINKS[year]) {
    return res.status(404).json({
      error: '年份不存在',
      available_years: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS)
    });
  }
  
  // 检查项目参数有效性
  if (!ENJOY_AI_HIERARCHICAL_LINKS[year][project]) {
    return res.status(404).json({
      error: '项目不存在',
      available_projects: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS[year])
    });
  }
  
  const url = ENJOY_AI_HIERARCHICAL_LINKS[year][project][docType];
  
  // 检查链接是否已配置
  if (!url) {
    return res.status(404).json({
      error: '文档类型不存在或链接未配置',
      available_docTypes: Object.keys(ENJOY_AI_HIERARCHICAL_LINKS[year][project]),
      note: '请在server.js的ENJOY_AI_HIERARCHICAL_LINKS中配置此链接'
    });
  }
  
  // 检测链接有效性
  const validity = await checkLinkValidity(url);
  
  if (!validity.valid) {
    return res.status(503).json({
      error: '当前文件链接已失效',
      code: 'LINK_EXPIRED',
      year,
      project,
      docType,
      status: validity.status,
      details: validity.error,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    year,
    project,
    docType,
    url,
    name: getDocumentName(year, project, docType),
    validity: validity,
    timestamp: new Date().toISOString()
  });
});

// 新增：获取所有链接状态
app.get('/api/links/status', async (req, res) => {
  try {
    const linkStatus = {};
    
    // 并行检查所有链接
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
    console.error('检测链接状态时出错:', error);
    res.status(500).json({
      success: false,
      error: '检测链接状态时出错',
      timestamp: new Date().toISOString()
    });
  }
});

// 列出所有可用文件夹
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
    hierarchical_available: true,
    timestamp: new Date().toISOString()
  });
});

// 静态文件服务 - 放在所有API路由之后
app.use(express.static(path.join(__dirname, 'public')));

// 重定向根路径到前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 辅助函数：获取文件夹友好名称
function getFolderName(folderId) {
  const names = {
    'whalesbot': 'WhalesBot',
    'test': 'Test 文件夹'
    // enjoy_ai 已移除
  };
  return names[folderId] || folderId;
}

// 辅助函数：获取文档友好名称
function getDocumentName(year, project, docType) {
  const projectNames = {
    'battle_of_tribes': 'Battle of Tribes',
    'cyber_city': 'Cyber City',
    'geometric_forest': 'Geometric Forest',
    'sample_solution': 'Sample Solution',
    'skyline_adventures': 'Skyline Adventures',
    // 2026年项目映射
    'drone_cup': 'Drone Cup',
    'mining_expedition': 'Mining Expedition',
    'inventions_trail': 'Inventions Trail',
    'battle_of_stars': 'Battle of Stars',
    'skyline_adventure': 'Skyline Adventure',
    'ancient_civilizations': 'Ancient Civilizations'
  };
  
  const docTypeNames = {
    'competition_rule': 'Competition Rule',
    'field_setup_guide': 'Field Setup Guide',
    'parts_list': 'Parts List',
    'competition_rule_scoring_sheet': 'Competition Rule & Scoring Sheet',
    'video_full_competition_round': 'Video: Full Competition Round',
    'program_reference': 'Program Reference',
    'video_competition_rules': 'Video: Competition Rules',
    'product_list': 'Product List',
    'solution_construction_manual': 'Solution Construction Manual',
    'air_pump_user_manual': 'Air Pump User Manual',
    'competition_rules': 'Competition Rules',
    'controller_user_manual': 'Controller User Manual',
    'competition_rules_field_setup_guide': 'Competition Rules & Field Setup Guide',
    'parts_list2': 'Parts List 2'
  };
  
  return `${year} - ${projectNames[project] || project} - ${docTypeNames[docType] || docType}`;
}

// 处理未匹配的路由
app.use((req, res) => {
  res.status(404).json({
    error: '端点不存在',
    availableEndpoints: {
      health: '/api/health',
      getLink: '/api/link/:folderId',
      hierarchicalStructure: '/api/hierarchical/enjoy_ai',
      hierarchicalLink: '/api/hierarchical/link?year=X&project=Y&docType=Z',
      linksStatus: '/api/links/status',
      listFolders: '/api/folders',
      frontend: '/ (前端页面)'
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Dropbox永久链接服务已启动`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🔗 已配置 ${Object.keys(MANUAL_SHARE_LINKS).length} 个永久链接`);
  console.log(`🌳 ENJOY AI已改为分级菜单结构 (${Object.keys(ENJOY_AI_HIERARCHICAL_LINKS).length} 个年份)`);
  console.log(`🔍 链接验证: 增强版（检测页面内容有效性）`);
  console.log(`=========================================`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`链接状态: http://localhost:${PORT}/api/links/status`);
  console.log(`测试链接: http://localhost:${PORT}/api/link/test`);
  console.log(`ENJOY AI分级结构: http://localhost:${PORT}/api/hierarchical/enjoy_ai`);
  console.log(`=========================================`);
});
