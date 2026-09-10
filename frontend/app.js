import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";

// ✅ العنوان الصحيح (القديم)
const CONTRACT_ADDRESS = "0x2df8830eD829E347720076A2073bfb6CC1D5D791";
const EXPECTED_CHAIN_ID_HEX = "0xf22f";

const STAGE_MESSAGES = {
  CONNECTING: "جاري الاتصال بالمحفظة...",
  SWITCHING_CHAIN: "جاري التبديل إلى شبكة GenLayer...",
  PREPARING: "جاري تجهيز الطلب...",
  ANALYZING: "جاري تحليل الصفقة...",
  WAITING_DECISION: "الشبكة بتحلل الصفقة (قد يستغرق 1-3 دقائق)...",
  READING_RESULT: "جاري قراءة النتيجة...",
  COMPLETE: "✓ اكتمل التحقق"
};

const VERDICT_INFO = {
  SAFE: {
    color: "#4CAF50",
    icon: "✓",
    title: "صفقة آمنة",
    description: "التحقق يشير إلى أن هذه الصفقة آمنة وموثوقة."
  },
  RISKY: {
    color: "#FF9800",
    icon: "⚠",
    title: "صفقة محفوفة بالمخاطر",
    description: "هناك مخاوف من صحة هذه الصفقة. يُنصح بالتحقق اليدوي."
  },
  HIGH_RISK: {
    color: "#F44336",
    icon: "✕",
    title: "صفقة عالية الخطورة",
    description: "تحذير: قد تكون هذه الصفقة احتيالية. تجنبها."
  }
};

const TIPS_BY_VERDICT = {
  SAFE: [
    "رغم أن النتيجة آمنة، تأكد دائماً من البائع بنفسك",
    "قارن الأسعار مع متاجر أخرى",
    "تأكد من سياسة الإرجاع قبل الشراء"
  ],
  RISKY: [
    "تأكد أن الروابط تعمل وتعرض نفس المنتج",
    "ابحث عن مراجعات إضافية على مواقع مستقلة",
    "تواصل مع البائع مباشرة للاستفسار",
    "تأكد من أن الوصف يتضمن تفاصيل كافية عن المنتج"
  ],
  HIGH_RISK: [
    "تجنب هذه الصفقة تماماً",
    "إذا كان السعر منخفضاً جداً، فهو غالباً احتيال",
    "ابحث عن البائع على مواقع التواصل الاجتماعي",
    "لا تدفع أبداً عبر وسائل غير آمنة"
  ]
};

// ======== المساعدات ========
function escapeHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showError(message) {
  const errorBox = document.getElementById("error");
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
    errorBox.className = "p-4 mb-4 rounded-xl bg-red-100 text-red-700 text-center font-bold";
  } else {
    alert(message);
  }
}

function hideError() {
  const errorBox = document.getElementById("error");
  if (errorBox) {
    errorBox.style.display = "none";
  }
}

function updateStatus(message, percent) {
  const statusBox = document.getElementById("status");
  const progressText = document.getElementById("progressText");
  const progressPercent = document.getElementById("progressPercent");
  const progressBar = document.getElementById("progressBar");
  
  if (statusBox) statusBox.style.display = "block";
  if (progressText) progressText.textContent = message;
  if (progressPercent) progressPercent.textContent = percent + "%";
  if (progressBar) progressBar.style.width = percent + "%";
  
  const btn = document.getElementById("verifyBtn");
  if (btn) {
    btn.textContent = message;
    btn.disabled = true;
  }
}

function hideStatus() {
  const statusBox = document.getElementById("status");
  if (statusBox) statusBox.style.display = "none";
}

function createCaseId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "case-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function parseVerification(rawResult) {
  if (!rawResult) return null;
  if (typeof rawResult === "string") {
    try {
      return JSON.parse(rawResult);
    } catch {
      throw new Error("العقد الذكي أرجع بيانات غير صالحة.");
    }
  }
  return rawResult;
}

// ======== قراءة النتيجة ========
async function readVerificationWithRetry(client, caseId, attempts = 15, delayMs = 3000) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`محاولة قراءة ${attempt}/${attempts}`);
    
    try {
      const rawResult = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_verification",
        args: [caseId],
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL
      });

      const result = parseVerification(rawResult);
      
      if (result?.case_id && result.case_id !== caseId) {
        throw new Error("النتيجة لا تتطابق مع الطلب.");
      }

      const verdict = String(result?.verdict ?? "").trim().toUpperCase();

      if (result?.case_id === caseId && ["SAFE", "RISKY", "HIGH_RISK"].includes(verdict)) {
        console.log("✓ نتيجة صالحة:", result);
        return { ...result, verdict };
      }

      console.log("⌛ النتيجة غير جاهزة، المحاولة:", attempt);
      
      if (attempt < attempts) {
        const progress = 55 + Math.floor((attempt / attempts) * 25);
        updateStatus(`جاري انتظار التحليل... (${attempt}/${attempts})`, progress);
        await new Promise(r => setTimeout(r, delayMs));
      }
    } catch (error) {
      console.warn(`محاولة ${attempt} فشلت:`, error);
      if (attempt < attempts) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  
  return null;
}

// ======== عرض النتيجة ========
function displayResult(result, verdict, caseId, txHash) {
  console.log("عرض النتيجة:", { result, verdict, caseId, txHash });
  
  const verdictInfo = VERDICT_INFO[verdict];
  const tips = TIPS_BY_VERDICT[verdict] || [];
  
  const resultBox = document.getElementById("result");
  if (!resultBox) {
    console.error("عنصر result غير موجود!");
    return;
  }

  let html = `
    <div style="
      border: 3px solid ${verdictInfo.color};
      border-radius: 20px;
      padding: 30px;
      background: linear-gradient(135deg, ${verdictInfo.color}15, ${verdictInfo.color}08);
      margin-top: 20px;
      box-shadow: 0 10px 40px ${verdictInfo.color}30;
    ">
      <div style="text-align: center; padding-bottom: 20px; margin-bottom: 20px; border-bottom: 2px solid ${verdictInfo.color}30;">
        <div style="font-size: 64px; margin-bottom: 15px;">${verdictInfo.icon}</div>
        <h2 style="font-size: 32px; font-weight: bold; color: ${verdictInfo.color}; margin-bottom: 10px;">
          ${verdictInfo.title}
        </h2>
        <p style="font-size: 18px; color: #555; line-height: 1.6;">
          ${escapeHtml(result.summary) || verdictInfo.description}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div style="background: white; padding: 20px; border-radius: 15px; text-align: center;">
          <div style="font-size: 14px; color: #666; margin-bottom: 5px;">درجة الخطر</div>
          <div style="font-size: 36px; font-weight: bold; color: ${verdictInfo.color};">
            ${result.risk_score ?? 0}/100
          </div>
        </div>
        <div style="background: white; padding: 20px; border-radius: 15px; text-align: center;">
          <div style="font-size: 14px; color: #666; margin-bottom: 5px;">مستوى الثقة</div>
          <div style="font-size: 36px; font-weight: bold; color: #4CAF50;">
            ${result.confidence ?? 0}%
          </div>
        </div>
      </div>
  `;

  if (result.reasons?.length) {
    html += `
      <div style="background: #FFEBEE; padding: 20px; border-radius: 15px; margin-bottom: 15px; border-right: 5px solid #F44336;">
        <h3 style="color: #C62828; font-weight: bold; margin-bottom: 10px;">⚠️ أسباب الخطر</h3>
        <ul style="margin: 0; padding-right: 20px; color: #555;">
          ${result.reasons.map(r => `<li style="margin: 8px 0;">${escapeHtml(r)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  if (result.evidence?.length) {
    html += `
      <div style="background: #E8F5E9; padding: 20px; border-radius: 15px; margin-bottom: 15px; border-right: 5px solid #4CAF50;">
        <h3 style="color: #2E7D32; font-weight: bold; margin-bottom: 10px;">✓ الأدلة</h3>
        <ul style="margin: 0; padding-right: 20px; color: #555;">
          ${result.evidence.map(e => `<li style="margin: 8px 0;">${escapeHtml(e)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  html += `
      <div style="background: #E3F2FD; padding: 20px; border-radius: 15px; margin-bottom: 15px; border-right: 5px solid #2196F3;">
        <h3 style="color: #1565C0; font-weight: bold; margin-bottom: 10px;">💡 نصائح DealGuard</h3>
        <ul style="margin: 0; padding-right: 20px; color: #555;">
          ${tips.map(tip => `<li style="margin: 8px 0;">${escapeHtml(tip)}</li>`).join("")}
        </ul>
      </div>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 10px; font-size: 12px; color: #666; font-family: monospace;">
        <div style="margin-bottom: 8px;"><strong>معرف القضية:</strong> ${escapeHtml(caseId)}</div>
        <div><strong>رقم المعاملة:</strong> ${escapeHtml(txHash)}</div>
      </div>
    </div>
  `;

  resultBox.innerHTML = html;
  resultBox.style.display = "block";
  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
  
  console.log("✓ تم عرض النتيجة بنجاح");
}

// ======== الدالة الرئيسية ========
window.verifyDeal = async function() {
  console.log("=== بدأ التحقق ===");
  
  hideError();
  
  const resultBox = document.getElementById("result");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerHTML = "";
  }

  const title = document.getElementById("title")?.value.trim();
  const description = document.getElementById("description")?.value.trim();
  const dealUrl = document.getElementById("dealUrl")?.value.trim();
  const secondUrl = document.getElementById("secondUrl")?.value.trim();

  console.log("المدخلات:", { title, description, dealUrl, secondUrl });

  if (!title || !description || !dealUrl || !secondUrl) {
    showError("يرجى ملء جميع الحقول المطلوبة.");
    return;
  }

  if (!dealUrl.startsWith("https://") || !secondUrl.startsWith("https://")) {
    showError("يجب أن تبدأ جميع الروابط بـ https://");
    return;
  }

  const provider = window.okxwallet || window.ethereum;
  if (!provider) {
    showError("يرجى فتح DealGuard داخل محفظة OKX أو MetaMask.");
    return;
  }

  let progressTimer = null;
  
  try {
    // 1. الاتصال
    updateStatus(STAGE_MESSAGES.CONNECTING, 8);
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("لم يتم العثور على حساب");
    const account = accounts[0];
    console.log("الحساب:", account);

    // 2. التحقق من الشبكة
    let chainId = await provider.request({ method: "eth_chainId" });
    if (chainId.toLowerCase() !== EXPECTED_CHAIN_ID_HEX) {
      updateStatus(STAGE_MESSAGES.SWITCHING_CHAIN, 15);
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: EXPECTED_CHAIN_ID_HEX }]
        });
      } catch (err) {
        if (err?.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: EXPECTED_CHAIN_ID_HEX,
              chainName: "GenLayer StudioNet",
              nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
              rpcUrls: ["https://studio.genlayer.com/api/rpc"]
            }]
          });
        }
      }
    }

    // 3. إنشاء العميل
    updateStatus(STAGE_MESSAGES.PREPARING, 22);
    const client = createClient({ chain: studionet, account, provider });
    const caseId = createCaseId();
    console.log("معرف القضية:", caseId);

    // 4. إرسال المعاملة
    updateStatus(STAGE_MESSAGES.ANALYZING, 30);
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "analyze_deal",
      args: [caseId, title, description, dealUrl, secondUrl],
      value: BigInt(0)
    });
    console.log("رقم المعاملة:", txHash);

    // 5. انتظار القرار
    updateStatus(STAGE_MESSAGES.WAITING_DECISION, 40);
    let currentProgress = 40;
    progressTimer = setInterval(() => {
      currentProgress = Math.min(70, currentProgress + 1);
      updateStatus(STAGE_MESSAGES.WAITING_DECISION, currentProgress);
    }, 3000);

    const transaction = await client.waitForTransactionReceipt({
      hash: txHash,
      waitUntil: "decided",
      interval: 3000,
      retries: 120
    });
    
    clearInterval(progressTimer);
    progressTimer = null;
    
    console.log("حالة المعاملة:", transaction);

    // 6. قراءة النتيجة
    updateStatus(STAGE_MESSAGES.READING_RESULT, 75);
    const result = await readVerificationWithRetry(client, caseId, 15, 3000);
    
    if (!result) {
      throw new Error("لم يتم الحصول على نتيجة من العقد الذكي. حاول مرة أخرى بعد قليل.");
    }

    console.log("النتيجة:", result);

    const verdict = result.verdict;
    if (!["SAFE", "RISKY", "HIGH_RISK"].includes(verdict)) {
      throw new Error("النتيجة غير صالحة: " + verdict);
    }

    hideStatus();
    displayResult(result, verdict, caseId, txHash);

    const btn = document.getElementById("verifyBtn");
    if (btn) {
      btn.textContent = "تحقق من صفقة جديدة";
      btn.disabled = false;
    }

  } catch (error) {
    console.error("خطأ:", error);
    if (progressTimer) clearInterval(progressTimer);
    hideStatus();
    showError(error?.message || "حدث خطأ غير متوقع");
    
    const btn = document.getElementById("verifyBtn");
    if (btn) {
      btn.textContent = "التحقق من الصفقة";
      btn.disabled = false;
    }
  }
};
