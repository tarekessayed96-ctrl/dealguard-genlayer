import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x2df8830eD829E347720076A2073bfb6CC1D5D791";
const EXPECTED_CHAIN_ID_HEX = "0xf22f";

// Language handling
const translations = {
    en: {
        title: "Deal Title",
        dealUrl: "Deal URL",
        description: "Description",
        refUrl: "Reference URL",
        verify: "Initialize Verification",
        verifying: "Processing...",
        stages: {
            connecting: "Connecting Neural Link...",
            switching: "Switching Network...",
            preparing: "Loading AI Modules...",
            analyzing: "Analyzing Deal Data...",
            waiting: "Consensus Building...",
            reading: "Decrypting Results...",
            complete: "Verification Complete"
        },
        results: {
            safe: "SAFE",
            risky: "RISKY",
            highRisk: "HIGH RISK",
            confidence: "Confidence Level",
            riskScore: "Risk Score"
        }
    },
    ar: {
        title: "عنوان الصفقة",
        dealUrl: "رابط الصفقة",
        description: "الوصف",
        refUrl: "رابط المرجع",
        verify: "بدء التحقق",
        verifying: "جاري المعالجة...",
        stages: {
            connecting: "جاري الاتصال...",
            switching: "تبديل الشبكة...",
            preparing: "تحميل الوحدات...",
            analyzing: "تحليل البيانات...",
            waiting: "بناء التوافق...",
            reading: "فك التشفير...",
            complete: "اكتمل التحقق"
        },
        results: {
            safe: "آمن",
            risky: "محفوف بالمخاطر",
            highRisk: "خطير جداً",
            confidence: "مستوى الثقة",
            riskScore: "درجة الخطر"
        }
    }
};

let currentLang = localStorage.getItem('dealguard-lang') || 'en';
const t = (key) => translations[currentLang][key] || key;

// UI Functions
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

function createResultHTML(result, verdict, caseId, txHash) {
    const colors = {
        SAFE: { border: 'result-safe', color: '#00ff88', icon: '✓' },
        RISKY: { border: 'result-risky', color: '#ffaa00', icon: '⚠' },
        HIGH_RISK: { border: 'result-danger', color: '#ff0044', icon: '✕' }
    };
    
    const cfg = colors[verdict];
    
    return `
        <div class="holo-card ${cfg.border} rounded-2xl p-8 animate-fade-in">
            <div class="text-center mb-8">
                <div class="text-8xl mb-4" style="color: ${cfg.color}; text-shadow: 0 0 30px ${cfg.color}">
                    ${cfg.icon}
                </div>
                <h2 class="text-4xl font-black mb-2" style="color: ${cfg.color}; font-family: 'Orbitron'">
                    ${verdict}
                </h2>
                <p class="text-cyan-200/60">${result.summary}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-6 mb-8">
                <div class="text-center p-6 bg-black/30 rounded-xl border border-cyan-500/20">
                    <div class="text-5xl font-black mb-2" style="color: ${cfg.color}">
                        ${result.risk_score}%
                    </div>
                    <div class="text-cyan-400 text-sm uppercase tracking-wider">${t('results.riskScore')}</div>
                </div>
                <div class="text-center p-6 bg-black/30 rounded-xl border border-cyan-500/20">
                    <div class="text-5xl font-black mb-2 text-cyan-400">
                        ${result.confidence}%
                    </div>
                    <div class="text-cyan-400 text-sm uppercase tracking-wider">${t('results.confidence')}</div>
                </div>
            </div>
            
            ${result.reasons?.length ? `
                <div class="mb-6 p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <h3 class="text-red-400 font-bold mb-3 uppercase tracking-wider">Risk Factors</h3>
                    <ul class="space-y-2 text-cyan-200/70">
                        ${result.reasons.map(r => `<li>› ${r}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div class="p-4 bg-black/50 rounded-lg font-mono text-xs text-cyan-600/50 overflow-x-auto">
                <div>CASE_ID: ${caseId}</div>
                <div>TX_HASH: ${txHash}</div>
            </div>
        </div>
    `;
}

// Main verification
async function verifyDeal() {
    hideError();
    
    const btn = document.getElementById('verifyBtn');
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const dealUrl = document.getElementById('dealUrl').value.trim();
    const secondUrl = document.getElementById('secondUrl').value.trim();
    
    if (!title || !description || !dealUrl || !secondUrl) {
        showError('Please fill all fields');
        return;
    }
    
    const provider = window.okxwallet || window.ethereum;
    if (!provider) {
        showError('Please install OKX or MetaMask');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-pulse">◈</span> ${t('verifying')}`;
        
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
        
        document.getElementById('result').innerHTML = createResultHTML(result, result.verdict, caseId, txHash);
        document.getElementById('result').classList.remove('hidden');
        
        // Save to history
        const history = JSON.parse(localStorage.getItem('dg-history') || '[]');
        history.unshift({ ...result, title, timestamp: new Date().toISOString() });
        localStorage.setItem('dg-history', JSON.stringify(history.slice(0, 10)));
        
        btn.innerHTML = `<span>◈</span> ${t('stages.complete')}`;
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = `<span>▶</span> ${t('verify')}`;
        }, 2000);
        
    } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.innerHTML = `<span>▶</span> ${t('verify')}`;
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('verifyBtn').addEventListener('click', verifyDeal);
    
    document.getElementById('langToggle').addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ar' : 'en';
        localStorage.setItem('dealguard-lang', currentLang);
        location.reload();
    });
});
