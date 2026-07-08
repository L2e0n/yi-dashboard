/**
 * localStorage 读写模块
 * 负责：LLM 配置 + 占卜历史
 */

const STORAGE_KEYS = {
  LLM_CONFIG: 'dayan_llm_config',
  HISTORY: 'dayan_history',
};

// === LLM 配置 ===

export function getLLMConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LLM_CONFIG);
    return raw ? JSON.parse(raw) : { endpoint: '', apiKey: '', model: 'gpt-4', enabled: false };
  } catch {
    return { endpoint: '', apiKey: '', model: 'gpt-4', enabled: false };
  }
}

export function saveLLMConfig(config) {
  config.enabled = !!(config.endpoint && config.apiKey);
  localStorage.setItem(STORAGE_KEYS.LLM_CONFIG, JSON.stringify(config));
}

// === 占卜历史 ===

export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveReading(record) {
  const history = getHistory();
  history.unshift({
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...record,
  });
  // 最多保留 50 条
  if (history.length > 50) history.length = 50;
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export function deleteReading(id) {
  const history = getHistory().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export function clearHistory() {
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
