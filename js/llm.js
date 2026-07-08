/**
 * LLM 解读模块
 * 调用 OpenAI-compatible API 获取白话解读
 * 未配置时静默跳过，不影响核心功能
 */

import { getLLMConfig } from './storage.js';

/**
 * 构建发送给 LLM 的 prompt
 */
function buildPrompt(question, hexagramResult) {
  const { benGua, bianGua, lines } = hexagramResult;

  // 变爻信息
  const changingLines = [];
  lines.forEach((line, i) => {
    if (line.changing) {
      const yaoName = getYaoName(i, line.nature);
      const yaoCi = benGua.lines ? benGua.lines[i] : `${yaoName}爻辞`;
      changingLines.push(`- ${yaoName}：${yaoCi}`);
    }
  });

  const parts = [];
  if (question) {
    parts.push(`我问的问题是：「${question}」`);
  }
  parts.push(`\n起卦结果：`);
  parts.push(`- 本卦：${benGua.symbol} ${benGua.name}卦（第${benGua.number}卦），${benGua.lower}下${benGua.upper}上`);
  if (bianGua) {
    parts.push(`- 变卦：${bianGua.symbol} ${bianGua.name}卦（第${bianGua.number}卦），${bianGua.lower}下${bianGua.upper}上`);
  }
  parts.push(`- 变爻位置：${changingLines.length > 0 ? changingLines.map((_, i) => {
    const idx = lines.findIndex((l, j) => l.changing && changingLines.filter((_, k) => k <= i).length - 1 === i);
    return `第${idx + 1}爻`;
  }).join('、') : '无变爻'}`);

  parts.push(`\n本卦卦辞：${benGua.judgment || '（无）'}`);
  parts.push(`本卦彖传：${benGua.tuan || '（无）'}`);
  parts.push(`本卦象传：${benGua.xiang || '（无）'}`);

  if (changingLines.length > 0) {
    parts.push(`\n变爻爻辞：`);
    changingLines.forEach(cl => parts.push(cl));
  }

  const questionText = question ? `，${question}？` : '';
  parts.push(`\n请帮我解读：${benGua.name}卦${bianGua ? '变' + bianGua.name + '卦' : ''}${questionText}。用大白话告诉我什么意思，我该怎么应对。`);

  return parts.join('\n');
}

function getYaoName(index, nature) {
  const pos = ['初', '二', '三', '四', '五', '上'][index];
  const num = nature === 'yang' ? '九' : '六';
  return `${pos}${num}`;
}

/**
 * 调用 LLM API 获取解读
 * @param {string} question - 用户问题
 * @param {object} hexagramResult - { benGua, bianGua, lines }
 * @returns {Promise<string|null>} 解读文本，失败返回 null
 */
export async function getInterpretation(question, hexagramResult) {
  const config = getLLMConfig();
  if (!config.enabled || !config.endpoint) {
    console.log('LLM 未配置，跳过 API 调用');
    return null;
  }

  const systemPrompt = `你是一位精通《周易》的国学大师。请根据用户的问题和卦象，给出通俗直白、接地气的现代文解读。不要堆砌古文，用普通人能听懂的大白话。结合用户的具体问题给出有针对性的建议。字数控制在300字以内。`;

  const userPrompt = buildPrompt(question, hexagramResult);

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!res.ok) {
      console.error('LLM API 返回错误:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    // 兼容某些代理服务的不同返回格式
    if (data.content) return data.content;
    if (data.message) return data.message;
    if (typeof data === 'string') return data;

    console.error('LLM 返回格式不兼容:', data);
    return null;
  } catch (e) {
    console.error('LLM API 调用失败:', e.message);
    return null;
  }
}
