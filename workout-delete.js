/* Workout history actions + total calorie column.
   Replaces the older workout-delete.js.
   Works with app.js and fitness-enhancements.js; keeps the intensity field.
*/
(() => {
  "use strict";
  const SUPABASE_URL = "https://ejnmarjkyrzvxfgnnoyf.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_lC5U4hIJqymo0Waw5Mq-mA_s6nrhyRD";
  const LIST_ID = "workout-list";
  let client;
  let busy = false;

  function addStyles() {
    if (document.getElementById("workout-delete-style")) return;
    const style = document.createElement("style");
    style.id = "workout-delete-style";
    style.textContent = `
      #${LIST_ID} td { white-space: nowrap; }
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
    const table = list?.querySelector("table");
    if (!table || !client || busy) return;
    busy = true;
    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) return;

      const { data, error } = await client
        .from("workout_logs")
        .select("id,workout_on,activity_type,name,duration_min,intensity,calories_total")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const head = table.querySelector("thead tr");
      const bodyRows = [...table.querySelectorAll("tbody tr")];
      if (!head) return;

      // Reuse an existing Manage column if one is already present.
      let manageIndex = [...head.children].findIndex(th => th.textContent.trim() === "จัดการ");
      if (manageIndex < 0) {
        const th = document.createElement("th");
        th.textContent = "จัดการ";
        head.appendChild(th);
        manageIndex = head.children.length - 1;
      }

      // Add Total kcal once, immediately after Active kcal when that column exists.
      let totalIndex = [...head.children].findIndex(th => th.textContent.trim() === "Total kcal");
      if (totalIndex < 0) {
        const totalTh = document.createElement("th");
        totalTh.textContent = "Total kcal";
        const activeIndex = [...head.children].findIndex(th => th.textContent.trim() === "Active kcal");
        const insertAt = activeIndex >= 0 ? activeIndex + 1 : manageIndex;
        head.insertBefore(totalTh, head.children[insertAt] || null);
      }

      // Recalculate column positions after inserting Total kcal.
      manageIndex = [...head.children].findIndex(th => th.textContent.trim() === "จัดการ");
      totalIndex = [...head.children].findIndex(th => th.textContent.trim() === "Total kcal");

      bodyRows.forEach((tr, index) => {
        const record = data?.[index];
        if (!record) return;

        // Ensure exactly one delete button in the Manage cell.
        let cells = [...tr.children];
        let manageCell = cells[manageIndex];
        if (!manageCell) {
          manageCell = document.createElement("td");
          tr.appendChild(manageCell);
        }
        if (!manageCell.querySelector(".workout-delete-btn")) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "workout-delete-btn";
          button.textContent = "ลบ";
          button.dataset.workoutDeleteId = record.id;
          manageCell.replaceChildren(button);
        }

        // Keep Total kcal aligned with its header.
        cells = [...tr.children];
        let totalCell = cells[totalIndex];
        if (!totalCell) {
          totalCell = document.createElement("td");
          tr.insertBefore(totalCell, tr.children[totalIndex] || null);
        }
        const totalText = record.calories_total == null
          ? "—"
          : `${Math.round(Number(record.calories_total))} kcal`;
        if (totalCell.textContent !== totalText) totalCell.textContent = totalText;
      });
    } catch (err) {
      console.error("Workout history columns:", err);
    } finally {
      busy = false;
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

      if (typeof window.loadAll === "function") {
        await window.loadAll();
      } else {
        window.location.reload();
      }
      window.alert("ลบประวัติการฝึกแล้ว");
    } catch (err) {
      window.alert("ลบไม่สำเร็จ: " + (err.message || "เกิดข้อผิดพลาด"));
      button.disabled = false;
    }
  }

  function start() {
    const list = document.getElementById(LIST_ID);
    if (!list || !window.supabase) return;
    addStyles();
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const observer = new MutationObserver(() => decorateRows());
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
