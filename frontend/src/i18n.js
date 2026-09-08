const translations = {
  ar: {
    title: "DealGuard - التحقق من الصفقات",
    heroTitle: "لا تثق بالصفقة.",
    heroSubtitle: "تحقق منها.",
    heroDesc: "DealGuard يقارن المصادر الحقيقية ويستخدم GenLayer لتحديد ما إذا كانت الصفقة موثوقة.",
    features: {
      webEvidence: "أدلة الويب",
      comparison: "مقارنة المصادر",
      uniqueCases: "قضايا فريدة"
    },
    form: {
      titleLabel: "عنوان الصفقة *",
      titlePlaceholder: "مثال: iPhone 15 Pro - 256GB",
      descLabel: "وصف الصفقة *",
      descPlaceholder: "صف تفاصيل الصفقة: السعر، البائع، الحالة...",
      dealUrlLabel: "رابط الصفقة *",
      dealUrlHint: "يجب أن يبدأ بـ https://",
      refUrlLabel: "رابط المرجع/المراجعة *",
      refUrlHint: "رابط لمراجعات أو متجر رسمي",
      verifyBtn: "التحقق من الصفقة",
      verifying: "جاري التحقق..."
    },
    stages: {
      connecting: "جاري الاتصال بالمحفظة...",
      switching: "جاري التبديل إلى شبكة GenLayer...",
      preparing: "جاري تجهيز الطلب...",
      analyzing: "جاري تحليل الصفقة...",
      waiting: "جاري انتظار القرار...",
      reading: "جاري قراءة النتيجة...",
      complete: "اكتمل التحقق ✓"
    },
    results: {
      safe: "صفقة آمنة",
      risky: "محفوفة بالمخاطر",
      highRisk: "عالية الخطورة",
      riskScore: "درجة الخطر",
      confidence: "الثقة",
      summary: "الملخص",
      reasons: "أسباب الخطر",
      evidence: "الأدلة",
      tips: "نصائح DealGuard",
      caseId: "معرف القضية",
      txHash: "رقم المعاملة",
      noResult: "لا توجد نتيجة"
    },
    errors: {
      fillAll: "يرجى ملء جميع الحقول",
      httpsRequired: "يجب أن تبدأ الروابط بـ https://",
      installWallet: "يرجى تثبيت محفظة OKX أو MetaMask"
    },
    history: {
      title: "سجل التحققات",
      empty: "لا توجد تحققات سابقة",
      clear: "مسح السجل"
    }
  },
  en: {
    title: "DealGuard - AI Deal Verification",
    heroTitle: "Don't trust the deal.",
    heroSubtitle: "Verify it.",
    heroDesc: "DealGuard compares real web sources and uses GenLayer to determine if an online deal is trustworthy.",
    features: {
      webEvidence: "Web Evidence",
      comparison: "Source Comparison",
      uniqueCases: "Unique Cases"
    },
    form: {
      titleLabel: "Deal Title *",
      titlePlaceholder: "e.g., iPhone 15 Pro - 256GB",
      descLabel: "Deal Description *",
      descPlaceholder: "Describe the deal: price, seller, condition...",
      dealUrlLabel: "Deal URL *",
      dealUrlHint: "Must start with https://",
      refUrlLabel: "Reference/Review URL *",
      refUrlHint: "Link to reviews or official store",
      verifyBtn: "Verify Deal",
      verifying: "Verifying..."
    },
    stages: {
      connecting: "Connecting wallet...",
      switching: "Switching to GenLayer...",
      preparing: "Preparing request...",
      analyzing: "Analyzing deal...",
      waiting: "Waiting for decision...",
      reading: "Reading result...",
      complete: "Verification Complete ✓"
    },
    results: {
      safe: "Safe Deal",
      risky: "Risky Deal",
      highRisk: "High Risk",
      riskScore: "Risk Score",
      confidence: "Confidence",
      summary: "Summary",
      reasons: "Risk Reasons",
      evidence: "Evidence",
      tips: "DealGuard Tips",
      caseId: "Case ID",
      txHash: "Transaction",
      noResult: "No result available"
    },
    errors: {
      fillAll: "Please fill all fields",
      httpsRequired: "URLs must start with https://",
      installWallet: "Please install OKX or MetaMask wallet"
    },
    history: {
      title: "Verification History",
      empty: "No previous verifications",
      clear: "Clear History"
    }
  }
};

let currentLang = localStorage.getItem('dealguard-lang') || 'en';

export function t(key) {
  const keys = key.split('.');
  let value = translations[currentLang];
  for (const k of keys) {
    value = value?.[k];
  }
  return value || key;
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('dealguard-lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function getLang() {
  return currentLang;
}

export function toggleLang() {
  setLang(currentLang === 'ar' ? 'en' : 'ar');
  window.location.reload();
}
