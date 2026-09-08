import { t } from './i18n.js';

export function LanguageToggle() {
  return `
    <button onclick="window.toggleLanguage()" 
            class="fixed top-4 left-4 z-50 px-4 py-2 rounded-full glass text-sm font-medium hover:bg-white/10 transition">
      ${document.documentElement.lang === 'ar' ? 'English' : 'العربية'}
    </button>
  `;
}

export function CircularProgress(percentage, color = 'emerald') {
  const colors = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400'
  };
  
  const dashArray = `${percentage}, 100`;
  
  return `
    <div class="relative h-24 w-24">
      <svg class="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <path class="text-white/10" 
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="currentColor" stroke-width="3"/>
        <path class="${colors[color]}" 
              stroke-dasharray="${dashArray}"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="currentColor" stroke-width="3">
          <animate attributeName="stroke-dasharray" from="0, 100" to="${dashArray}" dur="1s" fill="freeze"/>
        </path>
      </svg>
      <span class="absolute inset-0 flex items-center justify-center text-lg font-bold">${percentage}%</span>
    </div>
  `;
}

export function ResultCard(result, verdict, caseId, txHash) {
  const config = {
    SAFE: {
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      icon: '✓',
      title: t('results.safe'),
      textColor: 'text-emerald-400'
    },
    RISKY: {
      gradient: 'from-amber-500 via-orange-500 to-red-500',
      icon: '⚠',
      title: t('results.risky'),
      textColor: 'text-amber-400'
    },
    HIGH_RISK: {
      gradient: 'from-rose-500 via-red-500 to-pink-600',
      icon: '✕',
      title: t('results.highRisk'),
      textColor: 'text-rose-400'
    }
  };

  const cfg = config[verdict];
  
  return `
    <div class="animate-fade-in-up">
      <!-- Header Card -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br ${cfg.gradient} p-8 text-white shadow-2xl mb-6">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCAwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div class="relative z-10 flex flex-col items-center text-center">
          <div class="text-6xl mb-4 animate-bounce">${cfg.icon}</div>
          <h2 class="text-4xl font-black mb-2">${cfg.title}</h2>
          <p class="text-white/90 text-lg max-w-md">${escapeHtml(result.summary)}</p>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid md:grid-cols-2 gap-4 mb-6">
        <div class="glass rounded-2xl p-6 text-center">
          <div class="text-sm text-white/50 mb-2">${t('results.riskScore')}</div>
          ${CircularProgress(result.risk_score, verdict === 'SAFE' ? 'emerald' : verdict === 'RISKY' ? 'amber' : 'rose')}
        </div>
        <div class="glass rounded-2xl p-6 text-center">
          <div class="text-sm text-white/50 mb-2">${t('results.confidence')}</div>
          <div class="text-4xl font-bold ${cfg.textColor}">${result.confidence}%</div>
          <div class="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-current rounded-full transition-all duration-1000" style="width: ${result.confidence}%"></div>
          </div>
        </div>
      </div>

      <!-- Details -->
      ${result.reasons?.length ? `
        <div class="glass rounded-2xl p-6 mb-4 border-l-4 border-rose-500">
          <h3 class="font-bold text-rose-400 mb-3 flex items-center gap-2">
            <span>⚠️</span> ${t('results.reasons')}
          </h3>
          <ul class="space-y-2 text-white/70">
            ${result.reasons.map(r => `<li class="flex items-start gap-2"><span class="text-rose-400 mt-1">•</span> ${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${result.evidence?.length ? `
        <div class="glass rounded-2xl p-6 mb-4 border-l-4 border-emerald-500">
          <h3 class="font-bold text-emerald-400 mb-3 flex items-center gap-2">
            <span>✓</span> ${t('results.evidence')}
          </h3>
          <ul class="space-y-2 text-white/70">
            ${result.evidence.map(e => `<li class="flex items-start gap-2"><span class="text-emerald-400 mt-1">•</span> ${escapeHtml(e)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Verification Info -->
      <div class="glass rounded-2xl p-6 text-sm">
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <div class="text-white/40 mb-1">${t('results.caseId')}</div>
            <code class="text-xs text-white/60 break-all">${caseId}</code>
          </div>
          <div>
            <div class="text-white/40 mb-1">${t('results.txHash')}</div>
            <code class="text-xs text-white/60 break-all">${txHash}</code>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function HistoryList() {
  const history = JSON.parse(localStorage.getItem('dealguard-history') || '[]');
  
  if (history.length === 0) {
    return `<div class="text-center text-white/40 py-8">${t('history.empty')}</div>`;
  }

  return `
    <div class="space-y-3">
      ${history.map((item, i) => `
        <div class="glass rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition cursor-pointer" onclick="loadHistory(${i})">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${item.verdict === 'SAFE' ? '✓' : item.verdict === 'RISKY' ? '⚠' : '✕'}</span>
            <div>
              <div class="font-medium text-sm">${escapeHtml(item.title)}</div>
              <div class="text-xs text-white/40">${new Date(item.timestamp).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="text-sm font-bold ${item.verdict === 'SAFE' ? 'text-emerald-400' : item.verdict === 'RISKY' ? 'text-amber-400' : 'text-rose-400'}">
            ${item.risk_score}%
          </div>
        </div>
      `).join('')}
    </div>
    <button onclick="clearHistory()" class="mt-4 w-full py-2 text-sm text-white/40 hover:text-white transition">
      ${t('history.clear')}
    </button>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
