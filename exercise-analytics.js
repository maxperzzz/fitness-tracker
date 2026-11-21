/* Exercise Progression + Personal Records
   Derived entirely from workout_logs.notes [WORKOUT_V2_JSON]; no DB migration. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let chart = null;
  let exerciseData = new Map();

  function parseRecords() {
    const workouts = (typeof cache !== "undefined" && Array.isArray(cache.workouts)) ? cache.workouts : [];
    const map = new Map();
    workouts.forEach(workout => {
      const raw = String(workout.notes || "");
      const match = raw.match(/\[WORKOUT_V2_JSON\]([\s\S]*?)\[\/WORKOUT_V2_JSON\]/);
      if (!match) return;
      let exercises;
      try { exercises = JSON.parse(match[1]); } catch (_) { return; }
      (Array.isArray(exercises) ? exercises : []).forEach(ex => {
        const name = String(ex.name || "").trim();
        if (!name) return;
        const sets = (ex.sets || []).map(set => ({
          reps: Number(set.reps) || 0,
          weight: Number(set.weight) || 0
        })).filter(set => set.reps > 0);
        if (!sets.length) return;
        if (!map.has(name)) map.set(name, []);
        map.get(name).push({
          date: workout.workout_on || String(workout.created_at || "").slice(0,10),
          sets,
          volume: sets.reduce((sum,set) => sum + set.reps * set.weight,0),
          maxWeight: Math.max(...sets.map(set => set.weight))
        });
      });
    });
    map.forEach(entries => entries.sort((a,b) => String(a.date).localeCompare(String(b.date))));
    return map;
  }

  function renderProgression() {
    const root = $("exercise-analytics");
    if (!root || typeof cache === "undefined") return;
    exerciseData = parseRecords();
    const names = [...exerciseData.keys()].sort((a,b)=>a.localeCompare(b));
    const select = $("exercise-progress-select");
    const previous = select.value;
    select.innerHTML = names.length
      ? names.map(name => '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>').join("")
      : '<option value="">ยังไม่มีข้อมูลท่าฝึก</option>';
    if (names.includes(previous)) select.value = previous;
    renderSelectedExercise();
    renderPRs();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function renderSelectedExercise() {
    const name = $("exercise-progress-select")?.value;
    const entries = exerciseData.get(name) || [];
    const bestWeight = entries.reduce((best,row)=>Math.max(best,row.maxWeight),0);
    const bestVolume = entries.reduce((best,row)=>Math.max(best,row.volume),0);
    $("exercise-pr-weight").textContent = bestWeight ? bestWeight.toLocaleString() + " kg" : "—";
    $("exercise-pr-volume").textContent = bestVolume ? Math.round(bestVolume).toLocaleString() + " kg" : "—";
    $("exercise-pr-sessions").textContent = entries.length.toLocaleString() + " ครั้ง";
    const ctx = $("exercise-progress-chart");
    if (!ctx || typeof Chart === "undefined") return;
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type:"line",
      data:{
        labels:entries.map(row=>row.date),
        datasets:[{label:"น้ำหนักสูงสุดต่อครั้ง (kg)",data:entries.map(row=>row.maxWeight),borderWidth:2,tension:.25,fill:false},{label:"Volume ต่อครั้ง (kg)",data:entries.map(row=>Math.round(row.volume)),borderWidth:1,borderDash:[5,4],tension:.2,yAxisID:"y1"}]
      },
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
        plugins:{legend:{labels:{color:"#aab6c4",usePointStyle:true}}},
        scales:{x:{ticks:{color:"#8795a5"},grid:{color:"rgba(140,155,170,.08)"}},y:{beginAtZero:true,ticks:{color:"#8795a5"},grid:{color:"rgba(140,155,170,.1)"},title:{display:true,text:"kg",color:"#8795a5"}},y1:{beginAtZero:true,position:"right",ticks:{color:"#8795a5"},grid:{drawOnChartArea:false},title:{display:true,text:"Volume (kg)",color:"#8795a5"}}}}
    });
  }

  function renderPRs() {
    const target = $("exercise-pr-list");
    if (!target) return;
    const rows = [...exerciseData.entries()].map(([name,entries]) => {
      const best = Math.max(...entries.map(row=>row.maxWeight));
      const bestVolume = Math.max(...entries.map(row=>row.volume));
      const bestRow = entries.find(row=>row.maxWeight===best);
      return {name,best,bestVolume,date:bestRow?.date||"",sessions:entries.length};
    }).filter(row=>row.best>0).sort((a,b)=>b.best-a.best).slice(0,10);
    target.innerHTML = rows.length ? rows.map((row,index)=>
      '<div class="exercise-pr-row"><span class="exercise-pr-rank">'+(index+1)+'</span><strong>'+escapeHtml(row.name)+'</strong><span>'+row.best+' kg</span><small>'+row.date+'</small></div>'
    ).join("") : '<p class="muted">ยังไม่มีข้อมูลน้ำหนักที่ใช้สร้าง PR · บันทึกท่าพร้อม Reps และ Weight ก่อน</p>';
  }

  function install() {
    const page = $("page-workout");
    if (!page || $("exercise-analytics")) return;
    const panel = document.createElement("article");
    panel.id = "exercise-analytics";
    panel.className = "panel exercise-analytics-panel";
    panel.innerHTML = '<div class="workout-entry-heading"><div><span class="workout-section-step">03 / PROGRESS</span><h3>Exercise Progression & PR</h3><p>ติดตามน้ำหนักที่ยกและปริมาณการฝึกจากประวัติที่บันทึก</p></div></div><label class="exercise-progress-picker">เลือกท่าออกกำลังกาย<select id="exercise-progress-select"></select></label><div class="exercise-pr-kpis"><div><small>Personal Record · น้ำหนักสูงสุด</small><strong id="exercise-pr-weight">—</strong></div><div><small>Volume สูงสุดต่อครั้ง</small><strong id="exercise-pr-volume">—</strong></div><div><small>จำนวนครั้งที่ฝึก</small><strong id="exercise-pr-sessions">—</strong></div></div><div class="exercise-progress-chart-wrap"><canvas id="exercise-progress-chart"></canvas></div><div class="exercise-pr-heading"><h4>Top Personal Records</h4><span>เรียงตามน้ำหนักสูงสุด</span></div><div id="exercise-pr-list"></div><p class="exercise-analytics-note">หมายเหตุ: PR ใช้น้ำหนักสูงสุดที่กรอกในแต่ละเซต ไม่ใช่ 1RM ที่คาดการณ์ · Volume = ผลรวม Reps × Weight</p>';
    const history = $("workout-list")?.closest(".panel");
    if (history) history.insertAdjacentElement("beforebegin",panel);
    else page.appendChild(panel);
    $("exercise-progress-select").addEventListener("change",renderSelectedExercise);
    document.addEventListener("fitness-data-loaded",renderProgression);
    renderProgression();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();