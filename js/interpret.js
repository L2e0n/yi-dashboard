/**
 * 解卦逻辑
 * 左传古法：根据变爻数量判定断卦规则
 */

/**
 * @param {Array} lines - 六爻数组
 * @returns {number[]} 变爻位置索引 (0-based, 初爻=0)
 */
export function getChangingLineIndices(lines) {
  const indices = [];
  lines.forEach((line, i) => {
    if (line.changing) indices.push(i);
  });
  return indices;
}

/**
 * 爻位索引 → 爻名
 * 0→初, 1→二, 2→三, 3→四, 4→五, 5→上
 */
const POSITION_NAMES = ['初', '二', '三', '四', '五', '上'];

export function getYaoName(index, nature) {
  const pos = POSITION_NAMES[index];
  const number = nature === 'yang' ? '九' : '六';
  return `${pos}${number}`;
}

/**
 * 获取断卦规则文本
 */
export function getInterpretRule(changingIndices) {
  const count = changingIndices.length;
  switch (count) {
    case 0:
      return {
        rule: '六爻皆静，以本卦卦辞断。',
        useBenGua: true,
        useBianGua: false,
        description: '本卦六爻皆无变动，事情处于稳定状态，直接看本卦卦辞即可。'
      };
    case 1:
      return {
        rule: `一爻动，以本卦变爻（${changingIndices[0] + 1}爻）爻辞断。`,
        useBenGua: true,
        useBianGua: false,
        description: '只有一处变动，信息聚焦于该爻辞。'
      };
    case 2:
      return {
        rule: '二爻动，以本卦两变爻爻辞断，以上者为主。',
        useBenGua: true,
        useBianGua: false,
        description: '天尊地卑，上面的爻权重更高。'
      };
    case 3:
      return {
        rule: '三爻动，本卦（贞）+ 变卦（悔）卦辞合参，体用各半。',
        useBenGua: true,
        useBianGua: true,
        description: '变动过半，新旧参半，需综合判断。'
      };
    case 4:
      return {
        rule: '四爻动，以变卦两不变爻辞断，以下者为主。',
        useBenGua: false,
        useBianGua: true,
        description: '大部分已动，静的反而成关键，下为主（地承）。'
      };
    case 5:
      return {
        rule: '五爻动，以变卦唯一不变爻辞断。',
        useBenGua: false,
        useBianGua: true,
        description: '几乎全变，只剩一根静的做锚。'
      };
    case 6:
      return {
        rule: '六爻全变，以变卦卦辞断。乾用「用九」、坤用「用六」。',
        useBenGua: false,
        useBianGua: true,
        description: '全盘颠覆，本卦辞失效。'
      };
  }
}
