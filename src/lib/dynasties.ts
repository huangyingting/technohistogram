import { DOMAIN_ZH, REGION_ZH, TYPE_ZH, TAG_ZH } from './i18n';
import { fmtYear } from './time';

export interface DynastyEntry {
  id: string;
  zh: string;
  en: string;
  spanZh: string;
  spanEn: string;
  start: number;
  end: number;
  focusYear: number;
  noteZh: string;
  noteEn: string;
  aliases: string[];
}

export type DynastyPeriod = DynastyEntry;

export const DYNASTIES: DynastyEntry[] = [
  {
    id: 'paleolithic',
    zh: '旧石器时代',
    en: 'Paleolithic Era',
    spanZh: '约前330万年 — 前10000年',
    spanEn: '3.3M — 10,000 BCE',
    start: -3300000,
    end: -10000,
    focusYear: -40000,
    noteZh: '打制石器、用火控制、赭石颜料与早期骨角工具起源',
    noteEn: 'Knapped stone tools, controlled fire, ochre pigments & bone implements',
    aliases: ['旧石器', '石器时代', '远古', 'jiushiqi', 'jsq', 'paleolithic', 'stone age'],
  },
  {
    id: 'neolithic',
    zh: '新石器与农耕起源',
    en: 'Neolithic Revolution',
    spanZh: '约前10000年 — 前3000年',
    spanEn: '10,000 — 3000 BCE',
    start: -10000,
    end: -3000,
    focusYear: -7000,
    noteZh: '稻作与麦作驯化、制陶、纺织、灌溉与定居聚落诞生',
    noteEn: 'Crop domestication, pottery, weaving, irrigation & early settlements',
    aliases: ['新石器', '农耕', '仰韶', '河姆渡', 'xinshiqi', 'xsq', 'yangshao', 'hemudu', 'neolithic'],
  },
  {
    id: 'bronze-cradles',
    zh: '青铜时代与古文明',
    en: 'Bronze Age Civilizations',
    spanZh: '前3300年 — 前1200年',
    spanEn: '3300 — 1200 BCE',
    start: -3300,
    end: -1200,
    focusYear: -2500,
    noteZh: '楔形文字、圣书体、轮车、青铜冶铸与大型水利工程',
    noteEn: 'Cuneiform, wheeled vehicles, bronze metallurgy & monumental hydraulics',
    aliases: ['青铜时代', '青铜', '苏美尔', '古埃及', '巴比伦', 'qingtong', 'qt', 'sumer', 'ancient egypt', 'bronze age'],
  },
  {
    id: 'shang',
    zh: '商朝（殷商）',
    en: 'Shang Dynasty',
    spanZh: '约前1600年 — 前1046年',
    spanEn: 'c. 1600 — 1046 BCE',
    start: -1600,
    end: -1046,
    focusYear: -1200,
    noteZh: '甲骨卜辞文字体系、块范法大型青铜礼器铸造与马车传入',
    noteEn: 'Oracle-bone script, piece-mold bronze casting & chariots at Anyang',
    aliases: ['商朝', '商代', '殷商', '夏商周', '夏商', '甲骨文', 'shangchao', 'shangdai', 'yinshang', 'shang dynasty'],
  },
  {
    id: 'zhou-spring',
    zh: '西周与春秋',
    en: 'Western Zhou & Spring and Autumn',
    spanZh: '前1046年 — 前476年',
    spanEn: '1046 — 476 BCE',
    start: -1046,
    end: -476,
    focusYear: -500,
    noteZh: '早期生铁高炉鼓风冶炼、铁农具普及、历法圭表与币制萌芽',
    noteEn: 'Early blast-furnace cast iron, iron ploughshares & gnomon astronomy',
    aliases: ['西周', '东周', '周朝', '春秋', '春秋时代', 'xizhou', 'zhou', 'chunqiu', 'cq', 'spring and autumn'],
  },
  {
    id: 'warring-states',
    zh: '战国时代',
    en: 'Warring States Period',
    spanZh: '前475年 — 前221年',
    spanEn: '475 — 221 BCE',
    start: -475,
    end: -221,
    focusYear: -300,
    noteZh: '都江堰无坝引水、算筹十进位制、青铜弩机标准化与《考工记》《墨经》光学力学',
    noteEn: 'Dujiangyan irrigation, counting rods, standardized crossbows & Mohist optics',
    aliases: ['战国', '春秋战国', '先秦', 'zhanguo', 'zg', 'xianqin', 'warring states'],
  },
  {
    id: 'classical-greco-roman',
    zh: '古典希腊与罗马',
    en: 'Classical Greece & Rome',
    spanZh: '前500年 — 公元476年',
    spanEn: '500 BCE — 476 CE',
    start: -500,
    end: 476,
    focusYear: -100,
    noteZh: '几何公理化、阿基米德螺旋泵、安提基特拉机械、罗马水渠与火山灰混凝土',
    noteEn: 'Euclidean geometry, Antikythera mechanism, Roman aqueducts & pozzolanic concrete',
    aliases: ['古希腊', '古罗马', '罗马帝国', '希腊化', 'guxila', 'guluoma', 'luoma', 'ancient greece', 'roman empire'],
  },
  {
    id: 'qin',
    zh: '秦朝',
    en: 'Qin Dynasty',
    spanZh: '前221年 — 前207年',
    spanEn: '221 — 207 BCE',
    start: -221,
    end: -207,
    focusYear: -214,
    noteZh: '书同文车同轨、统一度量衡、灵渠船闸与驰道驿传网络',
    noteEn: 'Standardized weights, axle widths, script, Lingqu Canal & imperial highways',
    aliases: ['秦朝', '秦代', '大秦', '秦始皇', 'qinchao', 'qindai', 'qin dynasty'],
  },
  {
    id: 'han',
    zh: '汉朝（西汉·东汉）',
    en: 'Han Dynasty',
    spanZh: '前202年 — 公元220年',
    spanEn: '202 BCE — 220 CE',
    start: -202,
    end: 220,
    focusYear: 105,
    noteZh: '蔡伦改进造纸术、张衡候风地动仪与水运浑象、耧车播种、炒钢法与《九章算术》',
    noteEn: 'Cai Lun papermaking, Zhang Heng seismoscope, seed drill & Nine Chapters mathematics',
    aliases: ['汉朝', '汉代', '西汉', '东汉', '两汉', '秦汉', 'hanchao', 'handai', 'xihan', 'donghan', 'han dynasty'],
  },
  {
    id: 'six-dynasties',
    zh: '魏晋南北朝',
    en: 'Three Kingdoms & Six Dynasties',
    spanZh: '220年 — 589年',
    spanEn: '220 — 589 CE',
    start: 220,
    end: 589,
    focusYear: 480,
    noteZh: '祖冲之圆周率密率、马钧翻车与指南车、灌钢冶炼与《齐民要术》农学体系',
    noteEn: 'Zu Chongzhi pi approximation, co-fusion steelmaking, stirrups & Qimin Yaoshu agronomy',
    aliases: ['三国', '两晋', '魏晋', '南北朝', '魏晋南北朝', 'sanguo', 'weijin', 'nanbeichao', 'three kingdoms'],
  },
  {
    id: 'sui-tang',
    zh: '隋唐时代',
    en: 'Sui & Tang Dynasties',
    spanZh: '581年 — 907年',
    spanEn: '581 — 907 CE',
    start: 581,
    end: 907,
    focusYear: 725,
    noteZh: '大运河贯通、赵州敞肩石拱桥、雕版印刷术、僧一行子午线实测与早期火药配方',
    noteEn: 'Grand Canal, Zhaozhou Bridge, woodblock printing, meridian survey & early gunpowder',
    aliases: ['隋朝', '唐朝', '唐代', '盛唐', '隋唐', '大唐', 'tangchao', 'tangdai', 'suitang', 'suichao', 'tang dynasty'],
  },
  {
    id: 'islamic-golden',
    zh: '伊斯兰黄金时代',
    en: 'Islamic Golden Age',
    spanZh: '750年 — 1258年',
    spanEn: '750 — 1258 CE',
    start: 750,
    end: 1258,
    focusYear: 1000,
    noteZh: '花拉子米代数学、海什木实验光学、星盘精密仪器、医院制度与水力自动机',
    noteEn: 'Al-Khwarizmi algebra, Ibn al-Haytham optics, astrolabes, hospitals & automata',
    aliases: ['伊斯兰黄金时代', '阿拉伯帝国', '阿拔斯', 'yisilan', 'alabo', 'islamic golden age', 'abbasid'],
  },
  {
    id: 'song',
    zh: '宋朝（北宋·南宋）',
    en: 'Song Dynasty',
    spanZh: '960年 — 1279年',
    spanEn: '960 — 1279 CE',
    start: 960,
    end: 1279,
    focusYear: 1088,
    noteZh: '毕昇胶泥活字、航海罗盘针、苏颂水运仪象台擒纵机构、交子纸币与《梦溪笔谈》',
    noteEn: 'Bi Sheng movable type, mariner compass, Su Song clocktower escapement & paper money',
    aliases: ['宋朝', '宋代', '北宋', '南宋', '两宋', '宋元', 'songchao', 'songdai', 'beisong', 'nansong', 'sc', 'song dynasty'],
  },
  {
    id: 'yuan',
    zh: '元朝',
    en: 'Yuan Dynasty',
    spanZh: '1271年 — 1368年',
    spanEn: '1271 — 1368 CE',
    start: 1271,
    end: 1368,
    focusYear: 1313,
    noteZh: '郭守敬《授时历》与简仪、王祯木活字转轮排字盘、黄道婆棉纺革新与青花瓷成熟',
    noteEn: 'Guo Shoujing Shoushi calendar, Wang Zhen revolving type table & cotton spinning innovations',
    aliases: ['元朝', '元代', '蒙元', 'yuanchao', 'yuandai', 'yuan dynasty'],
  },
  {
    id: 'renaissance',
    zh: '文艺复兴与大航海',
    en: 'Renaissance & Age of Sail',
    spanZh: '1400年 — 1600年',
    spanEn: '1400 — 1600 CE',
    start: 1400,
    end: 1600,
    focusYear: 1455,
    noteZh: '郑和远洋宝船、古腾堡铅合金活字印刷、透视画法、哥白尼日心说与远洋航海图',
    noteEn: 'Zheng He voyages, Gutenberg press, perspective geometry, Copernican astronomy & oceanic navigation',
    aliases: ['文艺复兴', '大航海', '大航海时代', 'wenyifuxing', 'wyfx', 'dahanghai', 'renaissance', 'age of discovery'],
  },
  {
    id: 'ming',
    zh: '明朝',
    en: 'Ming Dynasty',
    spanZh: '1368年 — 1644年',
    spanEn: '1368 — 1644 CE',
    start: 1368,
    end: 1644,
    focusYear: 1637,
    noteZh: '郑和下西洋航海术、李时珍《本草纲目》、人痘接种免疫、徐光启中西历算与宋应星《天工开物》',
    noteEn: 'Zheng He fleets, Compendium of Materia Medica, variolation & Tiangong Kaiwu encyclopedia',
    aliases: ['明朝', '明代', '大明', '明清', 'mingchao', 'mingdai', 'mc', 'ming dynasty'],
  },
  {
    id: 'scientific-rev',
    zh: '科学革命',
    en: 'Scientific Revolution',
    spanZh: '1543年 — 1700年',
    spanEn: '1543 — 1700 CE',
    start: 1543,
    end: 1700,
    focusYear: 1687,
    noteZh: '望远镜与显微镜、气压真空实验、摆钟、微积分与牛顿《自然哲学的数学原理》',
    noteEn: 'Telescope, microscope, pendulum clock, calculus & Newtonian mechanics',
    aliases: ['科学革命', 'kexuegeming', 'kxgm', 'scientific revolution'],
  },
  {
    id: 'qing',
    zh: '清朝',
    en: 'Qing Dynasty',
    spanZh: '1644年 — 1912年',
    spanEn: '1644 — 1912 CE',
    start: 1644,
    end: 1912,
    focusYear: 1868,
    noteZh: '康熙实测《皇舆全览图》、江南制造局译书与近代造船、电报铁路引入及京张铁路自主设计',
    noteEn: 'Kangxi atlas survey, Jiangnan Arsenal translations, telegraphy & Beijing-Zhangjiakou railway',
    aliases: ['清朝', '清代', '晚清', '洋务运动', '大清', 'qingchao', 'qingdai', 'wanqing', 'yangwu', 'qing dynasty'],
  },
  {
    id: 'industrial-1',
    zh: '第一次工业革命（蒸汽时代）',
    en: 'First Industrial Revolution',
    spanZh: '1760年 — 1840年',
    spanEn: '1760 — 1840 CE',
    start: 1760,
    end: 1840,
    focusYear: 1776,
    noteZh: '珍妮纺纱机、瓦特分离冷凝器蒸汽机、焦炭炼铁、蒸汽机车与牛痘疫苗',
    noteEn: 'Spinning frame, Watt steam engine, coke ironmaking, railways & smallpox vaccination',
    aliases: ['工业革命', '第一次工业革命', '蒸汽时代', '蒸汽机时代', 'gongyegeming', 'gygm', 'zhengqi', 'industrial revolution'],
  },
  {
    id: 'industrial-2',
    zh: '第二次工业革命（电气与内燃机）',
    en: 'Second Industrial Revolution',
    spanZh: '1870年 — 1914年',
    spanEn: '1870 — 1914 CE',
    start: 1870,
    end: 1914,
    focusYear: 1888,
    noteZh: '转炉炼钢、交流电网、电话无线电、内燃机汽车、莱特兄弟飞行与哈伯合成氨',
    noteEn: 'Bessemer steel, AC power grids, telephone, radio, automobiles, powered flight & Haber ammonia',
    aliases: ['第二次工业革命', '电气时代', '电气革命', 'dianqishidai', 'dqsd', 'second industrial revolution', 'electric age'],
  },
  {
    id: 'republic-china',
    zh: '民国时期',
    en: 'Republic of China Era',
    spanZh: '1912年 — 1949年',
    spanEn: '1912 — 1949 CE',
    start: 1912,
    end: 1949,
    focusYear: 1930,
    noteZh: '侯氏制碱法、现代科研院所建立、汉字排字检字机械化与近代土木水利工程',
    noteEn: 'Hou’s alkali process, modern scientific institutes & Chinese mechanised typesetting',
    aliases: ['民国', '中华民国', '民国时期', 'minguo', 'mg'],
  },
  {
    id: 'atomic-space',
    zh: '原子能、晶体管与太空竞赛',
    en: 'Atomic, Transistor & Space Age',
    spanZh: '1945年 — 1975年',
    spanEn: '1945 — 1975 CE',
    start: 1945,
    end: 1975,
    focusYear: 1969,
    noteZh: 'ENIAC电子计算机、晶体管与集成电路、DNA双螺旋、人造卫星、阿波罗登月与杂交水稻',
    noteEn: 'Stored-program computers, transistors, ICs, DNA double helix, Sputnik & Apollo 11',
    aliases: ['冷战', '太空竞赛', '太空时代', '原子时代', 'lengzhan', 'taikong', 'space age', 'cold war', 'atomic age'],
  },
  {
    id: 'pc-internet',
    zh: '个人计算机与互联网时代',
    en: 'PC & Internet Era',
    spanZh: '1975年 — 2007年',
    spanEn: '1975 — 2007 CE',
    start: 1975,
    end: 2007,
    focusYear: 1993,
    noteZh: '微处理器普及、TCP/IP与万维网、光纤通信、开源生态、人类基因组计划与智能手机诞生',
    noteEn: 'Personal computers, TCP/IP, World Wide Web, fiber optics & Human Genome Project',
    aliases: ['互联网时代', '信息时代', '计算机时代', 'xinxishidai', 'xxsd', 'hulianwang', 'information age', 'internet era'],
  },
  {
    id: 'deep-learning-ai',
    zh: '深度学习与大模型纪元',
    en: 'Deep Learning & Foundation Models',
    spanZh: '2012年 — 2026年',
    spanEn: '2012 — 2026 CE',
    start: 2012,
    end: 2026,
    focusYear: 2022,
    noteZh: 'AlexNet、CRISPR基因编辑、mRNA疫苗、Transformer架构、AlphaFold与通用大语言模型浪潮',
    noteEn: 'AlexNet, CRISPR, mRNA vaccines, Transformer architecture, AlphaFold & frontier LLMs',
    aliases: ['深度学习', '大模型', '生成式ai', '人工智能时代', 'shenduxuexi', 'sdxx', 'damoxing', 'dmx', 'deep learning', 'llm era'],
  },
];

export function matchDynasties(rawQuery: string): DynastyEntry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q || q.length < 2) return [];
  const scored: { d: DynastyEntry; score: number }[] = [];
  for (const d of DYNASTIES) {
    let best = 0;
    if (d.zh.toLowerCase() === q || d.en.toLowerCase() === q) best = 100;
    for (const al of d.aliases) {
      const a = al.toLowerCase();
      if (a === q) best = Math.max(best, 95);
      else if (q.length >= 2 && a.startsWith(q)) best = Math.max(best, 75);
      else if (q.length >= 2 && /[\u4e00-\u9fff]/.test(q) && (a.includes(q) || d.zh.includes(q))) {
        best = Math.max(best, 70);
      }
    }
    if (best > 0) scored.push({ d, score: best });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.d.start - a.d.start)
    .slice(0, 2)
    .map((s) => s.d);
}

export function chinesePeriodParallel(year: number): string {
  if (year < -10000) return '旧石器时代';
  if (year < -2070) return '新石器时代';
  if (year < -1600) return '夏代纪年区间';
  if (year < -1046) return '商代纪年区间';
  if (year < -770) return '西周时期';
  if (year < -475) return '春秋时期';
  if (year < -221) return '战国时期';
  if (year < -202) return '秦代时期';
  if (year < 9) return '西汉时期';
  if (year < 25) return '新莽时期';
  if (year < 220) return '东汉时期';
  if (year < 280) return '三国时期';
  if (year < 420) return '两晋时期';
  if (year < 581) return '南北朝时期';
  if (year < 618) return '隋代时期';
  if (year < 907) return '唐代时期';
  if (year < 960) return '五代十国时期';
  if (year < 1127) return '北宋时期';
  if (year < 1279) return '南宋时期';
  if (year < 1368) return '元代时期';
  if (year < 1644) return '明代时期';
  if (year < 1840) return '清代前中期';
  if (year < 1912) return '晚清近代转型期';
  if (year < 1949) return '二十世纪上半叶（民国时期）';
  if (year < 1978) return '战后冷战与电子化时期';
  if (year < 2000) return '个人计算机与早期互联网时期';
  if (year < 2012) return '二十一世纪初移动与宽带时代';
  return '深度学习与智能计算纪元';
}

const SIG_PROSE_ZH: Record<number, string> = {
  5: '属于改变人类技术走向的五级核心地标事件',
  4: '属于重塑所属领域格局的四级关键突破',
  3: '属于推动技术演进链条的三级重要节点',
  2: '属于记录具体工艺或机制演进的二级技术史料',
  1: '属于提供历史背景坐标的一级文献记录',
};

export function synthesizeZhArchivalDigest(
  e: any,
  inc: any[],
  out: any[],
): string {
  const yrStr = fmtYear(e.year);
  const period = chinesePeriodParallel(e.year);
  const reg = REGION_ZH[e.region]?.label || '';
  const dom = DOMAIN_ZH[e.domain]?.label || e.domain || '技术史';
  const typ = TYPE_ZH[e.type] || '史料记录';
  const sig = SIG_PROSE_ZH[e.significance] || '';
  const parts: string[] = [];

  const locPhrase = reg && reg !== '全球' ? `发生于${reg}` : '具有全球范围影响';
  parts.push(
    `本条目记录${yrStr}（${period}）${locPhrase}的一项「${dom}」领域${typ}${sig ? `，${sig}` : ''}。`,
  );

  const who = (e.people || []).slice(0, 3).join('、');
  const org = (e.orgs || []).slice(0, 3).join('、');
  if (who && org) {
    parts.push(`核心人物与机构涉及 ${who} 及 ${org}。`);
  } else if (who) {
    parts.push(`相关关键人物包括 ${who}。`);
  } else if (org) {
    parts.push(`主要关联机构包括 ${org}。`);
  }

  const zhTags = (e.tags || [])
    .slice(0, 3)
    .map((t: string) => TAG_ZH[t] || t.replace(/-/g, ' '))
    .filter(Boolean);
  if (zhTags.length) {
    parts.push(`该事件归入「${zhTags.join(' · ')}」技术演进脉络。`);
  }

  const prevNames = inc
    .slice(0, 2)
    .map((x) => `《${x.title_short || x.title}》（${fmtYear(x.year)}）`);
  const nextNames = out
    .slice(0, 2)
    .map((x) => `《${x.title_short || x.title}》（${fmtYear(x.year)}）`);
  if (prevNames.length && nextNames.length) {
    parts.push(`在因果图谱中承接${prevNames.join('、')}，并进一步启发或促成了${nextNames.join('、')}。`);
  } else if (prevNames.length) {
    parts.push(`在技术谱系上承接自${prevNames.join('、')}。`);
  } else if (nextNames.length) {
    parts.push(`其后续影响直接延伸至${nextNames.join('、')}。`);
  }

  return parts.join('');
}
