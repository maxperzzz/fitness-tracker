
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
  photos: []
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
    workout: "ออกกำลังกาย",
    body: "ข้อมูลร่างกาย",
    analytics: "วิเคราะห์ผล",
    photos: "รูปภาพ",
    backup: "สำรองข้อมูล"
  };

  $("page-title").textContent = names[page];

  if (page === "analytics") {
    renderAnalytics();
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
    [
      cache.food,
      cache.workouts,
      cache.body,
      cache.photos
    ] = await Promise.all([
      rows("food_logs"),
      rows("workout_logs"),
      rows("body_metrics"),
      rows("photos")
    ]);

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

  const rows = cache.food.filter(
    x => x.logged_on === dayKey
  );

  /* Actual data takes priority */

  if (rows.length) {
    return {
      kcal: rows.reduce((s, x) => s + num(x.calories), 0),
      protein: rows.reduce((s, x) => s + num(x.protein_g), 0),
      source: "actual",
      sourceDate: dayKey
    };
  }

  /* Find the latest previous date with food records */

  const dates = [...new Set(
    cache.food
      .filter(x => x.logged_on < dayKey)
      .map(x => x.logged_on)
  )].sort();

  const sourceDate = dates[dates.length - 1];

  if (!sourceDate) {
    return {
      kcal: null,
      protein: null,
      source: "none"
    };
  }

  const previous = cache.food.filter(
    x => x.logged_on === sourceDate
  );

  return {
    kcal: previous.reduce((s, x) => s + num(x.calories), 0),
    protein: previous.reduce((s, x) => s + num(x.protein_g), 0),
    source: "estimated",
    sourceDate
  };
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderAll() {

  const d = today();

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
            ${num(x.calories)} kcal · ${num(x.protein_g)}g protein
          </span>
        </div>`
      ).join("")
    : nutrition.source === "estimated"
      ? `<div class="list-row muted">
          ไม่มีรายการอาหารวันนี้ · ใช้ค่าประมาณจาก ${esc(nutrition.sourceDate)}
        </div>`
      : "ยังไม่มีรายการอาหาร";

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

  $("workout-list").innerHTML =
    tableHtml(cache.workouts, [
      ["workout_on", "วันที่"],
      ["activity_type", "ประเภท"],
      ["name", "กิจกรรม"],
      ["duration_min", "นาที"],
      ["intensity", "ความหนัก"]
    ]);

  $("body-list").innerHTML =
    tableHtml(cache.body, [
      ["measured_on", "วันที่"],
      ["weight_kg", "น้ำหนัก kg"],
      ["body_fat_pct", "Body Fat %"],
      ["waist_cm", "รอบเอว cm"]
    ]);

  /* Photo list */

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

    /* Workout chart */

    const types = {};

    workouts.forEach(x => {
      const key = x.activity_type || "Other";
      types[key] = (types[key] || 0) + num(x.duration_min);
    });

    destroyChart("training");

    analyticsCharts.training = new Chart(
      $("training-chart"),
      {
        type: "bar",
        data: {
          labels: Object.keys(types).length
            ? Object.keys(types)
            : ["ยังไม่มีข้อมูล"],
          datasets: [{
            label: "Minutes",
            data: Object.keys(types).length
              ? Object.values(types)
              : [0],
            backgroundColor: [
              "#8bd7a8",
              "#b8a4ff",
              "#e9b875",
              "#78b7d6"
            ],
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
            x: {
              grid: { display: false }
            },
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

  } else {
    ["nutrition", "macro", "body", "training"].forEach(destroyChart);
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

  const sortedTypes = Object.entries(
    workouts.reduce((a, x) => {
      const key = x.activity_type || "Other";
      a[key] = (a[key] || 0) + num(x.duration_min);
      return a;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  $("training-summary").textContent =
    sortedTypes.length
      ? sortedTypes.map(x => x[0] + ": " + x[1] + " นาที").join(" · ")
      : "ยังไม่มีการฝึกในช่วงเวลานี้";
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
      logged_on: today(),
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

    await insert("workout_logs", {
      workout_on: today(),
      activity_type: x.type,
      name: x.name,
      duration_min: num(x.duration),
      intensity: x.intensity,
      notes: x.notes
    });

    e.target.reset();

  } catch (err) {
    toast(err.message, true);
  }
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
      photos: cache.photos.map(({ signed_url, ...x }) => x)
    }, null, 2),

    "application/json"
  );
});

$("backup-csv").addEventListener("click", () => {

  for (const [name, data] of Object.entries({
    food_logs: cache.food,
    workout_logs: cache.workouts,
    body_metrics: cache.body,
    photos: cache.photos
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
