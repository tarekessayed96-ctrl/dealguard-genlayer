import {
  createClient,
  isSuccessful
} from "genlayer-js";

import { studionet } from "genlayer-js/chains";

import {
  TransactionHashVariant
} from "genlayer-js/types";


const CONTRACT_ADDRESS =
  "PUT_NEW_CONTRACT_ADDRESS_HERE";

const EXPECTED_CHAIN_ID_HEX =
  "0xf22f";


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function showError(message) {

  const errorBox =
    document.getElementById("error");

  if (errorBox) {

    errorBox.textContent =
      message;

    errorBox.style.display =
      "block";

  } else {

    alert(message);
  }
}


function hideError() {

  const errorBox =
    document.getElementById("error");

  if (errorBox) {
    errorBox.style.display =
      "none";
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
    Math.random()
      .toString(36)
      .slice(2)
  );
}


window.verifyDeal = async function () {

  hideError();

  const button =
    document.getElementById("verifyBtn");

  const title =
    document
      .getElementById("title")
      ?.value
      .trim();

  const description =
    document
      .getElementById("description")
      ?.value
      .trim();

  const dealUrl =
    document
      .getElementById("dealUrl")
      ?.value
      .trim();

  const secondUrl =
    document
      .getElementById("secondUrl")
      ?.value
      .trim();


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

      button.disabled =
        true;

      button.innerText =
        "Connecting wallet...";
    }


    const accounts =
      await provider.request({
        method:
          "eth_requestAccounts"
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
        method:
          "eth_chainId"
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
          method:
            "eth_chainId"
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

        chain:
          studionet,

        account:
          account,

        provider:
          provider
      });


    /*
     * Every verification receives
     * its own unique ID.
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

        value:
          BigInt(0)
      });


    console.log(
      "GenLayer transaction:",
      txHash
    );


    if (button) {

      button.innerText =
        "Waiting for GenLayer consensus...";
    }


    /*
     * IMPORTANT:
     *
     * Do NOT stop at ACCEPTED.
     *
     * We wait until the GenLayer
     * transaction is FINALIZED.
     */

    const transaction =
      await client.waitForFinalization({

        hash:
          txHash
      });


    console.log(
      "Finalized transaction:",
      transaction
    );


    if (
      !isSuccessful(transaction)
    ) {

      throw new Error(
        `DealGuard transaction failed: ${
          transaction?.statusName ??
          "unknown status"
        } / ${
          transaction?.txExecutionResultName ??
          "unknown execution result"
        }`
      );
    }


    if (button) {

      button.innerText =
        "Reading verified result...";
    }


    /*
     * Read ONLY the result associated
     * with this case ID.
     *
     * LATEST_FINAL guarantees that
     * we read finalized contract state.
     */

    const rawResult =
      await client.readContract({

        address:
          CONTRACT_ADDRESS,

        functionName:
          "get_verification",

        args: [
          caseId
        ],

        transactionHashVariant:
          TransactionHashVariant.LATEST_FINAL
      });


    console.log(
      "DealGuard raw result:",
      rawResult
    );


    if (!rawResult) {

      throw new Error(
        "DealGuard returned an empty result."
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
          "DealGuard returned invalid JSON."
        );
      }

    } else {

      result =
        rawResult;
    }


    console.log(
      "DealGuard final result:",
      result
    );


    /*
     * Safety check:
     * make sure the returned result
     * belongs to this request.
     */

    if (
      result?.case_id &&
      result.case_id !== caseId
    ) {

      throw new Error(
        "Returned verification does not match this request."
      );
    }


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
