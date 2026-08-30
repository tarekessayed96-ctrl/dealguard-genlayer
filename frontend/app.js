import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS =
  "0x23C558dBe1E7c3661492b7C326F9a60161Df03eA";

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

  const provider = window.ethereum;

  if (!provider) {
    alert("Please open DealGuard inside your OKX Wallet browser.");
    return;
  }

  const button = document.querySelector("button");

  button.disabled = true;
  button.innerText = "Connecting wallet...";

  try {
    // Connect wallet
    const accounts = await provider.request({
      method: "eth_requestAccounts"
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No wallet account found.");
    }

    const walletAddress = accounts[0];

    console.log("Wallet:", walletAddress);

    // Check network
    const chainId = await provider.request({
      method: "eth_chainId"
    });

    console.log("Current Chain ID:", chainId);

    // GenLayer Studio / Studionet
    const GENLAYER_CHAIN_ID = "0xf22f";

    if (chainId.toLowerCase() !== GENLAYER_CHAIN_ID) {
      button.innerText = "Switching to GenLayer...";

      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: GENLAYER_CHAIN_ID
          }
        ]
      });
    }

    // Create GenLayer client
    button.innerText = "Preparing GenLayer...";

    const client = createClient({
      chain: studionet,
      account: walletAddress,
      provider: provider
    });

    button.innerText = "Verifying with GenLayer...";

    // Submit transaction
    const txHash = await client.writeContract({
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

    console.log("Transaction:", txHash);

    button.innerText = "Waiting for GenLayer...";

    // Wait up to approximately 60 seconds
    const receipt =
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED,
        interval: 3000,
        retries: 20
      });

    console.log("Receipt:", receipt);

    // Check execution result
    if (
      receipt.txExecutionResultName &&
      receipt.txExecutionResultName !== "FINISHED_WITH_RETURN"
    ) {
      throw new Error(
        "Contract execution failed: " +
        receipt.txExecutionResultName
      );
    }

    button.innerText = "Reading verification...";

    // Read contract result
    const verification =
      await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_last_verification",
        args: []
      });

    console.log("Verification:", verification);

    let result;

    if (typeof verification === "string") {
      try {
        result = JSON.parse(verification);
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

    // Show report
    document.getElementById("result").style.display = "block";

    document.getElementById("score").innerText =
      `${result?.risk_score ?? 0}/100`;

    document.getElementById("verdict").innerText =
      result?.verdict ?? "UNKNOWN";

    document.getElementById("summary").innerText =
      result?.summary ?? "";

    document.getElementById("reasons").innerHTML =
      (result?.reasons || [])
        .map(reason => `<li>${reason}</li>`)
        .join("");

    document.getElementById("evidence").innerHTML =
      (result?.evidence || [])
        .map(item => `<li>${item}</li>`)
        .join("");

    button.innerText = "Verification complete";
    button.disabled = false;

  } catch (error) {
    console.error("DealGuard error:", error);

    alert(
      "Verification failed:\n\n" +
      (error?.message || String(error))
    );

    button.disabled = false;
    button.innerText = "Verify Deal";
  }
};
