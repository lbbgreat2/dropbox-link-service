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

// 手动配置的Dropbox永久分享链接 - 已移除test文件夹
const MANUAL_SHARE_LINKS = {
  'whalesbot': 'https://www.dropbox.com/scl/fo/dm9mk69c56v8o554r11wv/AGjzYhC_2KXZ6xXkLc88k_g?rlkey=67t99jd9gms79e2ato24ee727&st=rhn2cwhy&dl=0'
};

// ============ ENJOY AI 分级链接配置 ============
const ENJOY_AI_HIERARCHICAL_LINKS = {
  '2025': {
    'cyber_city': {
      'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/r0jo3jkwlgeh7k8p0o7w6/Cyber-City_Competition-Rule.pdf?rlkey=cqwjdgtyy7csx1eckv8ga3q4u&st=jz9plkf6&dl=0',
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/ysvasz9s1disf8zogwwl2/Cyber-City_Field-Setup-Guide.pdf?rlkey=8xea6hi4mmgov6dn5x446u5gd&st=k7eisgjy&dl=0',
      'sample_solution_ppt': 'https://www.dropbox.com/scl/fi/yoe5wohhqkjtixyzkoemd/ENJOY-AI-2025_Cyber-City_Sample-Solution.pptx?rlkey=zu3pphz2hfb5s8wza0wu30266&st=t73u5exq&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/tqjsozecdypo8pa0t34yg/ANepzE0bWz3Q3jGXviMt0tg?rlkey=a8h3vdthhz1e6sq4s6re2l4kc&st=n15qnmum&dl=0'
    },
    'geometric_forest': {
      'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/an9zebpfmqwr3xyby997n/Geometric-Forest_Competition-Rule.pdf?rlkey=femmzsm1boubkwinz5kjfjpe5&st=sb1y4ssi&dl=0',
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/bzhlxz9zt27v7d91wyrzd/Geometric-Forest_Field-Setup-Guide.pdf?rlkey=y6q032umevx2i9d27ezs09z5k&st=rv3wr2wb&dl=0',
      'sample_solution_ppt': 'https://www.dropbox.com/scl/fi/6efna90my55ba3pyxfecf/ENJOY-AI-2025_Geometric-Forest_Sample-Solution.pptx?rlkey=6wiwxmv1va9neo5cmgv6x0jdq&st=prvb7wl2&dl=0'
    },
    'battle_of_tribes': {
      'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/pbj8vegug489ur8bwpl70/Battle-of-Tribes_Competition-Rule.pdf?rlkey=3z4eeul5yxsx6nxipy4r4dlen&st=5e4qgui0&dl=0',
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/259f0847zk3vu32h7cz0g/Battle-of-Tribes_Field-Setup-Guide.pdf?rlkey=j9d8ldm5pc3h7fj60pjcy09xq&st=xenqmnhk&dl=0',
      'sample_solution_ppt': 'https://www.dropbox.com/scl/fi/z2g2qypkwza2s2hpxi9ce/ENJOY-AI-2025_Battle-of-Tribes_Sample-Solution.pptx?rlkey=iqis8sxu92wc7p5wvkxhzwvfl&st=iyogbkly&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/eb9zgocez60dcv6soco52/AH7UhHhh073eVCqnIbfPCTc?rlkey=yunsmdztsnava89jqmhjm09i9&st=jbyct336&dl=0'
    },
    'skyline_adventures': {
      'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/ckmmfz1485hyp6ci0whtv/Skyline-Adventures_Competition-Rule.pdf?rlkey=g3x7abbi7g1a0id0omqtv4wor&st=r0so0dj7&dl=0',
      'field_setup_guide': 'https://www.dropbox.com/scl/fi/qe5178gkwy975vpf0qutw/Skyline-Adventures_Field-Setup-Guide.pdf?rlkey=rpz2kbnby7udqp8moen05o980&st=kwanxll4&dl=0',
      'sample_solution_ppt': 'https://www.dropbox.com/scl/fi/jefxr87i9177zxt0ggkmv/ENJOY-AI-2025_Skyline-Adventures_Sample-Solution.pptx?rlkey=k2t17kjogafbmvyi6k0nx7rlm&st=p7xcqvd0&dl=0'
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
      'video_full_competition_round': 'https://www.dropbox.com/scl/fi/uqooga4bo4v0olr7ehxup/2026-Mining-Expedition-Full-Competition-Round.mp4?rlkey=gh2zbf9vv6odh8ivff4o6vcg0&st=mhdd1x1x&dl=0',
      'program_reference': 'https://www.dropbox.com/scl/fo/yxmv2wffogybybn0f3ihy/AE5_v0MiV-YCZOQ4XrSJbVc?rlkey=eu3nxx8i8v773yq0dtrlezgpy&st=8utmbeo2&dl=0',
      'product_list': 'https://www.dropbox.com/scl/fo/rgz5ze9ezzzs1hxs78715/ACYUKlf7kKBxwS70WVQW4ko?rlkey=u1unwut06fhe3fg13ioccsrem&st=uemq3w7p&dl=0'
    },
    'inventions_trail': {
      'competition_rule_scoring_sheet': 'https://www.dropbox.com/scl/fi/5qprcf8ezy26gqpey5tnp/compeition-rule.pdf?rlkey=ktvu3885ph0vw8yr6b2d1pr2a&st=qmiin83o&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/4tb83c3w9zzjfhfxz56ux/EA-P1-26-EN-Parts-List-260212.pdf?rlkey=gcj1tcf0q0lku4tigv2gka13e&st=mmaq57g7&dl=0',
      'video_competition_rules': 'https://www.dropbox.com/scl/fi/rjhc2q9cddevj2h8dwfqr/ENJOY-AI-2026-Inventions-Trail-Competition-Rules.mp4?rlkey=2sr8ixwpx93g6awtcc4tklv0r&st=b0ws6wk4&dl=0',
      'video_full_competition_round': 'https://www.dropbox.com/scl/fi/318zktxprqe8dv9cpk6tr/Enjoy-AI-2026-Inventions-Trail-full-competition-round.mp4?rlkey=sw8ccmwoylc28s96te6luvenf&st=n4t77o73&dl=0',
      'field_setup_guide': 'https://www.dropbox.com/scl/fo/uv1aqaoopgly0tyuyit4i/AFuwkxQHWJ9vW22o75xCdJE?rlkey=9p52ziaha7snk8lmthpwtdh9u&st=kvxtyiic&dl=0',
      'product_list': 'https://www.dropbox.com/scl/fo/7oj3k7pc0tk4whhw7twjx/AKvxOsp6Is0_lYh0orNvrms?rlkey=8tjej12f7vkka9zjmfhvcy6zo&st=wm1m4bi0&dl=0',
      'program_reference': 'https://www.dropbox.com/scl/fo/lqj1yp7e15w760sgg4oo1/AJQmPDtNZSocYvMg88rlAhs?rlkey=0009ly68xuzkp5dvcjl6s1ipa&st=1w7bjhor&dl=0',
      'solution_construction_manual': 'https://www.dropbox.com/scl/fo/fq37o2unsi4osr9jyg1x9/ADGELW51XFP1SNwXgn29cSI?rlkey=gm9uop2yh3dqqsiuavin23mep&st=ro6u6x4s&dl=0',
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
};

// ============ WhalesBot 分级链接配置 ============
const WHALESBOT_HIERARCHICAL_LINKS = {
  'to_b': {
    'u10': {
      'courses': 'https://www.dropbox.com/scl/fo/h16zxke3owjffz8bqjjvz/ALI0newaGJ99h2EezA6EqQM?rlkey=sydtpqkrgd7rihsbrevxkiet8&st=0ydwerft&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/tqvb10sn04zg2dyddbm37/Whalesbot-U10-part-list.pdf?rlkey=woq3uz0b4bcdl8cypoqu53y5g&st=n3vhagks&dl=0'
    },
    'u10_pro': {
      'project_pictures': 'https://www.dropbox.com/scl/fo/nypul9n3nfyokrqk77fbc/AApxfxWc91PleS6Ls4EaUR4?rlkey=ffu2235gkfpd602jauh126sir&st=5m9n1w9g&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/6zgkmh4ptoskzqx2ktdru/ACnAs0oYZA8Q59kXJoWd5H8?rlkey=b89oi01f2k0gq8savfyosi3ne&st=b7b7x9gi&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/yidf5hg71avscel3tt1j6/Parts-List.pdf?rlkey=ngmzfd6zodomws6m4n0g0i7pa&st=vgqw80oi&dl=0'
    },
    'u20': {
      'courses': 'https://www.dropbox.com/scl/fo/p44mkvke317lz22b6wcwx/ADq_zXXpa4ru165DLImuGCI?rlkey=ocyrjkqcvwf2g5acgi684u264&st=45zcczqg&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/6izvk2am21n7ci66eqih5/Whalesbot-U20-part-list.pdf?rlkey=4w6m69i657of4mr694cwbw0il&st=jxf2omyv&dl=0'
    },
    'u20_pro': {
      'project_pictures': 'https://www.dropbox.com/scl/fo/n069k7lwhfthb00856cm1/AEnx-BS-RC1gIvbxT788Eqw?rlkey=6elw9yg2ysugjioyt7yi4qxco&st=u8ipt846&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/bdlvqx87u2fpdwuh9vqbs/AAY-VL-8z3FIjnxAqU_OEhc?rlkey=6zy0yuhy68v7tebk5snmiawfh&st=gbakh17m&dl=0',
      'user_manual': 'https://www.dropbox.com/scl/fi/hxv1muxlafsbp9nbowwx3/U20pro-Series-User-s-Manual.pdf?rlkey=6j7njwdp5fankb1iwt7rweg87&st=0op737yg&dl=0'
    },
    'u30_pro': {
      'courses': 'https://www.dropbox.com/scl/fo/a89qxrvlyow0af25js9ul/AKoaOMUYaNKV6yOU_d3LAAA?rlkey=z7lck9279447nx88tu5j6xwd9&st=owwb3lhi&dl=0',
      'parts_list_plus_quick_start_guide': 'https://www.dropbox.com/scl/fi/zmg7qvlc792hb6jtrh2iy/U30-Pro-Parts-List_241111.pdf?rlkey=e02maksvcd7t1unlpkazxjgna&st=tmf0h5lv&dl=0',
      'bp201_user_manual': 'https://www.dropbox.com/scl/fi/tlrcdj991ancmomn3gpa2/BP201.pdf?rlkey=s3jiuna8jfprokgjqqqogzisw&st=vaqi1lig&dl=0'
    },
    's10': {
      'parts_list': 'https://www.dropbox.com/scl/fi/nor59vj2hwl7zs3wbbjxj/Whalesbot-S10-Part-list.pdf?rlkey=l3osrjj8zl1e0scyozd8pqfwf&st=px1pok60&dl=0'
    },
    's30': {
      'courses': 'https://www.dropbox.com/scl/fo/lhal6tmx76meny288tp38/AHiLnMsTHiqxencVCbQt9iI?rlkey=643kxqbr6o0o7lchx42u44b5d&st=rno5k5cz&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/zaojcwvu1chu16fkprbds/Whalesbot-S30-Part-list.pdf?rlkey=0pgbfsh253vlmk4ee593xqr2t&st=i577bxkq&dl=0',
      'user_manual': 'https://www.dropbox.com/scl/fi/kdoe6i56n0wvix1bqio29/wecode-Pro-Instructions-Manual.pdf?rlkey=nkaq5e2v3idqambjr946a1ia7&st=m2b5v6yd&dl=0'
    },
    's40': {
      'project_pictures': 'https://www.dropbox.com/scl/fo/m7el0xorkv59hevwdzmuw/APs9Obk-Q_mYDpfwLIC9aBI?rlkey=bmnu9wsdhshta975i7u3rw5ti&st=udjarx59&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/ovb4tsdhevsr3th4oeg0s/AMpPiBQs1lLdhsgYqS0SO_w?rlkey=8l84tu0fwb91qns2imv37i54s&st=9c8ur5eo&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/kgn7bv1mvnqac98jtw41x/S40-part-list.pdf?rlkey=20wnl176jml2oqgqjyrzq8bau&st=3zxeb3lg&dl=0',
      'sc201_user_manual': 'https://www.dropbox.com/scl/fi/2cv9xor9d1ujtekm277nv/SC201-User-Guide_250117.pdf?rlkey=nmrpsyxdhha5ka233p81w2j2x&st=wzl8jllu&dl=0'
    },
    'ai_module_1s': {
      'project_pictures': 'https://www.dropbox.com/scl/fo/uf6mq6oiveufofpzkg1kk/AAlzNSvZDM2H7D039IZMMK0?rlkey=4x7xzq7q42akbctlb167kircc&st=v0lfmwqu&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/mt2p8wqdvvw2j1xxgybb2/ABszu7NKwcOLv4ogVbCSMfw?rlkey=n5f4o96wrwg7zh0py3qnazxt3&st=gaqw53rf&dl=0',
      'quick_start_guide': 'https://www.dropbox.com/scl/fi/sjejrxpufmrgxtmm35p9y/AI-MODULE-1S-Userguide.pdf?rlkey=hoz9r91b4uqycjjld5z8lhh9f&st=xw3x757u&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/clds22v8jzvef96bfztul/AI-Module-1S-Parts-list.JPG?rlkey=aommplzs4wi9vigvm9hnjriwf&st=nxmxwzh3&dl=0',
      'mc101s_user_manual': 'https://www.dropbox.com/scl/fi/zo7plmyzsekmknp48snvl/MC101s-User-Guide-V1.0_241016.pdf?rlkey=1yq77zgsv2b80f67syu4q6kq7&st=aep3c066&dl=0'
    },
    'ai_module_2s': {
      'mc101s_user_manual': 'https://www.dropbox.com/scl/fi/0srp3atrrsz8wsutc1nx4/MC101s-User-Guide-V1.0_241016.pdf?rlkey=lxhn7ifgk92zpceyi70frfy28&st=6i3zlyll&dl=0',
      'quick_start_guide': 'https://www.dropbox.com/scl/fi/dwxncwqbwbrgsqumybbz0/AI-Module-2s-quick-start.pdf?rlkey=elb1lzfz74p1wzzymbgz5nxye&st=1abvkvtj&dl=0'
    },
    'ai_module_3s': {
      'mc102_user_manual': 'https://www.dropbox.com/scl/fi/xqd7rwlg7c2nwr08deg67/MC102-User-Guide-V1.1_241014.pdf?rlkey=vzc9nao049nwxb2tfzlgvh3xo&st=ivqwfs3h&dl=0',
      'parts_list_plus_quick_start_guide': 'https://www.dropbox.com/scl/fi/zkzyxtyaq7zaf5xo9sprs/AI-module-3s-part-list.pdf?rlkey=cjwk7z3151d8xsp8p9odrzg0h&st=xmd5tdty&dl=0'
    },
    'ai_module_5': {
      'mc902_user_manual': 'https://www.dropbox.com/scl/fi/bk5sevmzfr1wp4cwzzrwh/MC902-User-Guide-V1.0_241014.pdf?rlkey=0ytd6flbulcaxmo3dtuetrwps&st=xuhnoecj&dl=0',
      'carton_label': 'https://www.dropbox.com/scl/fi/cdey4nzg60e9hrfddkn9z/AI-Module-5.pdf?rlkey=t9gynenjqswhhqglpm58knuhy&st=so01fhgn&dl=0'
    },
    'ai_module_5s': {
      'courses': 'https://www.dropbox.com/scl/fo/n2ph25mhxjggpdyprchar/AKiCUt43aPVp1r7HldmezWQ?rlkey=ez4nwvx01h6vfm11cvnx5nwjf&st=99tf3fd6&dl=0',
      'mc902_user_manual': 'https://www.dropbox.com/scl/fi/ddnt0gdibugxocld1cy5t/MC902-User-Guide-V1.0_241014.pdf?rlkey=3vu9n1zc0oxt0po6lh3t1dx9z&st=73746erj&dl=0',
      'parts_list_plus_quick_start_guide': 'https://www.dropbox.com/scl/fi/ijlkjfxpapomk7mmlpb8z/AI-Module-5S-part-list.pdf?rlkey=2q2f2dbl1lwh6zwtow0qejptv&st=v7h17mom&dl=0'
    },
    'enginbot_1s': {
      'courses_old': 'https://www.dropbox.com/scl/fo/4hnde9cox9z8ghjvh90pz/AD3rJaBI3WE8-yuJ55bXPTY?rlkey=j3bptubupg3wt39sougcxbti1&st=1hs0i66n&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/jadszp8xfc8orbvudxx3t/enginbot-1s-part-list.pdf?rlkey=zptkkqyhvyhe77kdw6xksjd1o&st=4qcobstl&dl=0',
      'scratch': 'https://www.dropbox.com/scl/fo/na6fyzakxd0fhgi24raa2/AL8WtgAiL2ZHBwPQiY3sggw?rlkey=zg141s196c59clmyeettn8qkj&st=wp7toqbh&dl=0',
      'python': 'https://www.dropbox.com/scl/fo/cnz2lqgjy6w2knjsidmd4/AB_6afT5kJQXtlo9d175JC8?rlkey=t1c8pw13c0h86z61uj8x7w8yi&st=n9j5vmbr&dl=0',
      'basics': 'https://www.dropbox.com/scl/fo/4j37pswrue0rotieozxuq/AF9QRYbQ29r-egcbGQclp-s?rlkey=vh4khgisqdxb8wqsgw5v8cffv&st=rq6ulfro&dl=0'
    },
    'wobot_1s': {
      'project_manual': 'https://www.dropbox.com/scl/fo/neekice49ifk16exf8x15/ANKNzwiUuDLdOQYxP7Ah8ds?rlkey=xpwm5qnmze84u5bh5ce4lk8uv&st=chriwfo0&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/plyxn12aoke9fofhv6hb0/Wobot-1s-part-list.pdf?rlkey=vdpb1ldw8olk51fy41s6zajsd&st=91a2tuh8&dl=0',
      'mc_602_user_guide': 'https://www.dropbox.com/scl/fi/vsxlt1lgod0mn5l2w880h/MC602-User-Guide-EN.pdf?rlkey=knqmjh056319ldorodo4fb2e1&st=xowabyjq&dl=0',
      'project_assembly_manual': 'https://www.dropbox.com/scl/fo/2i9iuwws4rj609hz4ud6c/AORdSK2pwkJKZK1dVRPQQSo?rlkey=rzd5vyhbj2w9icu92v6yux4rd&st=fjcnk2sj&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/or3to4a210d0sgfo3g096/AMjJwTCxTCKzUp4bcLVruDs?rlkey=bpf7u5oefbo0vthtlx1bbntnk&st=qr91ustr&dl=0'
    },
    'rocky': {
      'parts_list_plus_building_guide': 'https://www.dropbox.com/scl/fi/rhm1shmwwgyf6jp9392kv/Building-Guide.pdf?rlkey=p3mdsg2ccmukeazdnx4kg2d73&st=2hwmn31o&dl=0',
      'quick_start_guide': 'https://www.dropbox.com/scl/fi/dfaztb58zpyudf8cpd4tq/Rocky-quick-start.pdf?rlkey=1wf4rlba2rniegow40qv6np1d&st=ai61bixa&dl=0',
      'mc603_user_manual': 'https://www.dropbox.com/scl/fi/h72zev8wzjj6e6irtpwct/MC603-User-Guide-V2.0.pdf?rlkey=62khl4o6lqn6mcw8c2pblhixv&st=1jgfdb3x&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/8f83giw78qbtnfunl9xi1/AJzs9dCDOVSn6nDaT_fSv-E?rlkey=2ikxeb8rwwb0zjlgkanmd8h03&st=vtrza6gm&dl=0',
      'fpv_quick_start': 'https://www.dropbox.com/scl/fi/w8h320oe7kvqgq9el53hz/Rocky-FPV-Quick-Start.pdf?rlkey=482net91ogkimm8ichb4ocf83&st=bmkbyexx&dl=0'
    },
    'eagle_1001': {
      'courses': 'https://www.dropbox.com/scl/fo/6cxvs2y3m8q6k3wugt14i/AB-oZRODihQuU_XDHo1gyVM?rlkey=tcaxu0qimasuakw52zw0x881e&st=2w8w5c7w&dl=0',
      'user_guide': 'https://www.dropbox.com/scl/fi/ckbxkc0ndcndoazr5owuh/WhalesBot_Eagle_User_Guide_V1.2.pdf?rlkey=4epoi2j9giuegt1t4skit01jz&st=ceunshg3&dl=0'
    },
    'eagle_1003': {
      'parts_list_plus_quick_start_guide': 'https://www.dropbox.com/scl/fo/konrp7rlwfuy8mqig4hx3/AC8zAg32jUfgcyibP6_Jv1E?rlkey=9xmpon5w0td9k7enm8e7rassz&st=bnkd22i4&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/c00zy6gte752yh3u90g1z/AGsu6mIGXNhKyTfEN3x8nPw?rlkey=tg2mi5exq0d1lyix9kmy5qzov&st=7c98wjk1&dl=0',
      'user_guide': 'https://www.dropbox.com/scl/fi/wa4edkvbf4mt01ne1hrgv/WhalesBot-Eagle_User-Guide_V1.0.pdf?rlkey=sjte36bd8cjorc80ffm8sozpz&st=olfcseaa&dl=0'
    },
    'eagle_125f': {
      'parts_list_plus_quick_start_guide_plus_field_setup_tutorial': 'https://www.dropbox.com/scl/fo/nquifvvk9twqmizq4c8iz/ACqQRaEG9zi_DJ95yFmFBCc?rlkey=fa3sm773hkp2hn2kz99ficznq&st=yfsr4x5u&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/mwf4737ksw7px2bc08i80/AOrijiOOfKD1hKYbqPsW9_A?rlkey=0iy7ihy8ngmeau3w1k5o446ck&st=scl1nmxe&dl=0'
    },
    'eagle_2001': {
      'quick_start': 'https://www.dropbox.com/scl/fi/2dwrasx8ldj996sqdgeh6/Eagle-2001-Quick-Start.pdf?rlkey=7gp7o9o200ye2m9qaigjr4w1s&st=4kypsw4n&dl=0',
      'courses': 'https://www.dropbox.com/scl/fo/w9ilflzpisdf1wdzog7j0/AOgIj_zdhPjUDjCm8f3GkWA?rlkey=jn86mhvw5rka1q400gmff8cdw&st=nmcjcb3i&dl=0',
      'program_guide': 'https://www.dropbox.com/scl/fo/q4olaab5cp5i54on64zii/AFotZ-4BEXGjFC_1WQwBJcU?rlkey=fzu61nqe9il1dtsj9jpfv5rwn&st=28lai36r&dl=0',
      'wind_rider': 'https://www.dropbox.com/scl/fi/ki88mhuz1khr8pp97vsye/Wind-Rider.pdf?rlkey=dkm0m3vcfen6iwk6n12n84u8j&st=zyd7bs55&dl=0'
    },
    'eagle3001': {
      'outer_packaging_box': 'https://www.dropbox.com/scl/fi/29lcviqygm7g5iozhlwg8/Eagle3001-outer-packaging-box-EN.pdf?rlkey=23an6r8eekgyzqrf48oxg4bbl&st=ivjh1m7o&dl=0',
      'quick_start': 'https://www.dropbox.com/scl/fi/xelpmhhgnpppd7brlifpb/Eagle-3001-Quick-Start-EN-final.pdf?rlkey=q27byrb229znfkh9m9rvtgy39&st=qv77i0gl&dl=0'
    },
    'robovr': {
      'robovr_tutorial': 'https://www.dropbox.com/scl/fi/8zytfg8ljmwq9y69kzhst/RoboVR-Tutorial.pdf?rlkey=i6iks7xf6f77q1vga0t5899il&st=o9qza64u&dl=0',
      'robovr_contest_signup_tutorial': 'https://www.dropbox.com/scl/fi/if6p0c522nwsz3rgzmo8z/RoboVR-Contest-Signup-Tutorial.pdf?rlkey=7k7ks2vo7e69xgywznvqdp1q1&st=9n5vdv88&dl=0'
    },
    'ai_visual_module': {
      'ai_visual_module_introduction': 'https://www.dropbox.com/scl/fi/ua99gp351pfl0ittntnl8/AI-Visual-Module-Introduction.pptx?rlkey=hlvv75kcdtwu2twgbye7gowfm&st=46zeen9u&dl=0'
    },
    'make_u': {
      'make_u_coding_cards__introduction': 'https://www.dropbox.com/scl/fi/cd30damqqr4lgjg6lw0tv/Make-U-1.xlsx?rlkey=q9mo88od6jeitlzlvv4sahc0x&st=cksssj8u&dl=0'
    }
  },
  'to_c': {
    'a1': {
      'storybook': 'https://www.dropbox.com/scl/fo/q34bzsnqz89tvr8mm8q8y/ACaGqPvMXHFs8Odm9HnKXbQ?rlkey=sy9nl3tdawfn817r8ma1on80e&st=4ecm7yjf&dl=0',
      'project_pictures': 'https://www.dropbox.com/scl/fo/u0py5gngpacx61svve4fy/AGty_UtKKc313kuwUjS1qkw?rlkey=ouhcr8ked3nv38u0lm669r02y&st=o975aypw&dl=0',
      'manual_and_list': 'https://www.dropbox.com/scl/fo/j2vgsxnlmnf7zp6479hut/ADfAVF7liv5x7g6sRRzQeHY?rlkey=z7evusz9hvwa2fiivyeydzzy5&st=ejyeaufe&dl=0'
    },
    'a3': {
      'courses': 'https://www.dropbox.com/scl/fo/1kckvz5vii2e81g0y5xak/AH0ic_6_KsfMLX3X_h7sEc0?rlkey=w225dx01169m0pwpxx23mhwgy&st=ujfc0wus&dl=0',
      'project_pictures': 'https://www.dropbox.com/scl/fo/ygzhpje49lgu449g9ifd7/AJ1CRzskS_SVs7FrVS4gDfc?rlkey=k64209kivccex1shtrm904f77&st=f1ss7g4w&dl=0',
      'manual_and_list': 'https://www.dropbox.com/scl/fo/aiwzgive8eon1gsfzpdir/ALUOXde9u1rqkPXtZ6fa1b4?rlkey=5h89zoc376foookmguv28ehte&st=0oy9vqr8&dl=0'
    },
    'a7': {
      'building_guide_plus_manual_plus_storybook': 'https://www.dropbox.com/scl/fo/5nieggulofbyf6gcm1971/AKC9kR-gyiIy2rq9kRhQUCQ?rlkey=anqbkdvfa4sibna7ney6t0tze&st=gktb39yw&dl=0'
    },
    'b3_pro': {
      'courses': 'https://www.dropbox.com/scl/fo/0oxu7noun1v84e1iiu70c/AFZSVgJD6wVBzHHTNIakw5A?rlkey=dg71gqfarzmu81l4425z6wija&st=y0rexr6a&dl=0',
      'project_pictures': 'https://www.dropbox.com/scl/fo/oika2i99pgekpv2q661ub/ADaIh_3hKzK5iKD7vjgInB0?rlkey=8ox0bqd6dr5ri34e7xtmmys9z&st=uwufkzbz&dl=0',
      'manual_and_list': 'https://www.dropbox.com/scl/fo/vces6eaa90t88p8bw534s/ACzGP0VGtYKTcz0RCVETsvo?rlkey=j6357smg6marrslymi72ty3c1&st=kdnnndj7&dl=0'
    },
    'c3': {
      'parts_list_plus_storybook': 'https://www.dropbox.com/scl/fo/lb3s1eliolyt22fbxov0l/AFurOnVk68AogIM2HzShG-0?rlkey=xod7wel6wb36ekpm62crn4jyo&st=tcpo8uot&dl=0'
    },
    'd1': {
      'parts_list_plus_quick_start_guide': 'https://www.dropbox.com/scl/fo/n6ypw6fk5bbll0oijddf5/AEng_tzD1Px51gC2P4sWRlw?rlkey=pfx837o5xpxo4p06007szm57r&st=lh0z7hpg&dl=0'
    },
    'd3_pro': {
      'storybook': 'https://www.dropbox.com/scl/fo/d4n88jdxcsipdsedd75ok/AIBjhgTUhA6by4nDIBlHWEw?rlkey=b19q3tc0qwjc3wr6p0slrqkaw&st=e822708z&dl=0',
      'product_images': 'https://www.dropbox.com/scl/fo/ooyqj8k9ctg6nvzqshkls/ANPLmwaTfhcaQPH35eSRfHQ?rlkey=vgw7e5e00axq6g9q5u306qc1i&st=szj2wo3k&dl=0',
      'manual_and_list': 'https://www.dropbox.com/scl/fo/ooyqj8k9ctg6nvzqshkls/ANPLmwaTfhcaQPH35eSRfHQ?rlkey=vgw7e5e00axq6g9q5u306qc1i&st=mq6wq5rl&dl=0',
      'building_guide': 'https://www.dropbox.com/scl/fi/mqp3uvuhw1hfsfrc9d9jc/Building-Guide.pdf?rlkey=mmkiai9zjxx6odz1g9xn7hf7m&st=4eixcpho&dl=0'
    },
    'e7_pro': {
      'courses': 'https://www.dropbox.com/scl/fo/h2xyf499m8jey7ay6tq0h/AF7IbjR-ZIET8cI9yLi1lGE?rlkey=fh734y1hm1aiqc0es9wjwfpl7&st=i58jbr2s&dl=0',
      'project_pictures': 'https://www.dropbox.com/scl/fo/w3tbw077x0z6rry6hzdxr/AIfuB1Rdv4XOBgxr9YtWyyI?rlkey=y6m8hr40f4wmsorl3og06rwo6&st=6nhum0uy&dl=0',
      'manual_and_list': 'https://www.dropbox.com/scl/fo/sb3c6k468g1dvc2pbbg7f/AIQmyi4dw1b-t5Jpi6SdWwc?rlkey=tq2u552rrwkclj402klg91lju&st=tj8z47yn&dl=0'
    },
    'e9_pro': {
      'courses': 'https://www.dropbox.com/scl/fo/i1ttad6q4ndcuola7gpsh/ACXh4lCj8osfFtH27RH0tRY?rlkey=y5s29y42508cff82hztue32hy&st=nckeykjo&dl=0',
      'parts_list': 'https://www.dropbox.com/scl/fi/q5x5fswqyun02p9cmyk03/E9-Pro-Parts-List.pdf?rlkey=tb3v93pts9hggkx046a5znx0n&st=9ij4lj5d&dl=0',
      'pack_label': 'https://www.dropbox.com/scl/fi/cr5q6pv6s48e6dmprjtx5/E9-Pro-Pack-Label.pdf?rlkey=16nilddytdur2apcbrwj6ayz5&st=ckul1eyv&dl=0',
      'building_guide': 'https://www.dropbox.com/scl/fo/gq8mxss4tabqykku1y0yv/ALDCI6W1BHA97-MrCMh0q2I?rlkey=02a78w9ofcs26oceit6wkts1m&st=br56823s&dl=0'
    },
    'pubbo': {
      'user_manual__plus__video': 'https://www.dropbox.com/scl/fo/wgxmap8wkav8sol64r0yr/ANf3F7gOT-nP6NCgrfmXD3w?rlkey=9boo73pj4r38uum8eskq9b1dn&st=x5ladnnb&dl=0'
    }
  }
};

// 链接状态缓存
let linkStatusCache = {};
let enjoyAiLinkStatusCache = {};
let whalesbotLinkStatusCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 检测单个链接是否有效的函数
async function checkLinkValidity(url) {
  if (!url || url.trim() === '') {
    return {
      valid: false,
      timestamp: new Date().toISOString(),
      message: '链接为空或未配置',
      reason: 'EMPTY_URL'
    };
  }

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
      return {
        valid: false,
        status: response.status,
        timestamp: new Date().toISOString(),
        message: '链接未指向Dropbox有效页面',
        reason: 'NOT_DROPBOX'
      };
    }
    
    // 检查是否包含常见的失效提示关键词
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

// 获取ENJOY AI所有链接状态
async function getEnjoyAiAllLinksStatus() {
  const now = Date.now();
  const cacheKey = 'enjoy_ai_all';
  
  // 检查缓存
  if (enjoyAiLinkStatusCache[cacheKey] && 
      now - enjoyAiLinkStatusCache[cacheKey].timestamp < CACHE_DURATION) {
    return enjoyAiLinkStatusCache[cacheKey];
  }
  
  const result = {
    '2025': {},
    '2026': {}
  };
  
  // 并行检测所有链接
  const allPromises = [];
  const allLinks = [];
  
  // 收集所有链接
  Object.keys(ENJOY_AI_HIERARCHICAL_LINKS).forEach(year => {
    result[year] = {};
    Object.keys(ENJOY_AI_HIERARCHICAL_LINKS[year]).forEach(project => {
      result[year][project] = {};
      Object.keys(ENJOY_AI_HIERARCHICAL_LINKS[year][project]).forEach(docType => {
        const url = ENJOY_AI_HIERARCHICAL_LINKS[year][project][docType];
        allLinks.push({ year, project, docType, url });
      });
    });
  });
  
  // 创建检测任务
  allLinks.forEach(link => {
    allPromises.push(
      checkLinkValidity(link.url).then(status => {
        return { ...link, status };
      })
    );
  });
  
  // 等待所有检测完成
  const results = await Promise.all(allPromises);
  
  // 整理结果
  results.forEach(item => {
    if (!result[item.year][item.project]) {
      result[item.year][item.project] = {};
    }
    result[item.year][item.project][item.docType] = item.status;
  });
  
  // 缓存结果
  enjoyAiLinkStatusCache[cacheKey] = {
    data: result,
    timestamp: new Date().toISOString()
  };
  
  return enjoyAiLinkStatusCache[cacheKey];
}

// 获取ENJOY AI特定年份和项目的链接状态
async function getEnjoyAiLinksStatus(year, project) {
  const allStatus = await getEnjoyAiAllLinksStatus();
  
  if (year && project) {
    return allStatus.data[year]?.[project] || {};
  } else if (year) {
    return allStatus.data[year] || {};
  } else {
    return allStatus.data;
  }
}

// ============ WhalesBot 链接状态检测 ============

// 获取WhalesBot所有链接状态
async function getWhalesbotAllLinksStatus() {
  const now = Date.now();
  const cacheKey = 'whalesbot_all';
  
  // 检查缓存
  if (whalesbotLinkStatusCache[cacheKey] && 
      now - whalesbotLinkStatusCache[cacheKey].timestamp < CACHE_DURATION) {
    return whalesbotLinkStatusCache[cacheKey];
  }
  
  const result = {
    'to_b': {},
    'to_c': {}
  };
  
  // 并行检测所有链接
  const allPromises = [];
  const allLinks = [];
  
  // 收集所有链接
  Object.keys(WHALESBOT_HIERARCHICAL_LINKS).forEach(category => {
    result[category] = {};
    Object.keys(WHALESBOT_HIERARCHICAL_LINKS[category]).forEach(product => {
      result[category][product] = {};
      Object.keys(WHALESBOT_HIERARCHICAL_LINKS[category][product]).forEach(docType => {
        const url = WHALESBOT_HIERARCHICAL_LINKS[category][product][docType];
        allLinks.push({ category, product, docType, url });
      });
    });
  });
  
  // 创建检测任务
  allLinks.forEach(link => {
    allPromises.push(
      checkLinkValidity(link.url).then(status => {
        return { ...link, status };
      })
    );
  });
  
  // 等待所有检测完成
  const results = await Promise.all(allPromises);
  
  // 整理结果
  results.forEach(item => {
    if (!result[item.category][item.product]) {
      result[item.category][item.product] = {};
    }
    result[item.category][item.product][item.docType] = item.status;
  });
  
  // 缓存结果
  whalesbotLinkStatusCache[cacheKey] = {
    data: result,
    timestamp: new Date().toISOString()
  };
  
  return whalesbotLinkStatusCache[cacheKey];
}

// 获取WhalesBot特定分类和产品的链接状态
async function getWhalesbotLinksStatus(category, product) {
  const allStatus = await getWhalesbotAllLinksStatus();
  
  if (category && product) {
    return allStatus.data[category]?.[product] || {};
  } else if (category) {
    return allStatus.data[category] || {};
  } else {
    return allStatus.data;
  }
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

// 获取ENJOY AI分级链接结构
app.get('/api/hierarchical/enjoy_ai', (req, res) => {
  res.json({
    success: true,
    data: ENJOY_AI_HIERARCHICAL_LINKS,
    timestamp: new Date().toISOString(),
    note: '分级链接结构，请通过 /api/hierarchical/link 端点获取具体链接'
  });
});

// 获取WhalesBot分级链接结构
app.get('/api/hierarchical/whalesbot', (req, res) => {
  res.json({
    success: true,
    data: WHALESBOT_HIERARCHICAL_LINKS,
    timestamp: new Date().toISOString(),
    note: 'WhalesBot分级链接结构，请通过 /api/hierarchical/whalesbot_link 端点获取具体链接'
  });
});

// 获取ENJOY AI所有链接状态
app.get('/api/hierarchical/all_status', async (req, res) => {
  try {
    const status = await getEnjoyAiAllLinksStatus();
    res.json({
      success: true,
      data: status.data,
      timestamp: status.timestamp,
      cache: true
    });
  } catch (error) {
    console.error('获取ENJOY AI链接状态失败:', error);
    res.status(500).json({
      success: false,
      error: '获取ENJOY AI链接状态失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取ENJOY AI特定年份的链接状态
app.get('/api/hierarchical/status/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const status = await getEnjoyAiLinksStatus(year);
    
    res.json({
      success: true,
      year,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`获取ENJOY AI ${req.params.year} 链接状态失败:`, error);
    res.status(500).json({
      success: false,
      error: '获取ENJOY AI链接状态失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取ENJOY AI特定年份和项目的链接状态
app.get('/api/hierarchical/status/:year/:project', async (req, res) => {
  try {
    const { year, project } = req.params;
    const status = await getEnjoyAiLinksStatus(year, project);
    
    res.json({
      success: true,
      year,
      project,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`获取ENJOY AI ${req.params.year}/${req.params.project} 链接状态失败:`, error);
    res.status(500).json({
      success: false,
      error: '获取ENJOY AI链接状态失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取分级链接的具体文档（ENJOY AI）
app.get('/api/hierarchical/link', async (req, res) => {
  const { year, project, docType } = req.query;
  
  if (!year || !project || !docType) {
    return res.status(400).json({
      error: '缺少必要参数',
      message: '需要year, project, docType参数',
      example: '/api/hierarchical/link?year=2025&project=cyber_city&docType=competition_rule_scoring_sheet',
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

// ============ WhalesBot 分级链接 API ============

// 获取WhalesBot所有链接状态
app.get('/api/hierarchical/whalesbot_all_status', async (req, res) => {
  try {
    const status = await getWhalesbotAllLinksStatus();
    res.json({
      success: true,
      data: status.data,
      timestamp: status.timestamp,
      cache: true
    });
  } catch (error) {
    console.error('获取WhalesBot链接状态失败:', error);
    res.status(500).json({
      success: false,
      error: '获取WhalesBot链接状态失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取WhalesBot特定分类的链接状态
app.get('/api/hierarchical/whalesbot_status/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const status = await getWhalesbotLinksStatus(category);
    
    res.json({
      success: true,
      category,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`获取WhalesBot ${req.params.category} 链接状态失败:`, error);
    res.status(500).json({
      success: false,
      error: '获取WhalesBot链接状态失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取WhalesBot特定分类和产品的链接状态
app.get('/api/hierarchical/whalesbot_status/:category/:product', async (req, res) => {
  try {
    const { category, product } = req.params;
    const status = await getWhalesbotLinksStatus(category, product);
    
    res.json({
      success: true,
      category,
      product,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`获取WhalesBot ${req.params.category}/${req.params.product} 链接状态失败:`, error);
    res.status(500).json({
      success: false,
      error: '获取WhalesBot链接状态失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 获取WhalesBot分级链接的具体文档
app.get('/api/hierarchical/whalesbot_link', async (req, res) => {
  const { category, product, docType } = req.query;
  
  if (!category || !product || !docType) {
    return res.status(400).json({
      error: '缺少必要参数',
      message: '需要category, product, docType参数',
      example: '/api/hierarchical/whalesbot_link?category=to_b&product=u10&docType=courses',
      available_categories: Object.keys(WHALESBOT_HIERARCHICAL_LINKS)
    });
  }
  
  // 检查分类参数有效性
  if (!WHALESBOT_HIERARCHICAL_LINKS[category]) {
    return res.status(404).json({
      error: '分类不存在',
      available_categories: Object.keys(WHALESBOT_HIERARCHICAL_LINKS)
    });
  }
  
  // 检查产品参数有效性
  if (!WHALESBOT_HIERARCHICAL_LINKS[category][product]) {
    return res.status(404).json({
      error: '产品不存在',
      available_products: Object.keys(WHALESBOT_HIERARCHICAL_LINKS[category])
    });
  }
  
  const url = WHALESBOT_HIERARCHICAL_LINKS[category][product][docType];
  
  // 检查链接是否已配置
  if (!url) {
    return res.status(404).json({
      error: '文档类型不存在或链接未配置',
      available_docTypes: Object.keys(WHALESBOT_HIERARCHICAL_LINKS[category][product]),
      note: '请在server.js的WHALESBOT_HIERARCHICAL_LINKS中配置此链接'
    });
  }
  
  // 检测链接有效性
  const validity = await checkLinkValidity(url);
  
  if (!validity.valid) {
    return res.status(503).json({
      error: '当前文件链接已失效',
      code: 'LINK_EXPIRED',
      category,
      product,
      docType,
      status: validity.status,
      details: validity.error,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    category,
    product,
    docType,
    url,
    name: getWhalesbotDocumentName(category, product, docType),
    validity: validity,
    timestamp: new Date().toISOString()
  });
});

// 获取所有链接状态
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

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 重定向根路径到前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 辅助函数：获取文件夹友好名称
function getFolderName(folderId) {
  const names = {
    'whalesbot': 'WhalesBot'
  };
  return names[folderId] || folderId;
}

// 辅助函数：获取ENJOY AI文档友好名称
function getDocumentName(year, project, docType) {
  const projectNames = {
    'cyber_city': 'Cyber City',
    'geometric_forest': 'Geometric Forest',
    'battle_of_tribes': 'Battle of Tribes',
    'skyline_adventures': 'Skyline Adventures',
    'drone_cup': 'Drone Cup',
    'mining_expedition': 'Mining Expedition',
    'inventions_trail': 'Inventions Trail',
    'battle_of_stars': 'Battle of Stars',
    'skyline_adventure': 'Skyline Adventure',
    'ancient_civilizations': 'Ancient Civilizations'
  };
  
  const docTypeNames = {
    'competition_rule_scoring_sheet': 'Competition Rule & Scoring Sheet',
    'field_setup_guide': 'Field Setup Guide',
    'sample_solution_ppt': 'Sample Solution PPT',
    'courses': 'Courses',
    'parts_list': 'Parts List',
    'video_full_competition_round': 'Video: Full Competition Round',
    'program_reference': 'Program Reference',
    'video_competition_rules': 'Video: Competition Rules',
    'product_list': 'Product List',
    'solution_construction_manual': 'Solution Construction Manual',
    'air_pump_user_manual': 'Air Pump User Manual',
    'competition_rules': 'Competition Rules',
    'controller_user_manual': 'Controller User Manual',
    'competition_rules_field_setup_guide': 'Competition Rules & Field Setup Guide',
    'parts_list2': 'Parts List 2',
    'competition_rule': 'Competition Rule'
  };
  
  return `${year} - ${projectNames[project] || project} - ${docTypeNames[docType] || docType}`;
}

// 辅助函数：获取WhalesBot文档友好名称
function getWhalesbotDocumentName(category, product, docType) {
  const categoryNames = {
    'to_b': 'To B',
    'to_c': 'To C'
  };
  
  const productNames = {
    'u10': 'U10',
    'u10_pro': 'U10 Pro',
    'u20': 'U20',
    'u20_pro': 'U20 Pro',
    'u30_pro': 'U30 Pro',
    's10': 'S10',
    's30': 'S30',
    's40': 'S40',
    'ai_module_1s': 'AI Module 1S',
    'ai_module_2s': 'AI Module 2S',
    'ai_module_3s': 'AI Module 3S',
    'ai_module_5': 'AI Module 5',
    'ai_module_5s': 'AI Module 5S',
    'enginbot_1s': 'EnginBot 1s',
    'wobot_1s': 'Wobot 1s',
    'rocky': 'Rocky',
    'eagle_1001': 'Eagle 1001',
    'eagle_1003': 'Eagle 1003',
    'eagle_125f': 'Eagle 125F',
    'eagle_2001': 'Eagle 2001',
    'eagle3001': 'Eagle3001',
    'robovr': 'RoboVR',
    'ai_visual_module': 'AI Visual Module',
    'make_u': 'Make U',
    'a1': 'A1',
    'a3': 'A3',
    'a7': 'A7',
    'b3_pro': 'B3 Pro',
    'c3': 'C3',
    'd1': 'D1',
    'd3_pro': 'D3 Pro',
    'e7_pro': 'E7 Pro',
    'e9_pro': 'E9 Pro',
    'pubbo': 'Pubbo'
  };
  
  const docTypeNames = {
    'courses': 'Courses',
    'parts_list': 'Parts List',
    'project_pictures': 'Project Pictures',
    'user_manual': 'User Manual',
    'parts_list_plus_quick_start_guide': 'Parts List + Quick Start Guide',
    'bp201_user_manual': 'BP201 User Manual',
    'sc201_user_manual': 'SC201 User Manual',
    'quick_start_guide': 'Quick Start Guide',
    'mc101s_user_manual': 'MC101S User Manual',
    'mc102_user_manual': 'MC102 User Manual',
    'mc902_user_manual': 'MC902 User Manual',
    'carton_label': 'Carton Label',
    'courses_old': 'Courses (Old)',
    'scratch': 'Scratch',
    'python': 'Python',
    'basics': 'Basics',
    'project_manual': 'Project Manual',
    'mc_602_user_guide': 'MC602 User Guide',
    'project_assembly_manual': 'Project Assembly Manual',
    'parts_list_plus_building_guide': 'Parts List + Building Guide',
    'mc603_user_manual': 'MC603 User Manual',
    'fpv_quick_start': 'FPV Quick Start',
    'user_guide': 'User Guide',
    'parts_list_plus_quick_start_guide_plus_field_setup_tutorial': 'Parts List + Quick Start + Field Setup',
    'quick_start': 'Quick Start',
    'program_guide': 'Program Guide',
    'wind_rider': 'Wind Rider',
    'outer_packaging_box': 'Outer Packaging Box',
    'robovr_tutorial': 'RoboVR Tutorial',
    'robovr_contest_signup_tutorial': 'RoboVR Contest Signup Tutorial',
    'ai_visual_module_introduction': 'AI Visual Module Introduction',
    'make_u_coding_cards__introduction': 'Make U Coding Cards Introduction',
    'storybook': 'Storybook',
    'manual_and_list': 'Manual & List',
    'building_guide_plus_manual_plus_storybook': 'Building Guide + Manual + Storybook',
    'parts_list_plus_storybook': 'Parts List + Storybook',
    'parts_list_plus_quick_start_guide': 'Parts List + Quick Start Guide',
    'product_images': 'Product Images',
    'building_guide': 'Building Guide',
    'pack_label': 'Pack Label',
    'user_manual__plus__video': 'User Manual + Video'
  };
  
  return `${categoryNames[category] || category} - ${productNames[product] || product} - ${docTypeNames[docType] || docType}`;
}

// 处理未匹配的路由
app.use((req, res) => {
  res.status(404).json({
    error: '端点不存在',
    availableEndpoints: {
      health: '/api/health',
      getLink: '/api/link/:folderId',
      enjoyAiStructure: '/api/hierarchical/enjoy_ai',
      enjoyAiLink: '/api/hierarchical/link?year=X&project=Y&docType=Z',
      enjoyAiAllStatus: '/api/hierarchical/all_status',
      enjoyAiYearStatus: '/api/hierarchical/status/:year',
      enjoyAiProjectStatus: '/api/hierarchical/status/:year/:project',
      whalesbotStructure: '/api/hierarchical/whalesbot',
      whalesbotLink: '/api/hierarchical/whalesbot_link?category=X&product=Y&docType=Z',
      whalesbotAllStatus: '/api/hierarchical/whalesbot_all_status',
      whalesbotCategoryStatus: '/api/hierarchical/whalesbot_status/:category',
      whalesbotProductStatus: '/api/hierarchical/whalesbot_status/:category/:product',
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
  console.log(`📁 2025年ENJOY AI项目: ${Object.keys(ENJOY_AI_HIERARCHICAL_LINKS['2025']).length} 个`);
  console.log(`📁 2026年ENJOY AI项目: ${Object.keys(ENJOY_AI_HIERARCHICAL_LINKS['2026']).length} 个`);
  console.log(`📁 WhalesBot To B 产品: ${Object.keys(WHALESBOT_HIERARCHICAL_LINKS['to_b']).length} 个`);
  console.log(`📁 WhalesBot To C 产品: ${Object.keys(WHALESBOT_HIERARCHICAL_LINKS['to_c']).length} 个`);
  console.log(`🔍 链接验证: 已启用`);
  console.log(`🔍 ENJOY AI状态检测: 已启用`);
  console.log(`🔍 WhalesBot状态检测: 已启用`);
  console.log(`=========================================`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`链接状态: http://localhost:${PORT}/api/links/status`);
  console.log(`ENJOY AI结构: http://localhost:${PORT}/api/hierarchical/enjoy_ai`);
  console.log(`ENJOY AI状态: http://localhost:${PORT}/api/hierarchical/all_status`);
  console.log(`WhalesBot结构: http://localhost:${PORT}/api/hierarchical/whalesbot`);
  console.log(`WhalesBot状态: http://localhost:${PORT}/api/hierarchical/whalesbot_all_status`);
  console.log(`=========================================`);
});
