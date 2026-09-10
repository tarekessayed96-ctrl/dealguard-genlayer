import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT_ADDRESS = "0x2df8830eD829E347720076A2073bfb6CC1D5D791";
const EXPECTED_CHAIN_ID_HEX = "0xf22f";

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function updateStatus(text, percent) {
    document.getElementById('status').classList.remove('hidden');
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressPercent').textContent = percent + '%';
    document.getElementById('progressBar').style.width = percent + '%';
    document.getElementById('verifyBtn').disabled = true;
    document.getElementById('verifyBtn').textContent = text;
}

function hideStatus() {
    document.getElementById('status').classList.add('hidden');
    document.getElementById('verifyBtn').disabled = false;
    document.getElementById('verifyBtn').textContent = 'تحقق من الصفقة';
}

function showResult(result, verdict) {
    const box = document.getElementById('result');
    const styles = {
        SAFE: { class: 'safe', icon: '✓', title: 'صفقة آمنة', color: '#16a34a' },
        RISKY: { class: 'risky', icon: '⚠', title: 'محفوفة بالمخاطر', color: '#f59e0b' },
        HIGH_RISK: { class: 'danger', icon: '✕', title: 'عالية الخطورة', color: '#dc2626' }
    };
    
    const s = styles[verdict];
    box.innerHTML = `
        <div class="${s.class} text-center">
            <div style="font-size: 48px; color: ${s.color}; margin-bottom: 10px;">${s.icon}</div>
            <h2 style="font-size: 28px; color: ${s.color}; margin-bottom: 10px;">${s.title}</h2>
            <p style="margin-bottom: 15px;">${result.summary || ''}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                <div style="background: white; padding: 15px; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: bold; color: ${s.color};">${result.risk_score}/100</div>
                    <div style="font-size: 12px; color: #666;">درجة الخطر</div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${result.confidence}%</div>
                    <div style="font-size: 12px; color: #666;">الثقة</div>
                </div>
            </div>
        </div>
    `;
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth' });
}

window.verifyDeal = async function() {
    hideError();
    document.getElementById('result').style.display = 'none';
    
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const dealUrl = document.getElementById('dealUrl').value.trim();
    const secondUrl = document.getElementById('secondUrl').value.trim();
    
    if (!title || !description || !dealUrl || !secondUrl) {
        showError('يرجى ملء جميع الحقول');
        return;
    }
    
    if (!dealUrl.startsWith('https://') || !secondUrl.startsWith('https://')) {
        showError('الروابط يجب أن تبدأ بـ https://');
        return;
    }
    
    const provider = window.okxwallet || window.ethereum;
    if (!provider) {
        showError('يرجى تثبيت محفظة OKX أو MetaMask');
        return;
    }
    
    try {
        updateStatus('جاري الاتصال...', 10);
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        
        let chainId = await provider.request({ method: 'eth_chainId' });
        if (chainId.toLowerCase() !== EXPECTED_CHAIN_ID_HEX) {
            updateStatus('تبديل الشبكة...', 20);
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
        
        updateStatus('إرسال الطلب...', 30);
        const client = createClient({ chain: studionet, account, provider });
        const caseId = crypto.randomUUID?.() || `case-${Date.now()}`;
        
        updateStatus('تحليل الصفقة...', 40);
        const txHash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: 'analyze_deal',
            args: [caseId, title, description, dealUrl, secondUrl],
            value: BigInt(0)
        });
        
        updateStatus('انتظار القرار...', 50);
        await client.waitForTransactionReceipt({
            hash: txHash,
            waitUntil: 'decided',
            interval: 3000,
            retries: 120
        });
        
        updateStatus('قراءة النتيجة...', 80);
        
        let result = null;
        for (let i = 0; i < 15; i++) {
            try {
                const raw = await client.readContract({
                    address: CONTRACT_ADDRESS,
                    functionName: 'get_verification',
                    args: [caseId],
                    transactionHashVariant: "LATEST_NONFINAL" // ✅ بدون import
                });
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (parsed?.case_id === caseId && ['SAFE', 'RISKY', 'HIGH_RISK'].includes(parsed.verdict?.toUpperCase())) {
                    result = { ...parsed, verdict: parsed.verdict.toUpperCase() };
                    break;
                }
            } catch (e) {}
            updateStatus(`انتظار التحليل... (${i + 1}/15)`, 55 + Math.floor((i / 15) * 30));
            await new Promise(r => setTimeout(r, 3000));
        }
        
        if (!result) throw new Error('لم يتم الحصول على نتيجة');
        
        hideStatus();
        showResult(result, result.verdict);
        
    } catch (err) {
        hideStatus();
        showError(err.message || 'حدث خطأ');
    }
};

document.getElementById('verifyBtn').addEventListener('click', verifyDeal);
