/* Muscle Group Analytics
 * Uses structured workout details already stored in workout_logs.notes.
 * Set counts are attributed to each exercise's primary category.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "fitness-custom-exercises-v1";
  const BUILTIN = {
    "Bench Press":"อก","Incline Bench Press":"อก","Decline Bench Press":"อก","Dumbbell Bench Press":"อก","Incline Dumbbell Press":"อก","Chest Fly":"อก","Cable Fly":"อก","Pec Deck":"อก",
    "Lat Pulldown":"หลัง","Pull Up":"หลัง","Chin Up":"หลัง","Seated Cable Row":"หลัง","Barbell Row":"หลัง","Dumbbell Row":"หลัง","Chest Supported Row":"หลัง","Straight Arm Pulldown":"หลัง",
    "Shoulder Press":"ไหล่","Dumbbell Shoulder Press":"ไหล่","Lateral Raise":"ไหล่","Cable Lateral Raise":"ไหล่","Rear Delt Fly":"ไหล่","Face Pull":"ไหล่","Front Raise":"ไหล่",
    "Barbell Curl":"แขนหน้า","Dumbbell Curl":"แขนหน้า","Hammer Curl":"แขนหน้า","Preacher Curl":"แขนหน้า","Cable Curl":"แขนหน้า",
    "Triceps Pushdown":"แขนหลัง","Overhead Triceps Extension":"แขนหลัง","Skull Crusher":"แขนหลัง","Dips":"แขนหลัง",
    "Squat":"ขา","Leg Press":"ขา","Romanian Deadlift":"ขา","Deadlift":"ขา","Leg Extension":"ขา","Leg Curl":"ขา","Lunges":"ขา","Calf Raise":"ขา",
    "Plank":"แกนกลาง","Crunch":"แกนกลาง","Hanging Leg Raise":"แกนกลาง","Cable Crunch":"แกนกลาง",
    "Treadmill":"คาร์ดิโอ / อื่น ๆ","Incline Walk":"คาร์ดิโอ / อื่น ๆ","Stationary Bike":"คาร์ดิโอ / อื่น ๆ","Elliptical":"คาร์ดิโอ / อื่น ๆ","Ping Pong":"คาร์ดิโอ / อื่น ๆ"
  };
  const GROUPS = ["อก","หลัง","ไหล่","แขนหน้า","แขนหลัง","ขา","แกนกลาง"];
  const COLORS = ["#78c995","#69a9d8","#b49be8","#e5ad70","#df8c9c","#d2c56d","#73c8c1"];
  let chart = null;
  let weeks = [];

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function dateOf(row){return String(row.workout_on||row.created_at||"").slice(0,10);}
  function parseDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12);}
  function key(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
  function monday(d){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
  function getGroups(){
    const map={...BUILTIN};
    try{const custom=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");if(Array.isArray(custom))custom.forEach(x=>{if(x?.name&&x?.group)map[x.name]=x.group;});}catch(_){}
    return map;
  }
  function readData(){
    const workouts=(typeof cache!=="undefined"&&Array.isArray(cache.workouts))?cache.workouts:[];
    const category=getGroups(), sessions=[];
    workouts.forEach(w=>{
      const match=String(w.notes||"").match(/\[WORKOUT_V2_JSON\]([\s\S]*?)\[\/WORKOUT_V2_JSON\]/);
      if(!match)return;
      let exercises;try{exercises=JSON.parse(match[1]);}catch(_){return;}
      const date=dateOf(w);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
      const counts=Object.fromEntries(GROUPS.map(g=>[g,0]));
      let total=0;
      (Array.isArray(exercises)?exercises:[]).forEach(ex=>{
        const group=category[String(ex.name||"").trim()];
        if(!GROUPS.includes(group))return;
        const valid=(Array.isArray(ex.sets)?ex.sets:[]).filter(s=>Number(s.reps)>0);
        counts[group]+=valid.length;total+=valid.length;
      });
      if(total)sessions.push({date,counts,total});
    });
    return sessions;
  }
  function makeWeeks(){
    const now=new Date();now.setHours(12,0,0,0);
    weeks=Array.from({length:12},(_,i)=>{const start=monday(now);start.setDate(start.getDate()-7*i);const end=new Date(start);end.setDate(end.getDate()+6);return {start:key(start),end:key(end),label:key(start)+" – "+key(end)};});
    const select=$("muscle-week-select");if(!select)return;
    const previous=select.value;
    select.innerHTML=weeks.map((w,i)=>'<option value="'+i+'">'+(i===0?"สัปดาห์นี้ · ":"")+w.label+'</option>').join("");
    select.value=/^\d+$/.test(previous)&&Number(previous)<weeks.length?previous:"0";
  }
  function render(){
    const root=$("muscle-group-analytics");if(!root||typeof cache==="undefined")return;
    const all=readData();makeWeeks();
    const week=weeks[Number($("muscle-week-select").value)||0];
    const rows=all.filter(x=>x.date>=week.start&&x.date<=week.end);
    const totals=Object.fromEntries(GROUPS.map(g=>[g,rows.reduce((n,r)=>n+r.counts[g],0)]));
    const total=Object.values(totals).reduce((a,b)=>a+b,0);
    const active=GROUPS.filter(g=>totals[g]>0).length;
    $("muscle-total-sets").textContent=total.toLocaleString()+" เซต";
    $("muscle-active-groups").textContent=active+" / "+GROUPS.length+" กลุ่ม";
    $("muscle-training-days").textContent=new Set(rows.map(r=>r.date)).size+" วัน";
    $("muscle-group-list").innerHTML=GROUPS.map((g,i)=>'<div class="muscle-group-row"><span class="muscle-group-dot" style="background:'+COLORS[i]+'"></span><strong>'+g+'</strong><span>'+totals[g]+' เซต</span><div class="muscle-group-track"><i style="width:'+(total?totals[g]/Math.max(...Object.values(totals),1)*100:0)+'%;background:'+COLORS[i]+'"></i></div></div>').join("");
    const ctx=$("muscle-group-chart");
    if(ctx&&typeof Chart!=="undefined"){
      if(chart)chart.destroy();
      chart=new Chart(ctx,{type:"bar",data:{labels:GROUPS,datasets:[{label:"จำนวนเซต",data:GROUPS.map(g=>totals[g]),backgroundColor:COLORS,borderRadius:6}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,color:"#8795a5"},grid:{color:"rgba(140,155,170,.1)"}},y:{ticks:{color:"#aab6c4"},grid:{display:false}}}}});
    }
    $("muscle-group-note").textContent=total?"นับเฉพาะเซตที่มีการกรอก Reps และจัดเข้ากลุ่มกล้ามเนื้อได้ · สัปดาห์เริ่มวันจันทร์":"ยังไม่มีข้อมูลการฝึกที่จัดกลุ่มได้ในสัปดาห์นี้";
  }
  function install(){
    const page=$("page-workout");if(!page||$("muscle-group-analytics"))return;
    const panel=document.createElement("article");panel.id="muscle-group-analytics";panel.className="panel muscle-group-analytics-panel";
    panel.innerHTML='<div class="workout-entry-heading"><div><span class="workout-section-step">04 / MUSCLE BALANCE</span><h3>Muscle Group Analytics</h3><p>ภาพรวมปริมาณการฝึกแยกตามกลุ่มกล้ามเนื้อ</p></div></div><label class="muscle-week-picker">เลือกสัปดาห์<select id="muscle-week-select"></select></label><div class="muscle-group-kpis"><div><small>จำนวนเซตรวม</small><strong id="muscle-total-sets">—</strong></div><div><small>กลุ่มที่ได้ฝึก</small><strong id="muscle-active-groups">—</strong></div><div><small>วันฝึก</small><strong id="muscle-training-days">—</strong></div></div><div class="muscle-group-chart-wrap"><canvas id="muscle-group-chart"></canvas></div><div id="muscle-group-list" class="muscle-group-list"></div><p id="muscle-group-note" class="exercise-analytics-note"></p>';
    const progression=$("exercise-analytics");
    if(progression)progression.insertAdjacentElement("afterend",panel);else page.appendChild(panel);
    $("muscle-week-select").addEventListener("change",render);
    document.addEventListener("fitness-data-loaded",render);
    render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();