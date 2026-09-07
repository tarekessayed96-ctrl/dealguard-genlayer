import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
const CONTRACT_ADDRESS =
  "0x2df8830eD829E347720076A2073bfb6CC1D5D791";
const EXPECTED_CHAIN_ID_HEX = "0xf22f";
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function showError(message) {
  const errorBox = document.getElementById("error");
  if (errorBox) {
    errorBox.textContent = message;
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
function createCaseId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return (
    "case-" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2)
  );
}
/*
 * Convert the contract response into a JavaScript object.
 */
function parseVerification(rawResult) {
  if (!rawResult) {
    return null;
  }
  if (typeof rawResult === "string") {
    try {
      return JSON.parse(rawResult);
    } catch {
      throw new Error(
        "DealGuard returned invalid JSON."
      );
    }
  }
  return rawResult;
}
/*
 * Read the verification belonging ONLY to this caseId.
 *
 * We retry because the finalized state can take a little
 * time to become readable through the RPC after execution.
 *
 * UNKNOWN is NOT treated as a successful verification.
 */
async function readVerificationWithRetry(
  client,
  caseId,
  attempts = 12,
  delayMs = 5000
) {
  let lastResult = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(
      `Reading verification ${attempt}/${attempts}`,
      caseId
    );
    try {
      const rawResult =
        await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_verification",
          args: [caseId],
          transactionHashVariant:
            TransactionHashVariant.LATEST_FINAL
        });
      console.log(
        "Raw verification response:",
        rawResult
      );
      const result =
        parseVerification(rawResult);
      lastResult = result;
      console.log(
        "Parsed verification:",
        result
      );
      /*
       * The result must belong to this exact request.
       */
      if (
        result?.case_id &&
        result.case_id !== caseId
      ) {
        throw new Error(
          "Returned verification does not match this request."
        );
      }
      /*
       * A real verification has a known verdict.
       */
      const verdict =
        String(result?.verdict ?? "")
          .trim()
          .toUpperCase();
      if (
        result?.case_id === caseId &&
        ["SAFE", "RISKY", "HIGH_RISK"].includes(
          verdict
        )
      ) {
        return {
          ...result,
          verdict
        };
      }
      /*
       * If we received UNKNOWN, keep waiting.
       */
      console.log(
        "Verification is not available yet. Retrying..."
      );
    } catch (error) {
      console.warn(
        `Verification read attempt ${attempt} failed:`,
        error
      );
      /*
       * Do not immediately fail.
       * RPC/state propagation can temporarily fail.
       */
    }
    if (attempt < attempts) {
      const button =
        document.getElementById("verifyBtn");
      if (button) {
        button.innerText =
          `Waiting for verification... (${attempt}/${attempts})`;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs)
      );
    }
  }
  /*
   * If all retries failed, return the last response
   * only for diagnostics.
   */
  return lastResult;
}
window.verifyDeal = async function () {
  hideError();
  const button =
    document.getElementById("verifyBtn");
  const title =
    document.getElementById("title")?.value.trim();
  const description =
    document
      .getElementById("description")
      ?.value.trim();
  const dealUrl =
    document
      .getElementById("dealUrl")
      ?.value.trim();
  const secondUrl =
    document
      .getElementById("secondUrl")
      ?.value.trim();
  if (
    !title ||
    !description ||
    !dealUrl ||
    !secondUrl
  ) {
    showError(
      "Please complete all fields."
    );
    return;
  }
  if (
    !dealUrl.startsWith("https://") ||
    !secondUrl.startsWith("https://")
  ) {
    showError(
      "Both URLs must start with https://"
    );
    return;
  }
  const provider =
    window.okxwallet || window.ethereum;
  if (!provider) {
    showError(
      "Please open DealGuard inside OKX Wallet."
    );
    return;
  }
  try {
    if (button) {
      button.disabled = true;
      button.innerText =
        "Connecting wallet...";
    }
    const accounts =
      await provider.request({
        method: "eth_requestAccounts"
      });
    if (
      !accounts ||
      accounts.length === 0
    ) {
      throw new Error(
        "No wallet account found."
      );
    }
    const account = accounts[0];
    console.log(
      "Wallet:",
      account
    );
    let chainId =
      await provider.request({
        method: "eth_chainId"
      });
    console.log(
      "Current chain:",
      chainId
    );
    if (
      chainId.toLowerCase() !==
      EXPECTED_CHAIN_ID_HEX
    ) {
      if (button) {
        button.innerText =
          "Switching to GenLayer...";
      }
      try {
        await provider.request({
          method:
            "wallet_switchEthereumChain",
          params: [
            {
              chainId:
                EXPECTED_CHAIN_ID_HEX
            }
          ]
        });
      } catch (err) {
        if (err?.code === 4902) {
          await provider.request({
            method:
              "wallet_addEthereumChain",
            params: [
              {
                chainId:
                  EXPECTED_CHAIN_ID_HEX,
                chainName:
                  "GenLayer StudioNet",
                nativeCurrency: {
                  name: "GEN",
                  symbol: "GEN",
                  decimals: 18
                },
                rpcUrls: [
                  "https://studio.genlayer.com/api/rpc"
                ]
              }
            ]
          });
        } else {
          throw err;
        }
      }
      chainId =
        await provider.request({
          method: "eth_chainId"
        });
      if (
        chainId.toLowerCase() !==
        EXPECTED_CHAIN_ID_HEX
      ) {
        throw new Error(
          "Wallet is not connected to GenLayer StudioNet."
        );
      }
    }
    if (button) {
      button.innerText =
        "Preparing GenLayer...";
    }
    const client =
      createClient({
        chain: studionet,
        account,
        provider
      });
    /*
     * IMPORTANT:
     * This Case ID is the correlation ID for the request.
     *
     * It is NOT the transaction hash.
     */
    const caseId =
      createCaseId();
    console.log(
      "DealGuard case ID:",
      caseId
    );
    if (button) {
      button.innerText =
        "Analyzing deal...";
    }
    const txHash =
      await client.writeContract({
        address:
          CONTRACT_ADDRESS,
        functionName:
          "analyze_deal",
        args: [
          caseId,
          title,
          description,
          dealUrl,
          secondUrl
        ],
        value: BigInt(0)
      });
    console.log(
      "GenLayer transaction:",
      txHash
    );
    if (button) {
      button.innerText =
        "Waiting for GenLayer finalization...";
    }
    /*
     * Wait for actual finalized transaction state.
     */
    const transaction =
      await client.waitForTransactionReceipt({
        hash: txHash,
        waitUntil: "finalized",
        interval: 5000,
        retries: 120
      });
    console.log(
      "Finalized transaction:",
      transaction
    );
    /*
     * Check contract execution result.
     */
    const executionResult =
      transaction?.txExecutionResult;
    const executionResultName =
      transaction?.txExecutionResultName;
    if (
      executionResult &&
      executionResult !==
        "FINISHED_WITH_RETURN"
    ) {
      throw new Error(
        `DealGuard transaction failed: ${
          executionResultName ||
          executionResult
        }`
      );
    }
    if (button) {
      button.innerText =
        "Reading verified result...";
    }
    /*
     * IMPORTANT:
     *
     * We read using the SAME caseId that was submitted.
     *
     * We never use txHash here.
     *
     * We also retry because the RPC may temporarily
     * return the default UNKNOWN response.
     */
    const result =
      await readVerificationWithRetry(
        client,
        caseId,
        12,
        5000
      );
    console.log(
      "DealGuard verified result:",
      result
    );
    /*
     * A valid result must exist.
     */
    if (!result) {
      throw new Error(
        "DealGuard did not return a verification result."
      );
    }
    /*
     * Make sure the result belongs to this exact request.
     */
    if (
      result.case_id !== caseId
    ) {
      throw new Error(
        "Returned verification does not match this request."
      );
    }
    /*
     * Never display UNKNOWN as a successful verification.
     */
    const verdict =
      String(
        result.verdict ?? ""
      )
        .trim()
        .toUpperCase();
    if (
      ![
        "SAFE",
        "RISKY",
        "HIGH_RISK"
      ].includes(verdict)
    ) {
      throw new Error(
        "Verification result is still unavailable. Please try again."
      );
    }
    /*
     * Display result.
     */
    const resultBox =
      document.getElementById(
        "result"
      );
    if (resultBox) {
      resultBox.style.display =
        "block";
    }
    const score =
      document.getElementById(
        "score"
      );
    if (score) {
      score.textContent =
        `${result?.risk_score ?? 0}/100`;
    }
    const verdictBox =
      document.getElementById(
        "verdict"
      );
    if (verdictBox) {
      verdictBox.textContent =
        verdict;
    }
    const confidence =
      document.getElementById(
        "confidence"
      );
    if (confidence) {
      confidence.textContent =
        `Confidence: ${
          result?.confidence ?? 0
        }%`;
    }
    const summary =
      document.getElementById(
        "summary"
      );
    if (summary) {
      summary.textContent =
        result?.summary ?? "";
    }
    const reasons =
      document.getElementById(
        "reasons"
      );
    if (reasons) {
      reasons.innerHTML =
        (
          Array.isArray(
            result?.reasons
          )
            ? result.reasons
            : []
        )
          .map(
            (reason) =>
              `<li>${escapeHtml(
                reason
              )}</li>`
          )
          .join("");
    }
    const evidence =
      document.getElementById(
        "evidence"
      );
    if (evidence) {
      evidence.innerHTML =
        (
          Array.isArray(
            result?.evidence
          )
            ? result.evidence
            : []
        )
          .map(
            (item) =>
              `<li>${escapeHtml(
                item
              )}</li>`
          )
          .join("");
    }
    const caseIdBox =
      document.getElementById(
        "caseId"
      );
    if (caseIdBox) {
      caseIdBox.textContent =
        caseId;
    }
    const txHashBox =
      document.getElementById(
        "txHash"
      );
    if (txHashBox) {
      txHashBox.textContent =
        txHash;
    }
    if (button) {
      button.innerText =
        "Verification complete ✓";
      button.disabled = false;
    }
  } catch (error) {
    console.error(
      "DealGuard error:",
      error
    );
    showError(
      error?.shortMessage ||
        error?.message ||
        String(error)
    );
    if (button) {
      button.disabled = false;
      button.innerText =
        "Verify Deal";
    }
  }
};
