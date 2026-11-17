/* Fitness Tracker Free Food Logger — no paid AI/API */
(() => {
const foods=[
["ข้าวกะเพราหมูสับ",580,28,72,20],["ข้าวกะเพราไก่",520,32,70,12],["ข้าวกะเพราหมูกรอบ",720,24,75,34],
["ข้าวผัดหมู",600,22,82,19],["ข้าวผัดไก่",560,27,78,14],["ข้าวมันไก่",650,30,82,18],
["ข้าวไข่เจียว",550,17,68,23],["ข้าวหมูกระเทียม",590,30,75,17],["ข้าวเหนียวหมูปิ้ง",480,22,68,13],
["ผัดไทยกุ้งสด",600,25,82,18],["ผัดซีอิ๊วหมู",650,25,85,22],["ราดหน้าหมู",520,25,72,12],
["ส้มตำไทย",120,3,25,2],["ส้มตำปูปลาร้า",100,4,18,2],["ลาบหมู",250,22,8,14],
["ต้มยำกุ้งน้ำใส",120,18,6,3],["แกงเขียวหวานไก่",350,22,12,24],["แกงจืดเต้าหู้หมูสับ",180,17,8,8],
["ไข่ต้ม",78,6.3,.6,5.3],["ไข่ดาว",190,7,1,17],["ไข่เจียว",250,12,2,21],
["อกไก่ย่าง 100 กรัม",165,31,0,3.6],["อกไก่ต้ม 100 กรัม",150,31,0,3],
["หมูสันในย่าง 100 กรัม",180,29,0,7],["ข้าวสวย 1 ทัพพี",80,1.5,18,.2],
["ข้าวเหนียว 100 กรัม",170,3.5,37,.4],["กล้วยหอม 1 ลูก",105,1.3,27,.4],
["แอปเปิล 1 ลูก",95,.5,25,.3],["นมจืด 1 กล่อง 250 มล.",150,8,12,8],
["เวย์โปรตีน 1 สกู๊ป",120,24,3,2],["โยเกิร์ตรสธรรมชาติ 1 ถ้วย",120,6,14,4],
["แซนด์วิชทูน่า",320,20,35,11],["ขนมปังโฮลวีต 1 แผ่น",75,4,13,1]
].map(([name,calories,protein,carbs,fat])=>({name,calories,protein,carbs,fat}));
const css=`#free-food-logger{margin-bottom:18px}#free-food-logger .ff-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}#free-food-logger input,#free-food-logger select{width:100%;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--text)}#free-food-logger .ff-results{display:grid;gap:6px;margin-top:10px;max-height:220px;overflow:auto}#free-food-logger .ff-result{padding:10px;text-align:left;background:var(--panel2);border:1px solid var(--line);border-radius:9px;color:var(--text)}#free-food-logger .ff-result.active{border-color:var(--green)}#free-food-logger .ff-preview{max-width:180px;max-height:140px;object-fit:cover;border-radius:10px}#free-food-logger .ff-summary{padding:12px;background:var(--panel2);border-radius:10px;margin:10px 0}#free-food-logger .ff-muted{color:var(--muted);font-size:12px}@media(max-width:650px){#free-food-logger .ff-grid{grid-template-columns:1fr}}`;
function install(){
const page=document.getElementById("page-food");if(!page||document.getElementById("free-food-logger"))return;
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
const card=document.createElement("article");card.id="free-food-logger";card.className="panel form-panel";
card.innerHTML=`<h3>เพิ่มอาหารแบบรวดเร็ว · Free</h3><p class="ff-muted">ค้นหาจากฐานข้อมูลอาหารไทยในตัว ไม่เรียก AI และไม่มีค่า API</p><div class="ff-grid"><label>พิมพ์ชื่ออาหาร<input id="ff-search" placeholder="เช่น กะเพราหมูสับ, ไข่ต้ม, อกไก่"></label><label>ถ่ายรูป / เลือกรูป<input id="ff-photo" type="file" accept="image/*" capture="environment"></label><label>จำนวนหน่วย<input id="ff-qty" type="number" min=".25" step=".25" value="1"></label><label>มื้ออาหาร<select id="ff-meal"><option>Breakfast</option><option selected>Lunch</option><option>Dinner</option><option>Snack</option></select></label></div><div id="ff-photo-preview"></div><div id="ff-results" class="ff-results"></div><div id="ff-selected" class="ff-summary">เลือกอาหารจากรายการเพื่อดูสารอาหาร</div><button id="ff-save" class="primary" disabled>บันทึกอาหาร</button>`;
page.insertBefore(card,page.firstChild);
let selected=null,photoName="";const $=id=>document.getElementById(id),search=$("ff-search"),results=$("ff-results"),summary=$("ff-selected"),qty=$("ff-qty"),save=$("ff-save"),fmt=x=>Math.round(x*10)/10;
function update(){if(!selected){summary.textContent="เลือกอาหารจากรายการเพื่อดูสารอาหาร";save.disabled=true;return}const q=Math.max(.25,Number(qty.value)||1);summary.innerHTML=`<strong>${selected.name}</strong><br><strong>${fmt(selected.calories*q)} kcal</strong> · โปรตีน ${fmt(selected.protein*q)} g · คาร์บ ${fmt(selected.carbs*q)} g · ไขมัน ${fmt(selected.fat*q)} g<br><span class="ff-muted">ค่าประมาณตามหน่วยมาตรฐาน ปรับจำนวนหน่วยได้</span>`;save.disabled=false}
function render(){const q=search.value.trim().toLocaleLowerCase("th"),found=foods.filter(f=>!q||f.name.toLocaleLowerCase("th").includes(q)).slice(0,15);results.innerHTML=found.length?found.map(f=>`<button type="button" class="ff-result ${selected===f?"active":""}" data-food="${foods.indexOf(f)}">${f.name} <span class="ff-muted">· ${f.calories} kcal</span></button>`).join(""):`<p class="ff-muted">ไม่พบเมนู ลองคำค้นสั้นลง หรือใช้แบบฟอร์มเดิมกรอกเอง</p>`}
search.addEventListener("input",render);results.addEventListener("click",e=>{const b=e.target.closest("[data-food]");if(!b)return;selected=foods[+b.dataset.food];render();update()});qty.addEventListener("input",update);
$("ff-photo").addEventListener("change",e=>{const file=e.target.files?.[0],preview=$("ff-photo-preview");preview.innerHTML="";photoName=file?.name||"";if(file){const img=document.createElement("img");img.className="ff-preview";img.alt="รูปอาหาร";img.src=URL.createObjectURL(file);preview.appendChild(img);if(typeof toast==="function")toast("เลือกรูปแล้ว กรุณาเลือกชื่ออาหารให้ตรงกับภาพ")}});
save.addEventListener("click",async()=>{try{if(!selected)return;if(typeof db==="undefined"||!db||typeof currentUser==="undefined"||!currentUser)throw Error("กรุณาเข้าสู่ระบบและรอ Supabase เชื่อมต่อ");const q=Math.max(.25,Number(qty.value)||1);const {error}=await db.from("food_logs").insert({user_id:currentUser.id,logged_on:new Date().toLocaleDateString("en-CA"),meal:$("ff-meal").value,name:selected.name,serving:q+" หน่วย",calories:Math.round(selected.calories*q),protein_g:fmt(selected.protein*q),carbs_g:fmt(selected.carbs*q),fat_g:fmt(selected.fat*q),notes:"ประเมินจากฐานข้อมูล Free Food Logger"+(photoName?" · รูป: "+photoName:"")});if(error)throw error;if(typeof toast==="function")toast("บันทึกอาหารแล้ว");selected=null;search.value="";qty.value=1;$("ff-photo").value="";$("ff-photo-preview").innerHTML="";photoName="";render();update();if(typeof loadAll==="function")await loadAll()}catch(err){if(typeof toast==="function")toast("บันทึกไม่สำเร็จ: "+err.message,true);else alert(err.message)}});
render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();