/* USDA Food Reference search for Fitness Tracker.
   Requires food_reference table and authenticated Supabase client `db`.
   No USDA API calls, no API key, no paid AI.
*/
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  let selectedFood = null;
  let debounce = null;

  function ensurePanel() {
    const host = $("ft-my-food-panel");
    if (!host || $("ft-usda-panel")) return;

    const panel = document.createElement("section");
    panel.id = "ft-usda-panel";
    panel.style.cssText = "margin-top:18px;padding-top:16px;border-top:1px solid var(--line,#333)";
    panel.innerHTML = `
      <h4>USDA Food Database · ฐานข้อมูลอาหารอ้างอิง</h4>
      <p class="muted">ค้นหาอาหารพื้นฐานจาก USDA ที่นำเข้าไว้ในฐานข้อมูลของเรา · ค่าสารอาหารต่อ 100 กรัม</p>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 130px;gap:10px">
        <input id="ft-usda-query" type="search" placeholder="ค้นหา เช่น chicken breast, rice, egg">
        <input id="ft-usda-grams" type="number" min="1" max="3000" step="1" value="100" aria-label="ปริมาณกรัม">
      </div>
      <small class="muted">ปริมาณที่ต้องการ (กรัม)</small>
      <div id="ft-usda-status" class="muted" style="margin-top:8px">พิมพ์ชื่ออาหารเพื่อค้นหา</div>
      <div id="ft-usda-results" style="display:grid;gap:7px;margin-top:8px"></div>
      <div id="ft-usda-selected" class="muted" style="margin-top:8px"></div>
    `;
    host.appendChild(panel);

    $("ft-usda-query").addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(search, 250);
    });
    $("ft-usda-grams").addEventListener("input", applySelected);
    panel.addEventListener("click", event => {
      const button = event.target.closest("[data-usda-index]");
      if (!button) return;
      selectedFood = window.__ftUsdaResults?.[Number(button.dataset.usdaIndex)] || null;
      applySelected();
    });
  }

  async function search() {
    const query = $("ft-usda-query")?.value.trim();
    const status = $("ft-usda-status");
    const results = $("ft-usda-results");
    if (!query) {
      status.textContent = "พิมพ์ชื่ออาหารเพื่อค้นหา";
      results.innerHTML = "";
      return;
    }
    if (typeof db === "undefined" || !db) {
      status.textContent = "ยังเชื่อมต่อฐานข้อมูลไม่ได้";
      return;
    }

    status.textContent = "กำลังค้นหา...";
    results.innerHTML = "";
    try {
      const pattern = `%${query.replace(/[%_]/g, "")}%`;
      const [th, en] = await Promise.all([
        db.from("food_reference")
          .select("id,fdc_id,name_en,name_th,category,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,basis,source,data_type")
          .ilike("name_th", pattern).limit(20),
        db.from("food_reference")
          .select("id,fdc_id,name_en,name_th,category,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,basis,source,data_type")
          .ilike("name_en", pattern).limit(20)
      ]);
      if (th.error) throw th.error;
      if (en.error) throw en.error;

      const map = new Map();
      [...(th.data || []), ...(en.data || [])].forEach(row => map.set(row.id, row));
      const rows = [...map.values()].slice(0, 30);
      window.__ftUsdaResults = rows;

      if (!rows.length) {
        status.textContent = "ไม่พบรายการในฐานข้อมูล USDA ที่นำเข้าไว้";
        return;
      }
      status.textContent = `พบ ${rows.length} รายการ · แสดงค่าต่อ 100 กรัม`;
      results.innerHTML = rows.map((row, index) => `
        <button type="button" class="secondary" data-usda-index="${index}"
          style="display:flex;justify-content:space-between;gap:12px;text-align:left">
          <span><strong>${escapeHtml(row.name_th || row.name_en)}</strong>
            <small style="display:block;opacity:.7">${escapeHtml(row.name_en)}</small></span>
          <span style="white-space:nowrap">${Number(row.calories_kcal || 0).toFixed(0)} kcal</span>
        </button>
      `).join("");
    } catch (error) {
      console.error("USDA food search:", error);
      status.textContent = "ค้นหาไม่สำเร็จ: " + (error.message || "ตรวจสอบตาราง food_reference และสิทธิ์การอ่าน");
    }
  }

  function applySelected() {
    if (!selectedFood) return;
    const grams = Math.max(1, Math.min(3000, Number($("ft-usda-grams")?.value) || 100));
    const factor = grams / 100;
    const form = $("food-form");
    if (!form) return;

    form.elements.name.value = selectedFood.name_th || selectedFood.name_en;
    form.elements.serving.value = `${grams} g · USDA (${selectedFood.fdc_id || "FDC"})`;
    form.elements.calories.value = (Number(selectedFood.calories_kcal || 0) * factor).toFixed(1);
    form.elements.protein.value = (Number(selectedFood.protein_g || 0) * factor).toFixed(2);
    form.elements.carbs.value = (Number(selectedFood.carbs_g || 0) * factor).toFixed(2);
    form.elements.fat.value = (Number(selectedFood.fat_g || 0) * factor).toFixed(2);
    if (form.elements.notes) {
      form.elements.notes.value = `USDA FoodData Central · ${selectedFood.data_type || "Foundation Foods"} · ${grams} g; ค่าต่อ 100 g`;
    }
    $("ft-usda-selected").textContent =
      `เลือก: ${selectedFood.name_th || selectedFood.name_en} · ${grams} g · ${Math.round(Number(selectedFood.calories_kcal || 0) * factor)} kcal · ปรับปริมาณด้านบนเพื่อคำนวณใหม่`;
  }

  function start() {
    ensurePanel();
    const app = $("app");
    if (app) {
      new MutationObserver(ensurePanel).observe(app, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["class"]
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
