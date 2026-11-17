/* AI Food Estimator - UI scaffold only.
   No external AI/API calls are made in this version.
*/
(() => {
  "use strict";

  const STYLE_ID = "ai-food-estimator-style";
  const PANEL_ID = "ai-food-panel";

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function install() {
    const page = document.getElementById("page-food");
    const form = document.getElementById("food-form");

    if (!page || !form || document.getElementById(PANEL_ID)) return;

    if (!document.getElementById(STYLE_ID)) {
      const style = make("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${PANEL_ID} { margin-bottom: 18px; }
        #${PANEL_ID} .ai-food-muted { color: var(--muted, #9aa7b8); font-size: 12px; line-height: 1.6; }
        #${PANEL_ID} .ai-food-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 12px; }
        #${PANEL_ID} label { display: block; font-size: 13px; color: var(--text, #e8edf5); }
        #${PANEL_ID} input, #${PANEL_ID} select {
          display: block; width: 100%; box-sizing: border-box; margin-top: 7px;
          padding: 11px; border: 1px solid var(--line, #303a48); border-radius: 10px;
          background: var(--panel2, #202833); color: var(--text, #e8edf5); font: inherit;
        }
        #${PANEL_ID} .ai-food-status {
          display: flex; align-items: center; gap: 9px; margin-top: 13px; padding: 12px;
          border: 1px solid var(--line, #303a48); border-radius: 10px;
          background: var(--panel2, #202833); font-size: 13px;
        }
        #${PANEL_ID} .ai-food-dot { width: 8px; height: 8px; border-radius: 50%; background: #e9b875; flex: none; }
        #${PANEL_ID} .ai-food-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
        #${PANEL_ID} button:disabled { opacity: .5; cursor: not-allowed; }
        @media (max-width: 650px) { #${PANEL_ID} .ai-food-grid { grid-template-columns: 1fr; } }
      `;
      document.head.appendChild(style);
    }

    const panel = make("article", "panel form-panel");
    panel.id = PANEL_ID;

    panel.append(
      make("h3", "", "AI Food Estimator · ประเมินโภชนาการด้วย AI"),
      make("p", "ai-food-muted", "โหมดแยกจาก FoodCheck สำหรับประเมินอาหารทั่วไป โดยจะแสดงค่าพลังงานและสารอาหารให้ตรวจสอบก่อนบันทึกลง Food Log")
    );

    const grid = make("div", "ai-food-grid");

    const foodLabel = make("label", "", "ชื่ออาหาร / เมนู");
    const food = make("input");
    food.type = "text";
    food.placeholder = "เช่น ข้าวกะเพราหมูสับไข่ดาว";
    foodLabel.appendChild(food);

    const portionLabel = make("label", "", "ปริมาณที่รับประทาน");
    const portion = make("input");
    portion.type = "text";
    portion.placeholder = "เช่น 1 จาน หรือ 250 กรัม";
    portionLabel.appendChild(portion);

    const mealLabel = make("label", "", "มื้ออาหาร");
    const meal = make("select");
    ["Breakfast", "Lunch", "Dinner", "Snack"].forEach((value) => {
      const option = make("option", "", value);
      if (value === "Lunch") option.selected = true;
      meal.appendChild(option);
    });
    mealLabel.appendChild(meal);

    grid.append(foodLabel, portionLabel, mealLabel);

    const status = make("div", "ai-food-status");
    status.append(
      make("span", "ai-food-dot"),
      make("span", "", "หน้าจอเตรียมพร้อมแล้ว · ยังไม่ได้เชื่อมต่อ AI")
    );

    const actions = make("div", "ai-food-actions");
    const estimate = make("button", "primary", "ประเมินด้วย AI");
    estimate.type = "button";
    estimate.disabled = true;
    estimate.title = "รอเชื่อมต่อ OpenAI API";

    const clear = make("button", "secondary", "ล้างข้อมูล");
    clear.type = "button";
    clear.addEventListener("click", () => {
      food.value = "";
      portion.value = "";
      meal.value = "Lunch";
      food.focus();
    });
    actions.append(estimate, clear);

    panel.append(
      grid,
      status,
      actions,
      make("p", "ai-food-muted", "สถานะ: โหมดเตรียมระบบ (ไม่มีการเรียก API และไม่มีค่าใช้จ่าย) · เมื่อเชื่อมต่อ AI แล้ว ระบบจะแสดง Calories, Protein, Carbs และ Fat ให้ตรวจสอบก่อนบันทึก")
    );

    const currentFoodPanel = form.closest(".panel");
    page.insertBefore(panel, currentFoodPanel || page.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
