const state = { units: [], blocks: [], changes: {}, activeBlock: "", queueTracker: null };
const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}

function unitLabel(item) { return `${item.block} #${item.floor}-${item.unit}`; }

function dateLabel(value, options = { dateStyle: "medium" }) {
  return new Date(`${value}T12:00:00+08:00`).toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore", ...options,
  });
}

function addSingaporeWorkingDays(start, days, publicHolidays) {
  const holidays = new Set(publicHolidays || []);
  const result = new Date(`${start}T12:00:00Z`);
  let remaining = Math.max(0, days);
  while (remaining) {
    result.setUTCDate(result.getUTCDate() + 1);
    const isoDate = result.toISOString().slice(0, 10);
    if (result.getUTCDay() !== 0 && result.getUTCDay() !== 6 && !holidays.has(isoDate)) remaining -= 1;
  }
  return result.toISOString().slice(0, 10);
}

function renderPublicQueue() {
  const tracker = state.queueTracker;
  if (!tracker?.latest) return;
  $("public-queue").className = "panel queue-public-panel";
  const latest = tracker.latest;
  const input = $("public-queue-number");
  input.max = tracker.target_queue_number;
  const entered = Number(input.value);
  const hasPersonalQueue = Number.isInteger(entered) && entered >= 1 && entered <= tracker.target_queue_number;
  const target = hasPersonalQueue ? entered : tracker.target_queue_number;
  const remaining = Math.max(0, target - latest.last_queue_number);
  const percentage = Math.min(100, Math.round((latest.last_queue_number / target) * 1000) / 10);
  $("queue-traveller").style.left = `calc(${Math.min(88, percentage * 0.88)}% - 10px)`;
  $("queue-percent").textContent = `${percentage}%`;
  $("queue-latest").textContent = `${dateLabel(latest.date)} · latest reported queue ${latest.last_queue_number}`;
  $("queue-average").textContent = Number(latest.average_per_working_day).toFixed(2);
  if (hasPersonalQueue) {
    $("queue-remaining").textContent = remaining ? `${remaining} queue numbers to go` : "Your queue number has been reached";
    const exactAverage = latest.average_per_working_day_exact || latest.average_per_working_day;
    const remainingDays = exactAverage ? Math.ceil(remaining / exactAverage) : 0;
    const estimate = addSingaporeWorkingDays(latest.date, remainingDays, tracker.mom_public_holidays);
    $("queue-estimate").textContent = remaining ? dateLabel(estimate, { day: "numeric", month: "short", year: "numeric" }) : "Reached";
  } else {
    $("queue-remaining").textContent = `Overall queue progress · ${latest.last_queue_number} of ${tracker.target_queue_number}`;
    $("queue-estimate").textContent = "Enter yours";
  }
  $("public-queue-history").innerHTML = (tracker.history || []).map((item) => `
    <div><time datetime="${escapeHtml(item.date)}">${escapeHtml(dateLabel(item.date, { day: "numeric", month: "short" }))}</time><span>Queue ${item.from_queue_number}–${item.last_queue_number}</span><b>${item.progress >= 0 ? "+" : ""}${item.progress}</b></div>
  `).join("");
}

function showError(message) {
  const notice = $("notice");
  notice.textContent = message;
  notice.className = "notice error";
}

function showUnit(id) {
  const item = state.units.find((candidate) => candidate.id === id);
  if (!item) return;
  const isAvailable = item.status === "available";
  $("unit-detail").innerHTML = `
    <p class="eyebrow">Selected flat</p>
    <h3>${escapeHtml(item.block)} <span>#${escapeHtml(item.floor)}-${escapeHtml(item.unit)}</span></h3>
    <p><span class="status-pill ${item.status}">${isAvailable ? "Available" : "Taken"}</span></p>
    <dl><div><dt>Room type</dt><dd>4-room</dd></div><div><dt>Floor</dt><dd>${Number(item.floor)}</dd></div><div><dt>Stack</dt><dd>${escapeHtml(item.unit)}</dd></div></dl>`;
}

function renderBuilding() {
  const inventory = state.units.filter((item) => item.block === state.activeBlock);
  if (!inventory.length) return;
  const stacks = [...new Set(inventory.map((item) => item.unit))].sort((a, b) => Number(a) - Number(b));
  const byPosition = new Map(inventory.map((item) => [`${item.floor}-${item.unit}`, item]));
  const floors = inventory.map((item) => Number(item.floor));
  const maximum = Math.max(...floors);
  const minimum = Math.min(...floors);
  const rows = [];
  for (let floor = maximum; floor >= minimum; floor -= 1) {
    const floorText = String(floor).padStart(2, "0");
    if (floor === 39 || floor === 19) {
      rows.push(`<tr class="sky-row"><th>${floor}</th><td colspan="${stacks.length}">Sky garden</td></tr>`);
      continue;
    }
    const cells = stacks.map((stack) => {
      const item = byPosition.get(`${floorText}-${stack}`);
      if (!item) return `<td><span class="flat-cell void" title="No flat"></span></td>`;
      return `<td><button class="flat-cell ${item.status}" data-id="${escapeHtml(item.id)}" title="${escapeHtml(unitLabel(item))}"><b>${escapeHtml(stack)}</b></button></td>`;
    }).join("");
    rows.push(`<tr><th>${floor}</th>${cells}</tr>`);
  }
  $("building").innerHTML = `<table class="facade-table"><thead><tr><th>Floor</th>${stacks.map((stack) => `<th>#${escapeHtml(stack)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  document.querySelectorAll(".flat-cell[data-id]").forEach((button) => button.addEventListener("click", () => showUnit(button.dataset.id)));
}

function renderChanges(updatedAt) {
  const changes = [
    ...(state.changes.taken || []).map((item) => ({ item, type: "taken" })),
  ];
  const list = $("change-list");
  const updateDate = state.changes.date || new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(updatedAt));
  const dateLabel = new Date(`${updateDate}T00:00:00+08:00`).toLocaleDateString("en-SG", { dateStyle: "long", timeZone: "Asia/Singapore" });
  $("change-date").textContent = `· ${dateLabel}`;
  const takenCount = state.changes.taken?.length || 0;
  $("change-caption").textContent = `${takenCount} ${takenCount === 1 ? "unit" : "units"} taken`;
  if (!changes.length) {
    list.className = "chips muted";
    list.textContent = "No unit changes so far for this date.";
    return;
  }
  list.className = "chips";
  list.innerHTML = changes.map(({ item, type }) => `<span class="chip ${type}">${escapeHtml(unitLabel(item))} · ${type}</span>`).join("");
}

function render(data) {
  state.units = data.units || [];
  state.blocks = data.blocks || [];
  state.changes = data.changes || {};
  state.queueTracker = data.queue_tracker || null;
  state.activeBlock = state.blocks[0]?.block || "";
  $("available").textContent = data.summary.available.toLocaleString();
  $("taken").textContent = data.summary.taken.toLocaleString();
  $("total").textContent = data.summary.total.toLocaleString();
  $("dropout").textContent = data.dropout_summary ? data.dropout_summary.dropout_count.toLocaleString() : "—";
  const updated = new Date(data.updated_at).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore" });
  $("disclaimer-updated").textContent = updated;
  $("disclaimer-updated").dateTime = data.updated_at;
  $("block-select").innerHTML = state.blocks.map((item) => `<option value="${escapeHtml(item.block)}">Block ${escapeHtml(item.block)} · ${item.available} available · ${item.taken} taken</option>`).join("");
  renderChanges(data.updated_at);
  renderPublicQueue();
  renderBuilding();
}

$("block-select").addEventListener("change", (event) => {
  state.activeBlock = event.target.value;
  renderBuilding();
  $("unit-detail").innerHTML = `<p class="eyebrow">Selected flat</p><h3>Choose a unit</h3><p>Select any coloured unit in the block to see its details.</p>`;
});

$("public-queue-number").addEventListener("input", renderPublicQueue);

fetch(`./data/snapshot.json?v=${Date.now()}`, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Data could not be loaded (${response.status}).`);
    return response.json();
  })
  .then(render)
  .catch((error) => showError(`${error.message} Please reload shortly.`));
