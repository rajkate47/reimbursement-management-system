const path = require("node:path");
const express = require("express");

const { AppError, ReimbursementStore } = require("./lib/store");

const app = express();
const rootDir = __dirname;
const store = new ReimbursementStore(path.join(rootDir, "data", "reimbursement.sqlite"));
const port = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

function sendFrontendFile(res, fileName, contentType) {
  res.type(contentType);
  res.sendFile(path.join(rootDir, fileName));
}

function extractToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return "";
  }
  return token.trim();
}

function requireAuth(req, _res, next) {
  try {
    req.auth = store.getAuthContext(extractToken(req));
    next();
  } catch (error) {
    next(error);
  }
}

function handleRoute(work) {
  return (req, res, next) => {
    try {
      const result = work(req, res);
      if (result !== undefined) {
        res.json({ ok: true, ...result });
      }
    } catch (error) {
      next(error);
    }
  };
}

app.get("/api/health", handleRoute(() => ({ status: "ok" })));
app.get(
  "/api/bootstrap",
  handleRoute((req) => store.getBootstrap(extractToken(req))),
);
app.post(
  "/api/auth/signup",
  handleRoute((req) =>
    store.signupCompany({
      adminName: req.body.adminName,
      adminEmail: req.body.adminEmail,
      password: req.body.password,
      companyName: req.body.companyName,
      countryCode: req.body.countryCode,
    }),
  ),
);
app.post(
  "/api/auth/login",
  handleRoute((req) =>
    store.login({
      email: req.body.email,
      password: req.body.password,
    }),
  ),
);
app.post(
  "/api/auth/logout",
  handleRoute((req) => store.logout(extractToken(req))),
);
app.post("/api/demo/load", handleRoute(() => store.loadDemoWorkspace()));
app.post("/api/demo/reset", handleRoute(() => store.resetWorkspace()));
app.post(
  "/api/ocr/parse",
  handleRoute((req) => ({
    parsed: store.parseReceipt(req.body.text || ""),
  })),
);

app.post(
  "/api/company/settings",
  requireAuth,
  handleRoute((req) => store.updateCompanySettings(req.auth.user, req.body)),
);
app.post(
  "/api/users",
  requireAuth,
  handleRoute((req) => store.createUser(req.auth.user, req.body)),
);
app.patch(
  "/api/users/:userId",
  requireAuth,
  handleRoute((req) => store.updateUser(req.auth.user, req.params.userId, req.body)),
);
app.post(
  "/api/expenses",
  requireAuth,
  handleRoute((req) => store.createExpense(req.auth.user, req.body)),
);
app.post(
  "/api/expenses/:expenseId/decision",
  requireAuth,
  handleRoute((req) =>
    store.decideExpense(req.auth.user, req.params.expenseId, {
      decision: req.body.decision,
      comment: req.body.comment,
    }),
  ),
);
app.post(
  "/api/expenses/:expenseId/override",
  requireAuth,
  handleRoute((req) =>
    store.overrideExpense(req.auth.user, req.params.expenseId, {
      status: req.body.status,
      note: req.body.note,
    }),
  ),
);

app.get("/", (_req, res) => sendFrontendFile(res, "index.html", "html"));
app.get("/styles.css", (_req, res) => sendFrontendFile(res, "styles.css", "css"));
app.get("/script.js", (_req, res) => sendFrontendFile(res, "script.js", "application/javascript"));
app.get("/favicon.ico", (_req, res) => res.status(204).end());

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next(new AppError(404, "API route not found."));
    return;
  }

  sendFrontendFile(res, "index.html", "html");
});

app.use((error, _req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message =
    error instanceof AppError
      ? error.message
      : "The server hit an unexpected error.";

  if (!(error instanceof AppError)) {
    console.error(error);
  }

  res.status(statusCode).json({
    ok: false,
    message,
  });
});

app.listen(port, () => {
  console.log(`Reimbursement platform running at http://localhost:${port}`);
});
