import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const SUPABASE_URL='https://ddcwvfvxfpoojafpsyqy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_OtUbIQyOYdBYCgp3DwU1Pg_1ns2C-yq';
const APP_URL='https://mateoespinosag-pixel.github.io/control-gastos/';
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const authView=document.querySelector('#auth-view');
const dashboardView=document.querySelector('#dashboard-view');
const loginForm=document.querySelector('#login-form');
const registerForm=document.querySelector('#register-form');
const tabLogin=document.querySelector('#tab-login');
const tabRegister=document.querySelector('#tab-register');
const authMessage=document.querySelector('#auth-message');
const appMessage=document.querySelector('#app-message');
const logoutButton=document.querySelector('#logout-button');
const forgotPasswordButton=document.querySelector('#forgot-password');
const homeView=document.querySelector('#home-view');
const configureView=document.querySelector('#configure-view');
const incomeInput=document.querySelector('#monthly-income');

let currentUser=null;
let categories=[];
let monthlyBudgets={};
let baseBudgets={};
let activePeriod=null;

function money(value){
  return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(Number(value||0));
}

function monthStart(date=new Date()){
  return new Date(date.getFullYear(),date.getMonth(),1);
}

function monthDateString(date=new Date()){
  const d=monthStart(date);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  return `${y}-${m}-01`;
}

function monthLabel(date=new Date()){
  const value=new Intl.DateTimeFormat('es-EC',{month:'long',year:'numeric'}).format(date);
  return value.charAt(0).toUpperCase()+value.slice(1);
}

function showMessage(message,type='info',target='auth'){
  const el=target==='auth'?authMessage:appMessage;
  el.textContent=message;
  el.className=`message ${type}`;
}

function clearMessage(target='auth'){
  const el=target==='auth'?authMessage:appMessage;
  el.textContent='';
  el.className='message hidden';
}

function setAuthMode(mode){
  clearMessage();
  const isLogin=mode==='login';
  loginForm.classList.toggle('hidden',!isLogin);
  registerForm.classList.toggle('hidden',isLogin);
  tabLogin.classList.toggle('active',isLogin);
  tabRegister.classList.toggle('active',!isLogin);
}

function setView(view){
  clearMessage('app');
  homeView.classList.toggle('hidden',view!=='home');
  configureView.classList.toggle('hidden',view!=='configure');
  document.querySelectorAll('.nav-tab[data-view]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.view===view);
  });
}

tabLogin.addEventListener('click',()=>setAuthMode('login'));
tabRegister.addEventListener('click',()=>setAuthMode('register'));
document.querySelectorAll('.nav-tab[data-view]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
document.querySelector('#go-configure').addEventListener('click',()=>setView('configure'));

loginForm.addEventListener('submit',async(e)=>{
  e.preventDefault(); clearMessage();
  const email=document.querySelector('#login-email').value.trim();
  const password=document.querySelector('#login-password').value;
  const b=loginForm.querySelector('button[type="submit"]');
  b.disabled=true; b.textContent='Ingresando…';
  const {error}=await supabase.auth.signInWithPassword({email,password});
  b.disabled=false; b.textContent='Ingresar';
  if(error){showMessage('No pudimos iniciar sesión. Revisa el correo y la contraseña.','error');return;}
  await renderSession();
});

registerForm.addEventListener('submit',async(e)=>{
  e.preventDefault(); clearMessage();
  const name=document.querySelector('#register-name').value.trim();
  const email=document.querySelector('#register-email').value.trim();
  const password=document.querySelector('#register-password').value;
  const confirmation=document.querySelector('#register-password-confirm').value;
  if(password!==confirmation){showMessage('Las contraseñas no coinciden.','error');return;}
  const b=registerForm.querySelector('button[type="submit"]');
  b.disabled=true; b.textContent='Creando cuenta…';
  const {data,error}=await supabase.auth.signUp({
    email,password,
    options:{data:{name},emailRedirectTo:APP_URL}
  });
  b.disabled=false; b.textContent='Crear cuenta';
  if(error){showMessage(error.message||'No pudimos crear la cuenta.','error');return;}
  if(!data.session){showMessage('Cuenta creada. Revisa tu correo y confirma tu dirección antes de ingresar.','success');return;}
  await renderSession();
});

forgotPasswordButton.addEventListener('click',async()=>{
  clearMessage();
  const email=document.querySelector('#login-email').value.trim();
  if(!email){showMessage('Escribe primero tu correo para enviarte el enlace de recuperación.','error');return;}
  const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:APP_URL});
  if(error){showMessage(error.message||'No pudimos enviar el correo de recuperación.','error');return;}
  showMessage('Te enviamos un correo para recuperar tu contraseña.','success');
});

logoutButton.addEventListener('click',async()=>{await supabase.auth.signOut();await renderSession();});

async function loadProfile(userId){
  const {data,error}=await supabase.from('profiles').select('name').eq('id',userId).single();
  if(error)throw error;
  return data;
}

async function loadCategories(){
  const {data,error}=await supabase.from('categories')
    .select('id,name,sort_order,is_active')
    .eq('is_active',true)
    .order('sort_order',{ascending:true});
  if(error)throw error;
  return data??[];
}

async function loadBaseBudgets(){
  const {data,error}=await supabase.from('base_budgets').select('category_id,budget_amount');
  if(error)throw error;
  return Object.fromEntries((data??[]).map(x=>[x.category_id,Number(x.budget_amount)]));
}

async function loadCurrentPeriod(){
  const date=monthDateString();
  const {data,error}=await supabase.from('monthly_periods')
    .select('id,income,month_date')
    .eq('month_date',date)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function loadMonthlyBudgets(periodId){
  if(!periodId)return {};
  const {data,error}=await supabase.from('monthly_budgets')
    .select('category_id,budget_amount')
    .eq('monthly_period_id',periodId);
  if(error)throw error;
  return Object.fromEntries((data??[]).map(x=>[x.category_id,Number(x.budget_amount)]));
}

function renderHome(){
  const income=Number(activePeriod?.income||0);
  const budgetTotal=categories.reduce((sum,c)=>sum+Number(monthlyBudgets[c.id]??baseBudgets[c.id]??0),0);
  const margin=income-budgetTotal;

  document.querySelector('#current-month-title').textContent=monthLabel();
  document.querySelector('#configure-month-title').textContent=monthLabel();
  document.querySelector('#summary-income').textContent=money(income);
  document.querySelector('#summary-budget').textContent=money(budgetTotal);
  document.querySelector('#summary-margin').textContent=money(margin);
  document.querySelector('#month-status').textContent=activePeriod
    ? 'Tu configuración mensual está guardada.'
    : 'Configura tu ingreso y presupuestos para comenzar.';

  const grid=document.querySelector('#categories-grid');
  document.querySelector('#category-count').textContent=categories.length;
  grid.innerHTML='';
  for(const c of categories){
    const amount=Number(monthlyBudgets[c.id]??baseBudgets[c.id]??0);
    const item=document.createElement('article');
    item.className='category-card';
    item.innerHTML=`<strong></strong><b></b><span>Presupuesto mensual</span>`;
    item.querySelector('strong').textContent=c.name;
    item.querySelector('b').textContent=money(amount);
    grid.appendChild(item);
  }
}

function renderBudgetRows(){
  const income=Number(activePeriod?.income||0);
  incomeInput.value=income||'';
  const rows=document.querySelector('#budget-rows');
  rows.innerHTML='';

  for(const c of categories){
    const amount=Number(monthlyBudgets[c.id]??baseBudgets[c.id]??0);
    const percent=income>0 ? (amount/income*100) : 0;
    const row=document.createElement('div');
    row.className='budget-row';
    row.dataset.categoryId=c.id;
    row.innerHTML=`
      <div class="budget-row-name"></div>
      <div class="money-input"><span>$</span><input class="budget-amount" type="number" min="0" step="0.01" inputmode="decimal"></div>
      <div class="percent-wrap"><input class="budget-percent" type="number" min="0" step="0.1" inputmode="decimal"><span>%</span></div>
    `;
    row.querySelector('.budget-row-name').textContent=c.name;
    row.querySelector('.budget-amount').value=amount||'';
    row.querySelector('.budget-percent').value=percent ? percent.toFixed(1) : '';

    const amountInput=row.querySelector('.budget-amount');
    const percentInput=row.querySelector('.budget-percent');

    amountInput.addEventListener('input',()=>{
      const inc=Number(incomeInput.value||0);
      const val=Number(amountInput.value||0);
      percentInput.value=inc>0 ? (val/inc*100).toFixed(1) : '';
      updateBudgetSummary();
    });

    percentInput.addEventListener('input',()=>{
      const inc=Number(incomeInput.value||0);
      const pct=Number(percentInput.value||0);
      amountInput.value=inc>0 ? (inc*pct/100).toFixed(2) : '';
      updateBudgetSummary();
    });

    rows.appendChild(row);
  }

  updateBudgetSummary();
}

function updateBudgetSummary(){
  const income=Number(incomeInput.value||0);
  let total=0;
  document.querySelectorAll('.budget-amount').forEach(i=>total+=Number(i.value||0));
  const margin=income-total;
  const pct=income>0 ? total/income*100 : 0;
  document.querySelector('#assigned-total').textContent=money(total);
  document.querySelector('#potential-margin').textContent=money(margin);
  document.querySelector('#assigned-percent').textContent=`${pct.toFixed(1)}%`;
  document.querySelector('#budget-warning').classList.toggle('hidden',total<=income || income<=0);
}

incomeInput.addEventListener('input',()=>{
  const income=Number(incomeInput.value||0);
  document.querySelectorAll('.budget-row').forEach(row=>{
    const amount=Number(row.querySelector('.budget-amount').value||0);
    row.querySelector('.budget-percent').value=income>0 ? (amount/income*100).toFixed(1) : '';
  });
  updateBudgetSummary();
});

function collectBudgets(){
  const out={};
  document.querySelectorAll('.budget-row').forEach(row=>{
    out[row.dataset.categoryId]=Number(row.querySelector('.budget-amount').value||0);
  });
  return out;
}

async function saveConfiguration(saveAsBase=false){
  clearMessage('app');
  const income=Number(incomeInput.value||0);
  if(income<=0){showMessage('Ingresa un ingreso mensual mayor a 0.','error','app');return;}

  const budgetMap=collectBudgets();
  const monthDate=monthDateString();

  const {data:period,error:periodError}=await supabase.from('monthly_periods')
    .upsert({
      user_id:currentUser.id,
      month_date:monthDate,
      income
    },{onConflict:'user_id,month_date'})
    .select('id,income,month_date')
    .single();

  if(periodError){showMessage('No pudimos guardar el mes. Inténtalo nuevamente.','error','app');return;}

  const budgetRows=categories.map(c=>({
    user_id:currentUser.id,
    monthly_period_id:period.id,
    category_id:c.id,
    budget_amount:Number(budgetMap[c.id]||0)
  }));

  const {error:budgetError}=await supabase.from('monthly_budgets')
    .upsert(budgetRows,{onConflict:'monthly_period_id,category_id'});

  if(budgetError){showMessage('El mes se guardó, pero hubo un problema con los presupuestos.','error','app');return;}

  if(saveAsBase){
    const baseRows=categories.map(c=>({
      user_id:currentUser.id,
      category_id:c.id,
      budget_amount:Number(budgetMap[c.id]||0)
    }));
    const {error:baseError}=await supabase.from('base_budgets')
      .upsert(baseRows,{onConflict:'user_id,category_id'});
    if(baseError){showMessage('El mes se guardó, pero no pudimos actualizar la configuración base.','error','app');return;}
    baseBudgets={...budgetMap};
  }

  activePeriod=period;
  monthlyBudgets={...budgetMap};
  renderHome();
  renderBudgetRows();
  setView('home');
  showMessage(saveAsBase?'Mes guardado y nueva base actualizada.':'Mes guardado correctamente.','success','app');
}

document.querySelector('#save-month').addEventListener('click',()=>saveConfiguration(false));
document.querySelector('#save-base').addEventListener('click',()=>saveConfiguration(true));

async function refreshAppData(){
  const [loadedCategories,loadedBase,period]=await Promise.all([
    loadCategories(),loadBaseBudgets(),loadCurrentPeriod()
  ]);
  categories=loadedCategories;
  baseBudgets=loadedBase;
  activePeriod=period;
  monthlyBudgets=await loadMonthlyBudgets(period?.id);
  renderHome();
  renderBudgetRows();
}

async function renderSession(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user){
    currentUser=null;
    dashboardView.classList.add('hidden');
    authView.classList.remove('hidden');
    return;
  }

  try{
    currentUser=session.user;
    const profile=await loadProfile(currentUser.id);
    document.querySelector('#welcome-title').textContent=`Hola, ${profile.name}`;
    await refreshAppData();
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    setView('home');
  }catch(error){
    console.error(error);
    showMessage('La sesión está activa, pero no pudimos cargar tus datos. Actualiza la página e inténtalo nuevamente.','error','app');
  }
}

supabase.auth.onAuthStateChange(()=>queueMicrotask(renderSession));
await renderSession();