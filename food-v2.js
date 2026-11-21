/* Food Tracker V2 — Hybrid workspace
   Keeps the existing food_logs schema and all existing entry connectors.
   Photo mode is photo-assisted manual entry; no AI inference is claimed until a secure AI endpoint is configured.
*/
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  let photoUrl = "";

  function install() {
    const page = $("page-food");
    const form = $("food-form");
    const datePanel = $("ft-food-date-panel");
    const fcd = $("fcd-food-panel");
    const myFood = $("ft-my-food-panel");
    const manual = form?.closest(".panel");
    if (!page || !form || !datePanel || !fcd || !myFood || !manual) return false;
    if ($("food-v2-workspace")) return true;

    const workspace = document.createElement("section");
    workspace.id = "food-v2-workspace";
    workspace.innerHTML = `
      <div class="food-v2-intro">
        <div><span class="food-v2-eyebrow">FOOD TRACKER · V2</span>
          <h2>บันทึกอาหารในแบบที่ถนัด</h2>
          <p>ค้นหาจากฐานข้อมูล กรอกเอง หรือใช้รูปช่วยบันทึก</p></div>
        <div class="food-v2-mark">🍽️</div>
      </div>
      <div class="food-v2-date-host"></div>
      <div class="food-v2-tabs" role="tablist" aria-label="วิธีบันทึกอาหาร">
        <button type="button" class="food-v2-tab active" data-food-tab="search" role="tab" aria-selected="true">⌕ <span>ค้นหาอาหาร</span></button>
        <button type="button" class="food-v2-tab" data-food-tab="manual" role="tab" aria-selected="false">＋ <span>กรอกเอง</span></button>
        <button type="button" class="food-v2-tab" data-food-tab="photo" role="tab" aria-selected="false">▧ <span>ใช้รูปอาหาร</span></button>
      </div>
      <div class="food-v2-pane active" data-food-pane="search"></div>
      <div class="food-v2-pane" data-food-pane="manual">
        <article class="panel food-daily-total-panel">
          <div class="food-v2-panel-heading"><div><span class="food-v2-eyebrow">QUICK DAILY LOG</span><h3>บันทึกแคลอรี่รวมทั้งวัน</h3>
            <p>สำหรับวันที่ไม่ได้แยกรายการอาหาร กรอกยอดรวมคร่าว ๆ ได้เลย</p></div><span class="food-v2-step">OPTIONAL</span></div>
          <form id="food-daily-total-form" class="food-daily-total-form">
            <label>วันที่<input id="food-daily-total-date" name="logged_on" type="date" required></label>
            <label>แคลอรี่รวมทั้งวัน (kcal)<input name="calories" type="number" min="0" step="1" placeholder="เช่น 2,100" required></label>
            <button class="primary" type="submit">บันทึกยอดรวม</button>
          </form>
        </article>
      </div>
      <div class="food-v2-pane" data-food-pane="photo">
        <article class="panel food-photo-panel">
          <div class="food-v2-panel-heading"><div><span class="food-v2-eyebrow">PHOTO ASSIST</span><h3>ใช้รูปช่วยบันทึกอาหาร</h3>
            <p>เลือกรูปเพื่อดูภาพประกอบ แล้วกรอกค่าที่ประเมินได้ก่อนบันทึก</p></div><span class="food-v2-step">03</span></div>
          <label class="food-photo-drop" for="food-photo-input">
            <input id="food-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic">
            <span class="food-photo-symbol">＋</span><strong>เลือกรูปอาหาร</strong><small>JPG · PNG · WEBP · HEIC</small>
          </label>
          <div id="food-photo-preview" class="food-photo-preview" hidden></div>
          <div class="food-photo-note">หมายเหตุ: เวอร์ชันนี้ใช้รูปเป็นตัวช่วยประกอบการกรอก ยังไม่มี AI วิเคราะห์ภาพอัตโนมัติ ค่าที่บันทึกต้องตรวจสอบและกรอกเอง</div>
          <div class="food-photo-fields">
            <label>ชื่ออาหาร<input id="food-photo-name" placeholder="เช่น ข้าวกะเพราหมูสับ"></label>
            <label>ปริมาณ<input id="food-photo-serving" placeholder="เช่น 1 จาน / 250 g"></label>
            <label>พลังงาน (kcal)<input id="food-photo-kcal" type="number" min="0" step="1" placeholder="0"></label>
            <label>โปรตีน (g)<input id="food-photo-protein" type="number" min="0" step=".1" placeholder="0"></label>
            <label>คาร์บ (g)<input id="food-photo-carbs" type="number" min="0" step=".1" placeholder="0"></label>
            <label>ไขมัน (g)<input id="food-photo-fat" type="number" min="0" step=".1" placeholder="0"></label>
            <label>มื้ออาหาร<select id="food-photo-meal"><option>Breakfast</option><option selected>Lunch</option><option>Dinner</option><option>Snack</option></select></label>
          </div>
          <button type="button" class="primary food-photo-use" id="food-photo-use">นำข้อมูลไปกรอกในฟอร์ม</button>
        </article>
      </div>
      <div class="food-v2-history-host"></div>`;

    page.insertBefore(workspace, datePanel);
    workspace.querySelector(".food-v2-date-host").append(datePanel);
    workspace.querySelector('[data-food-pane="search"]').append(fcd, myFood);
    workspace.querySelector('[data-food-pane="manual"]').append(manual);
    const history = $("food-list")?.closest(".panel");
    if (history) workspace.querySelector(".food-v2-history-host").append(history);

    // The old AI scaffold falsely implied an active AI connection; replace it with the honest photo workflow.
    $("ai-food-panel")?.remove();

    workspace.querySelectorAll("[data-food-tab]").forEach(button => {
      button.addEventListener("click", () => activate(button.dataset.foodTab));
    });

    function activate(tab) {
      workspace.querySelectorAll("[data-food-tab]").forEach(button => {
        const active = button.dataset.foodTab === tab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      workspace.querySelectorAll("[data-food-pane]").forEach(pane => {
        pane.classList.toggle("active", pane.dataset.foodPane === tab);
      });
    }

    const input = $("food-photo-input");
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        if (typeof toast === "function") toast("กรุณาเลือกไฟล์รูปภาพ", true);
        input.value = "";
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        if (typeof toast === "function") toast("รูปต้องมีขนาดไม่เกิน 8 MB", true);
        input.value = "";
        return;
      }
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(file);
      const preview = $("food-photo-preview");
      preview.hidden = false;
      preview.innerHTML = `<img src="${photoUrl}" alt="ภาพอาหารที่เลือก"><div><strong>${safe(file.name)}</strong><small>${(file.size/1024/1024).toFixed(2)} MB</small></div>`;
    });

    $("food-photo-use").addEventListener("click", () => {
      const name = $("food-photo-name").value.trim();
      if (!name) {
        if (typeof toast === "function") toast("กรุณากรอกชื่ออาหารก่อน", true);
        $("food-photo-name").focus();
        return;
      }
      form.elements.name.value = name;
      form.elements.serving.value = $("food-photo-serving").value.trim();
      form.elements.calories.value = $("food-photo-kcal").value || 0;
      form.elements.protein.value = $("food-photo-protein").value || 0;
      form.elements.carbs.value = $("food-photo-carbs").value || 0;
      form.elements.fat.value = $("food-photo-fat").value || 0;
      form.elements.meal.value = $("food-photo-meal").value;
      form.elements.notes.value = "Photo-assisted manual entry · กรุณาตรวจสอบค่าประมาณก่อนบันทึก";
      activate("manual");
      form.scrollIntoView({behavior:"smooth",block:"center"});
      if (typeof toast === "function") toast("นำข้อมูลไปยังฟอร์มแล้ว ตรวจสอบก่อนบันทึก");
    });

    const dailyTotalForm = $("food-daily-total-form");
    const dailyTotalDate = $("food-daily-total-date");
    dailyTotalDate.value = new Date().toLocaleDateString("en-CA");
    dailyTotalForm.addEventListener("submit", async event => {
      event.preventDefault();
      const values = new FormData(dailyTotalForm);
      try {
        await insert("food_logs", {
          logged_on: values.get("logged_on"),
          meal: "Daily Total",
          name: "ยอดแคลอรี่รวมทั้งวัน",
          serving: "ทั้งวัน",
          calories: Number(values.get("calories")),
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          notes: "[DAILY_KCAL_TOTAL] บันทึกแคลอรี่รวมโดยประมาณทั้งวัน"
        });
        dailyTotalForm.reset();
        dailyTotalDate.value = new Date().toLocaleDateString("en-CA");
      } catch (error) {
        if (typeof toast === "function") toast("บันทึกไม่สำเร็จ: " + error.message, true);
      }
    });

    // Keep search connectors and personal-food lookup operating on the original form.
    return true;
  }

  function start() {
    if (install()) return;
    const page = $("page-food");
    if (!page) return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(page, {childList:true,subtree:true});
    window.setTimeout(() => observer.disconnect(), 15000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
