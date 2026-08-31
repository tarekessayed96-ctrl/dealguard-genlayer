import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS =
  "0x5D1b99BA76701fcbcB090917EB4439715a45AD88";

window.verifyDeal = async function () {

  const title =
    document.getElementById("title").value.trim();

  const description =
    document.getElementById("description").value.trim();

  const dealUrl =
    document.getElementById("dealUrl").value.trim();

  const secondUrl =
    document.getElementById("secondUrl").value.trim();

  if (!title || !description || !dealUrl || !secondUrl) {
    alert("Please complete all fields.");
    return;
  }

  const provider =
    window.okxwallet || window.ethereum;

  if (!provider) {
    alert("Please open DealGuard inside OKX Wallet.");
    return;
  }

  const button =
    document.querySelector("button");

  button.disabled = true;
  button.innerText =
    "Connecting wallet...";

  try {

    const accounts =
      await provider.request({
        method: "eth_requestAccounts"
      });

    if (!accounts || !accounts.length) {
      throw new Error("No wallet account found.");
    }

    const walletAddress = accounts[0];

    const currentChainId =
      await provider.request({
        method: "eth_chainId"
      });

    console.log("Wallet:", walletAddress);
    console.log("Chain:", currentChainId);

    const expectedChainId = "0xf22f";

    if (
      currentChainId.toLowerCase() !==
      expectedChainId
    ) {

      button.innerText =
        "Switching to GenLayer...";

      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: expectedChainId
          }
        ]
      });
    }

    button.innerText =
      "Preparing GenLayer...";

    const client =
      createClient({
        chain: studionet,
        account: walletAddress,
        provider: provider
      });

    button.innerText =
      "Verifying with GenLayer...";

    const txHash =
      await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "analyze_deal",
        args: [
          title,
          description,
          dealUrl,
          secondUrl
        ],
        value: BigInt(0)
      });

    console.log(
      "DealGuard transaction:",
      txHash
    );

    button.innerText =
      "Waiting for GenLayer...";

    const receipt =
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED,
        interval: 5000,
        retries: 40
      });

    console.log(
      "DealGuard receipt:",
      receipt
    );

    /*
     * IMPORTANT:
     * We do NOT call get_last_verification().
     *
     * The current transaction is the current deal.
     */

    let verification =
      receipt.returnData ??
      receipt.result ??
      receipt.data ??
      receipt.return_value;

    console.log(
      "Verification result:",
      verification
    );

    if (!verification) {
      throw new Error(
        "Transaction completed, but no verification result was returned."
      );
    }

    let result;

    if (typeof verification === "string") {

      try {

        result =
          JSON.parse(verification);

      } catch {

        result = {
          verdict: "UNKNOWN",
          risk_score: 0,
          confidence: 0,
          summary: verification,
          reasons: [],
          evidence: []
        };

      }

    } else {

      result = verification;

    }

    document.getElementById(
      "result"
    ).style.display = "block";

    document.getElementById(
      "score"
    ).innerText =
      `${result?.risk_score ?? 0}/100`;

    document.getElementById(
      "verdict"
    ).innerText =
      result?.verdict ?? "UNKNOWN";

    document.getElementById(
      "summary"
    ).innerText =
      result?.summary ?? "";

    document.getElementById(
      "reasons"
    ).innerHTML =
      (result?.reasons || [])
        .map(
          reason =>
            `<li>${reason}</li>`
        )
        .join("");

    document.getElementById(
      "evidence"
    ).innerHTML =
      (result?.evidence || [])
        .map(
          item =>
            `<li>${item}</li>`
        )
        .join("");

    button.innerText =
      "Verification complete";

    button.disabled = false;

  } catch (error) {

    console.error(
      "DealGuard error:",
      error
    );

    alert(
      "Verification failed:\n\n" +
      (
        error?.message ||
        String(error)
      )
    );

    button.disabled = false;

    button.innerText =
      "Verify Deal";
  }
};
