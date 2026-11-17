/* FoodCheck live API connector for Fitness Tracker
   Search: GET /api/search?q=...
   Detail: GET /api/food/{food.id}
   Nutrition values are read from FoodCheck per_100g; missing nutrients remain null.
*/
(() => {
  const BASE = "https://foodcheck.jocky.website/api";
  const SOURCE = "https://foodcheck.jocky.website/";
  const css = `
  #fcd-food-panel{margin-bottom:18px}
  #fcd-food-panel .fcd-row{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:12px}
  #fcd-food-panel input,#fcd-food-panel select{width:100%;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--text)}
  #fcd-food-panel .fcd-results{display:grid;gap:7px;margin:12px 0;max-height:260px;overflow:auto}
  #fcd-food-panel .fcd-item{display:flex;justify-content:space-between;gap:10px;text-align:left;padding:11px;background:var(--panel2);border:1px solid var(--line);border-radius:9px;color:var(--text);cursor:pointer}
  #fcd-food-panel .fcd-item:hover,#fcd-food-panel .fcd-item.active{border-color:var(--green)}
  #fcd-food-panel .fcd-muted{font-size:12px;color:var(--muted)}
  #fcd-food-panel .fcd-result{padding:14px;background:var(--panel2);border-radius:10px;margin:10px 0}
  #fcd-food-panel .fcd-macros{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
  #fcd-food-panel .fcd-macros div{padding:9px;background:var(--panel);border-radius:8px}
  #fcd-food-panel .fcd-macros b{display:block;font-size:18px}
  #fcd-food-panel .fcd-status{display:inline-block;padding:3px 8px;border-radius:20px;background:rgba(139,215,168,.12);font-size:11px}
  #fcd-food-panel button:disabled{opacity:.45;cursor:not-allowed}
  @media(max-width:650px){#fcd-food-panel .fcd-row{grid-template-columns:1fr}#fcd-food-panel .fcd-macros{grid-template-columns:repeat(2,1fr)}}
  `;
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const numOrNull = value => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
  const fmt = value => value == null ? "ไม่มีข้อมูล" : Number(value).toFixed(2);
  const nutrient = (list, patterns) => {
    const found = (list || []).find(item => {
      const name = String(item.nutrient_name || "").toLowerCase();
      return patterns.some(pattern => pattern.test(name));
    });
    return found ? numOrNull(found.per_100g) : null;
  };

  async function install() {
    const page = document.getElementById("page-food");
    if (!page || document.getElementById("fcd-food-panel")) return;
    const style = make("style"); style.textContent = css; document.head.appendChild(style);
    const panel = make("article", "panel form-panel");
    panel.id = "fcd-food-panel";
    const heading = make("h3", "", "FoodCheck · ค้นหาอาหารจากฐานข้อมูลจริง");
    const intro = make("p", "fcd-muted", "ค้นหาภาษาไทย เลือกเมนู แล้วคำนวณสารอาหารตามน้ำหนักที่กิน โดยอ้างอิงค่าต่อ 100 กรัม");
    const row = make("div", "fcd-row");
    const searchLabel = make("label", "", "ค้นหาอาหาร");
    const search = make("input"); search.type = "search"; search.placeholder = "เช่น กะเพรา, ไข่ต้ม, อกไก่"; search.id = "fcd-search";
    searchLabel.appendChild(search);
    const weightLabel = make("label", "", "น้ำหนักอาหาร (กรัม)");
    const weight = make("input"); weight.type = "number"; weight.min = "1"; weight.step = "1"; weight.value = "250"; weight.id = "fcd-weight";
    weightLabel.appendChild(weight);
    const mealLabel = make("label", "", "มื้ออาหาร");
    const meal = make("select"); meal.id = "fcd-meal";
    ["Breakfast","Lunch","Dinner","Snack"].forEach((v,i)=>{const o=make("option","",v);if(i===1)o.selected=true;meal.appendChild(o)});
    mealLabel.appendChild(meal);
    row.append(searchLabel, weightLabel, mealLabel);
    const results = make("div", "fcd-results"); results.id = "fcd-results";
    const preview = make("div", "fcd-result fcd-muted", "พิมพ์ชื่ออาหารเพื่อค้นหาจาก FoodCheck"); preview.id = "fcd-preview";
    const save = make("button", "primary", "บันทึกลง Food Log"); save.id = "fcd-save"; save.disabled = true;
    const source = make("p", "fcd-muted"); source.append("แหล่งข้อมูล: ");
    const link = make("a", "", "FoodCheck"); link.href = SOURCE; link.target = "_blank"; link.rel = "noopener"; source.appendChild(link);
    const status = make("p", "fcd-muted", "พร้อมค้นหา"); status.id = "fcd-status";
    panel.append(heading,intro,row,results,preview,save,source,status);
    page.insertBefore(panel, page.firstChild);

    let selected = null, detail = null, searchSeq = 0, detailSeq = 0;
    const api = async path => {
      const response = await fetch(BASE + path, { method:"GET", mode:"cors", credentials:"omit", headers:{ "Accept":"application/json" } });
      if (!response.ok) throw new Error("FoodCheck ตอบกลับ HTTP " + response.status);
      return response.json();
    };
    const setStatus = text => { status.textContent = text; };
    const showNutrients = () => {
      if (!selected || !detail) { preview.textContent = "เลือกเมนูเพื่อดูรายละเอียดสารอาหาร"; save.disabled = true; return; }
      const nutrients = detail.nutrients || [];
      const values = {
        kcal: nutrient(nutrients, [/^energy\b/i]),
        protein: nutrient(nutrients, [/^protein\b/i]),
        carbs: nutrient(nutrients, [/carbohydrate/i]),
        fat: nutrient(nutrients, [/^fat\b/i]),
        sodium: nutrient(nutrients, [/^sodium\b/i])
      };
      const grams = Math.max(1, Number(weight.value) || 1), factor = grams / 100;
      const scaled = Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v == null ? null : v*factor]));
      preview.replaceChildren();
      preview.appendChild(make("strong","",detail.food?.name_th || selected.name_th || "อาหารที่เลือก"));
      const grid = make("div","fcd-macros");
      [["พลังงาน",scaled.kcal,"kcal"],["โปรตีน",scaled.protein,"g"],["คาร์บ",scaled.carbs,"g"],["ไขมัน",scaled.fat,"g"]].forEach(([label,value,unit])=>{
        const cell=make("div");cell.append(make("span","fcd-muted",label),make("b","",fmt(value)),make("span","fcd-muted",value==null?"":unit));grid.appendChild(cell);
      });
      preview.appendChild(grid);
      preview.append(make("p","fcd-muted","โซเดียม: "+fmt(scaled.sodium)+(scaled.sodium==null?"":" mg")));
      preview.append(make("p","fcd-muted","ค่าที่แสดงคำนวณจาก "+grams+" กรัม · ข้อมูลต้นทางต่อ 100 กรัม"));
      preview.append(make("p","fcd-muted","รหัสอาหาร: "+(detail.food?.food_code || selected.food_code || "—")+" · "+(detail.food?.source || selected.source || "FoodCheck")));
      const missing = Object.entries(values).filter(([,v])=>v==null).map(([k])=>({kcal:"พลังงาน",protein:"โปรตีน",carbs:"คาร์โบไฮเดรต",fat:"ไขมัน",sodium:"โซเดียม"}[k]));
      if (missing.length) preview.appendChild(make("p","fcd-muted","ไม่มีค่าในแหล่งข้อมูล: "+missing.join(", ")+" (จะไม่เติมค่าแทน)"));
      save.disabled = values.kcal == null;
      detail._parsed = values;
    };

    const choose = async item => {
      selected = item; detail = null; const seq = ++detailSeq;
      results.querySelectorAll(".fcd-item").forEach(n=>n.classList.toggle("active", n.dataset.id === String(item.id)));
      preview.textContent = "กำลังโหลดรายละเอียดสารอาหาร..."; save.disabled = true;
      setStatus("กำลังเรียกข้อมูลรายละเอียดจาก FoodCheck...");
      try {
        const id = String(item.id || ("thaifcd_anamai:" + item.food_code));
        const data = await api("/food/" + encodeURIComponent(id).replace(/%3A/gi, ":"));
        if (seq !== detailSeq) return;
        detail = data;
        if (!detail.food || !Array.isArray(detail.nutrients)) throw new Error("รูปแบบข้อมูลรายละเอียดไม่ตรงกับที่คาดไว้");
        showNutrients(); setStatus("โหลดรายละเอียดสำเร็จ · "+detail.nutrients.length+" รายการสารอาหาร");
      } catch (err) {
        if (seq !== detailSeq) return;
        preview.textContent = "โหลดรายละเอียดไม่สำเร็จ: "+err.message;
        setStatus("หากพบปัญหา CORS อาจต้องใช้ตัวกลางฝั่งเซิร์ฟเวอร์");
      }
    };

    const runSearch = async () => {
      const q = search.value.trim(), seq = ++searchSeq;
      selected = null; detail = null; save.disabled = true; results.replaceChildren();
      if (q.length < 2) { preview.textContent = "พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา"; setStatus("พร้อมค้นหา"); return; }
      preview.textContent = "กำลังค้นหา..."; setStatus("กำลังค้นหาใน FoodCheck...");
      try {
        const data = await api("/search?q="+encodeURIComponent(q));
        if (seq !== searchSeq) return;
        const items = Array.isArray(data.results) ? data.results : [];
        if (!items.length) { preview.textContent = "ไม่พบรายการอาหาร"; setStatus("ค้นหาเสร็จแล้ว · 0 รายการ"); return; }
        items.forEach(item => {
          const button=make("button","fcd-item");button.type="button";button.dataset.id=String(item.id||"");
          const left=make("span");left.appendChild(make("strong","",item.name_th||"ไม่ระบุชื่อ"));
          if(item.name_en)left.appendChild(make("span","fcd-muted",item.name_en));
          button.append(left,make("span","fcd-status",item.status||item.source||"FoodCheck"));
          button.addEventListener("click",()=>choose(item));results.appendChild(button);
        });
        preview.textContent="พบ "+items.length+" รายการ · คลิกเมนูที่ต้องการเพื่อโหลดสารอาหาร";
        setStatus("ค้นหาเสร็จแล้ว · "+items.length+" รายการ");
      } catch(err) {
        if(seq!==searchSeq)return;
        preview.textContent="เชื่อมต่อ FoodCheck ไม่สำเร็จ: "+err.message;
        setStatus("อาจถูกเบราว์เซอร์บล็อกด้วย CORS หรือเครือข่ายไม่พร้อม");
      }
    };

    let searchTimer;
    search.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,300)});
    weight.addEventListener("input",()=>{if(detail)showNutrients()});
    save.addEventListener("click",async()=>{
      try{
        if(!detail||!detail._parsed)return;
        if(typeof db==="undefined"||!db||typeof currentUser==="undefined"||!currentUser)throw new Error("กรุณาเข้าสู่ระบบก่อน");
        const w=Math.max(1,Number(weight.value)||1),factor=w/100,v=detail._parsed,food=detail.food||selected;
        const record={
          user_id:currentUser.id,logged_on:new Date().toLocaleDateString("en-CA"),meal:meal.value,
          name:food.name_th||selected.name_th,serving:w+" g",calories:Math.round(v.kcal*factor),
          protein_g:v.protein==null?null:Number((v.protein*factor).toFixed(2)),
          carbs_g:v.carbs==null?null:Number((v.carbs*factor).toFixed(2)),
          fat_g:v.fat==null?null:Number((v.fat*factor).toFixed(2)),
          notes:"FoodCheck API · "+(food.food_code||selected.food_code||"")+" · ค่าต่อ 100g; ช่องที่ไม่มีข้อมูลคงเป็นค่าว่าง"
        };
        const {error}=await db.from("food_logs").insert(record);if(error)throw error;
        if(typeof toast==="function")toast("บันทึกข้อมูลจาก FoodCheck แล้ว");
        if(typeof loadAll==="function")await loadAll();
      }catch(err){if(typeof toast==="function")toast("บันทึกไม่สำเร็จ: "+err.message,true);else alert(err.message)}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();
