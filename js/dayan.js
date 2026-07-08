/**
 * 大衍筮法核心算法
 * 严格按《系辞》「分二、挂一、揲四、归奇」三变十八演实现
 */

// Seeded random using mulberry32 (deterministic but high quality)
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Combine timestamp + crypto for seed
function getSeed() {
  const timeSeed = Date.now();
  const cryptoArray = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(cryptoArray);
    return timeSeed ^ cryptoArray[0];
  }
  return timeSeed;
}

/**
 * 单次演变 (四营)
 * @param {number} totalSticks - 当前蓍草总数
 * @param {function} rng - 随机数生成器 (0-1)
 * @returns {{ remaining: number, left: number, right: number, hung: number, leftRem: number, rightRem: number, taken: number }}
 */
export function oneChange(totalSticks, rng) {
  // 1. 分二: 随机分为左右两堆
  const left = Math.floor(rng() * (totalSticks - 1)) + 1;
  const right = totalSticks - left;

  // 2. 挂一: 从右堆取1根 (象三才之人)
  const hung = 1;
  const rightAfterHang = right - hung;

  // 3. 揲四: 四根一组数，取余数
  //    关键：整除时余数为4，不能取0！
  let leftRem = left % 4;
  if (leftRem === 0) leftRem = 4;
  let rightRem = rightAfterHang % 4;
  if (rightRem === 0) rightRem = 4;

  // 4. 归奇: 拿走 (挂一 + 左余 + 右余)
  const taken = hung + leftRem + rightRem;
  const remaining = totalSticks - taken;

  return { remaining, left, right, hung, leftRem, rightRem, taken };
}

/**
 * 三变成一爻
 * @param {function} rng - 随机数生成器
 * @returns {{ value: number, nature: string, changing: boolean, steps: array }}
 */
export function generateLine(rng) {
  let sticks = 49; // 大衍之数五十，其用四十有九
  const steps = [];

  // 第一变
  const c1 = oneChange(sticks, rng);
  steps.push({ change: 1, start: sticks, ...c1 });
  sticks = c1.remaining;

  // 第二变
  const c2 = oneChange(sticks, rng);
  steps.push({ change: 2, start: c1.remaining, ...c2 });
  sticks = c2.remaining;

  // 第三变
  const c3 = oneChange(sticks, rng);
  steps.push({ change: 3, start: c2.remaining, ...c3 });
  sticks = c3.remaining;

  // 三变之后剩下的蓍草数 ÷4 = 爻值
  const value = sticks / 4; // 6, 7, 8, or 9

  const nature = (value === 6 || value === 8) ? 'yin' : 'yang';
  const changing = (value === 6 || value === 9);

  return { value, nature, changing, steps };
}

/**
 * 生成完整六爻卦
 * @returns {{
 *   lines: Array<{value:number, nature:string, changing:boolean, steps:array}>,
 *   benGua: object,
 *   bianGua: object|null,
 *   changingLineIndices: number[]
 * }}
 */
export function buildHexagram() {
  const seed = getSeed();
  const rng = mulberry32(seed);
  const lines = [];

  for (let i = 0; i < 6; i++) {
    lines.push(generateLine(rng));
  }

  return { lines, seed };
}

/**
 * 八卦查表: 三爻值(自下而上) → 卦名
 * 阳爻 = 7 or 9, 阴爻 = 6 or 8
 */
const TRIGRAM_MAP = {
  '111': { name: '乾', key: 'qian', symbol: '☰' },
  '000': { name: '坤', key: 'kun', symbol: '☷' },
  '100': { name: '震', key: 'zhen', symbol: '☳' },
  '010': { name: '坎', key: 'kan', symbol: '☵' },
  '001': { name: '艮', key: 'gen', symbol: '☶' },
  '011': { name: '巽', key: 'xun', symbol: '☴' },
  '101': { name: '離', key: 'li', symbol: '☲' },
  '110': { name: '兌', key: 'dui', symbol: '☱' },
};

function isYang(v) { return v === 7 || v === 9; }

/**
 * 三爻值 → 八卦 key
 */
export function getTrigramKey(v1, v2, v3) {
  const bits = [isYang(v1), isYang(v2), isYang(v3)].map(b => b ? '1' : '0').join('');
  return TRIGRAM_MAP[bits].key;
}

/**
 * 六爻 → 上卦+下卦 → 卦序 (用于查找 HEXAGRAMS)
 * 返回 { lower: trigram_key, upper: trigram_key, hexagramNumber: number }
 */
export function findHexagram(lines) {
  const lower = getTrigramKey(lines[0].value, lines[1].value, lines[2].value);
  const upper = getTrigramKey(lines[3].value, lines[4].value, lines[5].value);
  return { lower, upper };
}

/**
 * 生成变卦的六爻值 (翻转变爻)
 */
export function getBianYaoValues(lines) {
  return lines.map(l => {
    if (l.value === 6) return 7;  // 老阴变阳
    if (l.value === 9) return 8;  // 老阳变阴
    return l.value;                // 不变
  });
}
