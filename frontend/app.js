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

function showError(message, type = "error") {
  const errorBox = document.getElementById("error");
  if (!errorBox) {
    alert(message);
    return;
  }

  errorBox.innerHTML = `
    <div style="
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      background: ${type === "warning" ? "#FFF3E0" : "#FFEBEE"};
      border: 1px solid ${type === "warning" ? "#FF9800" : "#F44336"};
      color: ${type === "warning" ? "#E65100" : "#C62828"};
    ">
      <strong>${type === "warning" ? "تنبيه" : "خطأ"}</strong><br>
      ${escapeHtml(message)}
    </div>
  `;
  errorBox.style.display = "block";
}

function hideError() {
  const errorBox = document.getElementById("error");
  if (errorBox) errorBox.style.display = "none";
}

function setButtonState({ text, disabled = false }) {
  const button = document.getElementById("verifyBtn");
  if (!button) return;
  button.innerText = text;
  button.disabled = disabled;
}

function updateStatus(message, progress = null) {
  const statusBox = document.getElementById("status");
  if (!statusBox) return;

  let html = `
    <div style="
      padding: 12px;
      background: #E3F2FD;
      border-radius: 8px;
      margin-bottom: 15px;
      color: #1565C0;
      display: flex;
      align-items: center;
      gap: 10px;
    ">
  `;

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
            width: ${Math.min(100, Math.max(0, progress))}%;
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

  html += "</div>";
  statusBox.innerHTML = html;
  statusBox.style.display = "block";

  // تحديث نص الزر أيضاً أثناء العملية
  setButtonState({ text: message, disabled: true });
}

function hideStatus() {
  const statusBox = document.getElementById("status");
  if (statusBox) statusBox.style.display = "none";
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

function isValidHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ======== قراءة النتيجة مع إعادة المحاولة ========
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

      if (result?.case_id && result.case_id !== caseId) {
        throw new Error("النتيجة لا تتطابق مع الطلب الحالي.");
      }

      const verdict = String(result?.verdict ?? "").trim().toUpperCase();

      if (result?.case_id === caseId && ["SAFE", "RISKY", "HIGH_RISK"].includes(verdict)) {
        return { ...result, verdict };
      }

      // حالة انتظار التحليل
      if (verdict === "UNKNOWN" || !verdict) {
        updateStatus(`جاري انتظار التحليل... (${attempt}/${attempts})`, (attempt / attempts) * 100);
      }
    } catch (error) {
      console.warn(`محاولة ${attempt} فشلت:`, error);
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return lastResult;
}

// ======== الدالة الرئيسية ========
window.verifyDeal = async function () {
  hideError();
  hideStatus();

  const resultBox = document.getElementById("result");
  if (resultBox) resultBox.style.display = "none";

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

  if (!isValidHttpsUrl(dealUrl) || !isValidHttpsUrl(secondUrl)) {
    showError("يجب أن تكون جميع الروابط صحيحة وتبدأ بـ https://", "warning");
    return;
  }

  if (dealUrl === secondUrl) {
    showError("الرابطان يجب أن يكونا مختلفين للمقارنة.", "warning");
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

    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("لم يتم العثور على حساب في المحفظة. تأكد من فتح المحفظة والموافقة على الاتصال.");
    }
    const account = accounts[0];
    console.log("المحفظة:", account);

    // 2. التحقق من الشبكة والتبديل إن لزم
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
          // الشبكة غير موجودة → إضافتها
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: EXPECTED_CHAIN_ID_HEX,
              chainName: "GenLayer StudioNet",
              nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
              rpcUrls: ["https://studio.genlayer.com/api/rpc"]
            }]
          });
        } else if (err?.code === 4001) {
          throw new Error("تم رفض طلب تبديل الشبكة من المحفظة.");
        } else {
          throw new Error("فشل التبديل إلى شبكة GenLayer StudioNet. حاول يدوياً من إعدادات المحفظة.");
        }
      }

      // إعادة التحقق بعد التبديل
      chainId = await provider.request({ method: "eth_chainId" });
      if (chainId.toLowerCase() !== EXPECTED_CHAIN_ID_HEX) {
        throw new Error("المحفظة غير متصلة بشبكة GenLayer StudioNet بعد المحاولة.");
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

    const executionResult = transaction?.txExecutionResult;
    if (executionResult && executionResult !== "FINISHED_WITH_RETURN") {
      throw new Error(`فشلت المعاملة: ${transaction?.txExecutionResultName || executionResult}`);
    }

    // 7. قراءة النتيجة
    updateStatus(STAGE_MESSAGES.READING_RESULT, 80);
    const result = await readVerificationWithRetry(client, caseId, 12, 5000);
    console.log("النتيجة النهائية:", result);

    if (!result) {
      throw new Error("لم يتم إرجاع نتيجة التحقق بعد. حاول مرة أخرى بعد قليل.");
    }

    if (result.case_id !== caseId) {
      throw new Error("النتيجة لا تتطابق مع الطلب الحالي.");
    }

    const verdict = String(result.verdict ?? "").trim().toUpperCase();
    if (!["SAFE", "RISKY", "HIGH_RISK"].includes(verdict)) {
      throw new Error("النتيجة غير جاهزة بعد (حالة: " + (verdict || "UNKNOWN") + "). حاول مرة أخرى لاحقاً.");
    }

    // ======== عرض النتيجة ========
    hideStatus();
    displayResult(result, verdict, caseId, txHash);

    // إعادة الزر لحالته الطبيعية مع نص واضح
    setButtonState({ text: "تحقق من صفقة جديدة", disabled: false });

  } catch (error) {
    console.error("خطأ DealGuard:", error);
    hideStatus();

    let friendlyMessage = error?.shortMessage || error?.message || String(error);

    // رسائل أوضح لأخطاء شائعة
    if (friendlyMessage.includes("User rejected") || friendlyMessage.includes("4001")) {
      friendlyMessage = "تم إلغاء العملية من المحفظة.";
    } else if (friendlyMessage.includes("network") || friendlyMessage.includes("chain")) {
      friendlyMessage = "مشكلة في الاتصال بالشبكة. تأكد أنك على GenLayer StudioNet.";
    }

    showError(friendlyMessage);
    setButtonState({ text: "التحقق من الصفقة", disabled: false });
  }
};

// ======== دالة عرض النتيجة المحسّنة ========
function displayResult(result, verdict, caseId, txHash) {
  const verdictInfo = VERDICT_INFO[verdict];
  const tips = TIPS_BY_VERDICT[verdict] || [];

  const resultBox = document.getElementById("result");
  if (!resultBox) return;

  resultBox.innerHTML = `
    <div style="
      border: 2px solid ${verdictInfo.color};
      border-radius: 12px;
      padding: 20px;
      background: linear-gradient(135deg, ${verdictInfo.color}15, ${verdictInfo.color}08);
      margin-top: 20px;
    ">
      <!-- الحكم الرئيسي -->
      <div style="
        text-align: center;
        padding: 20px;
        border-bottom: 2px solid ${verdictInfo.color}30;
        margin-bottom: 20px;
      ">
        <div style="font-size: 48px; margin-bottom: 10px;">${verdictInfo.icon}</div>
        <div style="
          font-size: 28px;
          font-weight: bold;
          color: ${verdictInfo.color};
          margin-bottom: 10px;
        ">${verdictInfo.title}</div>
        <div style="font-size: 16px; color: #666; margin-bottom: 15px;">
          ${verdictInfo.description}
        </div>
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
            color: ${(result.confidence ?? 0) >= 80 ? '#4CAF50' : (result.confidence ?? 0) >= 50 ? '#FF9800' : '#F44336'};
          ">${result.confidence ?? 0}%</span>
        </div>
