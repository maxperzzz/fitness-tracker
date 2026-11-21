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
    if (!list || !client || busy) return;
    const cards = [...list.querySelectorAll("[data-workout-card-id]")];
    if (!cards.length) return;
    busy = true;
    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) return;
      const { data, error } = await client
        .from("workout_logs")
        .select("id,calories_total")
        .eq("user_id", user.id)
        .in("id", cards.map(card => card.dataset.workoutCardId));
      if (error) throw error;
      const byId = new Map((data || []).map(record => [record.id, record]));
      cards.forEach(card => {
        const record = byId.get(card.dataset.workoutCardId);
        if (!record) return;
        const calories = card.querySelector("[data-workout-calories]");
        if (calories) calories.textContent = record.calories_total == null
          ? "แคลอรีรวม —" : "แคลอรีรวม " + Math.round(Number(record.calories_total)) + " kcal";
      });
    } catch (err) {
      console.error("Workout card details:", err);
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
