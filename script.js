const roleButtons = document.querySelectorAll("[data-role]");
const rolePanels = document.querySelectorAll("[data-role-panel]");

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.role;

    roleButtons.forEach((item) => {
      item.classList.toggle("is-active", item === button);
      item.setAttribute("aria-selected", String(item === button));
    });

    rolePanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.rolePanel === role);
    });
  });
});

const approvalRange = document.getElementById("approvalRange");
const cfoApproval = document.getElementById("cfoApproval");
const approvalCount = document.getElementById("approvalCount");
const approvalPercent = document.getElementById("approvalPercent");
const ruleResult = document.getElementById("ruleResult");

function updateRuleSimulator() {
  const approvals = Number(approvalRange.value);
  const totalApprovers = 5;
  const percent = Math.round((approvals / totalApprovers) * 100);
  const cfoApproved = cfoApproval.checked;
  const expenseApproved = percent >= 60 || cfoApproved;

  approvalCount.textContent = `${approvals} of ${totalApprovers} approvers`;
  approvalPercent.textContent = `${percent}%`;

  if (expenseApproved) {
    ruleResult.innerHTML =
      `<strong>Expense approved.</strong> ` +
      `The request clears because ${cfoApproved ? "the CFO approved it" : `${percent}% meets the 60% threshold`}.`;
    ruleResult.style.background = "rgba(11, 122, 97, 0.12)";
    ruleResult.style.borderColor = "rgba(11, 122, 97, 0.22)";
  } else {
    ruleResult.innerHTML =
      `<strong>Still pending.</strong> ` +
      `The request needs more approvals or a CFO shortcut to satisfy the hybrid rule.`;
    ruleResult.style.background = "rgba(247, 168, 76, 0.16)";
    ruleResult.style.borderColor = "rgba(247, 168, 76, 0.28)";
  }
}

approvalRange.addEventListener("input", updateRuleSimulator);
cfoApproval.addEventListener("change", updateRuleSimulator);
updateRuleSimulator();
