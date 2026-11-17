/* FoodCheck connector via Supabase Edge Function (CORS-safe proxy).
   Requires deployed function named foodcheck-proxy with JWT verification enabled.
*/
(() => {
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
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
  const value=(list,regex)=>{const x=(list||[]).find(n=>regex.test(String(n.nutrient_name||"")));return x&&x.per_100g!=null&&Number.isFinite(Number(x.per_100g))?Number(x.per_100g):null};
  const fmt=v=>v==null?"ไม่มีข้อมูล":(Number(v).toFixed(2));
  async function install(){
    const page=document.getElementById("page-food");
    if(!page||document.getElementById("fcd-food-panel"))return;
    const style=make("style");style.textContent=css;document.head.appendChild(style);
    const panel=make("article","panel form-panel");panel.id="fcd-food-panel";
    const h=make("h3","","FoodCheck · ค้นหาอาหารจากฐานข้อมูลจริง");
    const intro=make("p","fcd-muted","ค้นหาภาษาไทย เลือกเมนู แล้วคำนวณตามน้ำหนักที่กิน โดยอ้างอิงค่าต่อ 100 กรัม");
    const row=make("div","fcd-row");
    const sl=make("label","","ค้นหาอาหาร"),search=make("input");search.type="search";search.placeholder="เช่น กะเพรา, ไข่ต้ม, อกไก่";sl.append(search);
    const wl=make("label","","น้ำหนักอาหาร (กรัม)"),weight=make("input");weight.type="number";weight.min="1";weight.step="1";weight.value="250";wl.append(weight);
    const ml=make("label","","มื้ออาหาร"),meal=make("select");["Breakfast","Lunch","Dinner","Snack"].forEach((x,i)=>{const o=make("option","",x);if(i===1)o.selected=true;meal.append(o)});ml.append(meal);
    row.append(sl,wl,ml);
    const results=make("div","fcd-results"),preview=make("div","fcd-result fcd-muted","พิมพ์ชื่ออาหารเพื่อค้นหา"),save=make("button","primary","บันทึกลง Food Log");save.disabled=true;
    const src=make("p","fcd-muted");src.append("แหล่งข้อมูล: ");const a=make("a","","FoodCheck");a.href=SOURCE;a.target="_blank";a.rel="noopener";src.append(a);
    const status=make("p","fcd-muted","พร้อมค้นหา");
    panel.append(h,intro,row,results,preview,save,src,status);page.insertBefore(panel,page.firstChild);
    let selected=null,detail=null,searchSeq=0,detailSeq=0;
    async function invoke(payload){
      if(typeof db==="undefined"||!db)throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
      const {data,error}=await db.functions.invoke("foodcheck-proxy",{body:payload});
      if(error)throw new Error(error.message||"เรียก Edge Function ไม่สำเร็จ");
      if(data?.error)throw new Error(data.error);
      return data;
    }
    function renderDetail(){
      if(!detail||!selected)return;
      const ns=detail.nutrients||[];
      const base={
        kcal:value(ns,/^energy\b/i),protein:value(ns,/^protein\b/i),
        carbs:value(ns,/carbohydrate/i),fat:value(ns,/^fat\b/i),sodium:value(ns,/^sodium\b/i)
      };
      const grams=Math.max(1,Number(weight.value)||1),factor=grams/100;
      const v=Object.fromEntries(Object.entries(base).map(([k,n])=>[k,n==null?null:n*factor]));
      preview.replaceChildren();preview.append(make("strong","",detail.food?.name_th||selected.name_th||"อาหารที่เลือก"));
      const grid=make("div","fcd-macros");
      [["พลังงาน",v.kcal,"kcal"],["โปรตีน",v.protein,"g"],["คาร์บ",v.carbs,"g"],["ไขมัน",v.fat,"g"]].forEach(([label,n,unit])=>{const cell=make("div");cell.append(make("span","fcd-muted",label),make("b","",fmt(n)),make("span","fcd-muted",n==null?"":unit));grid.append(cell)});
      preview.append(grid,make("p","fcd-muted","โซเดียม: "+fmt(v.sodium)+(v.sodium==null?"":" mg")),make("p","fcd-muted","คำนวณจาก "+grams+" กรัม · ข้อมูลต้นทางต่อ 100 กรัม"));
      const missing=Object.entries(base).filter(([,n])=>n==null).map(([k])=>({kcal:"พลังงาน",protein:"โปรตีน",carbs:"คาร์โบไฮเดรต",fat:"ไขมัน",sodium:"โซเดียม"}[k]));
      if(missing.length)preview.append(make("p","fcd-muted","ไม่มีค่าในแหล่งข้อมูล: "+missing.join(", ")+" (ไม่เติมค่าประมาณ)"));
      detail._base=base;save.disabled=base.kcal==null;
    }
    async function choose(item){
      selected=item;detail=null;const seq=++detailSeq;save.disabled=true;preview.textContent="กำลังโหลดรายละเอียด...";
      results.querySelectorAll(".fcd-item").forEach(b=>b.classList.toggle("active",b.dataset.id===String(item.id)));
      status.textContent="กำลังโหลดข้อมูลรายละเอียด...";
      try{
        const data=await invoke({action:"detail",id:String(item.id||"")});
        if(seq!==detailSeq)return;
        if(!data.food||!Array.isArray(data.nutrients))throw new Error("รูปแบบข้อมูลรายละเอียดไม่ถูกต้อง");
        detail=data;renderDetail();status.textContent="โหลดรายละเอียดสำเร็จ · "+data.nutrients.length+" รายการสารอาหาร";
      }catch(e){if(seq!==detailSeq)return;preview.textContent="โหลดรายละเอียดไม่สำเร็จ: "+e.message;status.textContent="ตรวจสอบว่าได้ติดตั้ง Edge Function แล้ว"};
    }
    async function runSearch(){
      const q=search.value.trim(),seq=++searchSeq;selected=null;detail=null;save.disabled=true;results.replaceChildren();
      if(q.length<2){preview.textContent="พิมพ์อย่างน้อย 2 ตัวอักษร";return}
      preview.textContent="กำลังค้นหา...";status.textContent="กำลังค้นหาใน FoodCheck...";
      try{
        const data=await invoke({action:"search",q});if(seq!==searchSeq)return;
        const items=Array.isArray(data.results)?data.results:[];
        if(!items.length){preview.textContent="ไม่พบรายการอาหาร";status.textContent="ค้นหาเสร็จแล้ว · 0 รายการ";return}
        items.forEach(item=>{const b=make("button","fcd-item");b.type="button";b.dataset.id=String(item.id||"");const left=make("span");left.append(make("strong","",item.name_th||"ไม่ระบุชื่อ"));if(item.name_en)left.append(make("span","fcd-muted",item.name_en));b.append(left,make("span","fcd-status",item.status||item.source||"FoodCheck"));b.addEventListener("click",()=>choose(item));results.append(b)});
        preview.textContent="พบ "+items.length+" รายการ · คลิกเมนูที่ต้องการ";status.textContent="ค้นหาเสร็จแล้ว · "+items.length+" รายการ";
      }catch(e){if(seq!==searchSeq)return;preview.textContent="เชื่อมต่อไม่สำเร็จ: "+e.message;status.textContent="ตรวจสอบ Edge Function และสถานะ Supabase"};
    }
    let timer;search.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(runSearch,300)});
    weight.addEventListener("input",()=>{if(detail)renderDetail()});
    save.addEventListener("click",async()=>{
      try{
        if(!detail||!detail._base)return;
        if(typeof currentUser==="undefined"||!currentUser)throw new Error("กรุณาเข้าสู่ระบบก่อน");
        const w=Math.max(1,Number(weight.value)||1),f=w/100,b=detail._base,food=detail.food||selected;
        const {error}=await db.from("food_logs").insert({
          user_id:currentUser.id,logged_on:new Date().toLocaleDateString("en-CA"),meal:meal.value,
          name:food.name_th||selected.name_th,serving:w+" g",calories:Math.round(b.kcal*f),
          protein_g:b.protein==null?null:Number((b.protein*f).toFixed(2)),
          carbs_g:b.carbs==null?null:Number((b.carbs*f).toFixed(2)),
          fat_g:b.fat==null?null:Number((b.fat*f).toFixed(2)),
          notes:"FoodCheck API · "+(food.food_code||selected.food_code||"")+" · สารอาหารต่อ 100 กรัม"
        });
        if(error)throw error;
        if(typeof toast==="function")toast("บันทึกข้อมูลจาก FoodCheck แล้ว");
        if(typeof loadAll==="function")await loadAll();
      }catch(e){if(typeof toast==="function")toast("บันทึกไม่สำเร็จ: "+e.message,true);else alert(e.message)}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();
