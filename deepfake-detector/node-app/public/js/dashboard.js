import { apiFetch, authFetch, getCurrentUser } from "./api.js";
import { RiskBadge, StatCard, Button, showToast, SkeletonShimmer } from "./components.js";
import { renderLayout, bindLayoutEvents } from "./layout.js";
import { renderChatWidget } from "./chat-widget.js";
import { bytesToSize, formatDate, formatPercent, NumberCounter } from "./utils.js";

const PROCESS_STEPS = [
  "Extracting frames...",
  "Detecting faces...",
  "Running inference...",
  "Generating heatmap...",
  "Classifying...",
];

let selectedFile = null;
let chartRef = null;
let statusInterval = null;
let elapsedInterval = null;
let currentGradcamObjectUrl = null;

function riskTone(risk) {
  if (risk === "HIGH_RISK") return "bg-red-500 risk-left-bar-high";
  if (risk === "MEDIUM_SUSPICION") return "bg-amber-500 risk-left-bar-medium";
  return "bg-emerald-500 risk-left-bar-auth";
}

function renderUploadCard() {
  return `<section class="space-y-6">
    <div class="space-y-3">
      <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">ANALYSIS / NEW</p>
      <h1 class="text-3xl font-mono font-semibold tracking-tight text-zinc-50">New Analysis</h1>
      <p class="text-sm text-zinc-400">Upload a video file to run deepfake detection.</p>
    </div>
    <div class="border border-zinc-800 bg-zinc-900 rounded-lg p-8">
      <label id="drop-zone" class="cursor-pointer border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-lg p-12 min-h-[240px] flex flex-col items-center justify-center gap-3 transition-all">
        <i data-lucide="upload-cloud" class="h-10 w-10 text-zinc-600"></i>
        <p class="font-mono text-base text-zinc-200">Drop video here or click to browse</p>
        <p class="font-mono text-xs text-zinc-500">MP4, MOV, AVI · Max 50MB</p>
        <input id="video-input" type="file" accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi" class="hidden">
      </label>
      <div id="file-meta" class="mt-6 hidden"></div>
    </div>
  </section>`;
}

function renderEmptyState() {
  return `<div class="py-16 flex flex-col items-center text-center">
    <p class="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-4">NO DATA</p>
    <i data-lucide="inbox" class="h-12 w-12 text-zinc-700 mb-4"></i>
    <h3 class="text-lg font-mono font-medium text-zinc-300">No analyses yet</h3>
    <p class="text-sm text-zinc-500 mt-2 max-w-md">Upload a video to start your first forensic analysis.</p>
    <div class="mt-6">${Button({ variant: "primary", children: "UPLOAD VIDEO", id: "empty-upload-btn" })}</div>
  </div>`;
}

function renderProcessing() {
  return `<section class="space-y-6 border border-zinc-800 bg-zinc-900 rounded-lg p-8">
    <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">PROCESSING</p>
    <div class="h-3 w-full bg-zinc-950 rounded-md overflow-hidden border border-zinc-800"><div class="h-full progress-gradient-bar"></div></div>
    <p id="processing-status" class="text-sm text-zinc-400 font-mono">Extracting frames...</p>
    <p id="elapsed-counter" class="text-sm text-zinc-500 font-mono">00:00 elapsed</p>
    <p class="text-xs text-zinc-600 font-mono">First analysis may take up to 90 seconds · ML model warming up</p>
    ${renderResultSkeleton()}
  </section>`;
}

function renderResultSkeleton() {
  return `<div class="space-y-6">
    <div class="border border-zinc-800 rounded-lg p-8 bg-zinc-900 space-y-4">
      ${SkeletonShimmer("220px", "22px")}
      ${SkeletonShimmer("320px", "68px")}
      ${SkeletonShimmer("100%", "180px")}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6 space-y-3">${SkeletonShimmer("90px", "10px")}${SkeletonShimmer("100px", "38px")}</div>
      <div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6 space-y-3">${SkeletonShimmer("90px", "10px")}${SkeletonShimmer("100px", "38px")}</div>
      <div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6 space-y-3">${SkeletonShimmer("90px", "10px")}${SkeletonShimmer("100px", "38px")}</div>
    </div>
    <div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6">${SkeletonShimmer("100%", "240px")}</div>
  </div>`;
}

function recentTable(rows, loading = false) {
  if (loading) {
    const skeletonRows = Array.from({ length: 5 })
      .map(
        () => `<tr class="border-b border-zinc-800/60">
          <td class="px-4 py-3">${SkeletonShimmer("80px", "12px")}</td>
          <td class="px-4 py-3">${SkeletonShimmer("120px", "12px")}</td>
          <td class="px-4 py-3">${SkeletonShimmer("100px", "22px")}</td>
          <td class="px-4 py-3">${SkeletonShimmer("70px", "12px")}</td>
          <td class="px-4 py-3">${SkeletonShimmer("90px", "12px")}</td>
          <td class="px-4 py-3">${SkeletonShimmer("70px", "12px")}</td>
        </tr>`
      )
      .join("");
    return `<section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-mono font-semibold tracking-tight text-zinc-50">Recent Analyses</h2>
      </div>
      <div class="border border-zinc-800 bg-zinc-900 rounded-lg overflow-x-auto">
        <table class="w-full"><tbody>${skeletonRows}</tbody></table>
      </div>
    </section>`;
  }

  const rowHtml = rows
    .map(
      (row) => `<tr class="hover:bg-zinc-800/50 border-b border-zinc-800/60">
        <td class="px-4 py-3 text-xs font-mono text-zinc-400">${formatDate(row.createdAt)}</td>
        <td class="px-4 py-3 text-sm text-zinc-300 font-mono">${row.videoFilename || row.id}</td>
        <td class="px-4 py-3">${RiskBadge(row.riskLevel)}</td>
        <td class="px-4 py-3 text-sm text-zinc-200 font-mono">${formatPercent(row.confidence || row.aggregatedConfidence || 0)}</td>
        <td class="px-4 py-3 text-xs font-mono ${row.needsReview ? "text-amber-400" : "text-zinc-600"}">${row.needsReview ? "⚠ Needs Review" : "—"}</td>
        <td class="px-4 py-3"><button data-analysis-id="${row.id}" class="view-analysis text-xs font-mono text-zinc-500 hover:text-cyan-500">VIEW →</button></td>
      </tr>`
    )
    .join("");
  const body =
    rowHtml ||
    `<tr><td colspan="6">${renderEmptyState()}</td></tr>`;

  return `<section class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-mono font-semibold tracking-tight text-zinc-50">Recent Analyses</h2>
      ${Button({ variant: "ghost", children: "VIEW ALL →" })}
    </div>
    <div class="border border-zinc-800 bg-zinc-900 rounded-lg overflow-x-auto">
      <table class="w-full">
        <thead><tr class="border-b border-zinc-800/60 text-left text-xs font-mono uppercase tracking-widest text-zinc-500"><th class="px-4 py-3">Time</th><th class="px-4 py-3">File</th><th class="px-4 py-3">Risk</th><th class="px-4 py-3">Confidence</th><th class="px-4 py-3">Review</th><th class="px-4 py-3">Actions</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}

function resultSection(result) {
  const frames = result.frameScores || result.frame_scores || [];
  const faces = result.facesDetected ?? result.faces_detected ?? 0;
  const std = result.scoreStd ?? result.score_std ?? 0;
  const risk = result.riskLevel || "MEDIUM_SUSPICION";
  return `<section class="space-y-6">
    <div class="grid grid-cols-12 gap-6 border border-zinc-800 bg-zinc-900 rounded-lg p-8 relative overflow-hidden">
      <div class="absolute left-0 top-0 h-full w-[2px] ${riskTone(risk)}"></div>
      <div class="col-span-12 lg:col-span-7 space-y-3">
        <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">VERDICT</p>
        ${RiskBadge(risk, true)}
        <div id="confidence-counter" class="text-6xl font-mono font-bold tracking-tighter text-zinc-50">0.0%</div>
        <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">Aggregated Confidence</p>
        <p class="text-sm text-zinc-300 max-w-md">${result.reasoning || "Confidence distribution and visual artifacts indicate this classification outcome."}</p>
        <div class="flex gap-3 pt-2">
          ${Button({ variant: "secondary", children: "WHY FLAGGED?", id: "why-flagged-btn" })}
          ${Button({ variant: "ghost", children: "EXPORT REPORT", id: "export-report-btn" })}
        </div>
      </div>
      <div class="col-span-12 lg:col-span-5 space-y-3">
        <div id="gradcam-container" class="rounded-md border border-zinc-800 shadow-lg shadow-cyan-500/10 overflow-hidden aspect-video bg-zinc-950 flex items-center justify-center">
          ${SkeletonShimmer("100%", "100%")}
        </div>
        <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">GRAD-CAM HEATMAP · Frame ${Math.max(1, frames.length)}/${Math.max(1, frames.length)}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      ${StatCard({ label: "FRAMES ANALYZED", value: `${frames.length} / ${frames.length || 10}`, subtext: "Frame sampling completed" })}
      ${StatCard({ label: "FACES DETECTED", value: `${faces} / ${frames.length || 1}`, subtext: "Primary face regions used" })}
      ${StatCard({ label: "SCORE VARIANCE", value: `σ ${Number(std).toFixed(2)}`, subtext: Number(std) < 0.2 ? "Low variance · Stable" : "Elevated variance · Mixed" })}
    </div>

    <div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6 space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">PER-FRAME CONFIDENCE</p>
        <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">${frames.length} FRAMES</p>
      </div>
      <canvas id="frame-score-chart" height="130"></canvas>
    </div>
  </section>`;
}

function startProcessingTicker() {
  const node = document.getElementById("processing-status");
  if (!node) return;
  let index = 0;
  statusInterval = setInterval(() => {
    node.textContent = PROCESS_STEPS[index % PROCESS_STEPS.length];
    index += 1;
  }, 1500);
}

function stopProcessingTicker() {
  if (statusInterval) clearInterval(statusInterval);
  if (elapsedInterval) clearInterval(elapsedInterval);
}

function startElapsedTicker() {
  const elapsedNode = document.getElementById("elapsed-counter");
  if (!elapsedNode) return;
  const startedAt = Date.now();
  elapsedInterval = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");
    elapsedNode.textContent = `${minutes}:${seconds} elapsed`;
  }, 1000);
}

function renderChart(scores) {
  const canvas = document.getElementById("frame-score-chart");
  if (!canvas || !window.Chart) return;
  if (chartRef) chartRef.destroy();
  const labels = scores.map((_, index) => `F${index + 1}`);
  chartRef = new window.Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "P(fake)",
          data: scores,
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6,182,212,0.1)",
          fill: true,
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#06b6d4",
        },
        { label: "MEDIUM", data: new Array(scores.length).fill(0.6), borderColor: "#f59e0b", borderDash: [6, 4], pointRadius: 0 },
        { label: "HIGH RISK", data: new Array(scores.length).fill(0.85), borderColor: "#ef4444", borderDash: [6, 4], pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 1, ticks: { color: "#a1a1aa", font: { family: "JetBrains Mono" } }, grid: { color: "rgba(39,39,42,0.4)" } },
        x: { ticks: { color: "#a1a1aa", font: { family: "JetBrains Mono" } }, grid: { color: "rgba(39,39,42,0.4)" } },
      },
      plugins: {
        legend: { labels: { color: "#a1a1aa", font: { family: "JetBrains Mono" } } },
        tooltip: { backgroundColor: "#18181b", titleFont: { family: "JetBrains Mono" }, bodyFont: { family: "JetBrains Mono" } },
      },
    },
  });
}

async function loadRecentAnalyses() {
  try {
    return await apiFetch("/analyses");
  } catch {
    return [];
  }
}

function bindUploadEvents() {
  const dropZone = document.getElementById("drop-zone");
  const input = document.getElementById("video-input");
  const fileMeta = document.getElementById("file-meta");
  if (!dropZone || !input || !fileMeta) return;

  const setFile = (file) => {
    selectedFile = file;
    fileMeta.classList.remove("hidden");
    fileMeta.innerHTML = `<div class="border border-zinc-800 rounded-md p-6 bg-zinc-950 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-mono text-zinc-200">${file.name}</p>
          <p class="text-xs font-mono text-zinc-500">${bytesToSize(file.size)}</p>
        </div>
        ${Button({ variant: "ghost", children: "REMOVE", id: "remove-file-btn" })}
      </div>
      ${Button({ variant: "primary", children: "ANALYZE", id: "analyze-btn", classes: "w-full" })}
    </div>`;
    document.getElementById("remove-file-btn")?.addEventListener("click", () => {
      selectedFile = null;
      input.value = "";
      fileMeta.classList.add("hidden");
      fileMeta.innerHTML = "";
    });
    document.getElementById("analyze-btn")?.addEventListener("click", runAnalyze);
  };

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("border-cyan-500", "bg-cyan-500/5");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-cyan-500", "bg-cyan-500/5");
  });
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("border-cyan-500", "bg-cyan-500/5");
    const [file] = event.dataTransfer.files;
    if (file) setFile(file);
  });
  input.addEventListener("change", () => {
    const [file] = input.files;
    if (file) setFile(file);
  });
}

async function runAnalyze() {
  if (!selectedFile) {
    showToast("Choose a file before analyzing.", "error");
    return;
  }
  const shell = document.getElementById("dashboard-shell");
  shell.innerHTML = renderProcessing();
  startProcessingTicker();
  startElapsedTicker();
  try {
    const payload = new FormData();
    payload.append("video", selectedFile);
    const result = await apiFetch("/analyze", { method: "POST", body: payload });
    stopProcessingTicker();
    const rows = await loadRecentAnalyses();
    shell.innerHTML = `${resultSection(result)}${recentTable(rows)}`;
    renderChart(result.frameScores || result.frame_scores || []);
    NumberCounter(document.getElementById("confidence-counter"), (result.confidence || 0) * 100);
    await loadGradcamImage(result.gradcamUrl);
    bindResultEvents(result);
    showToast("Analysis completed.", "success");
  } catch (error) {
    stopProcessingTicker();
    shell.innerHTML = `<section class="border border-zinc-800 bg-zinc-900 rounded-lg p-8"><div class="border-l-4 border-red-600 pl-4 space-y-3"><p class="text-xs font-mono uppercase tracking-widest text-zinc-500">ANALYSIS FAILED</p><p class="text-sm text-zinc-300">${error.message || "Something went wrong during analysis."}</p>${Button({ variant: "primary", children: "Try Again", id: "retry-analyze-btn" })}</div></section>${recentTable(await loadRecentAnalyses())}`;
    document.getElementById("retry-analyze-btn")?.addEventListener("click", () => {
      const shellNode = document.getElementById("dashboard-shell");
      shellNode.innerHTML = renderUploadCard();
      bindUploadEvents();
    });
    showToast(error.message || "Something went wrong", "error");
  }
}

async function loadGradcamImage(gradcamUrl) {
  const container = document.getElementById("gradcam-container");
  if (!container || !gradcamUrl) return;
  try {
    const response = await authFetch(gradcamUrl, { method: "GET" });
    if (!response.ok) throw new Error("Failed to load Grad-CAM image");
    const blob = await response.blob();
    if (currentGradcamObjectUrl) URL.revokeObjectURL(currentGradcamObjectUrl);
    currentGradcamObjectUrl = URL.createObjectURL(blob);
    container.innerHTML = `<img src="${currentGradcamObjectUrl}" alt="GradCAM Heatmap" class="w-full h-full object-cover">`;
  } catch {
    container.innerHTML = `<p class="text-xs font-mono text-zinc-500">Grad-CAM unavailable</p>`;
  }
}

function bindResultEvents(result) {
  document.getElementById("why-flagged-btn")?.addEventListener("click", async () => {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6";
    overlay.innerHTML = `<div class="w-full max-w-[560px] border border-zinc-800 bg-zinc-900 rounded-lg shadow-2xl shadow-black/50 p-8 space-y-3">
      <p class="text-xs font-mono uppercase tracking-widest text-zinc-500">AI EXPLANATION</p>
      <h3 class="text-xl font-mono font-semibold tracking-tight text-zinc-50">Analysis Reasoning</h3>
      <div id="modal-content" class="space-y-2">${SkeletonShimmer("100%", "14px")}${SkeletonShimmer("88%", "14px")}${SkeletonShimmer("70%", "14px")}</div>
      <div class="flex justify-end gap-3 pt-2">${Button({ variant: "ghost", children: "Close", id: "close-modal-btn" })}${Button({ variant: "primary", children: "Ask Follow-up", id: "ask-follow-up-btn" })}</div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById("close-modal-btn")?.addEventListener("click", () => overlay.remove());
    document.getElementById("ask-follow-up-btn")?.addEventListener("click", () => {
      overlay.remove();
      document.getElementById("chat-bubble-trigger")?.click();
    });
    try {
      const id = result.analysisId;
      let markdown = result.reasoning || "No explanation available.";
      if (id) {
        const response = await apiFetch(`/help/explain-analysis/${id}`, { method: "POST" });
        markdown = response.explanation || markdown;
        showToast("Explanation loaded.", "success");
      }
      document.getElementById("modal-content").innerHTML = `<div class="markdown-body text-sm text-zinc-300 leading-relaxed">${window.marked ? window.marked.parse(markdown) : markdown}</div>`;
    } catch (error) {
      document.getElementById("modal-content").innerHTML = `<p class="font-mono text-sm text-red-400">${error.message}</p>`;
      showToast(error.message || "Something went wrong", "error");
    }
  });
}

async function init() {
  const user = (await getCurrentUser()) || { email: "offline@local", role: "ANALYST" };
  document.getElementById("app").innerHTML = renderLayout({
    role: user.role,
    email: user.email,
    activePath: "/dashboard.html",
    content: `<div id="dashboard-shell">${renderUploadCard()}</div>${recentTable([], true)}`,
  });
  bindLayoutEvents();
  const recent = await loadRecentAnalyses();
  const tableSection = document.querySelector("main section:last-child");
  if (tableSection) {
    tableSection.outerHTML = recentTable(recent);
  }
  bindUploadEvents();
  if (!recent.length) {
    document.getElementById("dashboard-shell").innerHTML = renderUploadCard();
    document.getElementById("empty-upload-btn")?.addEventListener("click", () => {
      document.getElementById("video-input")?.click();
    });
  }
  renderChatWidget();
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

document.addEventListener("DOMContentLoaded", init);
