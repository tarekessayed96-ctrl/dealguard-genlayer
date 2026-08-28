import { createClient } from "genlayer-js";

const CONTRACT_ADDRESS =
  "0x23C558dBe1E7c3661492b7C326F9a60161Df03eA";

const CHAIN_ID = 61999;

const client = createClient({
  chainId: CHAIN_ID
});

window.verifyDeal = async function () {

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const dealUrl = document.getElementById("dealUrl").value.trim();
  const secondUrl = document.getElementById("secondUrl").value.trim();

  if (!title || !description || !dealUrl || !secondUrl) {
    alert("Please complete all fields.");
    return;
  }

  const button = document.querySelector("button");

  button.disabled = true;
  button.innerText = "Verifying with GenLayer...";

  try {

    const result = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "analyze_deal",
      args: [
        title,
        description,
        dealUrl,
        secondUrl
      ]
    });

    console.log("Transaction:", result);

    button.innerText = "Verification submitted";

  } catch (error) {

    console.error(error);

    alert(
      "Verification failed. Check the browser console for details."
    );

    button.disabled = false;
    button.innerText = "Verify Deal";
  }
};
