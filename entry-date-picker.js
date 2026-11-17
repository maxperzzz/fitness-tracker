/* Add retrospective date selection to Food and Workout forms.
   Load this file AFTER app.js, food-fcd.js and ai-food.js.
*/
(() => {
  "use strict";

  const localToday = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  function addDateField(formId, fieldName, labelText) {
    const form = document.getElementById(formId);
    if (!form || form.querySelector(`[name="${fieldName}"]`)) return;

    const label = document.createElement("label");
    label.className = "wide";
    label.textContent = labelText;

    const input = document.createElement("input");
    input.type = "date";
    input.name = fieldName;
    input.required = true;
    input.value = localToday();

    label.appendChild(input);
    form.insertBefore(label, form.firstElementChild);
  }

  function installDateOverride(formId, fieldName, tableName, columnName) {
    const form = document.getElementById(formId);
    if (!form) return;

    // Capture phase runs before the existing app.js submit handler.
    form.addEventListener("submit", () => {
      const chosenDate = form.elements[fieldName]?.value;
      if (!chosenDate || typeof db === "undefined" || !db) return;

      const originalFrom = db.from;
      db.from = function (table) {
        const builder = originalFrom.call(this, table);
        if (table !== tableName) return builder;

        return new Proxy(builder, {
          get(target, property) {
            if (property === "insert") {
              return (values, options) => {
                const applyDate = row => ({ ...row, [columnName]: chosenDate });
                const datedValues = Array.isArray(values)
                  ? values.map(applyDate)
                  : applyDate(values);
                return target.insert(datedValues, options);
              };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          }
        });
      };

      // app.js starts its async submit handler immediately after this listener.
      // Its insert call is synchronous up to the Supabase request.
      window.setTimeout(() => {
        if (db && db.from !== originalFrom) db.from = originalFrom;
      }, 0);
    }, true);
  }

  function init() {
    addDateField("food-form", "entry_date_food", "วันที่บันทึกอาหาร");
    addDateField("workout-form", "entry_date_workout", "วันที่ออกกำลังกาย");

    installDateOverride(
      "food-form", "entry_date_food", "food_logs", "logged_on"
    );
    installDateOverride(
      "workout-form", "entry_date_workout", "workout_logs", "workout_on"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
