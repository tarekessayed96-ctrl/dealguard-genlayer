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

  // Check fields
  if (!title || !description || !dealUrl || !secondUrl) {
    alert("Please complete all fields.");
    return;
  }

  // Get OKX Wallet / Ethereum provider
  const provider =
    window.okxwallet ||
    window.ethereum;

  if (!provider) {
    alert("Please open DealGuard inside OKX Wallet.");
    return;
  }

  const button =
    document.querySelector("button");

  button.disabled = true;
  button.innerText = "Connecting wallet...";

  try {

    // --------------------------------
    // 1. Connect wallet
    // --------------------------------

    const accounts =
      await provider.request({
        method: "eth_requestAccounts"
      });

    if (!accounts || !accounts.length) {
      throw new Error("No wallet account found.");
    }

    const walletAddress =
      accounts[0];

    console.log(
      "Wallet:",
      walletAddress
    );


    // --------------------------------
    // 2. Check network
    // --------------------------------

    const currentChainId =
      await provider.request({
        method: "eth_chainId"
      });

    console.log(
      "Current chain:",
      currentChainId
    );


    // --------------------------------
    // 3. Switch to GenLayer Studionet
    // --------------------------------

    const expectedChainId =
      "0xf22f";

    if (
      currentChainId.toLowerCase() !==
      expectedChainId.toLowerCase()
    ) {

      button.innerText =
        "Switching to GenLayer Studionet...";

      try {

        await provider.request({
          method:
            "wallet_switchEthereumChain",
          params: [
            {
              chainId:
                expectedChainId
            }
          ]
        });

      } catch (switchError) {

        console.log(
          "Switch error:",
          switchError
        );

        // Network is not added
        if (
          switchError &&
          switchError.code === 4902
        ) {

          button.innerText =
            "Adding GenLayer Studionet...";

          await provider.request({
            method:
              "wallet_addEthereumChain",
            params: [
              {
                chainId:
                  expectedChainId,

                chainName:
                  "GenLayer Studionet",

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

        } else {

          throw switchError;

        }
      }
    }


    // --------------------------------
    // 4. Create write client
    // --------------------------------

    button.innerText =
      "Preparing GenLayer...";

    const writeClient =
      createClient({
        chain: studionet,
        account: walletAddress,
        provider: provider
      });


    // --------------------------------
    // 5. Create read client
    // --------------------------------

    const readClient =
      createClient({
        chain: studionet
      });


    // --------------------------------
    // 6. Send transaction
    // --------------------------------

    button.innerText =
      "Verifying with GenLayer...";

    const txHash =
      await writeClient.writeContract({

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
      "Transaction:",
      txHash
    );


    // --------------------------------
    // 7. Wait for GenLayer
    // --------------------------------

    button.innerText =
      "Waiting for GenLayer...";


    const receipt =
      await readClient.waitForTransactionReceipt({

        hash:
          txHash,

        status:
          TransactionStatus.ACCEPTED,

        // Check every 5 seconds
        interval:
          5000,

        // Maximum ~3 minutes 20 seconds
        retries:
          40

      });


    console.log(
      "Receipt:",
      receipt
    );


    // --------------------------------
    // 8. Check execution result
    // --------------------------------

    if (
      receipt.txExecutionResultName &&
      receipt.txExecutionResultName !==
        "FINISHED_WITH_RETURN"
    ) {

      throw new Error(
        "Contract execution failed: " +
        receipt.txExecutionResultName
      );

    }


    // --------------------------------
    // 9. Read verification result
    // --------------------------------

    button.innerText =
      "Reading verification result...";


    const verification =
      await readClient.readContract({

        address:
          CONTRACT_ADDRESS,

        functionName:
          "get_last_verification",

        args: []

      });


    console.log(
      "Verification:",
      verification
    );


    // --------------------------------
    // 10. Parse result
    // --------------------------------

    let result;


    if (
      typeof verification ===
      "string"
    ) {

      try {

        result =
          JSON.parse(
            verification
          );

      } catch {

        result = {

          verdict:
            "UNKNOWN",

          risk_score:
            0,

          confidence:
            0,

          summary:
            verification,

          reasons:
            [],

          evidence:
            []

        };

      }

    } else {

      result =
        verification;

    }


    // --------------------------------
    // 11. Show result
    // --------------------------------

    document.getElementById(
      "result"
    ).style.display =
      "block";


    document.getElementById(
      "score"
    ).innerText =
      `${result?.risk_score ?? 0}/100`;


    document.getElementById(
      "verdict"
    ).innerText =
      result?.verdict ??
      "UNKNOWN";


    document.getElementById(
      "summary"
    ).innerText =
      result?.summary ??
      "";


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


    // --------------------------------
    // 12. Finished
    // --------------------------------

    button.innerText =
      "Verification complete";

    button.disabled =
      false;


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


    button.disabled =
      false;

    button.innerText =
      "Verify Deal";

  }

};
