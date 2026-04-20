import { apiFetch, getCurrentUser } from "./api.js";
import { StatCard, RiskBadge, showToast } from "./components.js";
import { renderLayout, bindLayoutEvents } from "./layout.js";
import { formatDate, formatPercent } from "./utils.js";
import { renderChatWidget } from "./chat-widget.js";

function tableShell(columns, body, id, loading = false) {
  if (loading) {
    const rows = Array.from({ length: 10 })
      .map(
        () => `<tr class="border-b border-zinc-800/60">${columns
          .map(() => `<td class="px-4 py-3"><div class="shimmer-block h-3 rounded-md"></div></td>`)
          .join("")}</tr>`
      )
      .join("");
    return `<div id="${id}" class="border border-zinc-800 bg-zinc-900 rounded-lg overflow-x-auto"><table class="w-full"><tbody>${rows}</tbody></table></div>`;
  }
  return `<div id="${id}" class="border border-zinc-800 bg-zinc-900 rounded-lg overflow-x-auto"><table class="w-full"><thead><tr class="border-b border-zinc-800/60 text-left text-xs font-mono uppercase tracking-widest text-zinc-500">${columns
    .map((col) => `<th class="px-4 py-3">${col}</th>`)
    .join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function eventDotColor(action = "") {
  if (String(action).includes("FAILED")) return "bg-red-500";
  if (String(action).includes("REVIEW") || String(action).includes("SUSPICION")) return "bg-amber-500";
  return "bg-cyan-500";
}

function renderAuditTimeline(items, empty = "NO EVENTS MATCH FILTERS") {
  const entries = items
    .map(
      (item) => `<div class="grid grid-cols-[120px_1fr] gap-4">
        <p class="text-xs font-mono text-zinc-500 pt-1">${formatDate(item.createdAt)}</p>
        <div class="relative pl-6 pb-6 border-l-2 border-zinc-800">
          <span class="absolute -left-[7px] top-1 h-3 w-3 rounded-full ${eventDotColor(item.action)}"></span>
          <div class="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-zinc-800 text-zinc-300">${item.action}</div>
          <p class="mt-2 text-sm text-zinc-400">${item.userEmail || "system"}</p>
          <button class="audit-toggle mt-2 text-xs font-mono text-zinc-500 hover:text-cyan-500 inline-flex items-center gap-1" data-target="meta-${item.id}">
            <i data-lucide="chevron-down" class="h-3 w-3"></i> metadata
          </button>
          <pre id="meta-${item.id}" class="hidden mt-2 bg-zinc-950 border border-zinc-800 rounded p-3 text-xs font-mono text-zinc-400 overflow-x-auto">${JSON.stringify(item.metadata || {}, null, 2)}</pre>
        </div>
      </div>`
    )
    .join("");
  return `<div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6">${entries || `<div class="py-16 text-center"><p class="text-xs font-mono uppercase tracking-widest text-zinc-600">${empty}</p></div>`}</div>`;
}

function renderTabs() {
  return `<div class="flex gap-6 border-b border-zinc-800/60">
    <button data-tab="all" class="admin-tab text-zinc-50 border-b-2 border-cyan-500 pb-3 font-mono text-sm">All Analyses</button>
    <button data-tab="review" class="admin-tab text-zinc-500 hover:text-zinc-300 pb-3 font-mono text-sm">Review Queue</button>
    <button data-tab="batches" class="admin-tab text-zinc-500 hover:text-zinc-300 pb-3 font-mono text-sm">Retraining Batches</button>
    <button data-tab="audit" class="admin-tab text-zinc-500 hover:text-zinc-300 pb-3 font-mono text-sm">Audit Log</button>
  </div>`;
}

function emptyRow(colspan, title = "No data yet") {
  return `<tr><td colspan="${colspan}" class="py-16 text-center">
    <p class="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-4">NO DATA</p>
    <i data-lucide="folder-open" class="h-12 w-12 text-zinc-700 mx-auto mb-4"></i>
    <h3 class="text-lg font-mono text-zinc-300">${title}</h3>
    <p class="text-sm text-zinc-500 mt-2">New records will appear here once activity begins.</p>
  </td></tr>`;
}

async function loadData() {
  const [analyses, reviewQueue, batches] = await Promise.all([
    apiFetch("/analyses").catch(() => []),
    apiFetch("/admin/review-queue").catch(() => []),
    apiFetch("/admin/retraining-batches").catch(() => []),
  ]);
  return { analyses, reviewQueue, batches };
}

function renderPanels(data) {
  const allRows = data.analyses
    .map(
      (row) => `<tr class="hover:bg-zinc-800/50 border-b border-zinc-800/60">
      <td class="px-4 py-3 text-xs font-mono text-zinc-400">${formatDate(row.createdAt)}</td>
      <td class="px-4 py-3 text-sm font-mono text-zinc-300">${row.id}</td>
      <td class="px-4 py-3">${RiskBadge(row.riskLevel)}</td>
      <td class="px-4 py-3 text-sm font-mono text-zinc-200">${formatPercent(row.confidence || row.aggregatedConfidence || 0)}</td>
      <td class="px-4 py-3 text-xs font-mono ${row.needsReview ? "text-amber-400" : "text-zinc-600"}">${row.needsReview ? "⚠ Needs Review" : "—"}</td>
      <td class="px-4 py-3 text-xs font-mono text-cyan-500">VIEW →</td>
    </tr>`
    )
    .join("");

  const reviewRows = data.reviewQueue
    .map(
      (item) => `<tr class="hover:bg-zinc-800/50 border-b border-zinc-800/60">
      <td class="px-4 py-3 text-xs font-mono text-zinc-400">${formatDate(item.createdAt)}</td>
      <td class="px-4 py-3 text-sm font-mono text-zinc-300">${item.analysisId}</td>
      <td class="px-4 py-3">${RiskBadge(item.analysis?.riskLevel || "MEDIUM_SUSPICION")}</td>
      <td class="px-4 py-3 text-xs font-mono text-amber-400">${item.status}</td>
      <td class="px-4 py-3 text-xs font-mono text-cyan-500">OPEN →</td>
    </tr>`
    )
    .join("");

  const batchRows = data.batches
    .map(
      (item) => `<tr class="hover:bg-zinc-800/50 border-b border-zinc-800/60">
      <td class="px-4 py-3 text-xs font-mono text-zinc-400">${formatDate(item.createdAt)}</td>
      <td class="px-4 py-3 text-sm font-mono text-zinc-300">${item.batchId}</td>
      <td class="px-4 py-3 text-sm font-mono text-zinc-200">${item.itemCount}</td>
      <td class="px-4 py-3 text-xs font-mono text-amber-400">PENDING</td>
      <td class="px-4 py-3 text-xs font-mono text-cyan-500">MARK TRAINED →</td>
    </tr>`
    )
    .join("");

  return `
    <section id="tab-all">${tableShell(["Time", "Analysis ID", "Risk", "Confidence", "Review", "Actions"], allRows || emptyRow(6, "No analyses yet"), "all-table")}</section>
    <section id="tab-review" class="hidden">${tableShell(["Time", "Analysis ID", "Risk", "Status", "Actions"], reviewRows || emptyRow(5, "No review queue items"), "review-table")}</section>
    <section id="tab-batches" class="hidden">${tableShell(["Created", "Batch", "Items", "Status", "Actions"], batchRows || emptyRow(5, "No retraining batches"), "batch-table")}</section>
    <section id="tab-audit" class="hidden space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input id="audit-user-filter" placeholder="userId" class="bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2.5 text-zinc-50 placeholder-zinc-600 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
        <input id="audit-action-filter" placeholder="action" class="bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2.5 text-zinc-50 placeholder-zinc-600 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
        <input id="audit-from-filter" type="date" class="bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2.5 text-zinc-50 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
        <input id="audit-to-filter" type="date" class="bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2.5 text-zinc-50 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
      </div>
      <div class="flex justify-end"><button id="audit-filter-btn" class="bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 px-5 py-2.5 rounded-md font-mono text-sm transition-all">APPLY FILTERS</button></div>
      <div id="audit-log-container">${renderAuditTimeline([])}</div>
    </section>
  `;
}

function bindTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((node) => node.className = "admin-tab text-zinc-500 hover:text-zinc-300 pb-3 font-mono text-sm");
      tab.className = "admin-tab text-zinc-50 border-b-2 border-cyan-500 pb-3 font-mono text-sm";
      ["all", "review", "batches", "audit"].forEach((id) => document.getElementById(`tab-${id}`)?.classList.add("hidden"));
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.remove("hidden");
    });
  });
}

async function loadAuditLog() {
  const params = new URLSearchParams();
  const userId = document.getElementById("audit-user-filter")?.value;
  const action = document.getElementById("audit-action-filter")?.value;
  const from = document.getElementById("audit-from-filter")?.value;
  const to = document.getElementById("audit-to-filter")?.value;
  if (userId) params.set("userId", userId);
  if (action) params.set("action", action);
  if (from) params.set("from", new Date(from).toISOString());
  if (to) params.set("to", new Date(to).toISOString());
  try {
    const response = await apiFetch(`/admin/audit-log?${params.toString()}`);
    document.getElementById("audit-log-container").innerHTML = renderAuditTimeline(response.items || []);
    document.querySelectorAll(".audit-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById(button.dataset.target)?.classList.toggle("hidden");
      });
    });
    if (window.lucide?.createIcons) window.lucide.createIcons();
  } catch (error) {
    showToast(error.message || "Something went wrong", "error");
  }
}

async function init() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    showToast("Admin access required.", "error");
    window.location.href = "/dashboard.html";
    return;
  }
  const data = await loadData();
  document.getElementById("app").innerHTML = renderLayout({
    role: user.role,
    email: user.email,
    activePath: "/admin.html",
    content: `<section class="space-y-6">
      <div class="space-y-3">
        <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">ADMIN / CONTROL</p>
        <h1 class="text-3xl font-mono font-semibold tracking-tight text-zinc-50">Operations Console</h1>
        <p class="text-sm text-zinc-400">Review, retraining, and audit workflows in one surface.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${StatCard({ label: "TOTAL ANALYSES", value: String(data.analyses.length), subtext: "All uploaded analyses" })}
        ${StatCard({ label: "PENDING REVIEW", value: String(data.reviewQueue.length), subtext: "Queue backlog" })}
        ${StatCard({ label: "RETRAINING BATCHES", value: String(data.batches.length), subtext: "Prepared manifests" })}
        ${StatCard({ label: "ACTIVE USERS", value: "1", subtext: "Current session scope" })}
      </div>
      ${renderTabs()}
      ${renderPanels(data)}
    </section>`,
  });
  bindLayoutEvents();
  bindTabs();
  renderChatWidget();
  document.getElementById("audit-filter-btn")?.addEventListener("click", loadAuditLog);
  await loadAuditLog();
}

document.addEventListener("DOMContentLoaded", init);
