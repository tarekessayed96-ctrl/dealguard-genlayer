import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = "0x5D1b99BA76701fcbcB090917EB4439715a45AD88";
const EXPECTED_CHAIN_ID_HEX = "0xf22f"; // 61999

// باش نحميو الموقع من الـ XSS
function escapeHtml(str) {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

window.verifyDeal = async function () {
  const button = document.getElementById("verifyBtn"); // اعطي الـ button متاعك id="verifyBtn"
  // ... نفس الكود متاعك

  // أهم تصليح: إضافة الشبكة لو مش موجودة
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: EXPECTED_CHAIN_ID_HEX }] });
  } catch (err) {
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: EXPECTED_CHAIN_ID_HEX,
          chainName: "GenLayer StudioNet",
          rpcUrls: ["https://studio.genlayer.com/api/rpc"],
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 }
        }]
      });
    }
  }
  
  // و في الإظهار استعمل escapeHtml
  document.getElementById("reasons").innerHTML = (result?.reasons || []).map(r => `<li>${escapeHtml(r)}</li>`).join("");
};
