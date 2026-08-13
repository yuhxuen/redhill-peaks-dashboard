(async () => {
  try {
    const response = await fetch(`./data/analytics.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    if (!config.enabled || !/^https:\/\/[a-z0-9-]+\.goatcounter\.com\/count$/.test(config.endpoint)) return;
    const tracker = document.createElement("script");
    tracker.async = true;
    tracker.src = "https://gc.zgo.at/count.js";
    tracker.dataset.goatcounter = config.endpoint;
    document.head.appendChild(tracker);
  } catch (_) {
    // Analytics must never interfere with the availability dashboard.
  }
})();
