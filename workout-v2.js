/* Workout Tracker V2
 * Adds structured exercise/set entry to the existing workout form.
 * Keeps compatibility with workout_logs.notes; no database migration.
 */
(() => {
  "use strict";
  const form = document.getElementById("workout-form");
  if (!form || document.getElementById("workout-v2-builder")) return;

  const notes = form.elements.notes;
  if (!notes) return;

  const builder = document.createElement("section");
  builder.id = "workout-v2-builder";
  builder.className = "workout-v2-builder wide";
  builder.innerHTML = `
    <div class="workout-v2-heading">
      <div><span class="workout-v2-eyebrow">WORKOUT TRACKER V2</span><h4>บันทึกท่าที่ฝึก</h4>
      <p>เพิ่มท่าและบันทึกจำนวนเซต ครั้ง และน้ำหนัก แยกจากรายละเอียดทั่วไป</p></div>
      <span class="workout-v2-count" id="workout-v2-count">0 ท่า</span>
    </div>
    <div id="workout-v2-exercises" class="workout-v2-exercises"></div>
    <button type="button" class="secondary workout-v2-add" id="workout-v2-add">＋ เพิ่มท่าออกกำลังกาย</button>
    <p class="workout-v2-hint">ข้อมูลท่าฝึกจะถูกแนบไว้ในรายละเอียดของประวัติเดิม ไม่สร้างตารางใหม่และไม่แก้ไขข้อมูลเก่า</p>
  `;

  const notesLabel = notes.closest("label");
  if (notesLabel) notesLabel.insertAdjacentElement("beforebegin", builder);
  else form.insertBefore(builder, form.lastElementChild);

  const list = builder.querySelector("#workout-v2-exercises");
  const count = builder.querySelector("#workout-v2-count");
  let nextId = 0;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));

  function updateCount() {
    const total = list.querySelectorAll(".workout-v2-exercise").length;
    count.textContent = total + " ท่า";
  }

  function addExercise(values = {}) {
    const id = ++nextId;
    const card = document.createElement("article");
    card.className = "workout-v2-exercise";
    card.dataset.exerciseId = String(id);
    card.innerHTML = `
      <div class="workout-v2-exercise-head">
        <strong>ท่าที่ <span class="workout-v2-number"></span></strong>
        <button type="button" class="workout-v2-remove" aria-label="ลบท่านี้">ลบ</button>
      </div>
      <label class="workout-v2-name">ชื่อท่า
        <input type="text" data-field="name" placeholder="เช่น Bench Press, Lat Pulldown" maxlength="100" value="${escapeHtml(values.name || "")}">
      </label>
      <div class="workout-v2-fields">
        <label>จำนวนเซต
          <input type="number" data-field="sets" min="1" max="30" step="1" value="${values.sets || 3}">
        </label>
        <label>จำนวนครั้ง / เซต
          <input type="text" data-field="reps" maxlength="30" placeholder="เช่น 10 หรือ 8-10" value="${escapeHtml(values.reps || "10")}">
        </label>
        <label>น้ำหนัก (kg)
          <input type="number" data-field="weight" min="0" max="1000" step="0.5" placeholder="เช่น 40" value="${values.weight ?? ""}">
        </label>
        <label>RPE (ถ้าต้องการ)
          <input type="number" data-field="rpe" min="1" max="10" step="0.5" placeholder="1–10" value="${values.rpe ?? ""}">
        </label>
      </div>`;
    card.querySelector(".workout-v2-remove").addEventListener("click", () => {
      card.remove();
      renumber();
      updateCount();
    });
    list.appendChild(card);
    renumber();
    updateCount();
  }

  function renumber() {
    list.querySelectorAll(".workout-v2-exercise").forEach((card, index) => {
      card.querySelector(".workout-v2-number").textContent = index + 1;
    });
  }

  function buildExerciseNotes() {
    const rows = [...list.querySelectorAll(".workout-v2-exercise")].map(card => {
      const get = field => card.querySelector('[data-field="' + field + '"]').value.trim();
      const name = get("name");
      if (!name) return null;
      const sets = get("sets") || "3";
      const reps = get("reps") || "—";
      const weight = get("weight");
      const rpe = get("rpe");
      return name + " — " + sets + " เซต × " + reps + " ครั้ง" +
        (weight ? " @ " + weight + " kg" : "") +
        (rpe ? " · RPE " + rpe : "");
    }).filter(Boolean);
    return rows.length ? "[WORKOUT V2]\n" + rows.join("\n") + "\n[/WORKOUT V2]" : "";
  }

  builder.querySelector("#workout-v2-add").addEventListener("click", () => addExercise());

  // Capture phase runs before app.js reads the form values.
  form.addEventListener("submit", () => {
    const generated = buildExerciseNotes();
    const previous = notes.value.replace(/\n?\[WORKOUT V2\][\s\S]*?\[\/WORKOUT V2\]/g, "").trim();
    notes.value = [previous, generated].filter(Boolean).join("\n\n");
  }, true);

  form.addEventListener("reset", () => {
    list.replaceChildren();
    updateCount();
    addExercise();
  });

  addExercise();
})();