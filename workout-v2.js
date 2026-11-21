/* Workout Tracker V2 - exercise dropdown and per-set logging.
 * Persists structured sets inside the existing workout_logs.notes field.
 * No database migration; existing workout history remains untouched.
 */
(() => {
  "use strict";
  const form = document.getElementById("workout-form");
  if (!form || document.getElementById("workout-v2-builder")) return;
  const notes = form.elements.notes;
  if (!notes) return;

  const EXERCISES = [
    ["อก","Bench Press"],["อก","Incline Bench Press"],["อก","Decline Bench Press"],["อก","Dumbbell Bench Press"],["อก","Incline Dumbbell Press"],["อก","Chest Fly"],["อก","Cable Fly"],["อก","Pec Deck"],
    ["หลัง","Lat Pulldown"],["หลัง","Pull Up"],["หลัง","Chin Up"],["หลัง","Seated Cable Row"],["หลัง","Barbell Row"],["หลัง","Dumbbell Row"],["หลัง","Chest Supported Row"],["หลัง","Straight Arm Pulldown"],
    ["ไหล่","Shoulder Press"],["ไหล่","Dumbbell Shoulder Press"],["ไหล่","Lateral Raise"],["ไหล่","Cable Lateral Raise"],["ไหล่","Rear Delt Fly"],["ไหล่","Face Pull"],["ไหล่","Front Raise"],
    ["แขนหน้า","Barbell Curl"],["แขนหน้า","Dumbbell Curl"],["แขนหน้า","Hammer Curl"],["แขนหน้า","Preacher Curl"],["แขนหน้า","Cable Curl"],
    ["แขนหลัง","Triceps Pushdown"],["แขนหลัง","Overhead Triceps Extension"],["แขนหลัง","Skull Crusher"],["แขนหลัง","Dips"],
    ["ขา","Squat"],["ขา","Leg Press"],["ขา","Romanian Deadlift"],["ขา","Deadlift"],["ขา","Leg Extension"],["ขา","Leg Curl"],["ขา","Lunges"],["ขา","Calf Raise"],
    ["แกนกลาง","Plank"],["แกนกลาง","Crunch"],["แกนกลาง","Hanging Leg Raise"],["แกนกลาง","Cable Crunch"],
    ["คาร์ดิโอ / อื่น ๆ","Treadmill"],["คาร์ดิโอ / อื่น ๆ","Incline Walk"],["คาร์ดิโอ / อื่น ๆ","Stationary Bike"],["คาร์ดิโอ / อื่น ๆ","Elliptical"],["คาร์ดิโอ / อื่น ๆ","Ping Pong"]
  ];

  const builder = document.createElement("section");
  builder.id = "workout-v2-builder";
  builder.className = "workout-v2-builder wide";
  builder.innerHTML = `
    <div class="workout-v2-heading">
      <div><span class="workout-v2-eyebrow">WORKOUT TRACKER V2</span><h4>บันทึกท่าที่ฝึก</h4>
      <p>เลือกท่าจากรายการ แล้วกรอกจำนวนครั้งและน้ำหนักแยกเป็นรายเซต</p></div>
      <span class="workout-v2-count" id="workout-v2-count">0 ท่า</span>
    </div>
    <div id="workout-v2-exercises" class="workout-v2-exercises"></div>
    <button type="button" class="secondary workout-v2-add" id="workout-v2-add">＋ เพิ่มท่าออกกำลังกาย</button>
    <p class="workout-v2-hint">ข้อมูลจะถูกบันทึกในประวัติเดิม โดยไม่สร้างตารางใหม่และไม่กระทบข้อมูลเก่า</p>`;
  const notesLabel = notes.closest("label");
  if (notesLabel) notesLabel.insertAdjacentElement("beforebegin", builder);
  else form.insertBefore(builder, form.lastElementChild);

  const list = builder.querySelector("#workout-v2-exercises");
  const count = builder.querySelector("#workout-v2-count");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  function options(selected = "") {
    const groups = {};
    EXERCISES.forEach(([group,name]) => (groups[group] ||= []).push(name));
    return '<option value="">เลือกท่าออกกำลังกาย</option>' + Object.entries(groups).map(([group,names]) =>
      '<optgroup label="' + esc(group) + '">' + names.map(name =>
        '<option value="' + esc(name) + '"' + (name === selected ? " selected" : "") + '>' + esc(name) + '</option>'
      ).join("") + '</optgroup>'
    ).join("");
  }

  function renumber() {
    list.querySelectorAll(".workout-v2-exercise").forEach((card,index) => {
      card.querySelector(".workout-v2-number").textContent = index + 1;
    });
    count.textContent = list.querySelectorAll(".workout-v2-exercise").length + " ท่า";
  }

  function addSet(container, values = {}) {
    const row = document.createElement("div");
    row.className = "workout-v2-set";
    row.innerHTML = `
      <span class="workout-v2-set-number"></span>
      <label>Reps<input type="number" data-set-field="reps" min="0" max="500" step="1" placeholder="10" value="${esc(values.reps ?? "")}"></label>
      <label>น้ำหนัก (kg)<input type="number" data-set-field="weight" min="0" max="1000" step="0.5" placeholder="เช่น 40" value="${esc(values.weight ?? "")}"></label>
      <button type="button" class="workout-v2-remove-set" aria-label="ลบเซต">×</button>`;
    row.querySelector("button").addEventListener("click", () => {
      row.remove();
      renumberSets(container);
    });
    container.appendChild(row);
    renumberSets(container);
  }

  function renumberSets(container) {
    container.querySelectorAll(".workout-v2-set").forEach((row,index) => {
      row.querySelector(".workout-v2-set-number").textContent = "Set " + (index + 1);
    });
  }

  function addExercise(values = {}) {
    const card = document.createElement("article");
    card.className = "workout-v2-exercise";
    card.innerHTML = `
      <div class="workout-v2-exercise-head"><strong>ท่าที่ <span class="workout-v2-number"></span></strong>
        <button type="button" class="workout-v2-remove">ลบ</button></div>
      <label class="workout-v2-name">เลือกท่าออกกำลังกาย
        <select data-exercise-name>${options(values.name || "")}</select>
      </label>
      <div class="workout-v2-sets-heading"><strong>รายละเอียดแต่ละเซต</strong><span>กำหนด Reps และน้ำหนักแยกกันได้</span></div>
      <div class="workout-v2-sets"></div>
      <button type="button" class="secondary workout-v2-add-set">＋ เพิ่มเซต</button>`;
    const sets = card.querySelector(".workout-v2-sets");
    (values.sets?.length ? values.sets : [{},{},{}]).forEach(set => addSet(sets,set));
    card.querySelector(".workout-v2-add-set").addEventListener("click", () => addSet(sets));
    card.querySelector(".workout-v2-remove").addEventListener("click", () => { card.remove(); renumber(); });
    list.appendChild(card);
    renumber();
  }

  function collectExercises() {
    return [...list.querySelectorAll(".workout-v2-exercise")].map(card => {
      const name = card.querySelector("[data-exercise-name]").value;
      const sets = [...card.querySelectorAll(".workout-v2-set")].map(row => ({
        reps: row.querySelector('[data-set-field="reps"]').value.trim(),
        weight: row.querySelector('[data-set-field="weight"]').value.trim()
      })).filter(set => set.reps !== "" || set.weight !== "");
      return {name,sets};
    }).filter(ex => ex.name && ex.sets.length);
  }

  builder.querySelector("#workout-v2-add").addEventListener("click", () => addExercise());

  // Build data before the existing app.js submit handler reads the form.
  form.addEventListener("submit", () => {
    const generated = collectExercises();
    const previous = notes.value
      .replace(/\n?\\[WORKOUT_V2\\][\\s\\S]*?\\[\\/WORKOUT_V2\\]/g,"")
      .replace(/\n?\\[WORKOUT_V2_JSON\\][\\s\\S]*?\\[\\/WORKOUT_V2_JSON\\]/g,"").trim();
    const marker = generated.length
      ? "[WORKOUT_V2_JSON]" + JSON.stringify(generated) + "[/WORKOUT_V2_JSON]"
      : "";
    notes.value = [previous,marker].filter(Boolean).join("\n\n");
  }, true);

  form.addEventListener("reset", () => {
    list.replaceChildren();
    addExercise();
  });
  addExercise();
})();