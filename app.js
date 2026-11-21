
/* =========================================================
   FITNESS TRACKER - APP.JS
   ========================================================= */

/* Supabase Configuration */
const SUPABASE_URL = "https://ejnmarjkyrzvxfgnnoyf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lC5U4hIJqymo0Waw5Mq-mA_s6nrhyRD";

/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

const $ = (id) => document.getElementById(id);

const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_ANON_KEY.includes("YOUR_");

let db = null;
let currentUser = null;

let cache = {
  food: [],
  workouts: [],
  body: [],
  photos: [],
  protein: []
};

let analyticsRange = 7;
let analyticsCharts = {};

/* =========================================================
   COMMON FUNCTIONS
   ========================================================= */

const today = () => new Date().toLocaleDateString("en-CA");

const num = (v) => Number(v || 0);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

function toast(msg, error = false) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden", "error");

  if (error) el.classList.add("error");

  setTimeout(() => el.classList.add("hidden"), 3200);
}

function setAuthMessage(msg) {
  $("auth-message").textContent = msg;
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */

function showApp(user) {
  currentUser = user;

  $("login-screen").classList.add("hidden");
  $("app").classList.remove("hidden");

  $("connection-label").textContent = "เชื่อมต่อแล้ว";

  $("today-label").textContent =
    new Date().toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

  $("date-chip").textContent = today();
  const dashboardDate = $("dashboard-date");
  if (dashboardDate && !dashboardDate.value) dashboardDate.value = today();

  loadAll();
}

function showLogin() {
  $("app").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
}

async function auth(action) {
  if (!db) {
    setAuthMessage("ยังไม่ได้ตั้งค่า Supabase URL และ Publishable Key ใน app.js");
    return;
  }

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    setAuthMessage("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  setAuthMessage("กำลังดำเนินการ...");

  const result =
    action === "in"
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({ email, password });

  if (result.error) {
    setAuthMessage(result.error.message);
    return;
  }

  if (action === "up" && !result.data.session) {
    setAuthMessage("สมัครแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี");
    return;
  }

  if (result.data.user) {
    showApp(result.data.user);
  }
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function navigate(page) {
  document.querySelectorAll(".page").forEach(x =>
    x.classList.add("hidden")
  );

  $("page-" + page).classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(x =>
    x.classList.toggle("active", x.dataset.page === page)
  );

  const names = {
    dashboard: "ภาพรวมวันนี้",
    food: "บันทึกอาหาร",
    protein: "บันทึกโปรตีน",
    workout: "ออกกำลังกาย",
    body: "ข้อมูลร่างกาย",
    analytics: "วิเคราะห์ผล",
    photos: "รูปภาพ",
    backup: "สำรองข้อมูล"
  };

  $("page-title").textContent = names[page];

  if (page === "protein") {
    renderProteinTracker();
  }

  if (page === "analytics") {
    renderAnalytics();
  }

  if (page === "body") {
    requestAnimationFrame(() => renderBodyProgress());
  }
}

/* =========================================================
   DATABASE
   ========================================================= */

async function rows(table) {
  const { data, error } = await db
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  return data || [];
}

async function loadAll() {
  try {
    // Load core trackers independently from optional/new modules.
    // A missing protein_logs table must never block Food, Workout, Body or Photos.
    const coreResults = await Promise.allSettled([
      rows("food_logs"),
      rows("workout_logs"),
      rows("body_metrics"),
      rows("photos")
    ]);

    const coreNames = ["Food", "Workout", "Body", "Photos"];
    const coreErrors = [];
    coreResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (index === 0) cache.food = result.value;
        if (index === 1) cache.workouts = result.value;
        if (index === 2) cache.body = result.value;
        if (index === 3) cache.photos = result.value;
      } else {
        coreErrors.push(coreNames[index] + ": " + result.reason.message);
      }
    });

    try {
      cache.protein = await rows("protein_logs");
    } catch (proteinError) {
      cache.protein = [];
      console.warn("Protein Tracker unavailable:", proteinError.message);
      toast("เมนูโปรตีนยังใช้งานไม่ได้: กรุณาสร้างตาราง protein_logs ใน Supabase", true);
    }

    if (coreErrors.length) {
      console.error("Some tracker data failed to load:", coreErrors);
      toast("โหลดข้อมูลบางส่วนไม่สำเร็จ: " + coreErrors.join(" / "), true);
    }

    cache.photos = await Promise.all(
      cache.photos.map(async photo => {
        const { data, error } = await db
          .storage
          .from("fitness-photos")
          .createSignedUrl(photo.storage_path, 3600);

        return {
          ...photo,
          signed_url: error ? "" : data.signedUrl
        };
      })
    );
    document.dispatchEvent(new CustomEvent("fitness-data-loaded"));
    renderAll();

  } catch (e) {
    toast("โหลดข้อมูลไม่สำเร็จ: " + e.message, true);
  }
}

/* =========================================================
   DATE FUNCTIONS
   ========================================================= */

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function shiftDate(daysAgo) {
  const d = new Date();

  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);

  return dateKey(d);
}

/* =========================================================
   NUTRITION ESTIMATION
   ========================================================= */

function nutritionForDay(dayKey) {

  const rows = cache.food.filter(x => x.logged_on === dayKey);
  const dailyTotal = rows.filter(x => String(x.notes || "").includes("[DAILY_KCAL_TOTAL]"));
  const foodRows = rows.filter(x => !String(x.notes || "").includes("[DAILY_KCAL_TOTAL]"));

  /* Only use records from the selected date. Never carry yesterday's calories into today. */
  if (!rows.length) {
    return { kcal: 0, protein: 0, source: "none", sourceDate: null };
  }

  return {
    kcal: dailyTotal.length
      ? num(dailyTotal[dailyTotal.length - 1].calories)
      : foodRows.reduce((sum, row) => sum + num(row.calories), 0),
    protein: foodRows.reduce((sum, row) => sum + num(row.protein_g), 0),
    source: "actual",
    sourceDate: dayKey
  };
}

/* =========================================================
   DASHBOARD
   ========================================================= */

const PROTEIN_FOODS = [
  { id: "whey", name: "Whey Protein", serving: "1 scoop", protein: 24 },
  { id: "chicken", name: "อกไก่สุก", serving: "100 g", protein: 31 },
  { id: "egg", name: "ไข่ไก่", serving: "1 ฟอง", protein: 6 },
  { id: "protein_milk", name: "นมโปรตีน", serving: "1 ขวด", protein: 28 },
  { id: "soy_milk", name: "น้ำเต้าหู้", serving: "250 ml", protein: 7 },
  { id: "tuna", name: "ทูน่าในน้ำแร่", serving: "1 กระป๋องเล็ก (เนื้อ)", protein: 25 },
  { id: "greek_yogurt", name: "กรีกโยเกิร์ต", serving: "1 ถ้วย", protein: 15 },
  { id: "pork", name: "หมูไม่ติดมันสุก", serving: "100 g", protein: 27 }
];

function proteinItemsForDate() {
  const record = cache.protein.find(x => x.logged_on === ($("protein-date").value || today()));
  return Array.isArray(record?.protein_items) ? record.protein_items : [];
}

function renderProteinFoodList() {
  const saved = proteinItemsForDate();
  const icons = { whey: "🥤", chicken: "🍗", egg: "🥚", protein_milk: "🥛", soy_milk: "🫘", tuna: "🐟", greek_yogurt: "🥣", pork: "🍖" };
  $("protein-food-list").innerHTML = PROTEIN_FOODS.map(food => {
    const item = saved.find(x => x.id === food.id);
    const qty = item ? num(item.qty) : 0;
    return `<div class="protein-food-row ${qty > 0 ? "selected" : ""}" data-protein-card="${food.id}"
        role="checkbox" tabindex="0" aria-checked="${qty > 0}" aria-label="${food.name}, ${food.protein} กรัมต่อ ${food.serving}">
      <div class="protein-food-top"><span class="protein-food-icon">${icons[food.id] || "＋"}</span><span class="protein-food-checkmark">${qty > 0 ? "✓" : "+"}</span></div>
      <strong class="protein-food-name">${food.name}</strong>
      <span class="protein-food-detail">${food.protein} g <i>/</i> ${food.serving}</span>
      <div class="protein-qty-controls" ${qty > 0 ? "" : "hidden"}>
        <button type="button" class="protein-qty-button" data-protein-action="minus" aria-label="ลดจำนวน">−</button>
        <output data-protein-qty>${qty || 1}</output>
        <button type="button" class="protein-qty-button" data-protein-action="plus" aria-label="เพิ่มจำนวน">+</button>
      </div>
      <span class="protein-food-hint" ${qty > 0 ? "hidden" : ""}>แตะเพื่อเลือก</span>
    </div>`;
  }).join("");
  const custom = saved.find(x => x.id === "other");
  const currentRecord = cache.protein.find(x => x.logged_on === ($("protein-date").value || today()));
  $("protein-other-grams").value = custom ? num(custom.protein_g) : currentRecord && !saved.length ? num(currentRecord.protein_g) : "";
  updateProteinDraft();
}

function updateProteinDraft() {
  let total = 0;
  const items = [];
  for (const food of PROTEIN_FOODS) {
    const card = document.querySelector('[data-protein-card="' + food.id + '"]');
    if (card?.classList.contains("selected")) {
      const qty = Math.max(1, Math.min(20, num(card.querySelector("[data-protein-qty]").textContent)));
      total += qty * food.protein;
      items.push({ id: food.id, name: food.name, qty, protein_g: qty * food.protein });
    }
  }
  const other = Math.max(0, Math.min(1000, num($("protein-other-grams").value)));
  if (other > 0) {
    total += other;
    items.push({ id: "other", name: "โปรตีนอื่น", qty: 1, protein_g: other });
  }
  $("protein-grams").value = total.toFixed(1);
  $("protein-draft-total").textContent = total.toFixed(1) + " g";
  return { total, items };
}

function renderProteinTracker() {
  const dateInput = $("protein-date");
  const amountInput = $("protein-grams");
  if (!dateInput || !amountInput) return;

  const selectedDate = dateInput.value || today();
  const record = cache.protein.find(x => x.logged_on === selectedDate);
  renderProteinFoodList();

  const latestBody = [...cache.body].sort(
    (a, b) => String(b.measured_on || "").localeCompare(String(a.measured_on || ""))
  )[0];
  const target = latestBody && num(latestBody.weight_kg) > 0
    ? num(latestBody.weight_kg) * 2
    : 140;
  const total = record ? num(record.protein_g) : 0;
  const remaining = Math.max(0, target - total);

  $("protein-daily-total").textContent = total.toFixed(1);
  $("protein-daily-target").textContent = target.toFixed(1) + " g";
  $("protein-daily-remaining").textContent = !record
    ? "ยังไม่ได้บันทึกวันนี้"
    : total >= target ? "ถึงเป้าหมายโปรตีนแล้ว" : "เหลืออีก " + remaining.toFixed(1) + " g";
  $("protein-daily-progress").style.width = Math.min(100, total / target * 100) + "%";
  const percent = Math.round(total / target * 100);
  $("protein-daily-percent").textContent = percent + "%";

  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDate(6 - i));
  const weekRecords = weekDates.map(date => cache.protein.find(x => x.logged_on === date) || null);
  const loggedRecords = weekRecords.filter(Boolean);
  const average = loggedRecords.length
    ? loggedRecords.reduce((sum, x) => sum + num(x.protein_g), 0) / loggedRecords.length : null;
  const achievedDays = loggedRecords.filter(x => num(x.protein_g) >= target).length;
  const missingDays = 7 - loggedRecords.length;

  $("protein-week-average").textContent = average == null ? "—" : average.toFixed(1) + " g";
  $("protein-week-average-note").textContent = loggedRecords.length + " จาก 7 วันที่มีการบันทึก";
  $("protein-week-achieved").textContent = achievedDays + " / 7";
  $("protein-week-achieved-note").textContent = missingDays ? "ยังไม่ได้บันทึก " + missingDays + " วัน" : "บันทึกครบ 7 วัน";
  $("protein-week-logged").textContent = loggedRecords.length + " / 7";
  $("protein-week-logged-note").textContent = missingDays ? "วันที่ไม่บันทึกไม่นับเป็น 0 g" : "ข้อมูลครบทุกวัน";

  if (window.Chart && $("protein-week-chart")) {
    destroyChart("proteinWeek");
    Chart.defaults.color = "#9ba7b7";
    Chart.defaults.borderColor = "rgba(145,160,180,.13)";
    analyticsCharts.proteinWeek = new Chart($("protein-week-chart"), {
      type: "bar",
      data: {
        labels: weekDates.map(date => new Date(date + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" })),
        datasets: [{ label: "Protein (g)", data: weekRecords.map(x => x ? num(x.protein_g) : null),
          backgroundColor: "rgba(139,215,168,.72)", borderColor: "#8bd7a8", borderWidth: 1, borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: context => context.raw == null ? "ยังไม่ได้บันทึก" : "โปรตีน " + Number(context.raw).toFixed(1) + " g" } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: "Protein (g)" } } } }
    });
  }
  $("protein-week-chart-note").textContent = loggedRecords.length
    ? "แสดงเฉพาะวันที่มีการบันทึก · เป้าหมาย " + target.toFixed(1) + " g/วัน"
    : "ยังไม่มีข้อมูลในช่วง 7 วันที่ผ่านมา";

  const sorted = [...cache.protein].sort((a, b) => String(b.logged_on || "").localeCompare(String(a.logged_on || "")));
  $("protein-history").innerHTML = sorted.length
    ? `<table><thead><tr><th>วันที่</th><th>โปรตีนรวม</th><th>จัดการ</th></tr></thead><tbody>
      ${sorted.map(x => `<tr><td>${esc(x.logged_on)}</td><td>${num(x.protein_g).toFixed(1)} g</td>
      <td><button type="button" class="secondary" data-delete-protein="${esc(x.id)}">ลบ</button></td></tr>`).join("")}
      </tbody></table>`
    : "ยังไม่มีประวัติการบันทึกโปรตีน";
}

function workoutHistoryHtml(records) {
  const sortedRecords = [...(records || [])].sort((a, b) =>
    String(b.workout_on || "").localeCompare(String(a.workout_on || "")) || String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  if (!sortedRecords.length) return "ยังไม่มีข้อมูล";
  return `<div class="workout-card-list">${sortedRecords.map(record => {
    const raw = String(record.notes || "");
    const match = raw.match(/\[WORKOUT_V2_JSON\]([\s\S]*?)\[\/WORKOUT_V2_JSON\]/);
    let exercises = [];
    if (match) { try { exercises = JSON.parse(match[1]); } catch (_) {} }
    const legacy = raw.replace(/\[WORKOUT_V2_JSON\][\s\S]*?\[\/WORKOUT_V2_JSON\]/g, "").replace(/\[WORKOUT_META\][\s\S]*?\[\/WORKOUT_META\]/g, "").trim();
    const setCount = exercises.reduce((sum, ex) => sum + (ex.sets || []).length, 0);
    const exerciseHtml = exercises.length ? exercises.map((ex, index) => {
      const sets = (ex.sets || []).map((set, setIndex) =>
        `<div class="workout-card-set"><b>SET ${setIndex + 1}</b><strong>${esc(set.reps || "—")} <small>REPS</small></strong><span>${set.weight !== "" && set.weight != null ? esc(set.weight) + " kg" : "Bodyweight"}</span></div>`
      ).join("");
      return `<section class="workout-card-exercise"><div class="workout-card-exercise-title"><span>${String(index + 1).padStart(2,"0")}</span><strong>${esc(ex.name)}</strong><small>${(ex.sets || []).length} SETS</small></div><div class="workout-card-sets">${sets}</div></section>`;
    }).join("") : `<p class="workout-card-legacy">${esc(legacy || "ไม่มีรายละเอียดท่าฝึก")}</p>`;
    return `<article class="workout-history-card" data-workout-card-id="${esc(record.id)}">
      <div class="workout-card-top"><div><span class="workout-card-date">${esc(record.workout_on || "ไม่ระบุวันที่")}</span><h4>${esc(record.name || "Workout")}</h4></div><span class="workout-card-duration">${num(record.duration_min)} นาที</span></div>
      <div class="workout-card-meta"><span>${esc(record.activity_type || "ไม่ระบุประเภท")}</span><span>${exercises.length} ท่า</span><span>${setCount} เซต</span></div>
      <div class="workout-card-exercise-list">${exerciseHtml}</div>
      <div class="workout-card-footer"><span class="workout-card-calories" data-workout-calories>แคลอรีรวม —</span><button type="button" class="workout-delete-btn" data-workout-delete-id="${esc(record.id)}">ลบประวัติ</button></div>
    </article>`;
  }).join("")}</div>`;
}
function renderAll() {

  const d = $("dashboard-date")?.value || today();

  renderProteinTracker();

  const foods = cache.food.filter(
    x => x.logged_on === d
  );

  const nutrition = nutritionForDay(d);

  const k = nutrition.kcal ?? 0;
  const p = nutrition.protein ?? 0;

  const c = foods.reduce(
    (a, x) => a + num(x.carbs_g), 0
  );

  const f = foods.reduce(
    (a, x) => a + num(x.fat_g), 0
  );

  $("kcal-total").innerHTML =
    `${Math.round(k).toLocaleString()} <small>kcal</small>`;

  $("protein-total").innerHTML =
    `${p.toFixed(1)} <small>g</small>`;

  $("carbs-total").innerHTML =
    `${c.toFixed(1)} <small>g</small>`;

  $("fat-total").innerHTML =
    `${f.toFixed(1)} <small>g</small>`;

  $("kcal-progress").style.width =
    Math.min(100, k / 2000 * 100) + "%";

  $("protein-progress").style.width =
    Math.min(100, p / 140 * 100) + "%";

  /* Today's food list */

  $("today-food").innerHTML = foods.length
    ? foods.map(x =>
        `<div class="list-row">
          ${esc(x.name)}
          <span class="muted">
            ${num(x.calories)} kcal${String(x.notes || "").includes("[DAILY_KCAL_TOTAL]") ? " · ยอดรวมทั้งวัน" : " · " + num(x.protein_g) + "g protein"}
          </span>
        </div>`
      ).join("")
    : "ไม่มีรายการอาหารในวันที่เลือก";

  /* Today's workout */

  const w = cache.workouts.filter(
    x => x.workout_on === d
  );

  $("today-workout").innerHTML = w.length
    ? w.map(x =>
        `<div class="list-row">
          ${esc(x.name)}
          <span class="muted">
            ${esc(x.activity_type)} · ${num(x.duration_min)} นาที
          </span>
        </div>`
      ).join("")
    : "ยังไม่มีรายการออกกำลังกาย";

  /* Data tables */

  $("food-list").innerHTML =
    foodTableHtml(cache.food);

  $("workout-list").innerHTML = workoutHistoryHtml(cache.workouts);

  $("body-list").innerHTML =
    bodyTableHtml(cache.body);

  const latestBody = [...cache.body].sort(
    (a, b) => b.measured_on.localeCompare(a.measured_on)
  )[0];

  const bodyFat = latestBody?.body_fat_pct != null
    ? num(latestBody.body_fat_pct)
    : null;

  $("body-current-weight").textContent =
    latestBody ? num(latestBody.weight_kg).toFixed(1) : "—";

  $("body-current-fat").textContent =
    bodyFat != null ? bodyFat.toFixed(1) : "—";

  $("body-fat-mass").textContent =
    bodyFat != null
      ? (num(latestBody.weight_kg) * bodyFat / 100).toFixed(1)
      : "—";

  $("body-lean-mass").textContent =
    bodyFat != null
      ? (num(latestBody.weight_kg) * (1 - bodyFat / 100)).toFixed(1)
      : "—";

  renderBodyProgress();

  /* Photo list */

  $("body-photo-list").innerHTML = cache.photos.filter(x => x.category === "Body Progress").length
    ? cache.photos.filter(x => x.category === "Body Progress").sort((x, y) => String(y.taken_on).localeCompare(String(x.taken_on))).map(x =>
        `<div class="photo-card">
          <img src="${esc(x.signed_url || "")}" alt="Body progress photo">
          <small>${esc(x.taken_on)}</small>
          <small>${esc(x.caption || "")}</small>
        </div>`
      ).join("")
    : "ยังไม่มีภาพ Body Progress";

  $("photo-list").innerHTML = cache.photos.length
    ? cache.photos.map(x =>
        `<div class="photo-card">
          <img src="${esc(x.signed_url || "")}" alt="">
          <small>${esc(x.category)} · ${esc(x.taken_on)}</small>
          <small>${esc(x.caption || "")}</small>
        </div>`
      ).join("")
    : "ยังไม่มีรูปภาพ";
}

const BODY_GOAL_DEFAULTS = { weight: 70, fat: 16 };

function getBodyGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem("fitness-body-goals") || "{}");
    return {
      weight: Number.isFinite(Number(saved.weight)) && Number(saved.weight) > 0
        ? Number(saved.weight) : BODY_GOAL_DEFAULTS.weight,
      fat: Number.isFinite(Number(saved.fat)) && Number(saved.fat) > 0 && Number(saved.fat) < 100
        ? Number(saved.fat) : BODY_GOAL_DEFAULTS.fat
    };
  } catch {
    return { ...BODY_GOAL_DEFAULTS };
  }
}

function renderBodyProgress() {

  const records = [...cache.body].sort((a, b) =>
    String(a.measured_on || "").localeCompare(
      String(b.measured_on || "")
    )
  );

  const first = records[0];
  const latest = records[records.length - 1];
  const firstFat = records.find(r => r.body_fat_pct != null);
  const latestFat = [...records].reverse().find(r => r.body_fat_pct != null);
  const goals = getBodyGoals();

  const weightChange = first && latest
    ? num(latest.weight_kg) - num(first.weight_kg)
    : null;

  const fatChange = firstFat && latestFat
    ? num(latestFat.body_fat_pct) - num(firstFat.body_fat_pct)
    : null;

  const formatChange = (value, unit) => {
    if (value == null) return "—";
    const sign = value > 0 ? "+" : "";
    return sign + value.toFixed(1) + " " + unit;
  };

  $("body-weight-change").textContent = formatChange(weightChange, "kg");
  $("body-fat-change").textContent = formatChange(fatChange, "จุด %");
  $("body-progress-period").textContent = first && latest
    ? first.measured_on + " ถึง " + latest.measured_on
    : "รอข้อมูลเพิ่มเติม";

  const weightInput = $("body-goal-weight");
  const fatInput = $("body-goal-fat");
  if (weightInput && document.activeElement !== weightInput) weightInput.value = goals.weight;
  if (fatInput && document.activeElement !== fatInput) fatInput.value = goals.fat;

  const progress = (start, current, target) => {
    if (start == null || current == null) return null;
    const range = start - target;
    if (Math.abs(range) < 0.000001) return current <= target ? 100 : 0;
    return Math.max(0, Math.min(100, ((start - current) / range) * 100));
  };

  const updateGoal = (prefix, current, target, start, unit, lowerIsBetter = true) => {
    const valueEl = $(prefix + "-goal-current");
    const targetEl = $(prefix + "-goal-target");
    const remainingEl = $(prefix + "-goal-remaining");
    const barEl = $(prefix + "-goal-progress");
    const percentEl = $(prefix + "-goal-percent");

    if (!valueEl || !targetEl || !remainingEl || !barEl || !percentEl) return;

    valueEl.textContent = current == null ? "—" : current.toFixed(1) + " " + unit;
    targetEl.textContent = "เป้าหมาย " + target.toFixed(1) + " " + unit;

    if (current == null || start == null) {
      remainingEl.textContent = "ต้องมีข้อมูลอย่างน้อย 1 รายการ";
      barEl.style.width = "0%";
      percentEl.textContent = "—";
      return;
    }

    const achieved = lowerIsBetter
      ? progress(start, current, target)
      : progress(current, target, start);

    const remaining = lowerIsBetter
      ? Math.max(0, current - target)
      : Math.max(0, target - current);

    remainingEl.textContent = remaining <= 0
      ? "ถึงเป้าหมายแล้ว"
      : "เหลืออีก " + remaining.toFixed(1) + " " + unit;

    barEl.style.width = achieved.toFixed(1) + "%";
    percentEl.textContent = achieved.toFixed(0) + "%";
  };

  updateGoal(
    "body-weight",
    latest ? num(latest.weight_kg) : null,
    goals.weight,
    first ? num(first.weight_kg) : null,
    "kg"
  );

  updateGoal(
    "body-fat",
    latestFat ? num(latestFat.body_fat_pct) : null,
    goals.fat,
    firstFat ? num(firstFat.body_fat_pct) : null,
    "%"
  );

  const weightRecords = records.filter(r =>
    r.weight_kg != null && Number.isFinite(Number(r.weight_kg))
  );
  const fatRecords = records.filter(r =>
    r.body_fat_pct != null && Number.isFinite(Number(r.body_fat_pct))
  );

  const makeLabels = data => data.map(r =>
    new Date(r.measured_on + "T12:00:00").toLocaleDateString(
      "th-TH",
      { day: "numeric", month: "short", year: "2-digit" }
    )
  );

  if (!window.Chart) return;

  Chart.defaults.color = "#9ba7b7";
  Chart.defaults.borderColor = "rgba(145,160,180,.13)";
  Chart.defaults.font.family = "Inter, IBM Plex Sans Thai, sans-serif";

  destroyChart("bodyWeight");
  destroyChart("bodyFat");
  destroyChart("bodyComposition");

  const weightCanvas = $("body-weight-chart");
  const fatCanvas = $("body-fat-chart");

  if (weightCanvas && weightRecords.length) {
    analyticsCharts.bodyWeight = new Chart(weightCanvas, {
      type: "line",
      data: {
        labels: makeLabels(weightRecords),
        datasets: [{
          label: "Weight (kg)",
          data: weightRecords.map(r => num(r.weight_kg)),
          borderColor: "#8bd7a8",
          backgroundColor: "rgba(139,215,168,.12)",
          fill: true,
          tension: .3,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "kg" } }
        }
      }
    });
  }

  if (fatCanvas && fatRecords.length) {
    analyticsCharts.bodyFat = new Chart(fatCanvas, {
      type: "line",
      data: {
        labels: makeLabels(fatRecords),
        datasets: [{
          label: "Body Fat (%)",
          data: fatRecords.map(r => num(r.body_fat_pct)),
          borderColor: "#b8a4ff",
          backgroundColor: "rgba(184,164,255,.12)",
          fill: true,
          tension: .3,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "%" } }
        }
      }
    });
  }

  $("body-weight-chart-note").textContent = weightRecords.length
    ? weightRecords.length + " จุดข้อมูล · อ้างอิงจากประวัติที่บันทึก"
    : "ยังไม่มีข้อมูลน้ำหนักสำหรับแสดงกราฟ";

  $("body-fat-chart-note").textContent = fatRecords.length
    ? fatRecords.length + " จุดข้อมูล · อ้างอิงจากประวัติที่บันทึก"
    : "ยังไม่มีข้อมูล Body Fat สำหรับแสดงกราฟ";

  const compositionRecords = records.filter(r =>
    r.weight_kg != null &&
    r.body_fat_pct != null &&
    Number.isFinite(Number(r.weight_kg)) &&
    Number.isFinite(Number(r.body_fat_pct))
  );

  const insightEl = $("body-insight-content");
  const insightStatus = $("body-insight-status");
  const insightCount = $("body-insight-count");

  if (insightEl && insightStatus && insightCount) {
    const firstComposition = compositionRecords[0];
    const latestComposition = compositionRecords[compositionRecords.length - 1];

    insightCount.textContent =
      compositionRecords.length + " จุดข้อมูลที่มีทั้งน้ำหนักและ Body Fat";

    if (compositionRecords.length < 2) {
      insightStatus.textContent = "ข้อมูลยังไม่เพียงพอ";
      insightStatus.className = "body-insight-status neutral";
      insightEl.textContent =
        "ต้องมีข้อมูลอย่างน้อย 2 ครั้งที่มีทั้งน้ำหนักและ Body Fat จึงจะเริ่มวิเคราะห์การเปลี่ยนแปลงได้";
    } else {
      const fatMass = r => num(r.weight_kg) * num(r.body_fat_pct) / 100;
      const leanMass = r => num(r.weight_kg) - fatMass(r);
      const fatDelta = fatMass(latestComposition) - fatMass(firstComposition);
      const leanDelta = leanMass(latestComposition) - leanMass(firstComposition);
      const weightDelta = num(latestComposition.weight_kg) - num(firstComposition.weight_kg);

      const fmt = value => (value > 0 ? "+" : "") + value.toFixed(1) + " kg";
      const facts = [
        "น้ำหนัก " + fmt(weightDelta),
        "Fat Mass " + fmt(fatDelta),
        "Lean Body Mass " + fmt(leanDelta)
      ];

      let status = "ติดตามต่อ";
      let tone = "neutral";
      let explanation = "แนวโน้มยังไม่ชัดเจน ควรเก็บข้อมูลต่อเนื่องภายใต้เงื่อนไขการวัดที่ใกล้เคียงกัน";

      if (fatDelta < -0.2 && leanDelta >= -0.3) {
        status = "แนวโน้มดี";
        tone = "positive";
        explanation = "มวลไขมันที่คำนวณได้ลดลง ขณะที่มวลไร้ไขมันค่อนข้างคงที่หรือเพิ่มขึ้น เป็นทิศทางที่สอดคล้องกับการลดไขมันโดยรักษามวลไร้ไขมัน";
      } else if (fatDelta < -0.2 && leanDelta < -0.3) {
        status = "ควรติดตามมวลไร้ไขมัน";
        tone = "warning";
        explanation = "มวลไขมันลดลง แต่ค่ามวลไร้ไขมันก็ลดลงด้วย ควรติดตามแนวโน้มหลายครั้งและทบทวนพลังงาน โปรตีน และการฝึกแรงต้าน";
      } else if (fatDelta > 0.2 && leanDelta < -0.3) {
        status = "ควรทบทวนแผน";
        tone = "warning";
        explanation = "มวลไขมันเพิ่มขึ้นพร้อมกับมวลไร้ไขมันลดลงจากค่าที่คำนวณได้ ควรตรวจสอบความสม่ำเสมอของการวัดและติดตามข้อมูลเพิ่มก่อนปรับแผน";
      } else if (fatDelta > 0.2) {
        status = "ไขมันมีแนวโน้มเพิ่ม";
        tone = "warning";
        explanation = "มวลไขมันที่คำนวณได้เพิ่มขึ้นเมื่อเทียบกับข้อมูลแรก ควรดูแนวโน้มต่อเนื่อง ไม่ตัดสินจากการวัดเพียงครั้งเดียว";
      }

      insightStatus.textContent = status;
      insightStatus.className = "body-insight-status " + tone;
      insightEl.innerHTML =
        '<p class="body-insight-message">' + explanation + '</p>' +
        '<div class="body-insight-facts">' +
        facts.map(f => '<span>' + esc(f) + '</span>').join("") +
        '</div>';
    }
  }

  const compositionCanvas = $("body-composition-chart");
  if (compositionCanvas && compositionRecords.length) {
    analyticsCharts.bodyComposition = new Chart(compositionCanvas, {
      type: "line",
      data: {
        labels: makeLabels(compositionRecords),
        datasets: [
          {
            label: "Fat Mass (kg)",
            data: compositionRecords.map(r =>
              num(r.weight_kg) * num(r.body_fat_pct) / 100
            ),
            borderColor: "#e9b875",
            backgroundColor: "rgba(233,184,117,.10)",
            tension: .3,
            pointRadius: 4
          },
          {
            label: "Lean Body Mass (kg)",
            data: compositionRecords.map(r =>
              num(r.weight_kg) * (1 - num(r.body_fat_pct) / 100)
            ),
            borderColor: "#8bd7a8",
            backgroundColor: "rgba(139,215,168,.10)",
            tension: .3,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 7, padding: 18 }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "kg" } }
        }
      }
    });
  }

  $("body-composition-chart-note").textContent = compositionRecords.length
    ? compositionRecords.length + " จุดข้อมูล · มวลไขมันและมวลไร้ไขมันคำนวณจากน้ำหนักและ Body Fat"
    : "ต้องมีทั้งน้ำหนักและ Body Fat เพื่อแสดงกราฟองค์ประกอบร่างกาย";
}
/* =========================================================
   ANALYTICS CHARTS
   ========================================================= */

function destroyChart(key) {
  if (analyticsCharts[key]) {
    analyticsCharts[key].destroy();
    delete analyticsCharts[key];
  }
}

function renderAnalytics() {

  const days = analyticsRange;
  const start = shiftDate(days - 1);
  const end = today();

  const foods = cache.food.filter(
    x => x.logged_on >= start && x.logged_on <= end
  );

  const workouts = cache.workouts.filter(
    x => x.workout_on >= start && x.workout_on <= end
  );

  const body = cache.body
    .filter(x => x.measured_on >= start && x.measured_on <= end)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on));

  const foodDays = [...new Set(
    foods.map(x => x.logged_on)
  )];

  const protein = foods.reduce(
    (s, x) => s + num(x.protein_g), 0
  );

  const avgKcal = foodDays.length
    ? foods.reduce((s, x) => s + num(x.calories), 0) / foodDays.length
    : 0;

  const avgProtein = foodDays.length
    ? protein / foodDays.length
    : 0;

  const totalMinutes = workouts.reduce(
    (s, x) => s + num(x.duration_min), 0
  );
// รวม Active Calories จากประวัติการฝึก
const workoutsWithCalories = workouts.filter(
  x => x.calories_active != null &&
       Number.isFinite(Number(x.calories_active))
);

const totalActiveKcal = workoutsWithCalories.reduce(
  (s, x) => s + num(x.calories_active), 0
);
  const latestBody = [...cache.body].sort(
    (a, b) => b.measured_on.localeCompare(a.measured_on)
  )[0];

  $("an-kcal").textContent =
    foodDays.length ? Math.round(avgKcal).toLocaleString() : "—";

  $("an-protein").textContent =
    foodDays.length ? avgProtein.toFixed(1) : "—";

  $("an-sessions").textContent = workouts.length;
if ($("an-active-kcal")) {
  $("an-active-kcal").textContent = workoutsWithCalories.length
    ? Math.round(totalActiveKcal).toLocaleString()
    : "—";
}

if ($("an-active-kcal-foot")) {
  $("an-active-kcal-foot").textContent =
    workoutsWithCalories.length + " ครั้งที่มีข้อมูลแคลอรี จาก " +
    workouts.length + " ครั้งที่ฝึก";
}
  $("an-minutes").textContent =
    totalMinutes.toLocaleString() + " นาทีรวม";

  $("an-kcal-foot").textContent =
    foods.length + " รายการอาหาร · " + foodDays.length + " วันที่บันทึก";

  $("an-protein-foot").textContent =
    "รวม " + protein.toFixed(1) + " g ในช่วงที่เลือก";

  $("an-weight").textContent =
    latestBody ? num(latestBody.weight_kg).toFixed(1) : "—";

  $("an-weight-foot").textContent =
    latestBody
      ? "อัปเดต " + latestBody.measured_on +
        (latestBody.body_fat_pct != null
          ? " · ไขมัน " + num(latestBody.body_fat_pct).toFixed(1) + "%"
          : "")
      : "ยังไม่มีข้อมูลร่างกาย";

  /* Daily nutrition chart */

  const labels = [];
  const dailyKcal = [];
  const dailyProtein = [];

  for (let i = days - 1; i >= 0; i--) {

    const key = shiftDate(i);

    labels.push(
      new Date(key + "T12:00:00").toLocaleDateString(
        "th-TH",
        { day: "numeric", month: "short" }
      )
    );

    const nutrition = nutritionForDay(key);

    dailyKcal.push(nutrition.kcal);
    dailyProtein.push(nutrition.protein);
  }

  if (window.Chart) {

    Chart.defaults.color = "#9ba7b7";
    Chart.defaults.borderColor = "rgba(145,160,180,.13)";
    Chart.defaults.font.family =
      "Inter, IBM Plex Sans Thai, sans-serif";

    destroyChart("nutrition");

    analyticsCharts.nutrition = new Chart(
      $("nutrition-chart"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Calories (kcal)",
              data: dailyKcal,
              borderColor: "#8bd7a8",
              backgroundColor: "rgba(139,215,168,.12)",
              fill: true,
              tension: 0.35,
              yAxisID: "y",
              pointRadius: 2
            },
            {
              label: "Protein (g)",
              data: dailyProtein,
              borderColor: "#b8a4ff",
              tension: 0.35,
              yAxisID: "y1",
              pointRadius: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                usePointStyle: true,
                boxWidth: 7,
                padding: 18
              }
            }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "kcal"
              }
            },
            y1: {
              beginAtZero: true,
              position: "right",
              grid: {
                drawOnChartArea: false
              },
              title: {
                display: true,
                text: "g"
              }
            }
          }
        }
      }
    );

    /* Macro chart - actual food records only */

    const macro = [
      foods.reduce((s, x) => s + num(x.protein_g) * 4, 0),
      foods.reduce((s, x) => s + num(x.carbs_g) * 4, 0),
      foods.reduce((s, x) => s + num(x.fat_g) * 9, 0)
    ];

    destroyChart("macro");

    analyticsCharts.macro = new Chart(
      $("macro-chart"),
      {
        type: "doughnut",
        data: {
          labels: ["Protein", "Carbs", "Fat"],
          datasets: [{
            data: macro,
            backgroundColor: [
              "#8bd7a8",
              "#b8a4ff",
              "#e9b875"
            ],
            borderColor: "#191e26",
            borderWidth: 4,
            hoverOffset: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx =>
                  ctx.label + ": " + Math.round(ctx.raw) + " kcal"
              }
            }
          }
        }
      }
    );

    $("macro-legend").innerHTML = [
      ["Protein", macro[0], "#8bd7a8"],
      ["Carbs", macro[1], "#b8a4ff"],
      ["Fat", macro[2], "#e9b875"]
    ].map(item =>
      `<span>
        <i style="background:${item[2]}"></i>
        ${item[0]}
        <b>${Math.round(item[1])} kcal</b>
      </span>`
    ).join("");

    /* Body chart */

    destroyChart("body");

    analyticsCharts.body = new Chart(
      $("body-chart"),
      {
        type: "line",
        data: {
          labels: body.map(x =>
            new Date(x.measured_on + "T12:00:00")
              .toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short"
              })
          ),
          datasets: [
            {
              label: "Weight (kg)",
              data: body.map(x => num(x.weight_kg)),
              borderColor: "#8bd7a8",
              backgroundColor: "rgba(139,215,168,.12)",
              fill: true,
              tension: 0.3,
              yAxisID: "y",
              spanGaps: true
            },
            {
              label: "Body Fat (%)",
              data: body.map(x =>
                x.body_fat_pct == null ? null : num(x.body_fat_pct)
              ),
              borderColor: "#b8a4ff",
              tension: 0.3,
              yAxisID: "y1",
              spanGaps: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                usePointStyle: true,
                boxWidth: 7
              }
            }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              title: {
                display: true,
                text: "kg"
              }
            },
            y1: {
              position: "right",
              grid: {
                drawOnChartArea: false
              },
              title: {
                display: true,
                text: "%"
              }
            }
          }
        }
      }
    );


    /* Workout Analytics: four standard categories */

  const workoutGroups = [
  "Weight Training",
  "Cardio",
  "Other"
];

    const normalizeWorkoutType = value => {
      const raw = String(value || "").trim().toLowerCase();

      if (["weight training", "weight-training", "เวท", "เวทเทรนนิ่ง"].includes(raw)) {
        return "Weight Training";
      }

      if (["cardio", "คาร์ดิโอ"].includes(raw)) {
        return "Cardio";
      }

      return "Other";
    };

    const durationByType = Object.fromEntries(
      workoutGroups.map(type => [type, 0])
    );

    const sessionsByType = Object.fromEntries(
      workoutGroups.map(type => [type, 0])
    );

    const activeKcalByType = Object.fromEntries(
      workoutGroups.map(type => [type, 0])
    );

    const calorieSessionsByType = Object.fromEntries(
      workoutGroups.map(type => [type, 0])
    );

    workouts.forEach(x => {
      const type = normalizeWorkoutType(x.activity_type);

      durationByType[type] += num(x.duration_min);
      sessionsByType[type] += 1;

      if (
        x.calories_active != null &&
        Number.isFinite(Number(x.calories_active))
      ) {
        activeKcalByType[type] += num(x.calories_active);
        calorieSessionsByType[type] += 1;
      }
    });

    const activeTypes = workoutGroups.filter(
      type => sessionsByType[type] > 0
    );

    const calorieTypes = workoutGroups.filter(
      type => calorieSessionsByType[type] > 0
    );

    const workoutColors = [
      "#8bd7a8",
      "#b8a4ff",
      "#e9b875",
      "#78b7d6"
    ];

    /* Duration chart */

    destroyChart("training");

    analyticsCharts.training = new Chart(
      $("training-chart"),
      {
        type: "bar",
        data: {
          labels: activeTypes.length
            ? activeTypes
            : ["ยังไม่มีข้อมูล"],
          datasets: [{
            label: "Minutes",
            data: activeTypes.length
              ? activeTypes.map(type => durationByType[type])
              : [0],
            backgroundColor: activeTypes.length
              ? activeTypes.map(type =>
                  workoutColors[workoutGroups.indexOf(type)]
                )
              : ["#46505c"],
            borderRadius: 7,
            maxBarThickness: 44
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "นาที"
              }
            }
          }
        }
      }
    );

    /* Active Calories chart */

    destroyChart("trainingCalories");

    analyticsCharts.trainingCalories = new Chart(
      $("training-calories-chart"),
      {
        type: "bar",
        data: {
          labels: calorieTypes.length
            ? calorieTypes
            : ["ยังไม่มีข้อมูลแคลอรี่"],
          datasets: [{
            label: "Active kcal",
            data: calorieTypes.length
              ? calorieTypes.map(type =>
                  Number(activeKcalByType[type].toFixed(1))
                )
              : [0],
            backgroundColor: calorieTypes.length
              ? calorieTypes.map(type =>
                  workoutColors[workoutGroups.indexOf(type)]
                )
              : ["#46505c"],
            borderRadius: 7,
            maxBarThickness: 44
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Active kcal"
              }
            }
          }
        }
      }
    );

    $("training-calories-summary").textContent =
      calorieTypes.length
        ? calorieTypes.map(type =>
            type + ": " +
            activeKcalByType[type].toFixed(1) +
            " kcal (" +
            calorieSessionsByType[type] +
            " ครั้ง)"
          ).join(" · ")
        : "ยังไม่มีรายการฝึกที่มีข้อมูล Active Calories";


  } else {
   ["nutrition", "macro", "body", "training", "trainingCalories"].forEach(destroyChart);
  }

  /* Body summary */

  if (body.length) {

    const first = body[0];
    const last = body[body.length - 1];

    const delta =
      num(last.weight_kg) - num(first.weight_kg);

    $("body-summary").textContent =
      "น้ำหนักเปลี่ยน " +
      (delta > 0 ? "+" : "") +
      delta.toFixed(1) +
      " kg ในช่วงที่เลือก · " +
      body.length +
      " ครั้งที่วัด";

  } else {
    $("body-summary").textContent =
      "ไม่มีข้อมูลร่างกายในช่วงเวลานี้";
  }

  
  /* Training summary */

const summaryGroups = [
  "Weight Training",
  "Cardio",
  "Other"
];

  const summaryByType = Object.fromEntries(
    summaryGroups.map(type => [type, 0])
  );

  workouts.forEach(x => {
    const raw = String(x.activity_type || "").trim().toLowerCase();

       const type =
      ["weight training", "weight-training", "เวท", "เวทเทรนนิ่ง"].includes(raw)
        ? "Weight Training"
        : ["cardio", "คาร์ดิโอ"].includes(raw)
          ? "Cardio"
          : "Other";

    summaryByType[type] += num(x.duration_min);
  });

  const sortedTypes = summaryGroups
    .filter(type => summaryByType[type] > 0)
    .sort((a, b) => summaryByType[b] - summaryByType[a]);

  $("training-summary").textContent = sortedTypes.length
    ? sortedTypes.map(type =>
        type + ": " + summaryByType[type] + " นาที"
      ).join(" · ")
    : "ยังไม่มีการฝึกในช่วงเวลานี้";

  /* Workout Performance Comparison */

  const previousStart = shiftDate(days * 2 - 1);
  const previousEnd = shiftDate(days);

  const previousWorkouts = cache.workouts.filter(
    x => x.workout_on >= previousStart &&
         x.workout_on <= previousEnd
  );

  const performanceGroups = [
    "Weight Training",
    "Cardio",
    "Other"
  ];

  const classifyPerformance = value => {
    const raw = String(value || "").trim().toLowerCase();

    if (["weight training", "weight-training", "เวท", "เวทเทรนนิ่ง"].includes(raw)) {
      return "Weight Training";
    }

    if (["cardio", "คาร์ดิโอ"].includes(raw)) {
      return "Cardio";
    }

    return "Other";
  };

  const summarizePerformance = rows => {
    const result = Object.fromEntries(
      performanceGroups.map(type => [
        type,
        { sessions: 0, minutes: 0, calories: 0 }
      ])
    );

    rows.forEach(x => {
      const item = result[classifyPerformance(x.activity_type)];

      item.sessions += 1;
      item.minutes += num(x.duration_min);
      item.calories += x.calories_active == null
        ? 0
        : num(x.calories_active);
    });

    return result;
  };

  const currentPerformance = summarizePerformance(workouts);
  const previousPerformance = summarizePerformance(previousWorkouts);

  const sumPerformance = (data, key) =>
    performanceGroups.reduce(
      (sum, type) => sum + data[type][key], 0
    );

  const metrics = [
    ["จำนวนครั้ง", "sessions", " ครั้ง"],
    ["เวลาฝึกรวม", "minutes", " นาที"],
    ["Active Calories", "calories", " kcal"]
  ];

  const metricHtml = metrics.map(([label, key, unit]) => {
    const current = sumPerformance(currentPerformance, key);
    const previous = sumPerformance(previousPerformance, key);

    const value = key === "calories"
      ? current.toFixed(1)
      : current.toLocaleString();

    let comparison = "ไม่มีข้อมูลช่วงก่อนหน้า";

    if (previous > 0) {
      const change = ((current - previous) / previous) * 100;
      const sign = change > 0 ? "+" : "";

      comparison = sign + change.toFixed(1) + "%";
    } else if (current === 0) {
      comparison = "ยังไม่มีข้อมูล";
    } else {
      comparison = "มีข้อมูลเฉพาะช่วงปัจจุบัน";
    }

    return `
      <div class="workout-compare-metric">
        <span>${label}</span>
        <strong>${value}${unit}</strong>
        <small>ช่วงก่อน: ${
          key === "calories"
            ? previous.toFixed(1)
            : previous.toLocaleString()
        }${unit} · ${comparison}</small>
      </div>
    `;
  }).join("");

  const comparisonRows = performanceGroups
    .filter(type =>
      currentPerformance[type].sessions > 0 ||
      previousPerformance[type].sessions > 0
    )
    .map(type => {
      const current = currentPerformance[type];
      const previous = previousPerformance[type];

      return `
        <tr>
          <th>${type}</th>
          <td>${current.sessions} / ${previous.sessions}</td>
          <td>${current.minutes} / ${previous.minutes}</td>
          <td>${current.calories.toFixed(1)} / ${previous.calories.toFixed(1)}</td>
        </tr>
      `;
    }).join("");

  if ($("workout-comparison-content")) {
    $("workout-comparison-content").innerHTML = `
      <div class="workout-compare-metrics">
        ${metricHtml}
      </div>

      <div class="workout-compare-table-wrap">
        <table class="workout-compare-table">
          <thead>
            <tr>
              <th>ประเภท</th>
              <th>จำนวนครั้ง<br>ปัจจุบัน / ก่อนหน้า</th>
              <th>นาที<br>ปัจจุบัน / ก่อนหน้า</th>
              <th>Active kcal<br>ปัจจุบัน / ก่อนหน้า</th>
            </tr>
          </thead>
          <tbody>
            ${comparisonRows ||
              '<tr><td colspan="4">ยังไม่มีข้อมูลการฝึก</td></tr>'}
          </tbody>
        </table>
      </div>

      <p class="chart-note">
        ช่วงปัจจุบัน ${start} ถึง ${end}
        · ช่วงก่อนหน้า ${previousStart} ถึง ${previousEnd}
      </p>
    `;
  }

}

/* =========================================================
   TABLE FUNCTIONS
   ========================================================= */

function tableHtml(data, cols) {

  if (!data.length) return "ยังไม่มีข้อมูล";

  return `
    <table>
      <thead>
        <tr>
          ${cols.map(c => `<th>${c[1]}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${data.slice(0, 30).map(r =>
          `<tr>
            ${cols.map(c =>
              `<td>${esc(r[c[0]] ?? "—")}</td>`
            ).join("")}
          </tr>`
        ).join("")}
      </tbody>
    </table>
  `;
}

function foodTableHtml(data) {

  if (!data.length) return "ยังไม่มีรายการอาหาร";

  const cols = [
    ["logged_on", "วันที่"],
    ["meal", "มื้อ"],
    ["name", "อาหาร"],
    ["calories", "kcal"],
    ["protein_g", "โปรตีน g"]
  ];

  return `
    <table>
      <thead>
        <tr>
          ${cols.map(c => `<th>${c[1]}</th>`).join("")}
          <th>จัดการ</th>
        </tr>
      </thead>
      <tbody>
        ${data.slice(0, 30).map(r =>
          `<tr>
            ${cols.map(c =>
              `<td>${esc(r[c[0]] ?? "—")}</td>`
            ).join("")}
            <td>
              <button
                type="button"
                class="secondary"
                data-delete-food="${esc(r.id)}"
              >ลบ</button>
            </td>
          </tr>`
        ).join("")}
      </tbody>
    </table>
  `;
}

function bodyTableHtml(data) {

  if (!data.length) return "ยังไม่มีข้อมูล";

  const sortedData = [...data].sort((a, b) =>
    String(b.measured_on || "").localeCompare(
      String(a.measured_on || "")
    )
  );

  return `
    <div class="body-history-summary">
      <span>ทั้งหมด ${data.length} รายการ</span>
      ${data.length > 30
        ? "<span>แสดง 30 รายการล่าสุด</span>"
        : ""}
    </div>

    <table>
      <thead>
        <tr>
          <th>วันที่</th>
          <th>น้ำหนัก kg</th>
          <th>Body Fat %</th>
          <th>จัดการ</th>
        </tr>
      </thead>
      <tbody>
        ${sortedData.slice(0, 30).map(r =>
          `<tr>
            <td>${esc(r.measured_on)}</td>
            <td>${esc(r.weight_kg)}</td>
            <td>${esc(r.body_fat_pct ?? "—")}</td>
            <td>
              <button
                type="button"
                class="secondary"
                data-delete-body="${esc(r.id)}"
              >ลบ</button>
            </td>
          </tr>`
        ).join("")}
      </tbody>
    </table>
  `;
}

async function deleteBodyMetric(id) {

  if (!id || !currentUser) return;

  const record = cache.body.find(
    r => String(r.id) === String(id)
  );

  if (!record) {
    toast("ไม่พบข้อมูลที่ต้องการลบ", true);
    return;
  }

  const details = [
    `วันที่: ${record.measured_on}`,
    `น้ำหนัก: ${record.weight_kg} kg`,
    `Body Fat: ${record.body_fat_pct ?? "—"}%`
  ].join("\n");

  if (!confirm(
    `ยืนยันลบข้อมูลร่างกายรายการนี้?\n\n${details}\n\nการลบไม่สามารถย้อนกลับได้`
  )) return;
  try {

    const { error } = await db
      .from("body_metrics")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) throw error;

    toast("ลบข้อมูลร่างกายแล้ว");

    await loadAll();

  } catch (err) {
    toast("ลบไม่สำเร็จ: " + err.message, true);
  }
}

/* =========================================================
   DELETE FOOD
   ========================================================= */

async function deleteFoodLog(id) {

  if (!id || !currentUser) return;

  if (!confirm("ยืนยันลบรายการอาหารนี้ใช่ไหม?")) return;

  try {

    const { error } = await db
      .from("food_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) throw error;

    toast("ลบรายการอาหารแล้ว");

    await loadAll();

  } catch (err) {
    toast("ลบไม่สำเร็จ: " + err.message, true);
  }
}

/* =========================================================
   INSERT DATA
   ========================================================= */

function formObject(form) {
  return Object.fromEntries(
    new FormData(form).entries()
  );
}

async function insert(table, obj) {

  const { error } = await db
    .from(table)
    .insert({
      ...obj,
      user_id: currentUser.id
    });

  if (error) throw error;

  toast("บันทึกข้อมูลแล้ว");

  await loadAll();
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

$("sign-in").addEventListener(
  "click",
  () => auth("in")
);

$("sign-up").addEventListener(
  "click",
  () => auth("up")
);

$("sign-out").addEventListener("click", async () => {
  await db.auth.signOut();
  currentUser = null;
  showLogin();
});

$("nav").addEventListener("click", e => {
  const b = e.target.closest("[data-page]");
  if (b) navigate(b.dataset.page);
});

$("dashboard-date")?.addEventListener("change", () => {
  renderAll();
});

document.querySelector(".range-switch").addEventListener("click", e => {

  const b = e.target.closest("[data-range]");
  if (!b) return;

  analyticsRange = Number(b.dataset.range);

  document.querySelectorAll(".range-button").forEach(x =>
    x.classList.toggle("active", x === b)
  );

  renderAnalytics();
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (b) navigate(b.dataset.go);
});

/* Delete food event */
/* Delete body event */

$("body-list").addEventListener("click", e => {
  const b = e.target.closest("[data-delete-body]");

  if (b) {
    deleteBodyMetric(b.dataset.deleteBody);
  }
});
$("food-list").addEventListener("click", e => {
  const b = e.target.closest("[data-delete-food]");

  if (b) {
    deleteFoodLog(b.dataset.deleteFood);
  }
});

/* Food form */

$("food-form").addEventListener("submit", async e => {

  e.preventDefault();

  try {

    const x = formObject(e.target);

    await insert("food_logs", {
      logged_on: $("ft-selected-food-date")?.value || today(),
      meal: x.meal,
      name: x.name,
      serving: x.serving,
      calories: num(x.calories),
      protein_g: num(x.protein),
      carbs_g: num(x.carbs),
      fat_g: num(x.fat),
      notes: x.notes
    });

    e.target.reset();

  } catch (err) {
    toast(err.message, true);
  }
});

/* Workout form */

$("workout-form").addEventListener("submit", async e => {

  e.preventDefault();

  try {

    const x = formObject(e.target);

    const duration = num(x.duration);
    const activityType = x.type || "Other";
    const latestBody = [...cache.body].filter(row => num(row.weight_kg) > 0)
      .sort((a, b) => String(b.measured_on || "").localeCompare(String(a.measured_on || "")))[0];
    const bodyWeight = latestBody ? num(latestBody.weight_kg) : null;
    // MET defaults based on the 2024 Adult Compendium where a matching activity is available.
    // Weight training: multiple exercises, 8-15 reps = 3.5 MET; table tennis = 4.0 MET.
    const metByType = { "Weight Training": 3.5, "Cardio": 5.0, "Ping Pong": 4.0, "Other": 3.0 };
    const metValue = metByType[activityType] || 3.0;
    const caloriesTotal = bodyWeight && duration > 0
      ? Math.round(metValue * 3.5 * bodyWeight / 200 * duration)
      : null;
    const metaMarker = "[WORKOUT_META]" + JSON.stringify({
      met: metValue,
      body_weight_kg: bodyWeight,
      calorie_method: "MET x 3.5 x body_weight_kg / 200 x duration_min",
      met_source: "2024 Adult Compendium"
    }) + "[/WORKOUT_META]";
    const savedNotes = [x.notes || "", metaMarker].filter(Boolean).join("\\n\\n");

    await insert("workout_logs", {
      activity_type: activityType,
      name: x.name,
      duration_min: duration,
      calories_total: caloriesTotal,
      notes: savedNotes
    });

    e.target.reset();

  } catch (err) {
    toast(err.message, true);
  }
});

/* Body goal settings */
$("save-body-goals").addEventListener("click", () => {
  const weight = Number($("body-goal-weight").value);
  const fat = Number($("body-goal-fat").value);

  if (!Number.isFinite(weight) || weight < 1 || weight > 500) {
    toast("กรุณากรอกน้ำหนักเป้าหมายให้ถูกต้อง", true);
    return;
  }

  if (!Number.isFinite(fat) || fat < 1 || fat > 60) {
    toast("กรุณากรอก Body Fat เป้าหมายระหว่าง 1–60%", true);
    return;
  }

  localStorage.setItem("fitness-body-goals", JSON.stringify({ weight, fat }));
  renderBodyProgress();
  toast("บันทึกเป้าหมายร่างกายแล้ว");
});

/* Body form */

$("body-form").addEventListener("submit", async e => {

  e.preventDefault();

  try {

    const x = formObject(e.target);

    await insert("body_metrics", {
      measured_on: x.measured_on,
      weight_kg: num(x.weight_kg),
      body_fat_pct: x.body_fat_pct
        ? num(x.body_fat_pct)
        : null,
      waist_cm: x.waist_cm
        ? num(x.waist_cm)
        : null,
      notes: x.notes
    });

    e.target.reset();

  } catch (err) {
    toast(err.message, true);
  }
});

/* Protein tracker */
$("protein-date").addEventListener("change", renderProteinTracker);
function toggleProteinCard(card) {
  const active = !card.classList.contains("selected");
  card.classList.toggle("selected", active);
  card.setAttribute("aria-checked", String(active));
  card.querySelector(".protein-qty-controls").hidden = !active;
  card.querySelector(".protein-food-hint").hidden = active;
  card.querySelector(".protein-food-checkmark").textContent = active ? "✓" : "+";
  updateProteinDraft();
}
$("protein-food-list").addEventListener("click", e => {
  const action = e.target.closest("[data-protein-action]");
  if (action) {
    const card = action.closest(".protein-food-row");
    const output = card.querySelector("[data-protein-qty]");
    output.textContent = String(Math.max(1, Math.min(20, num(output.textContent) + (action.dataset.proteinAction === "plus" ? 1 : -1))));
    updateProteinDraft();
    return;
  }
  const card = e.target.closest("[data-protein-card]");
  if (card) toggleProteinCard(card);
});
$("protein-food-list").addEventListener("keydown", e => {
  const card = e.target.closest("[data-protein-card]");
  if (card && (e.key === "Enter" || e.key === " ") && !e.target.closest("button")) {
    e.preventDefault();
    toggleProteinCard(card);
  }
});
$("protein-other-grams").addEventListener("input", updateProteinDraft);

$("protein-form").addEventListener("submit", async e => {
  e.preventDefault();
  const loggedOn = $("protein-date").value;
  const protein = Number($("protein-grams").value);

  if (!loggedOn || !Number.isFinite(protein) || protein < 0 || protein > 1000) {
    toast("กรุณากรอกวันที่และโปรตีน 0–1000 กรัม", true);
    return;
  }

  try {
    const { error } = await db.from("protein_logs").upsert({
      user_id: currentUser.id,
      logged_on: loggedOn,
      protein_g: protein,
      protein_items: updateProteinDraft().items
    }, { onConflict: "user_id,logged_on" });

    if (error) throw error;
    toast("บันทึกโปรตีนแล้ว");
    await loadAll();
    $("protein-date").value = loggedOn;
    renderProteinTracker();
  } catch (err) {
    toast("บันทึกโปรตีนไม่สำเร็จ: " + err.message, true);
  }
});

$("protein-history").addEventListener("click", async e => {
  const button = e.target.closest("[data-delete-protein]");
  if (!button) return;
  const record = cache.protein.find(x => String(x.id) === String(button.dataset.deleteProtein));
  if (!record || !confirm(`ยืนยันลบโปรตีนวันที่ ${record.logged_on} จำนวน ${record.protein_g} g?`)) return;

  try {
    const { error } = await db.from("protein_logs").delete().eq("id", record.id).eq("user_id", currentUser.id);
    if (error) throw error;
    toast("ลบข้อมูลโปรตีนแล้ว");
    await loadAll();
  } catch (err) {
    toast("ลบข้อมูลไม่สำเร็จ: " + err.message, true);
  }
});

/* Photo form */

$("photo-form").addEventListener("submit", async e => {

  e.preventDefault();

  try {

    const x = formObject(e.target);
    const file = e.target.elements.photo.files[0];

    if (!file) {
      throw new Error("กรุณาเลือกรูป");
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new Error("รูปใหญ่เกิน 8MB กรุณาย่อรูปก่อน");
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();

    const path =
      `${currentUser.id}/${Date.now()}.${ext}`;

    const up = await db
      .storage
      .from("fitness-photos")
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });

    if (up.error) throw up.error;

    const ins = await db
      .from("photos")
      .insert({
        user_id: currentUser.id,
        category: x.category,
        taken_on: x.taken_on,
        caption: x.caption,
        storage_path: path
      });

    if (ins.error) throw ins.error;

    toast("อัปโหลดรูปแล้ว");

    e.target.reset();

    await loadAll();

  } catch (err) {
    toast(err.message, true);
  }
});

/* =========================================================
   BACKUP
   ========================================================= */

$("backup-json").addEventListener("click", () => {

  download(
    "fitness-backup-" + today() + ".json",

    JSON.stringify({
      exported_at: new Date().toISOString(),
      food_logs: cache.food,
      workout_logs: cache.workouts,
      body_metrics: cache.body,
      photos: cache.photos.map(({ signed_url, ...x }) => x),
      protein_logs: cache.protein
    }, null, 2),

    "application/json"
  );
});

$("backup-csv").addEventListener("click", () => {

  for (const [name, data] of Object.entries({
    food_logs: cache.food,
    workout_logs: cache.workouts,
    body_metrics: cache.body,
    photos: cache.photos,
    protein_logs: cache.protein
  })) {

    const cols = [
      ...new Set(data.flatMap(Object.keys))
    ];

    const csv = [
      cols.join(","),

      ...data.map(r =>
        cols.map(c =>
          `"${String(r[c] ?? "").replace(/"/g, '""')}"`
        ).join(",")
      )
    ].join("\n");

    download(
      `${name}-${today()}.csv`,
      "\ufeff" + csv,
      "text/csv;charset=utf-8"
    );
  }
});

function download(name, content, type) {

  const a = document.createElement("a");

  const url = URL.createObjectURL(
    new Blob([content], { type })
  );

  a.href = url;
  a.download = name;
  a.click();

  URL.revokeObjectURL(url);

  $("backup-message").textContent =
    "สร้างไฟล์สำรองแล้ว กรุณาเก็บไว้ในที่ปลอดภัย";
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

  $("body-form").elements.measured_on.value = today();
  $("photo-form").elements.taken_on.value = today();
  $("protein-date").value = today();

  if (!configured) {

    setAuthMessage(
      "ขั้นต่อไป: ใส่ Supabase Project URL และ Publishable Key ใน app.js"
    );

    $("connection-label").textContent = "รอตั้งค่า Supabase";

    return;
  }

  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const {
    data: { session }
  } = await db.auth.getSession();

  if (session) {
    showApp(session.user);
  }

  db.auth.onAuthStateChange((_event, session) => {

    if (session) {
      showApp(session.user);
    } else {
      showLogin();
    }

  });
}

init();
