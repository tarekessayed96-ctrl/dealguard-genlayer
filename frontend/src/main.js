import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x2df8830eD829E347720076A2073bfb6CC1D5D791";
const EXPECTED_CHAIN_ID_HEX = "0xf22f";

const translations = {
    ar: {
        title: "عنوان الصفقة",
        desc: "وصف الصفقة",
        dealUrl: "رابط الموقع",
        refUrl: "رابط المرجع",
        verify: "تحقق من الصفقة",
        verifying: "جاري التحقق...",
        stages: {
            connecting: "جاري الاتصال بالمحفظة...",
            switching: "التبديل إلى GenLayer...",
            preparing: "تحضير الطلب...",
            analyzing: "تحليل الصفقة بالذكاء الاصطناعي...",
            waiting: "انتظار قرار الشبكة...",
            reading: "قراءة النتيجة...",
            complete: "اكتمل التحقق ✓"
        },
        results: {
            safe: "✓ صفقة آمنة",
            risky: "⚠ صفقة محفوفة بالمخاطر",
            highRisk: "✕ صفقة خطيرة",
            score: "درجة الخطر",
            confidence: "نسبة الثقة"
        },
        history: "سجل التحققات",
        empty: "لا توجد تحققات سابقة",
        poweredBy: "مدعوم من GenLayer"
    },
    en: {
        title: "Deal Title",
        desc: "Description",
        dealUrl: "Website URL",
        refUrl: "Reference URL",
        verify: "Verify Deal",
        verifying: "Verifying...",
        stages: {
            connecting: "Connecting wallet...",
            switching: "Switching to GenLayer...",
            preparing: "Preparing request...",
            analyzing: "AI analysis in progress...",
            waiting: "Waiting for network decision...",
            reading: "Reading results...",
            complete: "Verification Complete ✓"
        },
        results: {
            safe: "✓ Safe Deal",
            risky: "⚠ Risky Deal",
            highRisk: "✕ High Risk Deal",
            score: "Risk Score",
            confidence: "Confidence"
        },
        history: "Verification History",
        empty: "No previous verifications",
        poweredBy: "Powered by GenLayer"
    }
};

let currentLang = localStorage.getItem('dealguard-lang') || 'ar';
const t = (key) => key.split('.').reduce((o, k) => o?.[k], translations[currentLang]) || key;

function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key);
    });
    document.getElementById('langText').textContent = currentLang === 'ar' ? 'English' : 'العربية';
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
}

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function updateProgress(text, percent) {
    document.getElementById('progress').classList.remove('hidden');
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressPercent').textContent = percent + '%';
    document.getElementById('progressBar').style.width = percent + '%';
}

function createResultCard(result, verdict, caseId, txHash) {
    const styles = {
        SAFE: { class: 'result-safe', icon: '🌳', color: '#28a745', title: t('results.safe') },
        RISKY: { class: 'result-risky', icon: '🍂', color: '#ffc107', title: t('results.risky') },
        HIGH_RISK: { class: 'result-danger', icon: '🥀', color: '#dc3545', title: t('results.highRisk') }
    };
    
    const style = styles[verdict];
    
    return `
        <div class="organic-card ${style.class} p-8 animate-fade-in">
            <div class="text-center mb-6">
                <div class="text-6xl mb-3">${style.icon}</div>
                <h2 class="text-3xl font-bold mb-2" style="color: ${style.color}">${style.title}</h2>
                <p class="text-gray-600">${result.summary}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="text-center p-4 bg-white/50 rounded-2xl">
                    <div class="text-3xl font-bold" style="color: ${style.color}">${result.risk_score}%</div>
                    <div class="text-sm text-gray-600">${t('results.score')}</div>
                </div>
                <div class="text-center p-4 bg-white/50 rounded-2xl">
                    <div class="text-3xl font-bold text-green-600">${result.confidence}%</div>
                    <div class="text-sm text-gray-600">${t('results.confidence')}</div>
                </div>
            </div>
            
            ${result.reasons?.length ? `
                <div class="mb-4 p-4 bg-white/60 rounded-2xl">
                    <h3 class="font-bold text-red-600 mb-2">⚠️ أسباب الخطر</h3>
                    <ul class="space-y-1 text-gray-700">
                        ${result.reasons.map(r => `<li>• ${r}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div class="text-xs text-gray-500 font-mono bg-white/40 p-3 rounded-xl">
                <div>Case: ${caseId}</div>
                <div>TX: ${txHash}</div>
            </div>
        </div>
    `;
}

async function verifyDeal() {
    hideError();
    
    const btn = document.getElementById('verifyBtn');
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const dealUrl = document.getElementById('dealUrl').value.trim();
    const secondUrl = document.getElementById('secondUrl').value.trim();
    
    if (!title || !description || !dealUrl || !secondUrl) {
        showError(currentLang === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
        return;
    }
    
    const provider = window.okxwallet || window.ethereum;
    if (!provider) {
        showError(currentLang === 'ar' ? 'يرجى تثبيت محفظة' : 'Please install wallet');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin">🌿</span> ${t('verifying')}`;
        
        updateProgress(t('stages.connecting'), 10);
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        
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
        
        updateProgress(t('stages.preparing'), 30);
        const client = createClient({ chain: studionet, account, provider });
        const caseId = crypto.randomUUID?.() || `case-${Date.now()}`;
        
        updateProgress(t('stages.analyzing'), 40);
        const txHash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'analyze_deal',
            args: [caseId, title, description, dealUrl, secondUrl],
            value: BigInt(0)
        });
        
        updateProgress(t('stages.waiting'), 60);
        await client.waitForTransactionReceipt({
            hash: txHash,
            waitUntil: 'decided',
            interval: 5000,
            retries: 120
        });
        
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
            await new Promise(r => setTimeout(r, 5000));
        }
        
        if (!result) throw new Error('No result');
        
        document.getElementById('result').innerHTML = createResultCard(result, result.verdict, caseId, txHash);
        document.getElementByById('result').classList.remove('hidden');
        
        // Save history
        const history = JSON.parse(localStorage.getItem('dg-history') || '[]');
        history.unshift({ ...result, title, timestamp: new Date().toISOString() });
        localStorage.setItem('dg-history', JSON.stringify(history.slice(0, 10)));
        updateHistory();
        
        btn.innerHTML = `🌳 ${t('stages.complete')}`;
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = `<span class="tree-icon text-2xl">🌿</span><span>${t('verify')}</span>`;
        }, 2000);
        
    } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.innerHTML = `<span class="tree-icon text-2xl">🌿</span><span>${t('verify')}</span>`;
    }
}

function updateHistory() {
    const history = JSON.parse(localStorage.getItem('dg-history') || '[]');
    const container = document.getElementById('historyList');
    
    if (history.length === 0) {
        container.innerHTML = `<div class="text-center text-green-600/50 py-4">${t('empty')}</div>`;
        return;
    }
    
    container.innerHTML = history.map((item, i) => `
        <div class="flex items-center justify-between p-4 bg-white/60 rounded-2xl hover:bg-white/80 transition cursor-pointer" onclick="loadHistory(${i})">
            <div class="flex items-center gap-3">
                <span class="text-2xl">${item.verdict === 'SAFE' ? '🌳' : item.verdict === 'RISKY' ? '🍂' : '🥀'}</span>
                <div>
                    <div class="font-bold text-green-800">${item.title}</div>
                    <div class="text-xs text-green-600">${new Date(item.timestamp).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="font-bold ${item.verdict === 'SAFE' ? 'text-green-600' : item.verdict === 'RISKY' ? 'text-yellow-600' : 'text-red-600'}">
                ${item.risk_score}%
            </div>
        </div>
    `).join('');
}

window.loadHistory = (index) => {
    const history = JSON.parse(localStorage.getItem('dg-history') || '[]');
    const item = history[index];
    if (item) {
        document.getElementById('title').value = item.title || '';
        document.getElementById('description').value = item.description || '';
        document.getElementById('dealUrl').value = item.dealUrl || '';
        document.getElementById('secondUrl').value = item.secondUrl || '';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    updateHistory();
    
    document.getElementById('verifyBtn').addEventListener('click', verifyDeal);
    document.getElementById('langToggle').addEventListener('click', () => {
        currentLang = currentLang === 'ar' ? 'en' : 'ar';
        localStorage.setItem('dealguard-lang', currentLang);
        updateUI();
        updateHistory();
    });
});
