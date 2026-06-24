// 节日日历服务 — 为「节日节点」选品场景提供结构化节日信息
// 包含日期、文化背景、送礼建议、推荐材质/器型、选题模板等
// 作为选题生成和文案创作的上下文数据

export type FestivalType = 'traditional' | 'modern' | 'commercial' | 'seasonal';

export interface FestivalInfo {
  id: string;                    // 唯一标识，格式 yyyy_mm_dd_name
  name: string;                  // 节日名称
  month: number;                 // 月份 1-12
  day: number;                   // 日期 1-31
  type: FestivalType;            // 节日类型
  description: string;           // 一句话描述
  culturalBackground: string;    // 文化背景/含义（用于文案创作）
  giftSuggestions: string[];     // 送礼建议
  recommendedMaterials: string[];// 推荐材质大类
  recommendedTypes: string[];    // 推荐器型
  priceRange: [number, number];  // 建议价格区间 [min, max]
  marketingKeywords: string[];   // 营销关键词
  topicTemplates: string[];      // 选题标题模板（Markdown 模板）
  leadDays: number;              // 提前准备天数
  duration: number;              // 节日持续时间（天）
}

// ========== 节日数据 ==========

const FESTIVALS: FestivalInfo[] = [
  // ── 1月 ──
  {
    id: '0101_new_year',
    name: '元旦',
    month: 1, day: 1,
    type: 'modern',
    description: '公历新年第一天，辞旧迎新的送礼节点',
    culturalBackground: '一元复始，万象更新。元旦作为公历新年，是中国人表达祝福、规划新开始的重要时刻。近年演变为轻奢消费节点，年轻人喜欢在新年买件珠宝犒赏自己。',
    giftSuggestions: ['送自己', '送伴侣', '送朋友'],
    recommendedMaterials: ['贵金属', '玉'],
    recommendedTypes: ['吊坠', '手链', '戒指'],
    priceRange: [500, 3000],
    marketingKeywords: ['新年礼物', '开运', '马年纪念', '本命年', '新年第一件珠宝'],
    topicTemplates: [
      '2026马年第一件珠宝，选它开启好运',
      '新年开运｜本命年必入的{name}',
      '元旦礼物清单｜500-3000元轻奢珠宝推荐',
      '新的一年，送自己一份「戴得起」的仪式感',
    ],
    leadDays: 14,
    duration: 3,
  },
  {
    id: '0129_spring_festival',
    name: '春节',
    month: 1, day: 29,
    type: 'traditional',
    description: '农历新年，中国最重要的传统节日，送礼/自购/本命年消费高峰',
    culturalBackground: '春节是中华民族最隆重的传统节日，2026年为丙午马年。马象征奔腾向前、马到成功。传统有"拜年送礼"习俗，翡翠寓意平安、黄金代表富贵。2026年属马人逢本命年，红色编绳、马生肖金饰需求旺盛。',
    giftSuggestions: ['送长辈', '送父母', '送自己', '送客户'],
    recommendedMaterials: ['贵金属', '玉', '水晶'],
    recommendedTypes: ['手镯', '吊坠', '手链', '摆件'],
    priceRange: [500, 10000],
    marketingKeywords: ['年货', '本命年', '马年', '开运', '古法金', '压岁钱', '拜年礼'],
    topicTemplates: [
      '2026马年本命年｜红绳手串这样搭，开运又时髦',
      '过年送长辈｜{name}，寓意吉祥又体面',
      '年货清单｜这些「戴得走」的压岁钱',
      '马年开运珠宝Top10，第{num}件必入',
      '春节见家长｜选{name}不出错',
    ],
    leadDays: 30,
    duration: 7,
  },

  // ── 2月 ──
  {
    id: '0214_valentine',
    name: '情人节',
    month: 2, day: 14,
    type: 'modern',
    description: '西方情人节，情侣互赠礼物表达爱意的核心节点',
    culturalBackground: '情人节是全世界表达爱意的重要节日。在中国年轻群体中已成为硬性消费节点。玫瑰金、钻石、心形元素是情人节珠宝的主流符号。"买对戒"成为情人节标配动作。',
    giftSuggestions: ['送伴侣', '送暗恋对象', '送自己'],
    recommendedMaterials: ['贵金属'],
    recommendedTypes: ['项链', '戒指', '耳饰', '手链'],
    priceRange: [300, 5000],
    marketingKeywords: ['情人节礼物', '玫瑰金', '对戒', '浪漫礼赠', '心动款'],
    topicTemplates: [
      '情人节送礼指南｜{priceRange}预算怎么选？',
      '对戒推荐｜{name}，把爱戴在手上',
      '玫瑰金项链合集｜情人节限定',
      '这篇帮你搞定情人节礼物｜{name}闭眼入',
    ],
    leadDays: 14,
    duration: 3,
  },

  // ── 3月 ──
  {
    id: '0308_women_day',
    name: '三八妇女节',
    month: 3, day: 8,
    type: 'modern',
    description: '国际妇女节，近年演变为"女王节/女神节"，女性悦己消费爆发点',
    culturalBackground: '三八妇女节已从传统纪念日演变为"女性消费节"。品牌常以"悦己""独立""宠爱自己"为营销主题。珍珠、彩宝、轻奢K金等品类需求旺盛。',
    giftSuggestions: ['送自己', '送妈妈', '送闺蜜', '公司福利'],
    recommendedMaterials: ['珍珠', '彩宝', '贵金属'],
    recommendedTypes: ['项链', '耳饰', '手链'],
    priceRange: [300, 2000],
    marketingKeywords: ['女神节', '女王节', '悦己消费', '女性礼赠', '宠爱自己'],
    topicTemplates: [
      '女神节给自己挑件珠宝｜{name}太适合通勤了',
      '送妈妈的礼物｜{name}，致敬她的芳华',
      '三八节公司福利怎么选？{priceRange}高性价比推荐',
    ],
    leadDays: 10,
    duration: 3,
  },

  // ── 4月 ──
  {
    id: '0405_qingming',
    name: '清明节',
    month: 4, day: 5,
    type: 'traditional',
    description: '祭祖扫墓、踏青出游的传统节日，轻量级节点',
    culturalBackground: '清明节是祭祖和踏青的节日。虽非珠宝消费主力节点，但踏春出游场景可搭配轻便首饰。"春色满园"主题的翡翠、绿松石等绿色系珠宝在这个节点有内容话题性。',
    giftSuggestions: [],
    recommendedMaterials: ['玉', '水晶'],
    recommendedTypes: ['手串', '吊坠'],
    priceRange: [200, 1500],
    marketingKeywords: ['踏青', '春色', '绿', '新中式', '出游搭配'],
    topicTemplates: [
      '踏青出游｜{name}搭配春日穿搭太灵了',
      '春色满园｜这些绿色系珠宝让人一眼心动',
    ],
    leadDays: 5,
    duration: 3,
  },

  // ── 5月 ──
  {
    id: '0510_mothers_day',
    name: '母亲节',
    month: 5, day: 10,
    type: 'modern',
    description: '感恩母亲的节日，翡翠/珍珠/黄金是最经典的母亲节礼物',
    culturalBackground: '母亲节是珠宝行业全年最重要的"送长辈"节点之一。珍珠寓意圆满、翡翠代表平安、黄金象征富贵。子女愿意为母消费、不设预算上限是最大特点。',
    giftSuggestions: ['送妈妈', '送婆婆', '送岳母'],
    recommendedMaterials: ['珍珠', '玉', '贵金属'],
    recommendedTypes: ['项链', '手镯', '耳饰'],
    priceRange: [500, 5000],
    marketingKeywords: ['母亲节礼物', '送妈妈', '珍珠项链', '翡翠手镯', '感恩礼'],
    topicTemplates: [
      '母亲节礼物天花板｜{name}，妈妈戴上气质拉满',
      '送妈妈珠宝指南｜{priceRange}预算选这几款',
      '婆婆/岳母都说好的礼物｜{name}',
      '妈妈的首饰盒｜这些经典款永远不会错',
    ],
    leadDays: 14,
    duration: 3,
  },
  {
    id: '0520_love_day',
    name: '520',
    month: 5, day: 20,
    type: 'commercial',
    description: '网络情人节，因"520=我爱你"谐音成为珠宝线上第二大爆发点',
    culturalBackground: '520是中文互联网特有的表达爱意的日子。谐音"我爱你"使其成为表白、送礼、领证的"吉日"。相比情人节，520更年轻化、线上化，客单价稍低但渗透率更高。',
    giftSuggestions: ['送伴侣', '表白送礼', '送自己'],
    recommendedMaterials: ['贵金属', '彩宝'],
    recommendedTypes: ['戒指', '项链', '手链', '耳饰'],
    priceRange: [200, 2000],
    marketingKeywords: ['520礼物', '表白', '浪漫', '轻奢', '情侣款'],
    topicTemplates: [
      '520送她{name}，比说100句我爱你更管用',
      '表白成功秘籍｜{priceRange}预算选这{num}件',
      '小众不撞款｜520礼物清单',
      '单身也要爱自己｜520悦己珠宝推荐',
    ],
    leadDays: 10,
    duration: 3,
  },
  {
    id: '0531_dragon_boat',
    name: '端午节',
    month: 5, day: 31,
    type: 'traditional',
    description: '传统端午佳节，粽子/香囊主题首饰受欢迎',
    culturalBackground: '端午节是纪念屈原的传统节日，赛龙舟、吃粽子的同时，佩戴香囊、五彩绳是传统习俗。近年衍生出"粽子金饰""龙舟元素"等创意珠宝。翡翠、和田玉等传统题材产品适合此节点。',
    giftSuggestions: ['送长辈', '送客户'],
    recommendedMaterials: ['玉', '水晶', '贵金属'],
    recommendedTypes: ['手串', '吊坠', '摆件'],
    priceRange: [300, 3000],
    marketingKeywords: ['端午礼', '香囊金', '五彩绳', '祈福', '安康'],
    topicTemplates: [
      '端午安康｜{name}，中国传统色的魅力',
      '端午送礼清单｜{priceRange}以内的精致之选',
    ],
    leadDays: 10,
    duration: 3,
  },

  // ── 6月 ──
  {
    id: '0601_children_day',
    name: '六一儿童节',
    month: 6, day: 1,
    type: 'modern',
    description: '儿童节，适合亲子/童趣主题珠宝',
    culturalBackground: '六一儿童节虽是儿童节日，但近年来"大儿童也要过节"的文化盛行，生肖金钞、小金豆、儿童金手镯等品类需求增长。同时"送自己一份童年梦想"的悦己消费也在这个节点活跃。',
    giftSuggestions: ['送孩子', '送自己', '送朋友孩子'],
    recommendedMaterials: ['贵金属'],
    recommendedTypes: ['手镯', '金豆', '金钞', '吊坠'],
    priceRange: [200, 2000],
    marketingKeywords: ['儿童节', '童心', '小金豆', '亲子', '可爱'],
    topicTemplates: [
      '六一儿童节｜{name}，每个大人心里都住着小孩',
      '送给小朋友的第一件珠宝｜金豆子储蓄计划',
    ],
    leadDays: 7,
    duration: 2,
  },
  {
    id: '0621_fathers_day',
    name: '父亲节',
    month: 6, day: 21,
    type: 'modern',
    description: '感恩父亲的节日，玉石/金饰/手表配件类需求',
    culturalBackground: '父亲节相比母亲节消费力稍弱，但玉石挂件、金饰、男士手串等品类需求稳定。"父爱如山"的走心内容是打动消费者的关键。',
    giftSuggestions: ['送爸爸', '送公公', '送岳父'],
    recommendedMaterials: ['玉'],
    recommendedTypes: ['吊坠', '手串', '摆件'],
    priceRange: [300, 3000],
    marketingKeywords: ['父亲节礼物', '送爸爸', '玉石', '感恩父爱'],
    topicTemplates: [
      '父亲节｜送{name}给爸爸，把平安戴在他身上',
      '爸爸的珠宝盒｜这些男士首饰高级不张扬',
    ],
    leadDays: 10,
    duration: 2,
  },

  // ── 7月 ──
  {
    id: '0701_summer',
    name: '暑期消费季',
    month: 7, day: 1,
    type: 'seasonal',
    description: '暑期旅游、度假消费旺季，轻便/防晒/出游场景珠宝',
    culturalBackground: '暑期是旅游旺季，轻量化、便携带、好搭配的珠宝在这个季节更受欢迎。水晶、银饰、串珠等材质适合度假场景。"露肤度"提升使项链、手链等品类需求增加。',
    giftSuggestions: ['送自己', '送朋友', '出游搭配'],
    recommendedMaterials: ['水晶', '银饰', '彩宝'],
    recommendedTypes: ['手串', '项链', '耳饰', '手链'],
    priceRange: [100, 1000],
    marketingKeywords: ['暑期', '出游', '度假', '夏日搭配', '轻量化'],
    topicTemplates: [
      '暑期出游｜{name}，搭配比基尼也超好看',
      '夏日珠宝三件套｜这{num}件承包整个夏天',
    ],
    leadDays: 5,
    duration: 60,
  },

  // ── 8月 ──
  {
    id: '0829_qixi',
    name: '七夕节',
    month: 8, day: 29,
    type: 'traditional',
    description: '中国传统情人节，珠宝行业全年第一大节日节点',
    culturalBackground: '七夕源自牛郎织女的爱情传说，是中国本土最具浪漫色彩的节日。近年已成为珠宝行业全年最重要的营销节点，销售额远超西方情人节。古法金、定制款、限定款在这一节点爆发。传统文化元素与现代设计的融合款最受欢迎。',
    giftSuggestions: ['送伴侣', '求婚送礼', '结婚纪念'],
    recommendedMaterials: ['贵金属', '玉', '彩宝'],
    recommendedTypes: ['戒指', '项链', '手镯', '耳饰'],
    priceRange: [500, 8000],
    marketingKeywords: ['七夕礼物', '中国情人节', '东方浪漫', '限定款', '定制', '鹊桥'],
    topicTemplates: [
      '七夕情人节｜{name}，东方美学的浪漫告白',
      '七夕限定｜今年最值得入手的{num}款珠宝',
      '遥遥之约｜{name}，把鹊桥戴在手上',
      '不踩雷的七夕礼物清单｜{priceRange}预算够',
    ],
    leadDays: 20,
    duration: 5,
  },

  // ── 9月 ──
  {
    id: '0910_teachers_day',
    name: '教师节',
    month: 9, day: 10,
    type: 'modern',
    description: '感恩老师的节日，轻量级送礼节点',
    culturalBackground: '教师节是表达对老师感激之情的日子。学生及家长会选择有纪念意义的小件礼品，珠宝类以银饰、珍珠、金钞等轻客单价产品为主。"润物细无声"的情感表达是核心。',
    giftSuggestions: ['送老师', '送导师'],
    recommendedMaterials: ['银饰', '珍珠'],
    recommendedTypes: ['胸针', '耳饰', '金钞'],
    priceRange: [100, 1000],
    marketingKeywords: ['教师节礼物', '感恩老师', '桃李满天下'],
    topicTemplates: [
      '教师节｜{name}，感谢您照亮我们前行的路',
    ],
    leadDays: 7,
    duration: 2,
  },
  {
    id: '1001_national_day',
    name: '国庆节',
    month: 10, day: 1,
    type: 'modern',
    description: '国庆黄金周，秋季婚庆高峰+出游消费双叠加',
    culturalBackground: '国庆节是年度最重要的长假之一，同时是秋季结婚高峰期。婚庆刚需（三金+钻戒）与出游悦己消费双重叠加，是珠宝行业的黄金周。门店试戴体验、婚庆套餐促销是核心动作。',
    giftSuggestions: ['婚庆采购', '出游自购', '送亲友'],
    recommendedMaterials: ['贵金属', '玉', '彩宝'],
    recommendedTypes: ['手镯', '戒指', '项链', '吊坠'],
    priceRange: [500, 20000],
    marketingKeywords: ['国庆婚庆', '婚嫁季', '黄金周', '三金', '婚戒'],
    topicTemplates: [
      '国庆结婚季｜三金这样选不踩坑',
      '{name}｜国庆出游搭配指南',
      '婚嫁季珠宝清单｜{priceRange}预算也能买到心仪款',
    ],
    leadDays: 14,
    duration: 7,
  },
  {
    id: '1007_double_ninth',
    name: '重阳节',
    month: 10, day: 7,
    type: 'traditional',
    description: '重阳敬老节，玉石/翡翠/珍珠适合送长辈',
    culturalBackground: '九九重阳，寓意长久长寿，是传统的敬老节日。翡翠手镯、珍珠项链、金饰是重阳节送长辈的经典选择。相比母亲节/父亲节更注重"健康长寿"的祝福含义。',
    giftSuggestions: ['送长辈', '送父母', '送爷爷奶奶'],
    recommendedMaterials: ['玉', '珍珠', '贵金属'],
    recommendedTypes: ['手镯', '项链', '吊坠'],
    priceRange: [500, 5000],
    marketingKeywords: ['重阳节', '敬老', '长寿', '送长辈', '福寿安康'],
    topicTemplates: [
      '重阳节｜{name}，把平安祝福戴在手上',
      '送长辈珠宝不踩坑｜{priceRange}预算看这篇',
    ],
    leadDays: 7,
    duration: 3,
  },

  // ── 11月 ──
  {
    id: '1111_singles_day',
    name: '双11',
    month: 11, day: 11,
    type: 'commercial',
    description: '全年最大线上购物节，珠宝线上销售额最高的一日',
    culturalBackground: '双11已从"光棍节"演变为全民购物狂欢节。珠宝品类线上渗透率逐年攀升，直播带货是核心渠道。品牌通常提前30天蓄水，以爆款预售+直播间秒杀+满减优惠为核心策略。轻奢款和爆款最受欢迎。',
    giftSuggestions: ['自购囤货', '送礼', '年终犒赏'],
    recommendedMaterials: ['贵金属', '珍珠', '彩宝'],
    recommendedTypes: ['项链', '耳饰', '手链', '戒指'],
    priceRange: [200, 5000],
    marketingKeywords: ['双11', '双十一', '预售', '爆款', '直播', '秒杀', '全年最低'],
    topicTemplates: [
      '双11珠宝清单｜{name}，全年最低价必入',
      '不想吃土的双11攻略｜{priceRange}预算买这些',
      '预售开启｜{name}限量100件，手慢无',
    ],
    leadDays: 30,
    duration: 3,
  },
  {
    id: '1126_thanksgiving',
    name: '感恩节',
    month: 11, day: 26,
    type: 'modern',
    description: '感恩主题节日，走心内容营销节点',
    culturalBackground: '感恩节虽非中国传统节日，但"感恩"主题适合做走心内容营销。"感谢一路有你""送给最重要的人"等情感叙事能有效触达消费者。适合做会员回馈和情感绑定。',
    giftSuggestions: ['送父母', '送伴侣', '送恩人'],
    recommendedMaterials: ['银饰', '珍珠', '水晶'],
    recommendedTypes: ['手链', '吊坠', '耳饰'],
    priceRange: [200, 2000],
    marketingKeywords: ['感恩', '感谢', '暖心礼', '回馈'],
    topicTemplates: [
      '感恩节｜{name}，送给生命中最重要的她',
      '感谢一路有你｜{priceRange}以内的感恩好礼',
    ],
    leadDays: 7,
    duration: 2,
  },

  // ── 12月 ──
  {
    id: '1212_double_twelve',
    name: '双12',
    month: 12, day: 12,
    type: 'commercial',
    description: '年终促销节点，清库存+为新年蓄水',
    culturalBackground: '双12是双11的延续和补充，力度不如双11但仍是重要促销节点。商家常以"年终清仓""新年预备"为主题，适合清库存、推年货。',
    giftSuggestions: ['自购', '年终囤货'],
    recommendedMaterials: ['贵金属', '水晶', '银饰'],
    recommendedTypes: ['项链', '耳饰', '手链'],
    priceRange: [100, 2000],
    marketingKeywords: ['双12', '年终', '清仓', '年底扫货'],
    topicTemplates: [
      '双12捡漏｜{name}，错过双11就别再错过这次',
      '年终珠宝扫货指南｜{priceRange}以内好物',
    ],
    leadDays: 7,
    duration: 3,
  },
  {
    id: '1225_christmas',
    name: '圣诞节',
    month: 12, day: 25,
    type: 'modern',
    description: '西方圣诞节，情侣+社交送礼节点',
    culturalBackground: '圣诞节在中国年轻群体中已深度扎根，情侣互赠礼物、闺蜜换礼、派对穿搭等场景驱动消费。玫瑰金、红玉髓、雪花元素是圣诞珠宝的常见设计方向。',
    giftSuggestions: ['送伴侣', '送闺蜜', '派对穿搭', '送自己'],
    recommendedMaterials: ['贵金属', '彩宝', '水晶'],
    recommendedTypes: ['项链', '戒指', '耳饰', '手链'],
    priceRange: [200, 3000],
    marketingKeywords: ['圣诞礼物', '冬日', '派对', '限定款', '温暖礼'],
    topicTemplates: [
      '圣诞礼物｜{name}，圣诞树下的小惊喜',
      '冬日限定｜{name}，温暖整个冬天',
      '圣诞派对穿搭｜{name}是点睛之笔',
    ],
    leadDays: 14,
    duration: 3,
  },
  {
    id: '1231_new_year_eve',
    name: '跨年夜',
    month: 12, day: 31,
    type: 'modern',
    description: '年末收官节点，辞旧迎新主题',
    culturalBackground: '跨年夜是总结过去、展望未来的仪式感时刻。"跨年珠宝""新年战袍"概念火爆。生肖过渡款（马→羊）在这个节点开始预热。',
    giftSuggestions: ['送自己', '送伴侣'],
    recommendedMaterials: ['贵金属', '玉'],
    recommendedTypes: ['吊坠', '手链', '戒指'],
    priceRange: [300, 3000],
    marketingKeywords: ['跨年', '年终', '新年开运', '辞旧迎新', '仪式感'],
    topicTemplates: [
      '跨年夜｜{name}，用一件珠宝和2026说再见',
      '新年开运珠宝top{num}｜{name}必须拥有',
    ],
    leadDays: 7,
    duration: 2,
  },
];

// ========== 工具函数 ==========

/** 获取所有节日 */
export function getAllFestivals(): FestivalInfo[] {
  return FESTIVALS;
}

/** 按月获取节日 */
export function getFestivalsByMonth(month: number): FestivalInfo[] {
  return FESTIVALS.filter(f => f.month === month);
}

/** 按类型获取节日 */
export function getFestivalsByType(type: FestivalType): FestivalInfo[] {
  return FESTIVALS.filter(f => f.type === type);
}

/** 获取当前月份及下个月的邻近节日 */
export function getUpcomingFestivals(): FestivalInfo[] {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  return FESTIVALS.filter(f => f.month === currentMonth || f.month === nextMonth);
}

/** 获取指定月份及后续 N 个月的节日 */
export function getFestivalsInRange(startMonth: number, count: number): FestivalInfo[] {
  const result: FestivalInfo[] = [];
  for (let i = 0; i < count; i++) {
    const m = ((startMonth - 1 + i) % 12) + 1;
    result.push(...FESTIVALS.filter(f => f.month === m));
  }
  return result;
}

/** 根据当前日期计算最近的节日 */
export function getCurrentOrNextFestival(): { festival: FestivalInfo; daysUntil: number } | null {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth() + 1;

  // 按时间线排序
  const sorted = [...FESTIVALS].sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  // 找到当前日期当天或之后最近的节日
  for (const f of sorted) {
    if (f.month > currentMonth || (f.month === currentMonth && f.day >= today)) {
      const festivalDate = new Date(now.getFullYear(), f.month - 1, f.day);
      const diffMs = festivalDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / 86400000);
      return { festival: f, daysUntil: Math.max(0, daysUntil) };
    }
  }

  // 跨年：取明年第一个节日
  const first = sorted[0];
  const nextYearDate = new Date(now.getFullYear() + 1, first.month - 1, first.day);
  const diffMs = nextYearDate.getTime() - now.getTime();
  return { festival: first, daysUntil: Math.ceil(diffMs / 86400000) };
}

/** 获取特定 ID 的节日 */
export function getFestivalById(id: string): FestivalInfo | undefined {
  return FESTIVALS.find(f => f.id === id);
}

/** 根据月份范围获取节日线（用于前端日历展示） */
export function getFestivalTimeline(startMonth: number, count: number = 3): Array<FestivalInfo & { daysUntil: number }> {
  const now = new Date();
  const festivals = getFestivalsInRange(startMonth, count);
  return festivals.map(f => {
    const fDate = new Date(now.getFullYear(), f.month - 1, f.day);
    const diffMs = fDate.getTime() - now.getTime();
    return { ...f, daysUntil: Math.ceil(diffMs / 86400000) };
  }).sort((a, b) => a.month - b.month || a.day - b.day);
}
