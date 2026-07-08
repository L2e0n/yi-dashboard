/**
 * 大衍筮法 — 主入口 & SPA 路由
 */
console.log('[大衍筮法] 模块开始加载...');

import { buildHexagram, findHexagram, getBianYaoValues } from './dayan.js';
import { getHexagramByTrigrams, getHexagram, getAllHexagrams } from './hexagrams.js';
import { getChangingLineIndices, getInterpretRule, getYaoName } from './interpret.js';
import { getInterpretation } from './llm.js';
import { getLLMConfig, saveLLMConfig, getHistory, saveReading, deleteReading } from './storage.js';

console.log('[大衍筮法] 所有模块加载完成');

// ===== State =====
let castState = null; // 当前起卦状态
let currentResult = null; // 当前结果

// ===== DOM Elements =====
function $(sel) { return document.querySelector(sel); }

// ===== Page switching =====
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const page = $(`#page-${pageId}`);
  if (page) page.classList.remove('hidden');
}

// ===== Toast =====
function showToast(msg) {
  let toast = $('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#292524;color:#fff;padding:10px 24px;border-radius:20px;font-size:0.85rem;z-index:999;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

// ===== Cast Page =====
function initCast() {
  castState = null;
  currentResult = null;
  showPage('cast');
  document.getElementById('cast-init').classList.remove('hidden');
  document.getElementById('cast-panel').classList.add('hidden');
  document.getElementById('btn-start').disabled = false;
  document.getElementById('question-input').value = '';
  updateHistoryList();
}

function startCast() {
  castState = buildHexagram();
  const question = document.getElementById('question-input').value.trim();

  castState.question = question;
  castState.currentStep = 0; // 0-17, step index
  castState.currentLineIndex = 0; // which line (0-5)
  castState.currentChangeInLine = 1; // which change in current line (1-3)
  castState.completedLines = []; // array of completed line results

  document.getElementById('cast-init').classList.add('hidden');
  document.getElementById('cast-panel').classList.remove('hidden');

  updateCastPanel();
}

function updateCastPanel() {
  const s = castState;
  const step = s.currentStep;
  const lineIdx = s.currentLineIndex;
  const changeNum = s.currentChangeInLine;
  const lineData = s.lines[lineIdx];
  const changeData = lineData.steps[changeNum - 1];

  // Header
  document.getElementById('cast-step-label').textContent =
    `第 ${lineIdx + 1} 爻 · 第 ${changeNum} 变`;
  document.getElementById('cast-progress').textContent = step;

  // Progress bar
  document.getElementById('progress-fill').style.width = `${((step) / 18) * 100}%`;

  // Data
  if (changeData) {
    document.getElementById('data-current').textContent = `${changeData.start} 根`;
    document.getElementById('data-taken').textContent =
      `${changeData.taken} 根 (挂${changeData.hung}+余${changeData.leftRem}+余${changeData.rightRem})`;
    document.getElementById('data-remaining').textContent = `${changeData.remaining} 根`;

    if (changeNum === 3) {
      // Three changes done, line value known
      document.getElementById('data-line-value').textContent =
        `${lineData.value} · ${getLineLabel(lineData)}`;
    } else {
      document.getElementById('data-line-value').textContent = '?';
    }
  }

  // Update lines status
  for (let i = 0; i < 6; i++) {
    const el = document.getElementById(`status-${i}`);
    if (i < s.completedLines.length) {
      const line = s.completedLines[i];
      el.textContent = getLineSymbol(line.value);
      el.className = `status-value ${line.nature}${line.changing ? ' changing' : ''}`;
    } else if (i === lineIdx && changeNum === 3) {
      // current line just completed
      el.textContent = getLineSymbol(lineData.value);
      el.className = `status-value ${lineData.nature}${lineData.changing ? ' changing' : ''}`;
    } else {
      el.textContent = '?';
      el.className = 'status-value';
    }
  }

  // Button text
  const btn = document.getElementById('btn-step');
  if (step === 0 && changeNum === 1) {
    btn.innerHTML = '<span class="btn-icon">✋</span>分二·揲四·归奇';
  } else if (changeNum === 3 && step < 17) {
    btn.innerHTML = '<span class="btn-icon">→</span>继续下一爻';
  } else if (step >= 17) {
    btn.innerHTML = '<span class="btn-icon">🔮</span>揭晓卦象';
  } else {
    btn.innerHTML = '<span class="btn-icon">✋</span>分二·揲四·归奇';
  }
}

function handleStep() {
  const s = castState;
  s.currentStep++;

  if (s.currentChangeInLine < 3) {
    s.currentChangeInLine++;
  } else {
    // Line completed
    const lineData = s.lines[s.currentLineIndex];
    s.completedLines.push({
      value: lineData.value,
      nature: lineData.nature,
      changing: lineData.changing
    });

    if (s.currentLineIndex < 5) {
      s.currentLineIndex++;
      s.currentChangeInLine = 1;
    } else {
      // All 6 lines done
      showResult();
      return;
    }
  }

  updateCastPanel();
}

function getLineLabel(line) {
  const map = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };
  const extra = line.changing ? ' (变)' : '';
  return `${map[line.value]}${extra}`;
}

function getLineSymbol(value) {
  switch (value) {
    case 6: return '⚋';
    case 7: return '⚊';
    case 8: return '⚋';
    case 9: return '⚊';
    default: return '?';
  }
}

// ===== Result Page =====
function showResult() {
  const s = castState;
  const lines = s.lines.map(l => ({
    value: l.value,
    nature: l.nature,
    changing: l.changing
  }));

  const { lower, upper } = findHexagram(s.lines);
  const benGua = getHexagramByTrigrams(lower, upper);

  // Build bian gua (transformed hexagram)
  const bianYaoValues = getBianYaoValues(s.lines);
  let bianGua = null;
  if (bianYaoValues.some((v, i) => v !== lines[i].value)) {
    // Calculate bian gua trigrams
    const bianLinesForCalc = bianYaoValues.map((v, i) => ({
      value: v,
      nature: (v === 6 || v === 8) ? 'yin' : 'yang',
      changing: false,
      steps: null
    }));
    const { lower: bLower, upper: bUpper } = findHexagram(bianLinesForCalc);
    bianGua = getHexagramByTrigrams(bLower, bUpper);
  }

  const changingIndices = getChangingLineIndices(lines);
  const rule = getInterpretRule(changingIndices);

  currentResult = {
    question: s.question,
    lines,
    benGua,
    bianGua,
    changingIndices,
    rule
  };

  renderResult();
  saveReading({
    question: s.question,
    benGuaName: benGua ? benGua.name : '?',
    benGuaNumber: benGua ? benGua.number : 0,
    benGuaSymbol: benGua ? benGua.symbol : '?',
    bianGuaName: bianGua ? bianGua.name : null,
    bianGuaNumber: bianGua ? bianGua.number : null,
    bianGuaSymbol: bianGua ? bianGua.symbol : null,
    lines: lines.map(l => ({ value: l.value, nature: l.nature, changing: l.changing })),
    changingIndices
  });

  updateHistoryList();
}

function renderResult() {
  const r = currentResult;
  showPage('result');

  const container = document.getElementById('result-content');

  let html = '<div class="result-header">';

  // Question
  if (r.question) {
    html += `<div class="result-question">问：「${escapeHtml(r.question)}」</div>`;
  }

  // Hexagram pair
  html += '<div class="hex-pair">';
  html += renderHexCard(r.benGua, '本卦');
  if (r.bianGua) {
    html += '<div class="hex-arrow">→</div>';
    html += renderHexCard(r.bianGua, '变卦');
  }
  html += '</div>';

  // Lines display
  html += '<div class="lines-display">';
  const lineLabels = ['初', '二', '三', '四', '五', '上'];
  for (let i = 5; i >= 0; i--) {
    const line = r.lines[i];
    const isChanging = line.changing;
    const symbol = getLineSymbol(line.value);
    const label = getYaoName(i, line.nature);
    const natureLabel = getLineLabel(line);
    html += `
      <div class="line-row${isChanging ? ' changing' : ''}">
        <span class="${line.nature === 'yang' ? 'line-yang-symbol' : 'line-yin-symbol'}">${symbol}</span>
        <span class="line-label">${lineLabels[i]}爻 · ${label}</span>
        <span class="line-badge${isChanging ? ' changing' : ''}">${natureLabel}</span>
      </div>`;
  }
  html += '</div></div>';

  // Interpretation
  html += '<div class="interpret-section">';
  html += '<h3>📜 卦爻辞</h3>';

  // Rule
  html += `<div class="rule-box"><strong>${r.rule.rule}</strong><div class="rule-desc">${r.rule.description}</div></div>`;

  // Ben gua texts
  if (r.rule.useBenGua && r.benGua) {
    if (r.changingIndices.length === 0 || r.changingIndices.length === 3 || r.changingIndices.length === 6) {
      html += renderTextBlock('卦辞', r.benGua.judgment);
    }
    if (r.benGua.tuan) html += renderTextBlock('彖传', r.benGua.tuan);
    if (r.benGua.xiang) html += renderTextBlock('象传', r.benGua.xiang);

    // Show relevant line texts
    if (r.changingIndices.length === 1 || r.changingIndices.length === 2) {
      const idxs = [...r.changingIndices].sort((a, b) => b - a); // upper first
      for (const idx of idxs) {
        if (r.benGua.lines[idx]) {
          const yaoName = getYaoName(idx, r.lines[idx].nature);
          html += renderTextBlock(`${yaoName}爻辞${idxs.length === 2 && idx === Math.max(...idxs) ? '（主）' : ''}`, r.benGua.lines[idx]);
        }
      }
    }
  }

  if (r.rule.useBianGua && r.bianGua) {
    html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">';
    if (r.changingIndices.length === 3 || r.changingIndices.length === 6) {
      html += renderTextBlock('变卦卦辞', r.bianGua.judgment);
    }
    if (r.changingIndices.length === 4) {
      const unchanging = [];
      for (let i = 0; i < 6; i++) {
        if (!r.lines[i].changing) unchanging.push(i);
      }
      const sortedUnchanging = unchanging.sort((a, b) => a - b); // lower first
      for (const idx of sortedUnchanging) {
        if (r.bianGua.lines[idx]) {
          const yaoName = getYaoName(idx, r.changingIndices.includes(idx) ?
            // In bian gua, unchanged lines: get the nature from bianYaoValues
            (getBianYaoValues(r.lines)[idx] === 7 || getBianYaoValues(r.lines)[idx] === 9 ? 'yang' : 'yin') :
            (r.lines[idx].nature === 'yin' ? 'yin' : 'yang'));
          // Simplified: just show line index
          const pos = ['初', '二', '三', '四', '五', '上'][idx];
          const bianVal = getBianYaoValues(r.lines)[idx];
          const bianNature = (bianVal === 7 || bianVal === 9) ? 'yang' : 'yin';
          const bianYaoName = pos + (bianNature === 'yang' ? '九' : '六');
          html += renderTextBlock(`变卦${bianYaoName}爻辞${sortedUnchanging.length > 1 && idx === sortedUnchanging[0] ? '（主）' : ''}`, r.bianGua.lines[idx]);
        }
      }
    }
    if (r.changingIndices.length === 5) {
      const unchangedIdx = [0,1,2,3,4,5].find(i => !r.lines[i].changing);
      if (unchangedIdx !== undefined && r.bianGua.lines[unchangedIdx]) {
        html += renderTextBlock(`变卦不变爻辞`, r.bianGua.lines[unchangedIdx]);
      }
    }
    html += '</div>';
  }
  html += '</div>';

  // AI section
  html += '<div class="interpret-section" style="margin-top:16px;">';
  html += '<h3>🤖 AI 白话解读</h3>';
  html += '<div id="ai-result" class="ai-loading">加载中...</div>';
  html += '</div>';

  // Action bar
  html += '<div class="action-bar">';
  html += `<button id="btn-new" class="btn-main btn-small">🔄 重新起卦</button>`;
  html += '</div>';

  container.innerHTML = html;

  // Bind buttons
  document.getElementById('btn-back').onclick = initCast;
  document.getElementById('btn-new').onclick = initCast;

  // Fetch AI interpretation
  fetchAI();

  showPage('result');
}

function renderHexCard(gua, label) {
  if (!gua) return '';
  return `
    <div class="hex-card">
      <div class="hex-symbol">${gua.symbol}</div>
      <div class="hex-name">${gua.name}</div>
      <div class="hex-number">第${gua.number}卦 · ${label}</div>
    </div>`;
}

function renderTextBlock(title, content) {
  if (!content) return '';
  return `<div class="text-block"><h4>${title}</h4><p>${escapeHtml(content)}</p></div>`;
}

async function fetchAI() {
  const container = document.getElementById('ai-result');
  if (!container) return;

  const config = getLLMConfig();
  if (!config.enabled || !config.endpoint) {
    container.className = 'ai-not-configured';
    container.textContent = '💡 在设置中配置 API 后，可获取 AI 白话解读。';
    return;
  }

  container.className = 'ai-loading';
  container.textContent = '正在向 AI 请求解读...';

  const text = await getInterpretation(currentResult.question, {
    benGua: currentResult.benGua,
    bianGua: currentResult.bianGua,
    lines: currentResult.lines
  });

  if (text) {
    container.className = 'ai-content';
    container.textContent = text;
  } else {
    container.className = 'ai-not-configured';
    container.textContent = '⚠ AI 解读暂时不可用，请稍后再试或检查 API 配置。';
  }
}

// ===== History =====
function updateHistoryList() {
  const list = document.getElementById('history-list');
  const history = getHistory();

  if (history.length === 0) {
    list.innerHTML = '<p class="empty-hint">暂无历史记录，起一卦吧。</p>';
    return;
  }

  list.innerHTML = history.map(r => `
    <div class="history-item" data-id="${r.id}">
      <span class="history-symbol">${r.benGuaSymbol}</span>
      <div class="history-info">
        <div class="history-date">${formatDate(r.timestamp)}</div>
        <div class="history-hex">${r.benGuaName}${r.bianGuaName ? ' → ' + r.bianGuaName : ''}</div>
        ${r.question ? `<div class="history-question">问：${escapeHtml(r.question)}</div>` : ''}
      </div>
      <button class="history-delete" data-id="${r.id}" title="删除">×</button>
    </div>
  `).join('');

  // Bind click - view details
  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-delete')) return;
      const id = item.dataset.id;
      const record = getHistory().find(r => r.id === id);
      if (record) {
        loadHistoryResult(record);
      }
    });
  });

  // Bind delete
  list.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('删除这条记录？')) {
        deleteReading(id);
        updateHistoryList();
      }
    });
  });
}

function loadHistoryResult(record) {
  currentResult = {
    question: record.question,
    lines: record.lines,
    benGua: getHexagram(record.benGuaNumber),
    bianGua: record.bianGuaNumber ? getHexagram(record.bianGuaNumber) : null,
    changingIndices: record.changingIndices,
    rule: getInterpretRule(record.changingIndices)
  };
  renderResult();
}

function formatDate(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ===== Settings =====
function initSettings() {
  const config = getLLMConfig();
  document.getElementById('setting-endpoint').value = config.endpoint || '';
  document.getElementById('setting-apikey').value = config.apiKey || '';
  document.getElementById('setting-model').value = config.model || 'gpt-4';
  document.getElementById('page-settings').classList.remove('hidden');
}

function saveSettings() {
  const config = {
    endpoint: document.getElementById('setting-endpoint').value.trim(),
    apiKey: document.getElementById('setting-apikey').value.trim(),
    model: document.getElementById('setting-model').value.trim() || 'gpt-4'
  };
  saveLLMConfig(config);
  document.getElementById('page-settings').classList.add('hidden');
  showToast('✅ 设置已保存');
}

function closeSettings() {
  document.getElementById('page-settings').classList.add('hidden');
}

// ===== Helpers =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Init =====
function init() {
  console.log('[大衍筮法] init() 开始');
  try {
    // Cast page buttons
    const btnStart = document.getElementById('btn-start');
    console.log('[大衍筮法] btn-start 元素:', btnStart);
    if (!btnStart) { console.error('找不到 btn-start!'); return; }
    btnStart.addEventListener('click', startCast);

    const btnStep = document.getElementById('btn-step');
    console.log('[大衍筮法] btn-step 元素:', btnStep);
    if (btnStep) btnStep.addEventListener('click', handleStep);

  // Result page
  document.getElementById('btn-back').addEventListener('click', (e) => {
    e.preventDefault();
    initCast();
  });

  // Settings
  document.getElementById('btn-settings-toggle').addEventListener('click', initSettings);
  document.getElementById('btn-settings-close').addEventListener('click', closeSettings);
  document.getElementById('btn-settings-save').addEventListener('click', saveSettings);

  // Close overlay on backdrop click
  document.getElementById('page-settings').addEventListener('click', function(e) {
    if (e.target === this) closeSettings();
  });

  // Keyboard: Enter to advance step
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && castState && !document.getElementById('cast-panel').classList.contains('hidden')) {
      e.preventDefault();
      handleStep();
    }
  });

  // Init
  updateHistoryList();
  showPage('cast');
}

// Init: ES modules are deferred, so DOMContentLoaded may have already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
