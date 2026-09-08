import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import { t, setLang, getLang, toggleLang } from './i18n.js';
import { ResultCard, HistoryList } from './components.js';

const CONTRACT_ADDRESS = "0x2df8830eD829E347720076A2073bfb6CC1D5D791";
const EXPECTED_CHAIN_ID_HEX = "0xf22f";

// ======== المساعدات ========
function updateTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  document.getElementById('langText').textContent = getLang() === 'ar' ? 'English' : 'العربية';
}

function showError(message) {
  const errorBox = document.getElementById('error');
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error').classList.add('hidden');
}

function updateProgress(message, percent) {
  const progress = document.getElementById('progress');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const progressBar = document.getElementById('progressBar');
  
  progress.classList.remove('hidden');
  progressText.textContent = message;
  progressPercent.textContent = percent + '%';
  progressBar.style.width = percent + '%';
}

function hideProgress() {
  document.getElementById('progress').classList.add('hidden');
}

function createCaseId() {
  return crypto.randomUUID?.() || `case-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveToHistory(result, title) {
  const history = JSON.parse(localStorage.getItem('dealguard-history') || '[]');
  history.unshift({
    ...result,
    title,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('dealguard-history', JSON.stringify(history.slice(0, 10)));
  updateHistory();
}

function updateHistory() {
  document.getElementById('historyList').innerHTML = HistoryList();
}

window.toggleLanguage = () => {
  toggleLang();
  updateTranslations();
};

window.clearHistory = () => {
  localStorage.removeItem('dealguard-history');
  updateHistory();
};

window.loadHistory = (index) => {
  const history = JSON.parse(localStorage.getItem('dealguard-history') || '[]');
  const item = history[index];
  if (item) {
    document.getElementById('title').value = item.title || '';
    document.getElementById('description').value = item.description || '';
    document.getElementById('dealUrl').value = item.dealUrl || '';
    document.getElementById('secondUrl').value = item.secondUrl || '';
  }
};

// ======== التحقق الرئيسي ========
async function verifyDeal(e) {
  e.preventDefault();
  hideError();
  
  const button = document.getElementById('verifyBtn');
  const resultDiv = document.getElementById('result');
  
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const dealUrl = document.getElementById('dealUrl').value.trim();
  const secondUrl = document.getElementById('secondUrl').value.trim();
  
  if (!title || !description || !dealUrl || !secondUrl) {
    showError(t('errors.fillAll'));
    return;
  }
  
  if (!dealUrl.startsWith('https://') || !secondUrl.startsWith('https://')) {
    showError(t('errors.httpsRequired'));
    return;
  }
  
  const provider = window.okxwallet || window.ethereum;
  if (!provider) {
    showError(t('errors.installWallet'));
    return;
  }
  
  try {
    button.disabled = true;
    button.innerHTML = `<span class="animate-spin">↻</span> ${t('form.verifying')}`;
    
    // Connect
    updateProgress(t('stages.connecting'), 10);
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const account = accounts[0];
    
    // Check chain
    let chainId = await provider.request({ method: 'eth_chainId' });
    if (chainId.toLowerCase() !== EXPECTED_CHAIN_ID_HEX) {
      updateProgress(t('stages.switching'), 20);
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: EXPECTED_CHAIN_ID_HEX }]
        });
      } catch (err) {
        if (err?.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: EXPECTED_CHAIN_ID_HEX,
              chainName: 'GenLayer StudioNet',
              nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
              rpcUrls: ['https://studio.genlayer.com/api/rpc']
            }]
          });
        }
      }
    }
    
    // Prepare
    updateProgress(t('stages.preparing'), 30);
    const client = createClient({ chain: studionet, account, provider });
    const caseId = createCaseId();
    
    // Analyze
    updateProgress(t('stages.analyzing'), 40);
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'analyze_deal',
      args: [caseId, title, description, dealUrl, secondUrl],
      value: BigInt(0)
    });
    
    // Wait
    updateProgress(t('stages.waiting'), 60);
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      waitUntil: 'decided',
      interval: 5000,
      retries: 120
    });
    
    if (receipt?.txExecutionResult && receipt.txExecutionResult !== 'FINISHED_WITH_RETURN') {
      throw new Error('Transaction failed');
    }
    
    // Read result
    updateProgress(t('stages.reading'), 80);
    let result = null;
    for (let i = 0; i < 12; i++) {
      try {
        const raw = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_verification',
          args: [caseId],
          transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL
        });
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.case_id === caseId && ['SAFE', 'RISKY', 'HIGH_RISK'].includes(parsed.verdict?.toUpperCase())) {
          result = { ...parsed, verdict: parsed.verdict.toUpperCase() };
          break;
        }
      } catch (e) {}
      updateProgress(`${t('stages.reading')} (${i + 1}/12)`, 80 + (i / 12) * 15);
      await new Promise(r => setTimeout(r, 5000));
    }
    
    if (!result) throw new Error('No result');
    
    // Display
    hideProgress();
    resultDiv.innerHTML = ResultCard(result, result.verdict, caseId, txHash);
    saveToHistory(result, title);
    
    button.innerHTML = `<span>✓</span> ${t('stages.complete')}`;
    setTimeout(() => {
      button.disabled = false;
      button.innerHTML = `<span>🔍</span> ${t('form.verifyBtn')}`;
    }, 2000);
    
  } catch (error) {
    console.error(error);
    hideProgress();
    showError(error.message || 'Unknown error');
    button.disabled = false;
    button.innerHTML = `<span>🔍</span> ${t('form.verifyBtn')}`;
  }
}

// ======== التهيئة ========
document.addEventListener('DOMContentLoaded', () => {
  // Set initial language
  const savedLang = localStorage.getItem('dealguard-lang') || 'en';
  setLang(savedLang);
  updateTranslations();
  updateHistory();
  
  // Event listeners
  document.getElementById('dealForm').addEventListener('submit', verifyDeal);
  document.getElementById('langToggle').addEventListener('click', window.toggleLanguage);
});
