import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS =
  "0x23C558dBe1E7c3661492b7C326F9a60161Df03eA";

const provider =
  window.okxwallet ||
  window.ethereum;

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

  if (!provider) {
    alert("Please open DealGuard inside OKX Wallet.");
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

    const walletAddress = accounts[0];

    console.log("Wallet:", walletAddress);

    // Add Studionet if necessary
    try {

      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: "0xf1ef"
          }
        ]
      });

    } catch (switchError) {

      console.log("Network not found. Adding Studionet...");

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xf1ef",
            chainName: "GenLayer Studionet",
            nativeCurrency: {
              name: "GEN",
              symbol: "GEN",
              decimals: 18
            },
            rpcUrls: [
              "https://studio.genlayer.com/api"
            ],
            blockExplorerUrls: [
              "https://explorer-studio.genlayer.com"
            ]
          }
        ]
      });

    }

    button.innerText = "Connecting to Studionet...";

    const writeClient = createClient({
      chain: studionet,
      account: walletAddress,
      provider: provider
    });

    const readClient = createClient({
      chain: studionet
    });

    button.innerText = "Verifying with GenLayer...";

    const txHash = await writeClient.writeContract({
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

    button.innerText = "Waiting for verification...";

    const receipt =
      await readClient.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.ACCEPTED
      });

    console.log("Receipt:", receipt);

    button.innerText = "Reading result...";

    const verification =
      await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_last_verification",
        args: []
      });

    console.log("Verification:", verification);

    let result;

    try {
      result =
        typeof verification === "string"
          ? JSON.parse(verification)
          : verification;
    } catch {

      result = {
        verdict: "UNKNOWN",
        risk_score: 0,
        confidence: 0,
        summary: String(verification),
        reasons: [],
        evidence: []
      };

    }

    document.getElementById("result").style.display =
      "block";

    document.getElementById("score").innerText =
      (result.risk_score ?? 0) + "/100";

    document.getElementById("verdict").innerText =
      result.verdict ?? "UNKNOWN";

    document.getElementById("summary").innerText =
      result.summary ?? "";

    document.getElementById("reasons").innerHTML =
      (result.reasons || [])
        .map(reason => `<li>${reason}</li>`)
        .join("");

    document.getElementById("evidence").innerHTML =
      (result.evidence || [])
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
