/* Thai FCD food logger add-on for Fitness Tracker
   Loads verified records from thai-fcd-foods.json. Does not invent nutrition values. */
(() => {
  const SOURCE = "https://inmu.mahidol.ac.th/thaifcd/home";
  const DATA_URL = "thai-fcd-foods.json";
  const css = `
  #fcd-food-panel{margin-bottom:18px}
  #fcd-food-panel .fcd-row{display:grid;grid-template-columns:1.4fr 1fr;gap:12px}
  #fcd-food-panel input,#fcd-food-panel select{width:100%;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--text)}
  #fcd-food-panel .fcd-results{display:grid;gap:7px;margin:12px 0;max-height:230px;overflow:auto}
  #fcd-food-panel .fcd-item{display:flex;justify-content:space-between;gap:10px;text-align:left;padding:11px;background:var(--panel2);border:1px solid var(--line);border-radius:9px;color:var(--text)}
  #fcd-food-panel .fcd-item.active{border-color:var(--green)}
  #fcd-food-panel .fcd-muted{font-size:12px;color:var(--muted)}
  #fcd-food-panel .fcd-result{padding:14px;background:var(--panel2);border-radius:10px;margin:10px 0}
  #fcd-food-panel .fcd-macros{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
  #fcd-food-panel .fcd-macros div{padding:9px;background:var(--panel);border-radius:8px}
  #fcd-food-panel .fcd-macros b{display:block;font-size:18px}
  #fcd-food-panel .fcd-status{display:inline-block;padding:3px 8px;border-radius:20px;background:rgba(139,215,168,.12);font-size:11px}
  #fcd-food-panel button:disabled{opacity:.45;cursor:not-allowed}
  @media(max-width:650px){#fcd-food-panel .fcd-row{grid-template-columns:1fr}#fcd-food-panel .fcd-macros{grid-template-columns:repeat(2,1fr)}}
  `;
  const el = (tag, attrs={}, html="") => {
    const n=document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>k==="class"?n.className=v:k==="text"?n.textContent=v:n.setAttribute(k,v));
    n.innerHTML=html; return n;
  };
  async function install(){
    const page=document.getElementById("page-food");
    if(!page || document.getElementById("fcd-food-panel")) return;
    const style=el("style"); style.textContent=css; document.head.appendChild(style);
    const panel=el("article",{id:"fcd-food-panel",class:"panel form-panel"},`
      <h3>Thai FCD · ฐานข้อมูลอาหารอ้างอิง</h3>
      <p class="fcd-muted">คำนวณสารอาหารจากน้ำหนักอาหารจริง โดยใช้ค่าต่อ 100 กรัม · ไม่เติมตัวเลขที่ยังไม่มีแหล่งอ้างอิง</p>
      <div class="fcd-row">
        <label>ค้นหาเมนู<input id="fcd-search" placeholder="เช่น ข้าวกะเพรา, ข้าวผัด, ผัดไทย"></label>
        <label>น้ำหนักอาหาร (กรัม)<input id="fcd-weight" type="number" min="1" step="1" value="250"></label>
        <label>มื้ออาหาร<select id="fcd-meal"><option>Breakfast</option><option selected>Lunch</option><option>Dinner</option><option>Snack</option></select></label>
      </div>
      <div id="fcd-results" class="fcd-results"></div>
      <div id="fcd-preview" class="fcd-result fcd-muted">เลือกเมนูที่มีข้อมูลตรวจสอบแล้ว เพื่อดูผลคำนวณ</div>
      <button id="fcd-save" class="primary" disabled>บันทึกลง Food Log</button>
      <p class="fcd-muted" style="margin-top:10px">แหล่งข้อมูล: <a href="${SOURCE}" target="_blank" rel="noopener">Thai FCD – Institute of Nutrition, Mahidol University</a></p>
      <p id="fcd-count" class="fcd-muted">กำลังโหลดฐานข้อมูล...</p>
    `);
    page.insertBefore(panel,page.firstChild);
    const $=id=>document.getElementById(id);
    let foods=[],selected=null;
    try {
      const response=await fetch(DATA_URL,{cache:"no-store"});
      if(!response.ok) throw new Error("โหลดไฟล์ฐานข้อมูลไม่ได้ ("+response.status+")");
      const db=await response.json();
      foods=Array.isArray(db.foods)?db.foods:[];
      $("fcd-count").textContent=`ข้อมูลที่ตรวจสอบแล้ว ${foods.length} เมนู · เมนูเป้าหมาย ${db.planned_foods?.length||0} รายการ · ฐานข้อมูล ${db.source?.database||"Thai FCD"}`;
    } catch(err) {
      $("fcd-count").textContent="ไม่สามารถโหลด thai-fcd-foods.json ได้: "+err.message;
    }
    function calc(food,weight){
      const factor=weight/100;
      return {
        kcal:food.kcal_100g*factor, protein:food.protein_100g*factor,
        carbs:food.carbs_100g*factor, fat:food.fat_100g*factor,
        sodium:food.sodium_mg_100g==null?null:food.sodium_mg_100g*factor
      };
    }
    function render(){
      const q=$("fcd-search").value.trim().toLocaleLowerCase("th");
      const matches=foods.filter(f=>(f.name_th||"").toLocaleLowerCase("th").includes(q)||(f.name_en||"").toLowerCase().includes(q)).slice(0,30);
      $("fcd-results").innerHTML=matches.length?matches.map((f,i)=>`<button type="button" class="fcd-item ${selected===f?"active":""}" data-index="${foods.indexOf(f)}"><span><b>${f.name_th}</b><br><span class="fcd-muted">${f.name_en||""}</span></span><span class="fcd-status">${f.source_status==="analysed"?"Thai FCD · วิเคราะห์":"Thai FCD · คำนวณ"}</span></button>`).join(""):`<p class="fcd-muted">ยังไม่มีรายการที่ผ่านการตรวจสอบตรงกับคำค้นนี้ ฐานข้อมูลจะไม่แสดงค่าประมาณแทนข้อมูลอ้างอิง</p>`;
      update();
    }
    function update(){
      const weight=Math.max(1,Number($("fcd-weight").value)||1),save=$("fcd-save");
      if(!selected){$("fcd-preview").textContent="เลือกเมนูที่มีข้อมูลตรวจสอบแล้ว เพื่อดูผลคำนวณ";save.disabled=true;return}
      const v=calc(selected,weight);
      $("fcd-preview").innerHTML=`<b>${selected.name_th}</b> · <span class="fcd-status">${selected.source_status==="analysed"?"วิเคราะห์ในฐานข้อมูล":"คำนวณตามฐานข้อมูล"}</span>
      <div class="fcd-macros">
        <div><span class="fcd-muted">พลังงาน</span><b>${v.kcal.toFixed(1)}</b><span class="fcd-muted">kcal</span></div>
        <div><span class="fcd-muted">โปรตีน</span><b>${v.protein.toFixed(1)}</b><span class="fcd-muted">g</span></div>
        <div><span class="fcd-muted">คาร์บ</span><b>${v.carbs.toFixed(1)}</b><span class="fcd-muted">g</span></div>
        <div><span class="fcd-muted">ไขมัน</span><b>${v.fat.toFixed(1)}</b><span class="fcd-muted">g</span></div>
      </div>
      <p class="fcd-muted">ค่าต่อ 100 g: ${selected.kcal_100g} kcal · P ${selected.protein_100g} g · C ${selected.carbs_100g} g · F ${selected.fat_100g} g</p>
      <p class="fcd-muted">รหัสอาหาร: ${selected.food_code||"—"} · ${selected.source_label||"Thai FCD"} · <a href="${selected.source_url||SOURCE}" target="_blank" rel="noopener">เปิดแหล่งอ้างอิง</a></p>`;
      save.disabled=false;
    }
    $("fcd-search").addEventListener("input",()=>{selected=null;render()});
    $("fcd-results").addEventListener("click",e=>{
      const b=e.target.closest("[data-index]");if(!b)return;
      selected=foods[Number(b.dataset.index)];render();
    });
    $("fcd-weight").addEventListener("input",update);
    $("fcd-save").addEventListener("click",async()=>{
      try{
        if(!selected)return;
        if(typeof db==="undefined"||!db||typeof currentUser==="undefined"||!currentUser)throw Error("กรุณาเข้าสู่ระบบก่อน");
        const w=Math.max(1,Number($("fcd-weight").value)||1),v=calc(selected,w);
        const {error}=await db.from("food_logs").insert({
          user_id:currentUser.id,logged_on:new Date().toLocaleDateString("en-CA"),
          meal:$("fcd-meal").value,name:selected.name_th,serving:w+" g",
          calories:Math.round(v.kcal),protein_g:Number(v.protein.toFixed(1)),
          carbs_g:Number(v.carbs.toFixed(1)),fat_g:Number(v.fat.toFixed(1)),
          notes:`Thai FCD reference · ${selected.food_code||""} · per 100 g: ${selected.kcal_100g} kcal, P ${selected.protein_100g}g, C ${selected.carbs_100g}g, F ${selected.fat_100g}g · ${selected.source_url||SOURCE}`
        });
        if(error)throw error;
        if(typeof toast==="function")toast("บันทึกข้อมูลอ้างอิงแล้ว");
        if(typeof loadAll==="function")await loadAll();
      }catch(err){if(typeof toast==="function")toast("บันทึกไม่สำเร็จ: "+err.message,true);else alert(err.message)}
    });
    render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();
