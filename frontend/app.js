import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS =
  "0x5D1b99BA76701fcbcB090917EB4439715a45AD88";

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

window.verifyDeal = async function () {

  hideError();

  const button =
    document.getElementById("verifyBtn");

  const title =
    document.getElementById("title")?.value.trim();

  const description =
    document.getElementById("description")?.value.trim();

  const dealUrl =
    document.getElementById("dealUrl")?.value.trim();

  const secondUrl =
    document.getElementById("secondUrl")?.value.trim();

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

  const provider =
    window.okxwallet ||
    window.ethereum;

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

    const account =
      accounts[0];

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
        account: account,
        provider: provider
      });

    if (button) {
      button.innerText =
        "Analyzing deal...";
    }

    /*
     * Every click creates a NEW verification
     * using the data entered by the user.
     */

    const txHash =
      await client.writeContract({

        address:
          CONTRACT_ADDRESS,

        functionName:
          "analyze_deal",

        args: [
          title,
          description,
          dealUrl,
          secondUrl
        ],

        value:
          BigInt(0)
      });

    console.log(
      "Verification transaction:",
      txHash
    );

    if (button) {
      button.innerText =
        "Waiting for GenLayer consensus...";
    }

    const receipt =
      await client.waitForTransactionReceipt({

        hash:
          txHash,

        status:
          TransactionStatus.ACCEPTED,

        interval:
          5000,

        retries:
          90
      });

    console.log(
      "Transaction receipt:",
      receipt
    );

    /*
     * IMPORTANT:
     *
     * We intentionally DO NOT call:
     *
     * get_last_verification()
     *
     * because that would read shared stored state.
     */

    let rawResult =
      receipt?.returnData ??
      receipt?.return_value ??
      receipt?.result;

    console.log(
      "Returned result:",
      rawResult
    );

    if (!rawResult) {
      throw new Error(
        "The transaction was accepted, but no result was returned by the SDK."
      );
    }

    let result;

    if (
      typeof rawResult ===
      "string"
    ) {

      try {
        result =
          JSON.parse(rawResult);
      } catch {
        throw new Error(
          "GenLayer returned a result, but it is not valid JSON."
        );
      }

    } else {

      result =
        rawResult;
    }

    console.log(
      "DealGuard result:",
      result
    );

    const resultBox =
      document.getElementById("result");

    if (resultBox) {
      resultBox.style.display =
        "block";
    }

    const score =
      document.getElementById("score");

    if (score) {
      score.textContent =
        `${result?.risk_score ?? 0}/100`;
    }

    const verdict =
      document.getElementById("verdict");

    if (verdict) {
      verdict.textContent =
        result?.verdict ??
        "UNKNOWN";
    }

    const summary =
      document.getElementById("summary");

    if (summary) {
      summary.textContent =
        result?.summary ??
        "";
    }

    const reasons =
      document.getElementById("reasons");

    if (reasons) {

      reasons.innerHTML =
        (result?.reasons || [])
          .map(
            reason =>
              `<li>${escapeHtml(reason)}</li>`
          )
          .join("");
    }

    const evidence =
      document.getElementById("evidence");

    if (evidence) {

      evidence.innerHTML =
        (result?.evidence || [])
          .map(
            item =>
              `<li>${escapeHtml(item)}</li>`
          )
          .join("");
    }

    if (button) {
      button.innerText =
        "Verification complete ✓";

      button.disabled =
        false;
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
      button.disabled =
        false;

      button.innerText =
        "Verify Deal";
    }
  }
};
