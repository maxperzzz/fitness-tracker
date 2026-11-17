/* Fitness Tracker enhancements v1
   - One shared food date for manual Food Log + FoodCheck
   - Workout date and MET-based calorie estimate
   - Personal food lookup from previously saved food_logs
   No AI API, no paid API, no external calls.
   MET reference: 2024 Adult Compendium of Physical Activities.
*/
(() => {
  "use strict";

  const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const $id = id => document.getElementById(id);
  const safe = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  // Selected MET values are based on the 2024 Adult Compendium.
  // Incline treadmill is represented by uphill walking, not a fabricated treadmill MET.
  const ACTIVITIES = [
    {code:"02054", met:3.5, label:"เวทเทรนนิ่งหลายท่า 8–15 ครั้ง/เซต (ทั่วไป)"},
    {code:"02050", met:6.0, label:"เวทหนัก / Powerlifting / Bodybuilding"},
    {code:"02055", met:5.8, label:"เวทแบบ Circuit / Superset"},
    {code:"02035", met:5.0, label:"Circuit Training ปานกลาง"},
    {code:"02040", met:7.5, label:"Circuit / Kettlebell เข้มข้น"},
    {code:"02022", met:3.8, label:"Bodyweight ปานกลาง"},
    {code:"02057", met:6.5, label:"Bodyweight เข้มข้น"},
    {code:"17349", met:3.0, label:"เดินลู่วิ่ง 3.2–3.9 กม./ชม. พื้นราบ"},
    {code:"17352", met:3.5, label:"เดินลู่วิ่ง 4.0–4.7 กม./ชม. พื้นราบ"},
    {code:"17355", met:3.8, label:"เดินลู่วิ่ง 4.8–5.5 กม./ชม. พื้นราบ"},
    {code:"17358", met:4.8, label:"เดินลู่วิ่ง 5.6–6.3 กม./ชม. พื้นราบ"},
    {code:"17034", met:5.3, label:"เดินขึ้นเนิน 1–5%"},
    {code:"17035", met:7.0, label:"เดินขึ้นเนิน 6–10%"},
    {code:"12020", met:7.5, label:"วิ่ง Jogging ตามความเร็วที่เลือก"},
    {code:"12030", met:8.5, label:"วิ่ง 8.0–8.4 กม./ชม."},
    {code:"15660", met:4.0, label:"ปิงปอง / Table Tennis"},
    {code:"01010", met:4.0, label:"ปั่นจักรยาน <16 กม./ชม. เพื่อพักผ่อน"},
    {code:"02048", met:5.0, label:"Elliptical ปานกลาง"},
    {code:"02068", met:11.0, label:"กระโดดเชือก"},
    {code:"02101", met:2.3, label:"ยืดเหยียดเบา"}
  ];

  let installedDbPatch = false;
  let personalFoodPanelInstalled = false;

  function styleOnce() {
    if ($id("ft-enhance-style")) return;
    const s = document.createElement("style");
    s.id = "ft-enhance-style";
    s.textContent = `
      #ft-food-date-panel,#ft-my-food-panel{margin-bottom:18px}
      #ft-food-date-panel input,#ft-my-food-panel input,
      #workout-form input,#workout-form select{
        width:100%;box-sizing:border-box
      }
      #ft-food-date-panel .ft-date-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
      #ft-food-date-panel input[type=date]{max-width:260px}
      #ft-my-food-results{display:grid;gap:7px;margin-top:10px;max-height:230px;overflow:auto}
      #ft-my-food-results button{display:flex;justify-content:space-between;gap:10px;text-align:left}
      #ft-workout-calorie{padding:13px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);margin:8px 0}
      #ft-workout-calorie strong{font-size:22px}
      #ft-workout-calorie .ft-muted{font-size:12px;color:var(--muted)}
    `;
    document.head.appendChild(s);
  }

  function installFoodDate() {
    const page = $id("page-food");
    const form = $id("food-form");
    if (!page || !form || $id("ft-food-date-panel")) return;

    // Remove the previous experimental date fields to avoid duplicate/conflicting dates.
    ["entry_date_food"].forEach(name => {
      const old = form.querySelector(`[name="${name}"]`);
      if (old) old.closest("label")?.remove();
    });

    const panel = document.createElement("article");
    panel.className = "panel form-panel";
    panel.id = "ft-food-date-panel";
    panel.innerHTML = `
      <h3>วันที่บันทึกอาหาร</h3>
      <div class="ft-date-row">
        <label style="flex:1;min-width:220px">เลือกวันที่
          <input id="ft-selected-food-date" type="date" value="${todayLocal()}" required>
        </label>
        <span class="ft-muted">วันที่นี้ใช้ร่วมกับ FoodCheck, My Food และฟอร์มบันทึกอาหาร</span>
      </div>`;
    page.insertBefore(panel, page.firstChild);
  }

  function installWorkoutCalculator() {
    const form = $id("workout-form");
    if (!form || $id("ft-workout-calorie")) return;

    // Remove old experimental date field if present.
    const oldDate = form.querySelector('[name="entry_date_workout"]');
    if (oldDate) oldDate.closest("label")?.remove();

    const dateLabel = document.createElement("label");
    dateLabel.className = "wide";
    dateLabel.textContent = "วันที่ออกกำลังกาย";
    const date = document.createElement("input");
    date.type = "date";
    date.name = "ft_workout_date";
    date.required = true;
    date.value = todayLocal();
    dateLabel.appendChild(date);
    form.insertBefore(dateLabel, form.firstElementChild);

    const activityLabel = document.createElement("label");
    activityLabel.className = "wide";
    activityLabel.textContent = "กิจกรรมสำหรับคำนวณแคลอรี (ฐานข้อมูล MET)";
    const activity = document.createElement("select");
    activity.id = "ft-met-activity";
    activity.name = "ft_met_activity";
    ACTIVITIES.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${item.label} · ${item.met.toFixed(1)} MET`;
      if (item.code === "02054") option.selected = true;
      activity.appendChild(option);
    });
    activityLabel.appendChild(activity);

    const weightLabel = document.createElement("label");
    weightLabel.textContent = "น้ำหนักตัวที่ใช้คำนวณ (kg)";
    const weight = document.createElement("input");
    weight.id = "ft-workout-weight";
    weight.type = "number";
    weight.min = "20";
    weight.max = "300";
    weight.step = "0.1";
    weight.required = true;
    weight.placeholder = "กรอกน้ำหนักตัว";
    weightLabel.appendChild(weight);

    const preview = document.createElement("div");
    preview.id = "ft-workout-calorie";
    preview.className = "wide";
    preview.innerHTML = `<div class="ft-muted">ประมาณการพลังงานจาก MET</div><div>กรอกน้ำหนักและระยะเวลาเพื่อคำนวณ</div>`;

    const durationLabel = form.querySelector('[name="duration"]')?.closest("label");
    const intensityLabel = form.querySelector('[name="intensity"]')?.closest("label");
    if (durationLabel && intensityLabel) {
      durationLabel.insertAdjacentElement("afterend", activityLabel);
      activityLabel.insertAdjacentElement("afterend", weightLabel);
      weightLabel.insertAdjacentElement("afterend", preview);
    } else {
      form.insertBefore(activityLabel, form.lastElementChild);
      form.insertBefore(weightLabel, form.lastElementChild);
      form.insertBefore(preview, form.lastElementChild);
    }

    // Use the latest recorded body weight when available; never silently assume a weight.
    try {
      const latest = typeof cache !== "undefined" && Array.isArray(cache.body)
        ? [...cache.body].filter(x => Number(x.weight_kg) > 0)
            .sort((a,b) => String(b.measured_on).localeCompare(String(a.measured_on)))[0]
        : null;
      if (latest) weight.value = Number(latest.weight_kg).toFixed(1);
    } catch (_) {}

    const calculate = () => {
      const minutes = Math.max(0, Number(form.elements.duration?.value) || 0);
      const kg = Number(weight.value) || 0;
      const item = ACTIVITIES[Number(activity.value)] || ACTIVITIES[0];
      if (!kg || !minutes) {
        preview.innerHTML = `<div class="ft-muted">ประมาณการพลังงานจาก MET</div><div>กรอกน้ำหนักและระยะเวลาเพื่อคำนวณ</div>`;
        return null;
      }
      // Compendium conversion: kcal/min = MET × 3.5 × kg / 200.
      const total = item.met * 3.5 * kg / 200 * minutes;
      const active = (item.met - 1) * 3.5 * kg / 200 * minutes;
      preview.innerHTML = `
        <div class="ft-muted">ประมาณการจาก ${item.met.toFixed(1)} MET · ${item.code} · น้ำหนัก ${kg.toFixed(1)} kg · ${minutes} นาที</div>
        <div><strong>${Math.round(active).toLocaleString()} kcal</strong> <span class="ft-muted">Active Calories</span></div>
        <div class="ft-muted">พลังงานรวม (Total): ${Math.round(total).toLocaleString()} kcal</div>
        <div class="ft-muted">ค่าโดยประมาณ ไม่ใช่การวัดจากอุปกรณ์โดยตรง</div>`;
      return { active: Number(active.toFixed(1)), total: Number(total.toFixed(1)), met: item.met, weight: kg, code: item.code, label: item.label };
    };

    ["input","change"].forEach(evt => {
      form.addEventListener(evt, e => {
        if (["duration","ft-workout-weight","ft-met-activity"].includes(e.target.name || e.target.id)) calculate();
      });
    });
    calculate();
    window.__ftWorkoutCalc = calculate;
  }

  function installPersonalFoodSearch() {
    const page = $id("page-food");
    if (!page || $id("ft-my-food-panel")) return;

    const panel = document.createElement("article");
    panel.className = "panel form-panel";
    panel.id = "ft-my-food-panel";
    panel.innerHTML = `
      <h3>My Food Database · อาหารที่เคยบันทึก</h3>
      <p class="ft-muted">ค้นหาอาหารจากประวัติของบัญชีนี้ แล้วเลือกเพื่อนำข้อมูลสารอาหารกลับมาใช้ซ้ำ</p>
      <input id="ft-my-food-search" type="search" placeholder="ค้นหาชื่ออาหารที่เคยบันทึก">
      <div id="ft-my-food-results" class="ft-muted">กำลังรอข้อมูลอาหาร...</div>`;
    const foodPanel = $id("fcd-food-panel");
    if (foodPanel) foodPanel.insertAdjacentElement("afterend", panel);
    else page.insertBefore(panel, form?.closest(".panel") || page.firstChild);

    const render = () => {
      const query = ($id("ft-my-food-search")?.value || "").trim().toLowerCase();
      const list = typeof cache !== "undefined" && Array.isArray(cache.food) ? cache.food : [];
      const seen = new Map();
      list.forEach(row => {
        const key = [row.name,row.serving,row.calories,row.protein_g,row.carbs_g,row.fat_g].join("|");
        if (!seen.has(key)) seen.set(key,row);
      });
      const matches = [...seen.values()].filter(x => !query || String(x.name||"").toLowerCase().includes(query)).slice(0,25);
      const target = $id("ft-my-food-results");
      if (!target) return;
      if (!matches.length) {
        target.textContent = list.length ? "ไม่พบเมนูที่ค้นหา" : "ยังไม่มีประวัติอาหารในบัญชี";
        return;
      }
      target.innerHTML = matches.map((x,i) => `
        <button type="button" class="secondary" data-ft-food-index="${i}">
          <span>${safe(x.name)} <small>${safe(x.serving||"")}</small></span>
          <span>${Number(x.calories||0)} kcal</span>
        </button>`).join("");
      target._matches = matches;
    };
    $id("ft-my-food-search").addEventListener("input",render);
    panel.addEventListener("click", e => {
      const button = e.target.closest("[data-ft-food-index]");
      if (!button) return;
      const row = $id("ft-my-food-results")._matches?.[Number(button.dataset.ftFoodIndex)];
      if (!row) return;
      const form = $id("food-form");
      form.elements.name.value = row.name || "";
      form.elements.serving.value = row.serving || "";
      form.elements.calories.value = row.calories ?? 0;
      form.elements.protein.value = row.protein_g ?? 0;
      form.elements.carbs.value = row.carbs_g ?? 0;
      form.elements.fat.value = row.fat_g ?? 0;
      if (row.meal) form.elements.meal.value = row.meal;
      form.scrollIntoView({behavior:"smooth",block:"center"});
    });
    // refresh after app.js updates cache and rerenders tables
    const listNode = $id("food-list");
    if (listNode) new MutationObserver(render).observe(listNode,{childList:true,subtree:true});
    render();
  }

  function decorateWorkoutHistory() {
    const list = $id("workout-list");
    if (!list || typeof cache === "undefined" || !Array.isArray(cache.workouts)) return;
    const table = list.querySelector("table");
    if (!table) return;
    const head = table.querySelector("thead tr");
    if (head && !head.querySelector("[data-ft-calorie-head]")) {
      const th = document.createElement("th");
      th.textContent = "Active kcal";
      th.dataset.ftCalorieHead = "1";
      head.appendChild(th);
    }
    const rows = [...table.querySelectorAll("tbody tr")];
    rows.forEach((tr, index) => {
      if (tr.querySelector("[data-ft-calorie-cell]")) return;
      const record = cache.workouts[index];
      const td = document.createElement("td");
      td.dataset.ftCalorieCell = "1";
      const value = record?.calories_active;
      td.textContent = value == null ? "—" : `${Math.round(Number(value))} kcal`;
      tr.appendChild(td);
    });
  }

  function patchSupabaseInsert() {
    if (installedDbPatch || typeof db === "undefined" || !db || typeof db.from !== "function") return;
    const originalFrom = db.from.bind(db);
    db.from = function(table) {
      const builder = originalFrom(table);
      if (table !== "food_logs" && table !== "workout_logs") return builder;
      return new Proxy(builder, {
        get(target, prop) {
          if (prop === "insert") {
            return (values, options) => {
              const addFields = row => {
                const next = {...row};
                if (table === "food_logs") {
                  next.logged_on = $id("ft-selected-food-date")?.value || todayLocal();
                }
                if (table === "workout_logs") {
                  const calc = typeof window.__ftWorkoutCalc === "function" ? window.__ftWorkoutCalc() : null;
                  next.workout_on = $id("workout-form")?.elements.ft_workout_date?.value || todayLocal();
                  if (calc) {
                    next.calories_active = calc.active;
                    next.calories_total = calc.total;
                    next.met_value = calc.met;
                    next.body_weight_kg = calc.weight;
                    next.notes = [next.notes, `MET ${calc.met} (${calc.code}); ${calc.label}; Active ${calc.active} kcal; Total ${calc.total} kcal`].filter(Boolean).join(" | ");
                  }
                  next.activity_type = next.activity_type || "Weight Training";
                }
                return next;
              };
              const nextValues = Array.isArray(values) ? values.map(addFields) : addFields(values);
              return target.insert(nextValues, options);
            };
          }
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    };
    installedDbPatch = true;
  }

  function installPatchWhenReady() {
    patchSupabaseInsert();
    if (!installedDbPatch) {
      const timer = window.setInterval(() => {
        patchSupabaseInsert();
        if (installedDbPatch) window.clearInterval(timer);
      }, 150);
      window.setTimeout(() => window.clearInterval(timer), 20000);
    }
  }

  function start() {
    styleOnce();
    installFoodDate();
    installWorkoutCalculator();
    installPersonalFoodSearch();
    installPatchWhenReady();

    const workoutList = $id("workout-list");
    if (workoutList) {
      new MutationObserver(decorateWorkoutHistory).observe(workoutList,{childList:true,subtree:true});
      decorateWorkoutHistory();
    }

    // Keep My Food results fresh after later data loads.
    const app = $id("app");
    if (app) {
      new MutationObserver(() => {
        installFoodDate();
        installWorkoutCalculator();
        installPersonalFoodSearch();
        patchSupabaseInsert();
        decorateWorkoutHistory();
      }).observe(app,{attributes:true,attributeFilter:["class"]});
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",start,{once:true});
  } else {
    start();
  }
})();
