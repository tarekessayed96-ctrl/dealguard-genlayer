window.verifyDeal = function () {
  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const dealUrl = document.getElementById("dealUrl").value.trim();
  const secondUrl = document.getElementById("secondUrl").value.trim();

  if (!title || !description || !dealUrl || !secondUrl) {
    alert("Please complete all fields.");
    return;
  }

  alert("DealGuard frontend is working.");
};
