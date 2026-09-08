import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x2df8830eD829E347720076A2073bfb6CC1D5D791";
const EXPECTED_CHAIN_ID_HEX = "0xf22f";

// ======== رسائل التوضيح للمستخدم ========
const STAGE_MESSAGES = {
  CONNECTING: "جاري الاتصال بالمحفظة...",
  SWITCHING_CHAIN: "جاري التبديل إلى شبكة GenLayer...",
  PREPARING: "جاري تجهيز الطلب...",
  ANALYZING: "جاري تحليل الصفقة بالذكاء الاصطناعي...",
  WAITING_DECISION: "جاري انتظار قرار الشبكة...",
  READING_RESULT: "جاري قراءة نتيجة التحقق...",
  COMPLETE: "اكتمل التحقق ✓"
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

// ======== الدوال المساعدة ========
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(message, type = 'error') {
  const errorBox = document.getElementById("error");
  if (errorBox) {
    errorBox.innerHTML = `
      <div style="
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        background: ${type === 'warning' ? '#FFF3E0' : '#FFEBEE'};
        border: 1px solid ${type === 'warning' ? '#FF9800' : '#F44336'};
        color: ${type === 'warning' ? '#E65100' : '#C62828'};
      ">
        <strong>${type === 'warning' ? 'تنبيه' : 'خطأ'}</strong><br>
        ${escapeHtml(message)}
      </div>
    `;
    errorBox.style.display = "block";
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

function updateStatus(message, progress = null) {
  const statusBox = document.getElementById("status");
  if (statusBox) {
    let html = `<div style="
      padding: 12px;
      background: #E3F2FD;
      border-radius: 8px;
      margin-bottom: 15px;
      color: #1565C0;
      display: flex;
      align-items: center;
      gap: 10px;
    ">`;
    
    if (progress !== null) {
      html += `
        <div style="width: 100%;">
          <div style="margin-bottom: 8px;">${escapeHtml(message)}</div>
          <div style="
            width: 100%;
            height: 4px;
            background: #BBDEFB;
            border-radius: 2px;
            overflow: hidden;
          ">
            <div style="
              width: ${progress}%;
              height: 100%;
              background: #2196F3;
              transition: width 0.3s;
            "></div>
          </div>
        </div>
      `;
    } else {
      html += `<span>⏳</span> <span>${escapeHtml(message)}</span>`;
    }
    
    html += '</div>';
    statusBox.innerHTML = html;
    statusBox.style.display = "block";
  }
  
  // تحديث الزر أيضاً
  const button = document.getElementById("verifyBtn");
  if (button) {
    button.innerText = message;
  }
}

function hideStatus() {
  const statusBox = document.getElementById("status");
  if (statusBox) {
    statusBox.style.display = "none";
  }
}

function createCaseId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
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
async function readVerificationWithRetry(client, caseId, attempts = 12, delayMs = 5000) {
  let lastResult = null;
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`محاولة قراءة ${attempt}/${attempts}`, caseId);
    
    try {
      const rawResult = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_verification",
        args: [caseId],
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL
      });
      
      const result = parseVerification(rawResult);
      lastResult = result;
      
      // التحقق من تطابق معرف القضية
      if (result?.case_id && result.case_id !== caseId) {
        throw new Error("النتيجة لا تتطابق مع الطلب الحالي.");
      }
      
      const verdict = String(result?.verdict ?? "").trim().toUpperCase();
      
      // قبول النتائج الصالحة فقط
      if (result?.case_id === caseId && ["SAFE", "RISKY", "HIGH_RISK"].includes(verdict)) {
        return { ...result, verdict };
      }
      
      // إذا كانت النتيجة UNKNOWN، نوضح ذلك للمستخدم
      if (verdict === "UNKNOWN" || !verdict) {
        updateStatus(`جاري انتظار التحليل... (${attempt}/${attempts})`, (attempt / attempts) * 100);
      }
      
    } catch (error) {
      console.warn(`محاولة ${attempt} فشلت:`, error);
    }
    
    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return lastResult;
}

// ======== الدالة الرئيسية ========
window.verifyDeal = async function () {
  hideError();
  hideStatus();
  
  const button = document.getElementById("verifyBtn");
  const resultBox = document.getElementById("result");
  
  // إخفاء النتيجة السابقة
  if (resultBox) {
    resultBox.style.display = "none";
  }
  
  // جمع المدخلات
  const title = document.getElementById("title")?.value.trim();
  const description = document.getElementById("description")?.value.trim();
  const dealUrl = document.getElementById("dealUrl")?.value.trim();
  const secondUrl = document.getElementById("secondUrl")?.value.trim();

  // التحقق من المدخلات
  if (!title || !description || !dealUrl || !secondUrl) {
    showError("يرجى ملء جميع الحقول المطلوبة.", "warning");
    return;
  }

  if (!dealUrl.startsWith("https://") || !secondUrl.startsWith("https://")) {
    showError("يجب أن تبدأ جميع الروابط بـ https://", "warning");
    return;
  }

  // اكتشاف المحفظة
  const provider = window.okxwallet || window.ethereum;
  if (!provider) {
    showError("يرجى فتح DealGuard داخل محفظة OKX أو أي محفظة متوافقة مع Ethereum.");
    return;
  }

  try {
    // 1. الاتصال بالمحفظة
    updateStatus(STAGE_MESSAGES.CONNECTING, 10);
    if (button) button.disabled = true;

    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("لم يتم العثور على حساب في المحفظة.");
    }
    const account = accounts[0];
    console.log("المحفظة:", account);

    // 2. التحقق من الشبكة
    let chainId = await provider.request({ method: "eth_chainId" });
    
    if (chainId.toLowerCase() !== EXPECTED_CHAIN_ID_HEX) {
      updateStatus(STAGE_MESSAGES.SWITCHING_CHAIN, 20);
      
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
        } else {
          throw err;
        }
      }
      
      chainId = await provider.request({ method: "eth_chainId" });
      if (chainId.toLowerCase() !== EXPECTED_CHAIN_ID_HEX) {
        throw new Error("المحفظة غير متصلة بشبكة GenLayer StudioNet.");
      }
    }

    // 3. إنشاء العميل
    updateStatus(STAGE_MESSAGES.PREPARING, 30);
    const client = createClient({
      chain: studionet,
      account,
      provider
    });

    // 4. إنشاء معرف فريد
    const caseId = createCaseId();
    console.log("معرف القضية:", caseId);

    // 5. إرسال الطلب
    updateStatus(STAGE_MESSAGES.ANALYZING, 40);
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "analyze_deal",
      args: [caseId, title, description, dealUrl, secondUrl],
      value: BigInt(0)
    });
    console.log("معاملة GenLayer:", txHash);

    // 6. انتظار القرار
    updateStatus(STAGE_MESSAGES.WAITING_DECISION, 60);
    const transaction = await client.waitForTransactionReceipt({
      hash: txHash,
      waitUntil: "decided",
      interval: 5000,
      retries: 120
    });
    console.log("قرار GenLayer:", transaction);

    // التحقق من نجاح التنفيذ
    const executionResult = transaction?.txExecutionResult;
    if (executionResult && executionResult !== "FINISHED_WITH_RETURN") {
      throw new Error(`فشلت المعاملة: ${transaction?.txExecutionResultName || executionResult}`);
    }

    // 7. قراءة النتيجة
    updateStatus(STAGE_MESSAGES.READING_RESULT, 80);
    const result = await readVerificationWithRetry(client, caseId, 12, 5000);
    console.log("النتيجة النهائية:", result);

    if (!result) {
      throw new Error("لم يتم إرجاع نتيجة التحقق. حاول مرة أخرى.");
    }

    if (result.case_id !== caseId) {
      throw new Error("النتيجة لا تتطابق مع الطلب الحالي.");
    }

    const verdict = String(result.verdict ?? "").trim().toUpperCase();
    if (!["SAFE", "RISKY", "HIGH_RISK"].includes(verdict)) {
      throw new Error("النتيجة غير متاحة بعد. حاول مرة أخرى لاحقاً.");
    }

    // ======== عرض النتيجة ========
    hideStatus();
    displayResult(result, verdict, caseId, txHash);
    
    updateStatus(STAGE_MESSAGES.COMPLETE, 100);
    if (button) {
      button.innerText = STAGE_MESSAGES.COMPLETE;
      button.disabled = false;
    }

  } catch (error) {
    console.error("خطأ DealGuard:", error);
    hideStatus();
    showError(error?.shortMessage || error?.message || String(error));
    if (button) {
      button.disabled = false;
      button.innerText = "التحقق من الصفقة";
    }
  }
};

// ======== دالة عرض النتيجة المحسّنة ========
function displayResult(result, verdict, caseId, txHash) {
  const verdictInfo = VERDICT_INFO[verdict];
  const tips = TIPS_BY_VERDICT[verdict];
  
  const resultBox = document.getElementById("result");
  if (!resultBox) return;

  // تنسيق النتيجة
  resultBox.innerHTML = `
    <div style="
      border: 2px solid ${verdictInfo.color};
      border-radius: 12px;
      padding: 20px;
      background: linear-gradient(135deg, ${verdictInfo.color}10, ${verdictInfo.color}05);
      margin-top: 20px;
    ">
      <!-- الحكم الرئيسي -->
      <div style="
        text-align: center;
        padding: 20px;
        border-bottom: 2px solid ${verdictInfo.color}30;
        margin-bottom: 20px;
      ">
        <div style="
          font-size: 48px;
          margin-bottom: 10px;
        ">${verdictInfo.icon}</div>
        <div style="
          font-size: 28px;
          font-weight: bold;
          color: ${verdictInfo.color};
          margin-bottom: 10px;
        ">${verdictInfo.title}</div>
        <div style="
          font-size: 16px;
          color: #666;
          margin-bottom: 15px;
        ">${verdictInfo.description}</div>
      </div>

      <!-- التفاصيل -->
      <div style="display: grid; gap: 15px;">
        <!-- درجة الخطر -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: white;
          border-radius: 8px;
        ">
          <span>درجة الخطر:</span>
          <span style="
            font-size: 24px;
            font-weight: bold;
            color: ${verdictInfo.color};
          ">${result.risk_score ?? 0}/100</span>
        </div>

        <!-- مستوى الثقة -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background: white;
          border-radius: 8px;
        ">
          <span>مستوى الثقة:</span>
          <span style="
            font-weight: bold;
            color: ${result.confidence >= 80 ? '#4CAF50' : result.confidence >= 50 ? '#FF9800' : '#F44336'};
          ">${result.confidence ?? 0}%</span>
        </div>

        <!-- الملخص -->
        <div style="
          padding: 15px;
          background: white;
          border-radius: 8px;
        ">
          <strong>الملخص:</strong>
          <p style="margin: 10px 0 0 0; color: #555; line-height: 1.6;">
            ${escapeHtml(result.summary) || "لا يوجد ملخص متاح"}
          </p>
        </div>

        <!-- أسباب الخطر -->
        ${result.reasons?.length ? `
          <div style="
            padding: 15px;
            background: #FFEBEE;
            border-radius: 8px;
            border-right: 4px solid #F44336;
          ">
            <strong style="color: #C62828;">أسباب الخطر:</strong>
            <ul style="margin: 10px 0 0 0; padding-right: 20px; color: #555;">
              ${result.reasons.map(r => `<li style="margin: 5px 0;">${escapeHtml(r)}</li>`).join("")}
            </ul>
          </div>
        ` : ''}

        <!-- الأدلة -->
        ${result.evidence?.length ? `
          <div style="
            padding: 15px;
            background: #E8F5E9;
            border-radius: 8px;
            border-right: 4px solid #4CAF50;
          ">
            <strong style="color: #2E7D32;">الأدلة:</strong>
            <ul style="margin: 10px 0 0 0; padding-right: 20px; color: #555;">
              ${result.evidence.map(e => `<li style="margin: 5px 0;">${escapeHtml(e)}</li>`).join("")}
            </ul>
          </div>
        ` : ''}

        <!-- نصائح مخصصة -->
        <div style="
          padding: 15px;
          background: #E3F2FD;
          border-radius: 8px;
          border-right: 4px solid #2196F3;
        ">
          <strong style="color: #1565C0;">💡 نصائح DealGuard:</strong>
          <ul style="margin: 10px 0 0 0; padding-right: 20px; color: #555;">
            ${tips.map(tip => `<li style="margin: 5px 0;">${escapeHtml(tip)}</li>`).join("")}
          </ul>
        </div>

        <!-- معلومات التحقق -->
        <div style="
          margin-top: 15px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
          font-size: 12px;
          color: #666;
        ">
          <div style="margin-bottom: 8px;">
            <strong>معرف القضية:</strong> 
            <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(caseId)}</code>
          </div>
          <div>
            <strong>رقم المعاملة:</strong> 
            <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px; word-break: break-all;">${escapeHtml(txHash)}</code>
          </div>
        </div>
      </div>
    </div>
  `;
  
  resultBox.style.display = "block";
}
