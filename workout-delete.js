/* Workout history: delete individual entries.
   Add <script src="workout-delete.js"></script> after app.js in index.html.
*/
(() => {
  "use strict";

  const SUPABASE_URL = "https://ejnmarjkyrzvxfgnnoyf.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_lC5U4hIJqymo0Waw5Mq-mA_s6nrhyRD";
  const LIST_ID = "workout-list";
  let client;
  let refreshQueued = false;

  function addStyles() {
    if (document.getElementById("workout-delete-style")) return;
    const style = document.createElement("style");
    style.id = "workout-delete-style";
    style.textContent = `
      #${LIST_ID} td:last-child { white-space: nowrap; }
      #${LIST_ID} .workout-delete-btn {
        padding: 6px 10px; border: 1px solid var(--line, #444);
        border-radius: 8px; background: transparent; color: var(--text, inherit);
        cursor: pointer; font: inherit; font-size: 12px;
      }
      #${LIST_ID} .workout-delete-btn:hover { border-color: #e07b7b; color: #e07b7b; }
    `;
    document.head.appendChild(style);
  }

  async function decorateRows() {
    const list = document.getElementById(LIST_ID);
    if (!list || !client || refreshQueued) return;
    refreshQueued = true;

    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) return;

      const { data, error } = await client
        .from("workout_logs")
        .select("id,workout_on,activity_type,name,duration_min,intensity")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const table = list.querySelector("table");
      if (!table) return;

      const headRow = table.querySelector("thead tr");
      if (headRow && !headRow.querySelector("[data-workout-delete-heading]")) {
        const th = document.createElement("th");
        th.textContent = "จัดการ";
        th.dataset.workoutDeleteHeading = "1";
        headRow.appendChild(th);
      }

      const rows = [...table.querySelectorAll("tbody tr")];
      rows.forEach((tr, index) => {
        if (tr.querySelector(".workout-delete-btn")) return;
        const record = data?.[index];
        if (!record) return;

        const td = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workout-delete-btn";
        button.textContent = "ลบ";
        button.dataset.workoutDeleteId = record.id;
        td.appendChild(button);
        tr.appendChild(td);
      });
    } catch (err) {
      console.error("Workout delete UI:", err);
    } finally {
      refreshQueued = false;
    }
  }

  async function deleteWorkout(id, button) {
    if (!id || !client) return;
    if (!window.confirm("ยืนยันลบประวัติการฝึกนี้ใช่ไหม?")) return;

    button.disabled = true;
    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("กรุณาเข้าสู่ระบบใหม่");

      const { error } = await client
        .from("workout_logs")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      window.alert("ลบประวัติการฝึกแล้ว");
      const list = document.getElementById(LIST_ID);
      if (list) list.innerHTML = "กำลังโหลดข้อมูล...";
      const { data: rows, error: loadError } = await client
        .from("workout_logs")
        .select("id,workout_on,activity_type,name,duration_min,intensity")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (loadError) throw loadError;

      renderWorkoutTable(list, rows || []);
    } catch (err) {
      window.alert("ลบไม่สำเร็จ: " + (err.message || "เกิดข้อผิดพลาด"));
      button.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "—").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function renderWorkoutTable(list, rows) {
    if (!list) return;
    if (!rows.length) {
      list.textContent = "ยังไม่มีข้อมูล";
      return;
    }
    const columns = [
      ["workout_on", "วันที่"],
      ["activity_type", "ประเภท"],
      ["name", "กิจกรรม"],
      ["duration_min", "นาที"],
      ["intensity", "ความหนัก"]
    ];
    list.innerHTML = `
      <table><thead><tr>
        ${columns.map(c => `<th>${c[1]}</th>`).join("")}<th>จัดการ</th>
      </tr></thead><tbody>
        ${rows.map(r => `<tr>
          ${columns.map(c => `<td>${escapeHtml(r[c[0]])}</td>`).join("")}
          <td><button type="button" class="workout-delete-btn" data-workout-delete-id="${escapeHtml(r.id)}">ลบ</button></td>
        </tr>`).join("")}
      </tbody></table>`;
  }

  function start() {
    const list = document.getElementById(LIST_ID);
    if (!list || !window.supabase) return;

    addStyles();
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const observer = new MutationObserver(() => {
      if (list.querySelector("table")) decorateRows();
    });
    observer.observe(list, { childList: true, subtree: true });
    decorateRows();

    list.addEventListener("click", event => {
      const button = event.target.closest("[data-workout-delete-id]");
      if (button) deleteWorkout(button.dataset.workoutDeleteId, button);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
