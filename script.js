const TOKEN_KEY = "rm_api_token_v1";

const COUNTRY_OPTIONS = [
  { code: "IN", name: "India", currency: "INR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" },
];

const CATEGORY_OPTIONS = [
  "Travel",
  "Meals",
  "Accommodation",
  "Office Supplies",
  "Software",
  "Transport",
  "Client Entertainment",
  "Training",
  "Other",
];

const USD_BASE_RATES = {
  USD: 1,
  INR: 83.2,
  GBP: 0.79,
  AED: 3.67,
  EUR: 0.92,
  SGD: 1.35,
  JPY: 150.4,
  CAD: 1.36,
  AUD: 1.52,
};

const refs = {
  authShell: document.getElementById("authShell"),
  dashboardShell: document.getElementById("dashboardShell"),
  signinForm: document.getElementById("signinForm"),
  signupForm: document.getElementById("signupForm"),
  countrySelect: document.getElementById("countrySelect"),
  currencyDisplay: document.getElementById("currencyDisplay"),
  loadDemoBtn: document.getElementById("loadDemoBtn"),
  resetWorkspaceBtn: document.getElementById("resetWorkspaceBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  showSignupBtn: document.getElementById("showSignupBtn"),
  showSigninBtn: document.getElementById("showSigninBtn"),
  noticeBar: document.getElementById("noticeBar"),
  dashboardTitle: document.getElementById("dashboardTitle"),
  dashboardSubtitle: document.getElementById("dashboardSubtitle"),
  companyBadge: document.getElementById("companyBadge"),
  roleBadge: document.getElementById("roleBadge"),
  metricsGrid: document.getElementById("metricsGrid"),
  workspaceGrid: document.getElementById("workspaceGrid"),
};

let authToken = localStorage.getItem(TOKEN_KEY) || "";
let state = loadState();
let notice = null;

boot();

async function boot() {
  populateCountrySelects();
  bindStaticEvents();
  await refreshState();
}

function loadState() {
  return freshState();
}

function freshState() {
  return {
    companies: [],
    users: [],
    expenses: [],
    session: { userId: null },
  };
}

function saveState() {
  return null;
}

function persistToken(token) {
  authToken = token || "";
  if (authToken) {
    localStorage.setItem(TOKEN_KEY, authToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function apiRequest(url, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: {},
  };

  if (options.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(options.body);
  }

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({
    ok: false,
    message: "The server returned an unreadable response.",
  }));

  if (!response.ok || data.ok === false) {
    if (response.status === 401) {
      persistToken("");
    }
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

async function refreshState() {
  try {
    const data = await apiRequest("/api/bootstrap");
    state = data.state || freshState();
    if (authToken && !state.session.userId) {
      persistToken("");
    }
    render();
  } catch (error) {
    persistToken("");
    state = freshState();
    render();
    setNotice(error.message, "error");
  }
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getCurrentUser() {
  return state.users.find((user) => user.id === state.session.userId) || null;
}

function getUser(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function getCompany(companyId) {
  return state.companies.find((company) => company.id === companyId) || null;
}

function getCountry(code) {
  return COUNTRY_OPTIONS.find((country) => country.code === code) || COUNTRY_OPTIONS[0];
}

function getCompanyUsers(companyId) {
  return state.users.filter((user) => user.companyId === companyId);
}

function getCompanyExpenses(companyId) {
  return state.expenses.filter((expense) => expense.companyId === companyId);
}

function getApproverCandidates(companyId) {
  return getCompanyUsers(companyId).filter((user) => user.role !== "employee");
}

function getEmployeeReports(managerId) {
  return state.users.filter((user) => user.managerId === managerId);
}

function getExpense(expenseId) {
  return state.expenses.find((expense) => expense.id === expenseId) || null;
}

function setNotice(message, type = "info") {
  notice = { message, type };
  renderNotice();
}

function renderNotice() {
  if (!notice) {
    refs.noticeBar.className = "notice-bar is-hidden";
    refs.noticeBar.textContent = "";
    return;
  }

  refs.noticeBar.className = `notice-bar ${notice.type}`;
  refs.noticeBar.textContent = notice.message;
}

function populateCountrySelects() {
  refs.countrySelect.innerHTML = COUNTRY_OPTIONS.map(
    (country) =>
      `<option value="${country.code}">${country.name} (${country.currency})</option>`,
  ).join("");

  refs.countrySelect.value = "IN";
  refs.currencyDisplay.value = getCountry(refs.countrySelect.value).currency;
}

function bindStaticEvents() {
  refs.countrySelect.addEventListener("change", () => {
    refs.currencyDisplay.value = getCountry(refs.countrySelect.value).currency;
  });

  refs.showSignupBtn.addEventListener("click", () => {
    document.getElementById("signupName").focus();
  });

  refs.showSigninBtn.addEventListener("click", () => {
    document.getElementById("signinEmail").focus();
  });

  refs.signinForm.addEventListener("submit", handleSignIn);
  refs.signupForm.addEventListener("submit", handleSignUp);
  refs.logoutBtn.addEventListener("click", handleLogout);
  refs.loadDemoBtn.addEventListener("click", loadDemoWorkspace);
  refs.resetWorkspaceBtn.addEventListener("click", resetWorkspace);
}

async function handleSignIn(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  try {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    persistToken(data.token || "");
    state = data.state || freshState();
    event.currentTarget.reset();
    setNotice(data.message || "Signed in successfully.", "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function handleSignUp(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const countryCode = String(formData.get("countryCode") || "IN");

  try {
    const data = await apiRequest("/api/auth/signup", {
      method: "POST",
      body: {
        adminName: name,
        adminEmail: email,
        password,
        companyName,
        countryCode,
      },
    });
    persistToken(data.token || "");
    state = data.state || freshState();
    event.currentTarget.reset();
    refs.countrySelect.value = "IN";
    refs.currencyDisplay.value = getCountry("IN").currency;
    setNotice(data.message || "Company created successfully.", "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function handleLogout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch (_error) {
    // Ignore logout failures and clear local session anyway.
  }

  persistToken("");
  state = freshState();
  setNotice("Logged out.", "info");
  render();
}

async function resetWorkspace() {
  const shouldReset = window.confirm(
    "This will remove all companies, users, expenses, and demo data from this browser. Continue?",
  );

  if (!shouldReset) {
    return;
  }

  try {
    const data = await apiRequest("/api/demo/reset", { method: "POST" });
    persistToken("");
    state = data.state || freshState();
    setNotice(data.message || "Workspace reset successfully.", "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function loadDemoWorkspace() {
  const shouldLoad = window.confirm(
    "Load a demo company with admin, manager, finance, CFO, director, and employee accounts?",
  );

  if (!shouldLoad) {
    return;
  }

  try {
    const data = await apiRequest("/api/demo/load", { method: "POST" });
    persistToken(data.token || "");
    state = data.state || freshState();
    setNotice(data.message || "Demo workspace loaded.", "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function createDemoState() {
  const companyId = uid("company");
  const adminId = uid("user");
  const managerId = uid("user");
  const financeId = uid("user");
  const cfoId = uid("user");
  const directorId = uid("user");
  const employeeId = uid("user");

  const company = {
    id: companyId,
    name: "Northwind Labs",
    countryCode: "IN",
    currency: "INR",
    settings: {
      managerFirst: true,
      approverSequence: [financeId, cfoId, directorId],
      ruleMode: "hybrid",
      threshold: 60,
      specialApproverId: cfoId,
    },
    createdAt: nowIso(),
  };

  const users = [
    {
      id: adminId,
      companyId,
      name: "Aisha Rao",
      email: "admin@northwind.test",
      password: "pass123",
      role: "admin",
      title: "Admin",
      managerId: "",
      createdAt: nowIso(),
    },
    {
      id: managerId,
      companyId,
      name: "Rohan Sen",
      email: "manager@northwind.test",
      password: "pass123",
      role: "manager",
      title: "Team Lead",
      managerId: "",
      createdAt: nowIso(),
    },
    {
      id: financeId,
      companyId,
      name: "Neha Shah",
      email: "finance@northwind.test",
      password: "pass123",
      role: "manager",
      title: "Finance",
      managerId: "",
      createdAt: nowIso(),
    },
    {
      id: cfoId,
      companyId,
      name: "Kabir Joshi",
      email: "cfo@northwind.test",
      password: "pass123",
      role: "manager",
      title: "CFO",
      managerId: "",
      createdAt: nowIso(),
    },
    {
      id: directorId,
      companyId,
      name: "Meera Kapoor",
      email: "director@northwind.test",
      password: "pass123",
      role: "manager",
      title: "Director",
      managerId: "",
      createdAt: nowIso(),
    },
    {
      id: employeeId,
      companyId,
      name: "Arjun Patel",
      email: "employee@northwind.test",
      password: "pass123",
      role: "employee",
      title: "Sales Associate",
      managerId: managerId,
      createdAt: nowIso(),
    },
  ];

  state = {
    companies: [company],
    users,
    expenses: [],
    session: { userId: adminId },
  };

  const employee = users[5];
  createExpenseRecord({
    company,
    employee,
    amount: 214,
    currency: "USD",
    category: "Meals",
    description: "Client dinner in Dubai",
    expenseDate: "2026-03-28",
    receiptText: "Harbor Grill\nDate: 28/03/2026\nTotal: 214.00 USD",
  });

  const financeExpense = createExpenseRecord({
    company,
    employee,
    amount: 1800,
    currency: "INR",
    category: "Travel",
    description: "Airport cab reimbursement",
    expenseDate: "2026-03-26",
    receiptText: "Airport Cab\nDate: 26/03/2026\nTotal: 1800 INR",
  });
  applyApprovalDecision(financeExpense.id, managerId, "approved", "Looks correct.");

  const approvedExpense = createExpenseRecord({
    company,
    employee,
    amount: 92,
    currency: "USD",
    category: "Software",
    description: "Team analytics plugin",
    expenseDate: "2026-03-22",
    receiptText: "Insight AI\nDate: 22/03/2026\nTotal: 92 USD",
  });
  applyApprovalDecision(approvedExpense.id, managerId, "approved", "Approved at team level.");
  applyApprovalDecision(approvedExpense.id, financeId, "approved", "Budget available.");
  applyApprovalDecision(approvedExpense.id, cfoId, "approved", "CFO shortcut applied.");

  const rejectedExpense = createExpenseRecord({
    company,
    employee,
    amount: 3200,
    currency: "INR",
    category: "Office Supplies",
    description: "Printer cartridges",
    expenseDate: "2026-03-19",
    receiptText: "Office Mart\nDate: 19/03/2026\nTotal: 3200 INR",
  });
  applyApprovalDecision(rejectedExpense.id, managerId, "approved", "Necessary purchase.");
  applyApprovalDecision(rejectedExpense.id, financeId, "rejected", "Invoice copy is missing.");

  return state;
}

function render() {
  const currentUser = getCurrentUser();

  refs.authShell.classList.toggle("is-hidden", Boolean(currentUser));
  refs.dashboardShell.classList.toggle("is-hidden", !currentUser);
  refs.logoutBtn.classList.toggle("is-hidden", !currentUser);
  renderNotice();

  if (!currentUser) {
    refs.metricsGrid.innerHTML = "";
    refs.workspaceGrid.innerHTML = "";
    refs.dashboardTitle.textContent = "Dashboard";
    refs.dashboardSubtitle.textContent = "";
    refs.companyBadge.textContent = "";
    refs.roleBadge.textContent = "";
    return;
  }

  const company = getCompany(currentUser.companyId);
  refs.dashboardTitle.textContent = `Welcome, ${currentUser.name}`;
  refs.dashboardSubtitle.textContent = `You are signed in as ${currentUser.role}. Use the workspace below to manage your reimbursement flow.`;
  refs.companyBadge.textContent = `${company.name} - ${company.currency}`;
  refs.roleBadge.textContent = currentUser.role.toUpperCase();
  refs.metricsGrid.innerHTML = renderMetrics(currentUser, company);
  refs.workspaceGrid.innerHTML = renderWorkspace(currentUser, company);
  bindWorkspaceEvents(currentUser, company);
}

function renderMetrics(currentUser, company) {
  const users = getCompanyUsers(company.id);
  const expenses = getCompanyExpenses(company.id);
  const pendingForUser = expenses.filter(
    (expense) => expense.status === "pending" && expense.currentApproverId === currentUser.id,
  ).length;

  const approved = expenses.filter((expense) => expense.status === "approved").length;
  const rejected = expenses.filter((expense) => expense.status === "rejected").length;
  const employees = users.filter((user) => user.role === "employee").length;
  const managers = users.filter((user) => user.role === "manager").length;

  const cards = [
    {
      label: "Users",
      value: users.length,
      note: `${employees} employees - ${managers} managers`,
    },
    {
      label: "Pending Claims",
      value: expenses.filter((expense) => expense.status === "pending").length,
      note: `${pendingForUser} currently assigned to you`,
    },
    {
      label: "Approved",
      value: approved,
      note: `Rejected: ${rejected}`,
    },
    {
      label: "Currency",
      value: company.currency,
      note: getCountry(company.countryCode).name,
    },
  ];

  return cards
    .map(
      (card) => `
        <article class="metric-card">
          <p class="eyebrow">${card.label}</p>
          <strong>${escapeHtml(String(card.value))}</strong>
          <div class="metric-note">${escapeHtml(card.note)}</div>
        </article>
      `,
    )
    .join("");
}

function renderWorkspace(currentUser, company) {
  const sharedPanel = renderSharedPanel(company);

  if (currentUser.role === "admin") {
    return sharedPanel + renderAdminWorkspace(currentUser, company);
  }

  if (currentUser.role === "manager") {
    return sharedPanel + renderManagerWorkspace(currentUser, company);
  }

  return sharedPanel + renderEmployeeWorkspace(currentUser, company);
}

function renderSharedPanel(company) {
  const settings = company.settings;
  const specialApprover = settings.specialApproverId ? getUser(settings.specialApproverId) : null;

  return `
    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Approval engine</p>
          <h3>Current company rules</h3>
          <p class="section-lead">
            Sequential approval is stored per company and applied to each new expense.
          </p>
        </div>
        <span class="tag">${escapeHtml(settings.ruleMode)}</span>
      </div>

      <div class="support-grid">
        <article class="support-card">
          <strong>Manager first</strong>
          <span class="subtle-copy">${settings.managerFirst ? "Enabled" : "Disabled"}</span>
        </article>
        <article class="support-card">
          <strong>Threshold</strong>
          <span class="subtle-copy">${escapeHtml(String(settings.threshold))}% approval</span>
        </article>
        <article class="support-card">
          <strong>Special approver</strong>
          <span class="subtle-copy">${specialApprover ? escapeHtml(specialApprover.name) : "Not set"}</span>
        </article>
      </div>
    </section>
  `;
}

function renderAdminWorkspace(currentUser, company) {
  const users = getCompanyUsers(company.id);
  const approvers = getApproverCandidates(company.id);
  const expenses = getCompanyExpenses(company.id)
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  const sequenceRows = approvers
    .map((approver) => {
      const index = company.settings.approverSequence.indexOf(approver.id);
      const checked = index >= 0;
      return `
        <div class="sequence-row">
          <label>
            <input
              type="checkbox"
              class="sequence-include"
              data-user-id="${approver.id}"
              ${checked ? "checked" : ""}
            />
            <span>${escapeHtml(approver.name)} - ${escapeHtml(approver.title || approver.role)}</span>
          </label>
          <input
            class="inline-input sequence-order"
            data-user-id="${approver.id}"
            type="number"
            min="1"
            value="${checked ? index + 1 : approvers.length + 1}"
          />
        </div>
      `;
    })
    .join("");

  const userRows = users
    .map((user) => renderUserRow(user, users, currentUser.id))
    .join("");

  const expenseRows = expenses.length
    ? expenses.map((expense) => renderAdminExpenseCard(expense, company)).join("")
    : `<div class="empty-state">No expenses have been submitted yet.</div>`;

  return `
    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Company setup</p>
          <h3>Configure approval rules</h3>
          <p class="section-lead">Admin can change company country, currency defaults, approver order, and hybrid rules.</p>
        </div>
      </div>

      <form id="settingsForm" class="form-grid">
        <div class="row-grid-3">
          <label class="field">
            <span>Company name</span>
            <input name="companyName" type="text" value="${escapeHtml(company.name)}" required />
          </label>

          <label class="field">
            <span>Country</span>
            <select name="countryCode" id="settingsCountrySelect">
              ${COUNTRY_OPTIONS.map(
                (country) => `
                  <option value="${country.code}" ${country.code === company.countryCode ? "selected" : ""}>
                    ${country.name} (${country.currency})
                  </option>
                `,
              ).join("")}
            </select>
          </label>

          <label class="field">
            <span>Default currency</span>
            <input name="currency" id="settingsCurrencyDisplay" type="text" value="${escapeHtml(company.currency)}" readonly />
          </label>
        </div>

        <div class="row-grid-3">
          <label class="field">
            <span>Rule mode</span>
            <select name="ruleMode">
              ${["none", "percentage", "specific", "hybrid"]
                .map(
                  (mode) => `
                    <option value="${mode}" ${mode === company.settings.ruleMode ? "selected" : ""}>
                      ${mode}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>

          <label class="field">
            <span>Threshold percentage</span>
            <input name="threshold" type="number" min="1" max="100" value="${escapeHtml(String(company.settings.threshold))}" />
          </label>

          <label class="field">
            <span>Special approver</span>
            <select name="specialApproverId">
              <option value="">None</option>
              ${approvers
                .map(
                  (approver) => `
                    <option value="${approver.id}" ${approver.id === company.settings.specialApproverId ? "selected" : ""}>
                      ${escapeHtml(approver.name)} - ${escapeHtml(approver.title || approver.role)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>

        <label class="checkbox-field">
          <input name="managerFirst" type="checkbox" ${company.settings.managerFirst ? "checked" : ""} />
          <span>Require direct manager approval before the custom sequence</span>
        </label>

        <div class="helper-block">
          <strong>Ordered approver sequence</strong>
          <span>Check the approvers you want after the direct manager, then assign their order numbers.</span>
        </div>
        <div class="sequence-grid">${sequenceRows || `<div class="empty-state">Create managers first to build an approval sequence.</div>`}</div>

        <div class="inline-actions">
          <button class="primary-button" type="submit">Save approval settings</button>
        </div>
      </form>
    </section>

    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">People</p>
          <h3>Create users</h3>
          <p class="section-lead">Admins can create employees and managers, then define reporting relationships.</p>
        </div>
      </div>

      <form id="createUserForm" class="form-grid">
        <div class="row-grid-3">
          <label class="field">
            <span>Name</span>
            <input name="name" type="text" placeholder="Priya Sharma" required />
          </label>
          <label class="field">
            <span>Email</span>
            <input name="email" type="email" placeholder="priya@company.com" required />
          </label>
          <label class="field">
            <span>Password</span>
            <input name="password" type="text" placeholder="Create password" required />
          </label>
        </div>

        <div class="row-grid-3">
          <label class="field">
            <span>Role</span>
            <select name="role">
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <label class="field">
            <span>Title</span>
            <input name="title" type="text" placeholder="Finance / Director / Team Lead" required />
          </label>
          <label class="field">
            <span>Manager relationship</span>
            <select name="managerId">
              <option value="">No manager</option>
              ${users
                .filter((user) => user.role !== "employee")
                .map(
                  (user) => `
                    <option value="${user.id}">
                      ${escapeHtml(user.name)} - ${escapeHtml(user.title || user.role)}
                    </option>
                  `,
                )
                .join("")}
            </select>
          </label>
        </div>

        <div class="inline-actions">
          <button class="primary-button" type="submit">Create user</button>
        </div>
      </form>
    </section>

    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Directory</p>
          <h3>Update users and manager mappings</h3>
        </div>
      </div>
      <div class="user-list">${userRows}</div>
    </section>

    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Admin review</p>
          <h3>All expenses and override controls</h3>
        </div>
      </div>
      <div class="expense-list">${expenseRows}</div>
    </section>
  `;
}

function renderManagerWorkspace(currentUser, company) {
  const pending = getCompanyExpenses(company.id).filter(
    (expense) => expense.status === "pending" && expense.currentApproverId === currentUser.id,
  );
  const directReports = getEmployeeReports(currentUser.id).map((user) => user.id);
  const teamExpenses = getCompanyExpenses(company.id).filter((expense) =>
    directReports.includes(expense.employeeId),
  );

  return `
    ${renderDemoAccessPanel()}
    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Approval queue</p>
          <h3>Claims waiting for your decision</h3>
          <p class="section-lead">Approve or reject with comments. The expense moves to the next approver after your action unless a rule resolves it earlier.</p>
        </div>
      </div>
      <div class="approval-list">
        ${
          pending.length
            ? pending.map((expense) => renderApprovalCard(expense, company, currentUser)).join("")
            : `<div class="empty-state">Nothing is waiting for your approval right now.</div>`
        }
      </div>
    </section>

    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Team visibility</p>
          <h3>Direct-report expenses</h3>
        </div>
      </div>
      <div class="history-list">
        ${
          teamExpenses.length
            ? teamExpenses
                .map((expense) => renderHistoryCard(expense, company, { includeEmployee: true }))
                .join("")
            : `<div class="empty-state">No expenses found for your direct reports.</div>`
        }
      </div>
    </section>
  `;
}

function renderEmployeeWorkspace(currentUser, company) {
  const myExpenses = getCompanyExpenses(company.id)
    .filter((expense) => expense.employeeId === currentUser.id)
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  return `
    ${renderDemoAccessPanel()}
    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Submit expense</p>
          <h3>Create a reimbursement claim</h3>
          <p class="section-lead">You can submit in any supported currency. Managers will also see the amount in the company default currency.</p>
        </div>
      </div>

      <form id="expenseForm" class="form-grid">
        <div class="row-grid-3">
          <label class="field">
            <span>Amount</span>
            <input name="amount" type="number" step="0.01" min="0" placeholder="214.00" required />
          </label>
          <label class="field">
            <span>Currency</span>
            <select name="currency">
              ${getCurrencyOptions(company.currency)}
            </select>
          </label>
          <label class="field">
            <span>Date</span>
            <input name="expenseDate" type="date" required />
          </label>
        </div>

        <div class="row-grid-2">
          <label class="field">
            <span>Category</span>
            <select name="category">
              ${CATEGORY_OPTIONS.map((category) => `<option value="${category}">${category}</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Description</span>
            <input name="description" type="text" placeholder="Client dinner in Dubai" required />
          </label>
        </div>

        <label class="field">
          <span>Receipt text for mock OCR</span>
          <textarea name="receiptText" id="receiptText" placeholder="Paste a scanned receipt text here. Example:&#10;Harbor Grill&#10;Date: 28/03/2026&#10;Total: 214.00 USD"></textarea>
          <small>The OCR helper reads merchant, date, amount, and guessed category from pasted receipt text.</small>
        </label>

        <div class="inline-actions">
          <button class="ghost-button" id="parseReceiptBtn" type="button">Parse receipt text</button>
          <button class="primary-button" type="submit">Submit expense</button>
        </div>

        <div class="helper-block" id="ocrPreview">
          <strong>OCR preview</strong>
          <span>No receipt parsed yet.</span>
        </div>
      </form>
    </section>

    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">History</p>
          <h3>Your submitted claims</h3>
        </div>
      </div>
      <div class="history-list">
        ${
          myExpenses.length
            ? myExpenses.map((expense) => renderHistoryCard(expense, company)).join("")
            : `<div class="empty-state">You have not submitted any expenses yet.</div>`
        }
      </div>
    </section>
  `;
}

function renderDemoAccessPanel() {
  const demoUsers = [
    ["admin@northwind.test", "pass123"],
    ["manager@northwind.test", "pass123"],
    ["finance@northwind.test", "pass123"],
    ["cfo@northwind.test", "pass123"],
    ["director@northwind.test", "pass123"],
    ["employee@northwind.test", "pass123"],
  ];

  return `
    <section class="card panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Demo access</p>
          <h3>Sample credentials</h3>
          <p class="section-lead">Use these after loading the demo workspace to test each role quickly.</p>
        </div>
      </div>
      <div class="credentials-list">
        ${demoUsers
          .map(
            ([email, password]) => `
              <div class="credential-row">
                <div class="row-between">
                  <span class="code-pill">${email}</span>
                  <span class="code-pill">${password}</span>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderUserRow(user, users, currentAdminId) {
  const managerOptions = users
    .filter((candidate) => candidate.id !== user.id && candidate.role !== "employee")
    .map(
      (candidate) => `
        <option value="${candidate.id}" ${candidate.id === user.managerId ? "selected" : ""}>
          ${escapeHtml(candidate.name)} - ${escapeHtml(candidate.title || candidate.role)}
        </option>
      `,
    )
    .join("");

  return `
    <div class="user-row" data-user-id="${user.id}">
      <div class="user-row-top">
        <div class="meta-column">
          <strong>${escapeHtml(user.name)}</strong>
          <span>${escapeHtml(user.email)}</span>
          <span>${escapeHtml(user.title || user.role)}</span>
        </div>
        <span class="status-pill">${escapeHtml(user.role)}</span>
      </div>

      <div class="row-grid-3">
        <label class="field">
          <span>Role</span>
          <select class="inline-select" data-user-prop="role">
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
            <option value="manager" ${user.role === "manager" ? "selected" : ""}>manager</option>
            <option value="employee" ${user.role === "employee" ? "selected" : ""}>employee</option>
          </select>
        </label>
        <label class="field">
          <span>Title</span>
          <input class="inline-input" data-user-prop="title" type="text" value="${escapeHtml(user.title || "")}" />
        </label>
        <label class="field">
          <span>Manager</span>
          <select class="inline-select" data-user-prop="managerId">
            <option value="">No manager</option>
            ${managerOptions}
          </select>
        </label>
      </div>

      <div class="inline-actions">
        <button class="tiny-button" data-action="save-user" data-id="${user.id}" type="button">Save user</button>
        ${
          user.id === currentAdminId
            ? `<span class="light-copy">You are signed in as this admin user.</span>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderAdminExpenseCard(expense, company) {
  const employee = getUser(expense.employeeId);
  const currentApprover = expense.currentApproverId ? getUser(expense.currentApproverId) : null;

  return `
    <div class="expense-row" data-expense-id="${expense.id}">
      <div class="expense-row-top">
        <div class="meta-column">
          <strong>${escapeHtml(expense.description)}</strong>
          <span>${escapeHtml(employee ? employee.name : "Unknown employee")} - ${escapeHtml(expense.category)}</span>
          <span>${escapeHtml(formatCurrency(expense.amount, expense.currency))} - company view ${escapeHtml(formatCurrency(expense.companyAmount, company.currency))}</span>
        </div>
        <span class="status-pill ${statusClass(expense.status)}">${escapeHtml(expense.status)}</span>
      </div>

      <div class="row-between">
        <span class="light-copy">Current approver: ${escapeHtml(currentApprover ? currentApprover.name : "Completed")}</span>
        <span class="light-copy">Submitted: ${escapeHtml(formatDate(expense.expenseDate))}</span>
      </div>

      <div class="row-grid-2">
        <label class="field">
          <span>Override status</span>
          <select class="inline-select" data-override-status>
            <option value="">Choose override</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
        <label class="field">
          <span>Override note</span>
          <input class="inline-input" data-override-note type="text" placeholder="Reason for override" />
        </label>
      </div>

      <div class="inline-actions">
        <button class="tiny-button" data-action="override-expense" data-id="${expense.id}" type="button">Apply override</button>
      </div>

      ${renderAudit(expense.activity)}
    </div>
  `;
}

function renderApprovalCard(expense, company, currentUser) {
  const employee = getUser(expense.employeeId);
  const approvalStats = getApprovalProgress(expense);

  return `
    <div class="approval-row" data-expense-id="${expense.id}">
      <div class="approval-row-top">
        <div class="meta-column">
          <strong>${escapeHtml(expense.description)}</strong>
          <span>${escapeHtml(employee ? employee.name : "Unknown employee")} - ${escapeHtml(expense.category)}</span>
          <span>${escapeHtml(formatCurrency(expense.amount, expense.currency))} - ${escapeHtml(formatCurrency(expense.companyAmount, company.currency))} in company currency</span>
        </div>
        <span class="status-pill status-pending">waiting on ${escapeHtml(currentUser.name)}</span>
      </div>

      <div class="row-between">
        <span class="light-copy">${approvalStats}</span>
        <span class="light-copy">${escapeHtml(formatDate(expense.expenseDate))}</span>
      </div>

      <label class="field">
        <span>Comment</span>
        <textarea class="inline-textarea" data-comment rows="3" placeholder="Add your approval or rejection note"></textarea>
      </label>

      <div class="inline-actions">
        <button class="action-button" data-action="decide-expense" data-decision="approved" data-id="${expense.id}" type="button">
          Approve
        </button>
        <button class="danger-ghost" data-action="decide-expense" data-decision="rejected" data-id="${expense.id}" type="button">
          Reject
        </button>
      </div>

      ${renderAudit(expense.activity)}
    </div>
  `;
}

function renderHistoryCard(expense, company, options = {}) {
  const employee = getUser(expense.employeeId);
  const currentApprover = expense.currentApproverId ? getUser(expense.currentApproverId) : null;

  return `
    <div class="history-row">
      <div class="history-row-top">
        <div class="meta-column">
          <strong>${escapeHtml(expense.description)}</strong>
          <span>${escapeHtml(expense.category)} - ${escapeHtml(formatDate(expense.expenseDate))}</span>
          ${
            options.includeEmployee
              ? `<span>${escapeHtml(employee ? employee.name : "Unknown employee")}</span>`
              : ""
          }
        </div>
        <span class="status-pill ${statusClass(expense.status)}">${escapeHtml(expense.status)}</span>
      </div>

      <div class="row-between">
        <span class="light-copy">${escapeHtml(formatCurrency(expense.amount, expense.currency))} - company ${escapeHtml(formatCurrency(expense.companyAmount, company.currency))}</span>
        <span class="light-copy">Current approver: ${escapeHtml(currentApprover ? currentApprover.name : "Completed")}</span>
      </div>

      ${renderAudit(expense.activity)}
    </div>
  `;
}

function renderAudit(activity = []) {
  if (!activity.length) {
    return `<div class="audit-list"><div class="empty-state">No audit events recorded yet.</div></div>`;
  }

  return `
    <div class="audit-list">
      ${activity
        .slice()
        .reverse()
        .map(
          (item) => `
            <div class="audit-row">
              <div class="meta-column">
                <strong>${escapeHtml(item.message)}</strong>
                <span>${escapeHtml(formatDateTime(item.at))}</span>
              </div>
              <span class="light-copy">${escapeHtml(item.by || "System")}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function bindWorkspaceEvents(currentUser, company) {
  const settingsForm = document.getElementById("settingsForm");
  const createUserForm = document.getElementById("createUserForm");
  const expenseForm = document.getElementById("expenseForm");
  const parseReceiptBtn = document.getElementById("parseReceiptBtn");
  const settingsCountrySelect = document.getElementById("settingsCountrySelect");
  const settingsCurrencyDisplay = document.getElementById("settingsCurrencyDisplay");

  if (settingsCountrySelect && settingsCurrencyDisplay) {
    settingsCountrySelect.addEventListener("change", () => {
      settingsCurrencyDisplay.value = getCountry(settingsCountrySelect.value).currency;
    });
  }

  if (settingsForm) {
    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      saveCompanySettings(company.id, event.currentTarget);
    });
  }

  if (createUserForm) {
    createUserForm.addEventListener("submit", (event) => {
      event.preventDefault();
      createUser(company.id, event.currentTarget);
    });
  }

  if (expenseForm) {
    expenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitExpense(company, currentUser, event.currentTarget);
    });
  }

  if (parseReceiptBtn) {
    parseReceiptBtn.addEventListener("click", () => {
      parseReceiptIntoForm();
    });
  }

  refs.workspaceGrid.querySelectorAll("[data-action='save-user']").forEach((button) => {
    button.addEventListener("click", () => {
      saveUserUpdates(button.dataset.id);
    });
  });

  refs.workspaceGrid.querySelectorAll("[data-action='override-expense']").forEach((button) => {
    button.addEventListener("click", () => {
      applyOverride(button.dataset.id, currentUser);
    });
  });

  refs.workspaceGrid.querySelectorAll("[data-action='decide-expense']").forEach((button) => {
    button.addEventListener("click", () => {
      decideExpense(button.dataset.id, currentUser.id, button.dataset.decision);
    });
  });
}

async function saveCompanySettings(companyId, form) {
  const company = getCompany(companyId);
  if (!company) {
    setNotice("Company not found.", "error");
    return;
  }

  const formData = new FormData(form);
  const approverRows = Array.from(form.querySelectorAll(".sequence-row"))
    .map((row) => {
      const userId = row.querySelector(".sequence-include").dataset.userId;
      const include = row.querySelector(".sequence-include").checked;
      const order = Number(row.querySelector(".sequence-order").value || 0);
      return { userId, include, order };
    })
    .filter((row) => row.include)
    .sort((left, right) => left.order - right.order);

  try {
    const data = await apiRequest("/api/company/settings", {
      method: "POST",
      body: {
        companyName: String(formData.get("companyName") || company.name).trim(),
        countryCode: String(formData.get("countryCode") || company.countryCode),
        managerFirst: Boolean(formData.get("managerFirst")),
        ruleMode: String(formData.get("ruleMode") || "hybrid"),
        threshold: clamp(Number(formData.get("threshold") || 60), 1, 100),
        specialApproverId: String(formData.get("specialApproverId") || ""),
        approverSequence: approverRows.map((row) => row.userId),
      },
    });
    state = data.state || freshState();
    setNotice(data.message || "Approval settings updated.", "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function createUser(companyId, form) {
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "employee");
  const title = String(formData.get("title") || "").trim();
  const managerId = String(formData.get("managerId") || "");

  try {
    const data = await apiRequest("/api/users", {
      method: "POST",
      body: {
        companyId,
        name,
        email,
        password,
        role,
        title,
        managerId,
      },
    });
    state = data.state || freshState();
    form.reset();
    setNotice(data.message || `User created. Credentials: ${email} / ${password}`, "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function saveUserUpdates(userId) {
  const container = refs.workspaceGrid.querySelector(`[data-user-id="${userId}"]`);
  if (!container) {
    setNotice("Unable to update that user.", "error");
    return;
  }

  try {
    const data = await apiRequest(`/api/users/${userId}`, {
      method: "PATCH",
      body: {
        role: container.querySelector('[data-user-prop="role"]').value,
        title: container.querySelector('[data-user-prop="title"]').value.trim(),
        managerId: container.querySelector('[data-user-prop="managerId"]').value,
      },
    });
    state = data.state || freshState();
    setNotice(data.message || "User updated successfully.", "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function submitExpense(company, employee, form) {
  const formData = new FormData(form);
  const amount = Number(formData.get("amount") || 0);
  const currency = String(formData.get("currency") || company.currency);
  const category = String(formData.get("category") || "Other");
  const description = String(formData.get("description") || "").trim();
  const expenseDate = String(formData.get("expenseDate") || "");
  const receiptText = String(formData.get("receiptText") || "").trim();

  try {
    const data = await apiRequest("/api/expenses", {
      method: "POST",
      body: {
        companyId: company.id,
        employeeId: employee.id,
        amount,
        currency,
        category,
        description,
        expenseDate,
        receiptText,
      },
    });
    state = data.state || freshState();
    form.reset();
    const preview = document.getElementById("ocrPreview");
    if (preview) {
      preview.innerHTML = `<strong>OCR preview</strong><span>No receipt parsed yet.</span>`;
    }
    setNotice(data.message || "Expense submitted successfully.", "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function createExpenseRecord({
  company,
  employee,
  amount,
  currency,
  category,
  description,
  expenseDate,
  receiptText,
}) {
  const chain = buildApprovalChain(company, employee);
  const companyAmount = convertAmount(amount, currency, company.currency);
  const parsedReceipt = receiptText ? parseReceiptText(receiptText) : null;

  const expense = {
    id: uid("expense"),
    companyId: company.id,
    employeeId: employee.id,
    amount,
    currency,
    companyAmount,
    category,
    description,
    expenseDate,
    receiptText,
    parsedReceipt,
    status: chain.length ? "pending" : "approved",
    currentApproverId: chain.length ? chain[0] : "",
    approvals: chain.map((approverId, index) => ({
      approverId,
      order: index + 1,
      decision: "pending",
      comment: "",
      actedAt: "",
    })),
    activity: [
      {
        message: `Expense submitted by ${employee.name}`,
        at: nowIso(),
        by: employee.name,
      },
    ],
    createdAt: nowIso(),
  };

  if (!chain.length) {
    expense.activity.push({
      message: "Expense auto-approved because no approvers were configured.",
      at: nowIso(),
      by: "System",
    });
  }

  state.expenses.push(expense);
  return expense;
}

function buildApprovalChain(company, employee) {
  const chain = [];
  const settings = company.settings;

  if (settings.managerFirst && employee.managerId) {
    chain.push(employee.managerId);
  }

  settings.approverSequence.forEach((approverId) => {
    if (!chain.includes(approverId) && approverId !== employee.id) {
      chain.push(approverId);
    }
  });

  return chain;
}

async function parseReceiptIntoForm() {
  const textarea = document.getElementById("receiptText");
  const preview = document.getElementById("ocrPreview");

  if (!textarea || !preview) {
    return;
  }

  const content = textarea.value.trim();
  if (!content) {
    setNotice("Paste receipt text before using OCR parsing.", "error");
    return;
  }

  try {
    const data = await apiRequest("/api/ocr/parse", {
      method: "POST",
      body: { text: content },
    });
    const parsed = data.parsed || {};
    const expenseForm = document.getElementById("expenseForm");

    if (expenseForm && parsed.amount) {
      expenseForm.elements.amount.value = parsed.amount;
    }
    if (expenseForm && parsed.date) {
      expenseForm.elements.expenseDate.value = parsed.date;
    }
    if (expenseForm && parsed.category) {
      expenseForm.elements.category.value = parsed.category;
    }
    if (expenseForm && parsed.description) {
      expenseForm.elements.description.value = parsed.description;
    }
    if (expenseForm && parsed.currency) {
      expenseForm.elements.currency.value = parsed.currency;
    }

    preview.innerHTML = `
      <strong>OCR preview</strong>
      <span>Merchant: ${escapeHtml(parsed.merchant || "Not found")}</span>
      <span>Amount: ${escapeHtml(parsed.amount ? `${parsed.amount} ${parsed.currency || ""}`.trim() : "Not found")}</span>
      <span>Date: ${escapeHtml(parsed.date || "Not found")}</span>
      <span>Category guess: ${escapeHtml(parsed.category || "Other")}</span>
    `;

    setNotice("Receipt parsed into the expense form.", "success");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function parseReceiptText(text) {
  const cleaned = text.replace(/\r/g, "");
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const merchant = lines[0] || "";
  const currencyMatch = cleaned.match(/\b(USD|INR|GBP|AED|EUR|SGD|JPY|CAD|AUD)\b/i);
  const amountMatches = cleaned.match(/(\d+(?:[.,]\d{1,2})?)/g) || [];
  const lastAmount = amountMatches.length
    ? Number(amountMatches[amountMatches.length - 1].replace(",", ""))
    : 0;
  const rawDateMatch = cleaned.match(
    /(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/,
  );

  return {
    merchant,
    amount: lastAmount || "",
    currency: currencyMatch ? currencyMatch[1].toUpperCase() : "",
    date: normalizeDate(rawDateMatch ? rawDateMatch[1] : ""),
    category: guessCategory(cleaned),
    description: merchant ? `${merchant} receipt import` : "Receipt import",
  };
}

function guessCategory(text) {
  const source = text.toLowerCase();

  if (/(restaurant|dinner|lunch|cafe|bistro|meal)/.test(source)) {
    return "Meals";
  }
  if (/(flight|air|uber|ola|cab|taxi|rail|train|travel|airport)/.test(source)) {
    return "Travel";
  }
  if (/(hotel|stay|accommodation|inn)/.test(source)) {
    return "Accommodation";
  }
  if (/(software|subscription|license|saas)/.test(source)) {
    return "Software";
  }
  if (/(office|printer|stationery|supplies)/.test(source)) {
    return "Office Supplies";
  }
  return "Other";
}

async function decideExpense(expenseId, approverId, decision) {
  const container = refs.workspaceGrid.querySelector(`[data-expense-id="${expenseId}"]`);
  const comment = container ? container.querySelector("[data-comment]").value.trim() : "";

  try {
    const data = await apiRequest(`/api/expenses/${expenseId}/decision`, {
      method: "POST",
      body: {
        approverId,
        decision,
        comment,
      },
    });
    state = data.state || freshState();
    setNotice(data.message || `Expense ${decision}.`, "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function applyApprovalDecision(expenseId, approverId, decision, comment) {
  const expense = getExpense(expenseId);
  if (!expense || expense.status !== "pending" || expense.currentApproverId !== approverId) {
    return;
  }

  const company = getCompany(expense.companyId);
  const approver = getUser(approverId);
  const entry = expense.approvals.find(
    (approval) => approval.approverId === approverId && approval.decision === "pending",
  );

  if (!entry) {
    return;
  }

  entry.decision = decision;
  entry.comment = comment;
  entry.actedAt = nowIso();
  expense.activity.push({
    message: `${approver ? approver.name : "Approver"} ${decision}${comment ? `: ${comment}` : ""}`,
    at: nowIso(),
    by: approver ? approver.name : "Approver",
  });

  resolveExpenseFlow(expense, company);
}

function resolveExpenseFlow(expense, company) {
  const settings = company.settings;
  const approvedCount = expense.approvals.filter((approval) => approval.decision === "approved").length;
  const rejectedCount = expense.approvals.filter((approval) => approval.decision === "rejected").length;
  const pending = expense.approvals.filter((approval) => approval.decision === "pending");
  const total = expense.approvals.length || 1;
  const approvedPct = (approvedCount / total) * 100;
  const maxPossiblePct = ((approvedCount + pending.length) / total) * 100;
  const specialApproved =
    settings.specialApproverId &&
    expense.approvals.some(
      (approval) =>
        approval.approverId === settings.specialApproverId && approval.decision === "approved",
    );
  const specialPending =
    settings.specialApproverId &&
    expense.approvals.some(
      (approval) =>
        approval.approverId === settings.specialApproverId && approval.decision === "pending",
    );

  if (settings.ruleMode === "none") {
    if (rejectedCount > 0) {
      expense.status = "rejected";
      expense.currentApproverId = "";
      expense.activity.push({
        message: "Expense rejected because a sequential approver rejected the claim.",
        at: nowIso(),
        by: "System",
      });
      return;
    }

    if (!pending.length) {
      expense.status = "approved";
      expense.currentApproverId = "";
      expense.activity.push({
        message: "Expense approved after all sequential approvers signed off.",
        at: nowIso(),
        by: "System",
      });
      return;
    }
  }

  if (settings.ruleMode === "percentage") {
    if (approvedPct >= settings.threshold) {
      expense.status = "approved";
      expense.currentApproverId = "";
      expense.activity.push({
        message: `Expense auto-approved after reaching ${Math.round(approvedPct)}% approvals.`,
        at: nowIso(),
        by: "System",
      });
      return;
    }

    if (maxPossiblePct < settings.threshold) {
      expense.status = "rejected";
      expense.currentApproverId = "";
      expense.activity.push({
        message: "Expense rejected because the threshold can no longer be met.",
        at: nowIso(),
        by: "System",
      });
      return;
    }
  }

  if (settings.ruleMode === "specific") {
    if (specialApproved) {
      expense.status = "approved";
      expense.currentApproverId = "";
      expense.activity.push({
        message: "Expense auto-approved by the special approver.",
        at: nowIso(),
        by: "System",
      });
      return;
    }

    if (!pending.length) {
      expense.status = rejectedCount > 0 ? "rejected" : "approved";
      expense.currentApproverId = "";
      expense.activity.push({
        message:
          expense.status === "approved"
            ? "Expense approved after all sequential approvers finished."
            : "Expense rejected because the special approver rule was not met and a rejection occurred.",
        at: nowIso(),
        by: "System",
      });
      return;
    }
  }

  if (settings.ruleMode === "hybrid") {
    if (specialApproved || approvedPct >= settings.threshold) {
      expense.status = "approved";
      expense.currentApproverId = "";
      expense.activity.push({
        message: specialApproved
          ? "Expense auto-approved by the special approver."
          : `Expense auto-approved after reaching ${Math.round(approvedPct)}% approvals.`,
        at: nowIso(),
        by: "System",
      });
      return;
    }

    if (maxPossiblePct < settings.threshold && !specialPending) {
      expense.status = "rejected";
      expense.currentApproverId = "";
      expense.activity.push({
        message: "Expense rejected because neither the threshold nor the special approver path can be satisfied.",
        at: nowIso(),
        by: "System",
      });
      return;
    }
  }

  if (!pending.length) {
    expense.status =
      approvedPct >= settings.threshold || specialApproved || rejectedCount === 0
        ? "approved"
        : "rejected";
    expense.currentApproverId = "";
    expense.activity.push({
      message: `Expense ${expense.status} after the final approval step.`,
      at: nowIso(),
      by: "System",
    });
    return;
  }

  expense.status = "pending";
  expense.currentApproverId = pending[0].approverId;
}

async function applyOverride(expenseId, currentUser) {
  const container = refs.workspaceGrid.querySelector(`[data-expense-id="${expenseId}"]`);
  if (!container) {
    setNotice("Unable to override that expense.", "error");
    return;
  }

  const status = container.querySelector("[data-override-status]").value;
  const note = container.querySelector("[data-override-note]").value.trim();

  if (!status) {
    setNotice("Choose an override status first.", "error");
    return;
  }

  try {
    const data = await apiRequest(`/api/expenses/${expenseId}/override`, {
      method: "POST",
      body: {
        status,
        note,
        actorId: currentUser.id,
      },
    });
    state = data.state || freshState();
    setNotice(data.message || `Expense overridden as ${status}.`, "success");
    render();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function convertAmount(amount, fromCurrency, toCurrency) {
  const fromRate = USD_BASE_RATES[fromCurrency] || 1;
  const toRate = USD_BASE_RATES[toCurrency] || 1;
  const usdAmount = amount / fromRate;
  return roundAmount(usdAmount * toRate);
}

function roundAmount(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(rawDate) {
  if (!rawDate) {
    return "N/A";
  }

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(rawDate) {
  if (!rawDate) {
    return "N/A";
  }

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeDate(input) {
  if (!input) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const slashMatch = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    let [, day, month, year] = slashMatch;
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function getCurrencyOptions(selectedCurrency) {
  const uniqueCurrencies = [...new Set(COUNTRY_OPTIONS.map((country) => country.currency))];
  return uniqueCurrencies
    .map(
      (currency) => `
        <option value="${currency}" ${currency === selectedCurrency ? "selected" : ""}>${currency}</option>
      `,
    )
    .join("");
}

function getApprovalProgress(expense) {
  const approved = expense.approvals.filter((approval) => approval.decision === "approved").length;
  const total = expense.approvals.length;
  return `${approved}/${total} approvals complete`;
}

function statusClass(status) {
  if (status === "approved") {
    return "status-approved";
  }
  if (status === "rejected") {
    return "status-rejected";
  }
  return "status-pending";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
