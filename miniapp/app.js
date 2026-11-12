const tg = window.Telegram?.WebApp;
const $ = (id) => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const state = { profile:null, dashboard:null, organization:null, tab:'home', picked:[] };
const dateTehran = () => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
const money = x => new Intl.NumberFormat('fa-IR').format(Number(x||0));
const statusNames = { submitted:'منتظر تأیید',approved:'تأییدشده',returned:'برگشت خورده',draft:'پیش‌نویس' };
function setNotice(text,ok=false){$('notice').textContent=text;$('notice').className='notice'+(ok?' ok':'');}
function call(name,input={}) {return new Promise((resolve,reject)=>{
  if(!tg?.Serverless?.call){reject(new Error('این فرم باید از داخل مینی‌اپ تلگرام باز شود؛ Serverless API در دسترس نیست.'));return;}
  tg.Serverless.call(name,input,(err,data)=>err?reject(new Error(err.message||'خطا در ارتباط')):resolve(data));
});}
async function refresh(){state.dashboard=await call('getDashboard');if(state.profile.role==='admin')state.organization=await call('manageOrganization',{action:'list'});render();}
async function action(name,payload){try{setNotice('در حال ذخیره اطلاعات…');await call(name,payload);await refresh();setNotice('اطلاعات با موفقیت ثبت شد.',true);}catch(e){setNotice(e.message);}}
function personName(id){return state.dashboard.users.find(x=>x.id===id)?.name||`شناسه ${id}`;}
function customerName(id){return state.dashboard.customers.find(x=>x.id===id)?.name||`مشتری ${id}`;}
function render(){const p=state.profile,d=state.dashboard; $('app').hidden=false;$('avatar').textContent=p.name.trim().slice(0,1);$('welcome').textContent=`سلام، ${p.name}`;$('subheading').textContent=({admin:'مدیر سیستم',supervisor:'سرپرست فروش',rep:'بازاریاب'})[p.role]+' · '+d.date;
 const labels=[['home','گزارش امروز'], ...(p.role==='admin'?[['staff','مدیریت افراد']]:[]),...(p.role==='rep'?[['plan','پیشنهاد مسیر'],['visit','ثبت ویزیت']]:[]),...(p.role!=='rep'?[['review','بررسی مسیرها']]:[])];
 $('tabs').innerHTML=labels.map(([id,label])=>`<button data-tab="${id}" class="${state.tab===id?'active':''}">${label}</button>`).join('');
 $('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
 ({home:renderHome,staff:renderStaff,plan:renderPlan,visit:renderVisit,review:renderReview}[state.tab]||renderHome)();
}
function renderHome(){const s=state.dashboard.summary;
 $('content').innerHTML=`<section class="panel"><h3>خلاصه فعالیت امروز</h3><div class="grid">${[['ویزیت انجام‌شده',s.actual],['سفارش',s.positive],['نرخ تبدیل',s.conversion+'٪'],['تحقق مسیر',s.routeCompletion+'٪']].map(([label,val])=>`<div class="stat"><strong>${typeof val==='string'&&val.endsWith('٪')?escapeHtml(val):money(val)}</strong><span>${label}</span></div>`).join('')}</div><p class="hint">سفارش ثبت‌شده: ${money(s.amountRial)} ریال · خارج از مسیر: ${money(s.offRoute)} · تعطیل: ${money(s.closed)}</p></section>`+
 `<section class="panel"><h3>مسیرها</h3><div class="list">${state.dashboard.routes.slice(0,30).map(r=>`<div class="item"><div><strong>${escapeHtml(personName(r.repId))}</strong><p>${escapeHtml(r.routeDate)} · ${r.stops.length} مشتری</p></div><span class="badge ${r.status==='approved'?'ok':'warn'}">${statusNames[r.status]||r.status}</span></div>`).join('')||'<p class="hint">هنوز مسیری ثبت نشده است.</p>'}</div></section>`;
}
function renderStaff(){const org=state.organization;if(!org){$('content').innerHTML='';return;}
 const options=org.teams.filter(t=>t.active).map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
 $('content').innerHTML=`<section class="panel"><h3>تیم فروش جدید</h3><form id="teamForm"><label>نام تیم</label><input name="name" required maxlength="100" placeholder="مثلاً تیم فروش ۳"/><button class="button">ایجاد تیم</button></form></section>`+
 `<section class="panel"><h3>افزودن یا انتقال بازاریاب / سرپرست</h3><p class="hint">شناسه عددی تلگرام را از پیام /start کارمند دریافت کنید. کاربر قبلی با همان شناسه، به تیم انتخابی منتقل می‌شود.</p><form id="userForm"><label>نام و نام خانوادگی</label><input name="name" required maxlength="150"/><label>شناسه عددی تلگرام</label><input name="telegramId" type="number" inputmode="numeric" required/><label>نقش</label><select name="role"><option value="rep">بازاریاب</option><option value="supervisor">سرپرست</option></select><label>تیم</label><select name="teamId" required>${options}</select><button class="button">ذخیره کاربر</button></form></section>`+
 `<section class="panel"><h3>پرسنل</h3><div class="list">${org.users.filter(x=>x.role!=='admin').map(u=>`<div class="item"><div><strong>${escapeHtml(u.name)}</strong><p>${u.role==='rep'?'بازاریاب':u.role==='supervisor'?'سرپرست':'در انتظار'} · ${escapeHtml(org.teams.find(t=>t.id===u.teamId)?.name||'بدون تیم')} · ${u.telegramId}</p></div><button class="button inline ${u.active?'danger':'secondary'}" data-user="${u.id}" data-active="${!u.active}">${u.active?'غیرفعال‌سازی':'فعال‌سازی'}</button></div>`).join('')||'<p class="hint">پرسنلی ثبت نشده است.</p>'}</div></section>`+
 `<section class="panel"><h3>ثبت مشتری</h3><form id="customerForm"><label>نام فروشگاه</label><input name="name" required/><label>کد مشتری (اختیاری)</label><input name="code"/><label>منطقه</label><input name="area"/><label>آدرس</label><textarea name="address"></textarea><button class="button">افزودن مشتری</button></form></section>`;
 $('teamForm').onsubmit=e=>{e.preventDefault();action('manageOrganization',{action:'createTeam',name:new FormData(e.target).get('name')})};
 $('userForm').onsubmit=e=>{e.preventDefault();action('manageOrganization',{action:'saveUser',...Object.fromEntries(new FormData(e.target))})};
 $('customerForm').onsubmit=e=>{e.preventDefault();action('manageOrganization',{action:'saveCustomer',...Object.fromEntries(new FormData(e.target))})};
 document.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>action('manageOrganization',{action:'setUserStatus',id:Number(b.dataset.user),active:b.dataset.active==='true'}));
}
function renderPlan(){const all=state.dashboard.customers;
 $('content').innerHTML=`<section class="panel"><h3>پیشنهاد مسیر روز کاری بعد</h3><p class="hint">مشتریان را انتخاب کنید؛ ترتیب انتخاب، ترتیب مراجعه خواهد بود.</p><label>تاریخ مسیر (میلادی)</label><input id="planDate" type="date" min="${dateTehran()}"/><label>جستجوی مشتری</label><input id="customerFilter" placeholder="نام یا منطقه مشتری"/><div id="customerChoices" class="list"></div><p class="hint" id="pickedNames"></p><button id="submitPlan" class="button">ارسال برای سرپرست</button></section>`;
 const renderChoices=()=>{const q=$('customerFilter').value.trim();$('customerChoices').innerHTML=all.filter(c=>!q||`${c.name} ${c.area}`.includes(q)).slice(0,100).map(c=>`<label class="check"><input type="checkbox" data-customer="${c.id}" ${state.picked.includes(c.id)?'checked':''}/><span>${escapeHtml(c.name)} <small class="muted">${escapeHtml(c.area)}</small></span></label>`).join('');
 document.querySelectorAll('[data-customer]').forEach(x=>x.onchange=()=>{const id=Number(x.dataset.customer);state.picked=x.checked?[...state.picked,id]:state.picked.filter(v=>v!==id);$('pickedNames').textContent=`${state.picked.length} مشتری: ${state.picked.map(customerName).join(' ← ')}`;});$('pickedNames').textContent=`${state.picked.length} مشتری: ${state.picked.map(customerName).join(' ← ')}`;};
 $('customerFilter').oninput=renderChoices;renderChoices();
 $('submitPlan').onclick=async()=>{await action('manageRoutes',{action:'propose',date:$('planDate').value,customerIds:state.picked});state.picked=[];};
}
function renderReview(){const plans=state.dashboard.routes.filter(r=>r.status==='submitted');
 $('content').innerHTML=`<section class="panel"><h3>مسیرهای منتظر تأیید</h3><div class="list">${plans.map(r=>`<div class="item"><div><strong>${escapeHtml(personName(r.repId))}</strong><p>${escapeHtml(r.routeDate)} · ${r.stops.length} مشتری</p><p>${r.stops.map(s=>escapeHtml(customerName(s.customerId))).join('، ')}</p><textarea id="feedback${r.id}" placeholder="توضیح برگشت (در صورت نیاز)"></textarea></div><div><button class="button inline" data-review="${r.id}" data-decision="approved">تأیید</button><button class="button inline secondary" data-review="${r.id}" data-decision="returned" style="margin-top:6px">برگشت</button></div></div>`).join('')||'<p class="hint">موردی برای بررسی وجود ندارد.</p>'}</div></section>`;
 document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>action('manageRoutes',{action:'review',routeId:Number(b.dataset.review),decision:b.dataset.decision,feedback:$('feedback'+b.dataset.review).value}));
}
function renderVisit(){const d=state.dashboard;
 const todays = d.routes.filter(r=>r.routeDate===d.date&&r.status==='approved');
 const planned = todays.flatMap(r=>r.stops.map(x=>x.customerId));
 const options = d.customers.map(c=>`<option value="${c.id}">${planned.includes(c.id)?'★ ':''}${escapeHtml(c.name)} — ${escapeHtml(c.area)}</option>`).join('');
 $('content').innerHTML=`<section class="panel"><h3>ثبت نتیجه مراجعه</h3><p class="hint">★ نشان‌دهنده مشتری برنامه تأییدشده است. سایر مشتریان به‌عنوان خارج از مسیر ثبت می‌شوند.</p><form id="visitForm"><label>مشتری</label><select name="customerId" required>${options}</select><label>نتیجه</label><select name="result" id="visitResult"><option value="order">سفارش ثبت شد</option><option value="no_order">ویزیت بدون سفارش</option><option value="closed">فروشگاه تعطیل</option><option value="not_visited">مراجعه انجام نشد</option></select><div id="visitAmount"><label>مبلغ سفارش (ریال)</label><input name="amountRial" inputmode="numeric" type="number" min="1" step="1" placeholder="150000000"/></div><div id="visitReason" hidden><label>دلیل عدم سفارش</label><select name="reason"><option value="قیمت">قیمت</option><option value="موجودی مشتری">موجودی کافی مشتری</option><option value="نقدینگی">مشکل نقدینگی</option><option value="سایر">سایر</option></select></div><label>تاریخ پیگیری (اختیاری)</label><input name="followUpDate" type="date"/><label>یادداشت (اختیاری)</label><textarea name="note"></textarea><button class="button">ثبت گزارش ویزیت</button></form></section>`;
 $('visitResult').onchange=()=>{$('visitAmount').hidden=$('visitResult').value!=='order';$('visitReason').hidden=$('visitResult').value!=='no_order';};
 $('visitForm').onsubmit=e=>{e.preventDefault();action('saveVisit',{...Object.fromEntries(new FormData(e.target)),date:dateTehran()})};
}
(async function init(){ try {
  if(!tg?.initData) throw new Error('برای ورود، مینی‌اپ کاویان را از داخل تلگرام باز کنید.');
  tg.ready();tg.expand();state.profile=await call('getProfile');await refresh();setNotice('اتصال امن برقرار شد.',true);
 }catch(e){setNotice(e.message||'اتصال برقرار نشد');} })();
