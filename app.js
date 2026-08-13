const state = { units: [], blocks: [], changes: {}, activeBlock: "" };
const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}

function unitLabel(item) { return `${item.block} #${item.floor}-${item.unit}`; }

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
    <strong class="detail-price">${money.format(item.price)}</strong>
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
      return `<td><button class="flat-cell ${item.status}" data-id="${escapeHtml(item.id)}" title="${escapeHtml(unitLabel(item))} · ${money.format(item.price)}"><b>${escapeHtml(stack)}</b><small>${money.format(item.price).replace("SGD", "$")}</small></button></td>`;
    }).join("");
    rows.push(`<tr><th>${floor}</th>${cells}</tr>`);
  }
  $("building").innerHTML = `<table class="facade-table"><thead><tr><th>Floor</th>${stacks.map((stack) => `<th>#${escapeHtml(stack)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  document.querySelectorAll(".flat-cell[data-id]").forEach((button) => button.addEventListener("click", () => showUnit(button.dataset.id)));
}

function renderChanges() {
  const changes = [
    ...(state.changes.taken || []).map((item) => ({ item, type: "taken" })),
  ];
  const list = $("change-list");
  const dateLabel = state.changes.date
    ? new Date(`${state.changes.date}T00:00:00+08:00`).toLocaleDateString("en-SG", { dateStyle: "long" })
    : "Latest update date";
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
  state.activeBlock = state.blocks[0]?.block || "";
  $("available").textContent = data.summary.available.toLocaleString();
  $("taken").textContent = data.summary.taken.toLocaleString();
  $("total").textContent = data.summary.total.toLocaleString();
  const updated = new Date(data.updated_at).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" });
  $("disclaimer-updated").textContent = updated;
  $("disclaimer-updated").dateTime = data.updated_at;
  $("block-select").innerHTML = state.blocks.map((item) => `<option value="${escapeHtml(item.block)}">Block ${escapeHtml(item.block)} · ${item.available} available · ${item.taken} taken</option>`).join("");
  renderChanges();
  renderBuilding();
}

$("block-select").addEventListener("change", (event) => {
  state.activeBlock = event.target.value;
  renderBuilding();
  $("unit-detail").innerHTML = `<p class="eyebrow">Selected flat</p><h3>Choose a unit</h3><p>Select any coloured unit in the block to see its details.</p>`;
});

fetch(`./data/snapshot.json?v=${Date.now()}`, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Data could not be loaded (${response.status}).`);
    return response.json();
  })
  .then(render)
  .catch((error) => showError(`${error.message} Please reload shortly.`));
