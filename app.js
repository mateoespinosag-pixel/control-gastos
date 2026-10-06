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
const transactionsView=document.querySelector('#transactions-view');
const comparisonsView=document.querySelector('#comparisons-view');
const transactionForm=document.querySelector('#transaction-form');
const incomeInput=document.querySelector('#monthly-income');

let currentUser=null;
let categories=[];
let allCategories=[];
let monthlyBudgets={};
let baseBudgets={};
let activePeriod=null;
let transactions=[];
let historicalPeriods=[];
let allTransactions=[];
let allMonthlyBudgets=[];
let selectedMonthDate=monthDateString();
let comparisonCurrentPeriod=null;

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
  transactionsView.classList.toggle('hidden',view!=='transactions');
  comparisonsView.classList.toggle('hidden',view!=='comparisons');
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
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  b.disabled=false; b.textContent='Ingresar';
  if(error){showMessage('No pudimos iniciar sesión. Revisa el correo y la contraseña.','error');return;}

  if(data?.session?.user){
    currentUser=data.session.user;
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    setView('home');
  }

  try{
    await renderSession();
  }catch(err){
    console.error(err);
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    showMessage('Ingresaste correctamente. Hubo un problema al refrescar una parte de los datos.','error','app');
  }
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
    .order('sort_order',{ascending:true});
  if(error)throw error;
  return data??[];
}

async function loadBaseBudgets(){
  const {data,error}=await supabase.from('base_budgets').select('category_id,budget_amount');
  if(error)throw error;
  return Object.fromEntries((data??[]).map(x=>[x.category_id,Number(x.budget_amount)]));
}

async function loadPeriod(monthDate=selectedMonthDate){
  const {data,error}=await supabase.from('monthly_periods')
    .select('id,income,month_date')
    .eq('month_date',monthDate)
    .maybeSingle();
  if(error)throw error;
  return data;
}

async function loadTransactions(periodId){
  if(!periodId)return [];
  const {data,error}=await supabase.from('transactions')
    .select('id,transaction_date,description,amount,category_id,created_at')
    .eq('monthly_period_id',periodId)
    .order('transaction_date',{ascending:false})
    .order('created_at',{ascending:false});
  if(error)throw error;
  return data??[];
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
  const spentTotal=transactions.reduce((sum,t)=>sum+Number(t.amount||0),0);
  const available=income-spentTotal;
  const savingsRate=income>0 ? (available/income*100) : 0;

  document.querySelector('#current-month-title').textContent=monthLabel(new Date(selectedMonthDate+'T12:00:00'));
  document.querySelector('#configure-month-title').textContent=monthLabel(new Date(selectedMonthDate+'T12:00:00'));
  document.querySelector('#transactions-month-title').textContent=monthLabel(new Date(selectedMonthDate+'T12:00:00'));
  document.querySelector('#summary-income').textContent=money(income);
  document.querySelector('#summary-spent').textContent=money(spentTotal);
  document.querySelector('#summary-available').textContent=money(available);
  document.querySelector('#summary-savings-rate').textContent=`${savingsRate.toFixed(1)}%`;
  document.querySelector('#month-status').textContent=activePeriod
    ? 'Tu configuración mensual está guardada.'
    : 'Configura tu ingreso y presupuestos para comenzar.';

  const spentByCategory={};
  for(const t of transactions){
    spentByCategory[t.category_id]=(spentByCategory[t.category_id]||0)+Number(t.amount||0);
  }

  const grid=document.querySelector('#categories-grid');
  document.querySelector('#category-count').textContent=categories.length;
  grid.innerHTML='';
  for(const c of categories){
    const budget=Number(monthlyBudgets[c.id]??baseBudgets[c.id]??0);
    const spent=Number(spentByCategory[c.id]||0);
    const remaining=budget-spent;
    const pct=budget>0 ? spent/budget*100 : 0;
    const item=document.createElement('article');
    const level=budget<=0 ? (spent>0?'danger':'unassigned') : pct>=90?'danger':pct>=70?'warning':'healthy';
    item.className=`category-card level-${level}`;
    item.innerHTML='<div class="category-top"><strong></strong><span class="category-chip"></span></div><b></b><span class="category-status"></span><div class="category-progress" role="progressbar" aria-valuemin="0"><span></span></div>';
    item.querySelector('strong').textContent=c.name;
    item.querySelector('b').textContent=`${money(spent)} / ${money(budget)}`;
    const chip=item.querySelector('.category-chip');
    const status=item.querySelector('.category-status');
    if(budget<=0){
      chip.textContent=spent>0?'Sin presupuesto':'Sin asignar';
      status.textContent=spent>0?`Gastado sin presupuesto: ${money(spent)}`:'Asigna un presupuesto';
    }else if(spent>budget){
      chip.textContent=`Excedido · ${Math.round(pct)}%`;
      status.textContent=`Excedido por ${money(spent-budget)}`;
    }else if(pct>=90){
      chip.textContent=`Al límite · ${Math.round(pct)}%`;
      status.textContent=`Solo quedan ${money(remaining)}`;
    }else if(pct>=70){
      chip.textContent=`Atención · ${Math.round(pct)}%`;
      status.textContent=`Disponible: ${money(remaining)}`;
    }else{
      chip.textContent=`En orden · ${Math.round(pct)}%`;
      status.textContent=`Disponible: ${money(remaining)}`;
    }
    const progress=item.querySelector('.category-progress');
    progress.setAttribute('aria-valuenow',String(Math.max(0,Math.round(pct))));
    progress.setAttribute('aria-label',`${c.name}: ${Math.round(pct)}% consumido`);
    progress.querySelector('span').style.width=`${Math.max(0,Math.min(pct,100))}%`;
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
  const monthDate=selectedMonthDate;

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

function renderTransactionForm(){
  const select=document.querySelector('#transaction-category');
  select.innerHTML='<option value="">Selecciona una categoría</option>';
  for(const c of categories){
    const option=document.createElement('option');
    option.value=c.id;
    option.textContent=c.name;
    select.appendChild(option);
  }
  const today=new Date();
  const isCurrentMonth=selectedMonthDate===monthDateString();
  document.querySelector('#transaction-date').value=isCurrentMonth?today.toISOString().slice(0,10):selectedMonthDate;
  const submitButton=transactionForm.querySelector('button[type="submit"]');
  submitButton.disabled=!isCurrentMonth;
  submitButton.textContent=isCurrentMonth?'Registrar gasto':'Solo mes actual';
}

function renderTransactions(){
  const list=document.querySelector('#transactions-list');
  const empty=document.querySelector('#transactions-empty');
  const total=transactions.reduce((sum,t)=>sum+Number(t.amount||0),0);
  document.querySelector('#transactions-total').textContent=money(total);
  list.innerHTML='';
  empty.classList.toggle('hidden',transactions.length>0);
  for(const t of transactions){
    const category=allCategories.find(c=>c.id===t.category_id);
    const row=document.createElement('div');
    row.className='transaction-row';
    row.innerHTML='<span class="transaction-date"></span><span class="transaction-description"></span><span class="transaction-category"></span><span class="transaction-amount"></span><button class="icon-button" type="button" aria-label="Eliminar">×</button>';
    row.querySelector('.transaction-date').textContent=new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short'}).format(new Date(t.transaction_date+'T12:00:00'));
    row.querySelector('.transaction-description').textContent=t.description;
    row.querySelector('.transaction-category').textContent=category?.name||'Sin categoría';
    row.querySelector('.transaction-amount').textContent=money(t.amount);
    row.querySelector('.icon-button').addEventListener('click',()=>deleteTransaction(t.id));
    list.appendChild(row);
  }
}

transactionForm.addEventListener('submit',async(e)=>{
  e.preventDefault(); clearMessage('app');
  if(selectedMonthDate!==monthDateString()){showMessage('Los movimientos solo se registran en el mes calendario actual. Vuelve al mes actual para ingresar gastos.','error','app');return;}
  if(!activePeriod){showMessage('Primero configura el mes actual.','error','app');setView('configure');return;}
  const transactionDate=document.querySelector('#transaction-date').value;
  const description=document.querySelector('#transaction-description').value.trim();
  const categoryId=document.querySelector('#transaction-category').value;
  const amount=Number(document.querySelector('#transaction-amount').value||0);
  if(!transactionDate||!description||!categoryId||amount<=0){showMessage('Completa todos los campos del gasto.','error','app');return;}
  if(transactionDate.slice(0,7)!==selectedMonthDate.slice(0,7)){showMessage('La fecha debe pertenecer al mes seleccionado.','error','app');return;}
  const button=transactionForm.querySelector('button[type="submit"]');
  button.disabled=true; button.textContent='Guardando…';
  const {data,error}=await supabase.from('transactions').insert({
    user_id:currentUser.id,
    monthly_period_id:activePeriod.id,
    category_id:categoryId,
    transaction_date:transactionDate,
    description,
    amount
  }).select('id,transaction_date,description,amount,category_id,created_at').single();
  button.disabled=false; button.textContent='Registrar gasto';
  if(error){showMessage('No pudimos registrar el gasto. Inténtalo nuevamente.','error','app');return;}
  transactions.unshift(data);
  transactionForm.reset();
  renderTransactionForm();
  renderTransactions();
  renderHome();
  showMessage('Gasto registrado correctamente.','success','app');
});

async function deleteTransaction(id){
  const {error}=await supabase.from('transactions').delete().eq('id',id);
  if(error){showMessage('No pudimos eliminar el movimiento.','error','app');return;}
  transactions=transactions.filter(t=>t.id!==id);
  renderTransactions();
  renderHome();
  showMessage('Movimiento eliminado.','success','app');
}

async function loadHistoricalData(){
  const currentMonth=monthDateString();
  const [{data:periods,error:periodError},{data:tx,error:txError},{data:budgets,error:budgetError},{data:currentPeriod,error:currentError}]=await Promise.all([
    supabase.from('monthly_periods').select('id,income,month_date').lt('month_date',currentMonth).order('month_date',{ascending:true}),
    supabase.from('transactions').select('monthly_period_id,category_id,amount,transaction_date'),
    supabase.from('monthly_budgets').select('monthly_period_id,category_id,budget_amount'),
    supabase.from('monthly_periods').select('id,income,month_date').eq('month_date',currentMonth).maybeSingle()
  ]);
  if(periodError)throw periodError;
  if(txError)throw txError;
  if(budgetError)throw budgetError;
  if(currentError)throw currentError;
  historicalPeriods=periods??[];
  allTransactions=tx??[];
  allMonthlyBudgets=budgets??[];
  comparisonCurrentPeriod=currentPeriod;
}

function monthLabelFromDateString(dateString){
  const d=new Date(dateString+'T12:00:00');
  const value=new Intl.DateTimeFormat('es-EC',{month:'short',year:'numeric'}).format(d);
  return value.charAt(0).toUpperCase()+value.slice(1);
}

function historicalRows(){
  const totals={};
  for(const p of historicalPeriods)totals[p.id]=0;
  for(const t of allTransactions){
    if(Object.prototype.hasOwnProperty.call(totals,t.monthly_period_id)){
      totals[t.monthly_period_id]+=Number(t.amount||0);
    }
  }
  return historicalPeriods.map(p=>{
    const income=Number(p.income||0);
    const spent=Number(totals[p.id]||0);
    const savings=income-spent;
    return {...p,income,spent,savings,rate:income>0?savings/income*100:0};
  });
}

function renderComparisons(){
  const rows=historicalRows();
  const currentIncome=Number(comparisonCurrentPeriod?.income||0);
  const currentSpent=comparisonCurrentPeriod
    ? allTransactions.filter(t=>t.monthly_period_id===comparisonCurrentPeriod.id).reduce((s,t)=>s+Number(t.amount||0),0)
    : 0;
  const currentSavings=currentIncome-currentSpent;

  document.querySelector('#comparison-current-month').textContent=monthLabel();
  document.querySelector('#comparison-current-income').textContent=money(currentIncome);
  document.querySelector('#comparison-current-spent').textContent=money(currentSpent);
  document.querySelector('#comparison-current-savings').textContent=money(currentSavings);

  const count=rows.length;
  const avgSpent=count?rows.reduce((s,r)=>s+r.spent,0)/count:0;
  const avgSavings=count?rows.reduce((s,r)=>s+r.savings,0)/count:0;
  const avgRate=count?rows.reduce((s,r)=>s+r.rate,0)/count:0;
  document.querySelector('#history-month-count').textContent=count;
  document.querySelector('#history-average-spent').textContent=money(avgSpent);
  document.querySelector('#history-average-savings').textContent=money(avgSavings);
  document.querySelector('#history-average-rate').textContent=`${avgRate.toFixed(1)}%`;

  const bars=document.querySelector('#history-bars');
  bars.innerHTML='';
  const recent=rows.slice(-12);
  const maxSpent=Math.max(1,...recent.map(r=>r.spent));
  for(const r of recent){
    const row=document.createElement('div');
    row.className='history-bar-row';
    row.innerHTML='<span class="history-bar-label"></span><div class="history-bar-track"><span></span></div><span class="history-bar-value"></span>';
    row.querySelector('.history-bar-label').textContent=monthLabelFromDateString(r.month_date);
    row.querySelector('.history-bar-track span').style.width=`${Math.max(2,r.spent/maxSpent*100)}%`;
    row.querySelector('.history-bar-value').textContent=money(r.spent);
    bars.appendChild(row);
  }

  const tbody=document.querySelector('#history-table-body');
  tbody.innerHTML='';
  for(const r of [...rows].reverse()){
    const tr=document.createElement('tr');
    tr.innerHTML='<td></td><td></td><td></td><td></td><td></td>';
    const tds=tr.querySelectorAll('td');
    tds[0].textContent=monthLabelFromDateString(r.month_date);
    tds[1].textContent=money(r.income);
    tds[2].textContent=money(r.spent);
    tds[3].textContent=money(r.savings);
    tds[3].className=r.savings>=0?'positive':'negative';
    tds[4].textContent=`${r.rate.toFixed(1)}%`;
    tds[4].className=r.rate>=0?'positive':'negative';
    tbody.appendChild(tr);
  }

  const select=document.querySelector('#comparison-category');
  const selected=select.value;
  select.innerHTML='';
  for(const cat of allCategories){
    const option=document.createElement('option');
    option.value=cat.id;
    option.textContent=cat.name;
    select.appendChild(option);
  }
  if(selected && allCategories.some(c=>c.id===selected))select.value=selected;
  renderCategoryHistory(select.value || allCategories[0]?.id);
}

function renderCategoryHistory(categoryId){
  const box=document.querySelector('#category-history');
  box.innerHTML='';
  if(!categoryId)return;
  const rows=historicalRows().slice(-12);
  const budgetMap={};
  for(const b of allMonthlyBudgets){
    if(b.category_id===categoryId)budgetMap[b.monthly_period_id]=Number(b.budget_amount||0);
  }
  const spentMap={};
  for(const t of allTransactions){
    if(t.category_id===categoryId)spentMap[t.monthly_period_id]=(spentMap[t.monthly_period_id]||0)+Number(t.amount||0);
  }
  const maxValue=Math.max(1,...rows.flatMap(r=>[spentMap[r.id]||0,budgetMap[r.id]||0]));
  for(const r of rows){
    const spent=Number(spentMap[r.id]||0);
    const budget=Number(budgetMap[r.id]||0);
    const item=document.createElement('div');
    item.className='category-history-row';
    item.innerHTML='<span class="category-month"></span><div class="category-track"><span></span></div><span class="category-value"></span>';
    item.querySelector('.category-month').textContent=monthLabelFromDateString(r.month_date);
    item.querySelector('.category-track span').style.width=`${Math.max(2,spent/maxValue*100)}%`;
    item.querySelector('.category-value').textContent=`${money(spent)} / ${money(budget)}`;
    box.appendChild(item);
  }
}

document.querySelector('#comparison-category').addEventListener('change',(e)=>renderCategoryHistory(e.target.value));


function renderCategoryManager(){
  const list=document.querySelector('#category-manager-list');
  if(!list)return;
  list.innerHTML='';

  allCategories.forEach((cat,index)=>{
    const row=document.createElement('div');
    row.className='category-manager-row';
    row.dataset.categoryId=cat.id;
    row.innerHTML=`
      <input class="category-name-input" type="text" maxlength="60">
      <div class="category-actions">
        <button class="small-button move-up" type="button" title="Subir">↑</button>
        <button class="small-button move-down" type="button" title="Bajar">↓</button>
        <button class="small-button save-name" type="button">Guardar</button>
      </div>
      <button class="status-button" type="button"></button>
    `;

    const nameInput=row.querySelector('.category-name-input');
    nameInput.value=cat.name;

    const up=row.querySelector('.move-up');
    const down=row.querySelector('.move-down');
    up.disabled=index===0;
    down.disabled=index===allCategories.length-1;
    up.addEventListener('click',()=>moveCategory(cat.id,-1));
    down.addEventListener('click',()=>moveCategory(cat.id,1));

    row.querySelector('.save-name').addEventListener('click',()=>renameCategory(cat.id,nameInput.value));

    const status=row.querySelector('.status-button');
    status.textContent=cat.is_active?'Activa':'Inactiva';
    status.className=`status-button ${cat.is_active?'active':'inactive'}`;
    status.addEventListener('click',()=>toggleCategory(cat.id,!cat.is_active));

    list.appendChild(row);
  });
}

async function refreshCategoriesOnly(){
  const loaded=await loadCategories();
  allCategories=loaded;
  categories=loaded.filter(c=>c.is_active);
  baseBudgets=await loadBaseBudgets();
  monthlyBudgets=await loadMonthlyBudgets(activePeriod?.id);
  await loadHistoricalData();
  renderHome();
  renderBudgetRows();
  renderTransactionForm();
  renderTransactions();
  renderComparisons();
  renderCategoryManager();
  renderCategoryManager();
}

async function renameCategory(categoryId,newName){
  clearMessage('app');
  const clean=(newName||'').trim();
  if(!clean){showMessage('El nombre de la categoría no puede quedar vacío.','error','app');return;}

  const duplicate=allCategories.some(c=>c.id!==categoryId && c.name.toLowerCase()===clean.toLowerCase());
  if(duplicate){showMessage('Ya existe una categoría con ese nombre.','error','app');return;}

  const {error}=await supabase.from('categories').update({name:clean}).eq('id',categoryId);
  if(error){showMessage('No pudimos renombrar la categoría.','error','app');return;}

  await refreshCategoriesOnly();
  showMessage('Categoría renombrada. El historial se mantiene asociado.','success','app');
}

async function toggleCategory(categoryId,nextActive){
  clearMessage('app');
  const activeCount=allCategories.filter(c=>c.is_active).length;
  if(!nextActive && activeCount<=1){showMessage('Debes mantener al menos una categoría activa.','error','app');return;}

  const {error}=await supabase.from('categories').update({is_active:nextActive}).eq('id',categoryId);
  if(error){showMessage('No pudimos cambiar el estado de la categoría.','error','app');return;}

  await refreshCategoriesOnly();
  showMessage(nextActive?'Categoría activada.':'Categoría desactivada. Su historial sigue disponible.','success','app');
}

async function moveCategory(categoryId,direction){
  const index=allCategories.findIndex(c=>c.id===categoryId);
  const otherIndex=index+direction;
  if(index<0 || otherIndex<0 || otherIndex>=allCategories.length)return;

  const current=allCategories[index];
  const other=allCategories[otherIndex];
  const currentOrder=current.sort_order;
  const otherOrder=other.sort_order;

  const {error:firstError}=await supabase.from('categories').update({sort_order:otherOrder}).eq('id',current.id);
  if(firstError){showMessage('No pudimos cambiar el orden.','error','app');return;}

  const {error:secondError}=await supabase.from('categories').update({sort_order:currentOrder}).eq('id',other.id);
  if(secondError){
    await supabase.from('categories').update({sort_order:currentOrder}).eq('id',current.id);
    showMessage('No pudimos completar el cambio de orden.','error','app');
    return;
  }

  await refreshCategoriesOnly();
}

document.querySelector('#toggle-category-manager').addEventListener('click',()=>{
  const body=document.querySelector('#category-manager-body');
  const button=document.querySelector('#toggle-category-manager');
  const willOpen=body.classList.contains('hidden');
  body.classList.toggle('hidden',!willOpen);
  button.textContent=willOpen?'Cerrar administrador':'Administrar categorías';
});

document.querySelector('#new-category-form').addEventListener('submit',async(e)=>{
  e.preventDefault();
  clearMessage('app');
  const input=document.querySelector('#new-category-name');
  const name=input.value.trim();
  if(!name)return;

  if(allCategories.some(c=>c.name.toLowerCase()===name.toLowerCase())){
    showMessage('Ya existe una categoría con ese nombre.','error','app');
    return;
  }

  const nextOrder=(Math.max(0,...allCategories.map(c=>Number(c.sort_order)||0)))+1;
  const {data:newCategory,error}=await supabase.from('categories')
    .insert({user_id:currentUser.id,name,sort_order:nextOrder,is_active:true})
    .select('id,name,sort_order,is_active')
    .single();

  if(error){showMessage('No pudimos crear la categoría.','error','app');return;}

  const {error:baseError}=await supabase.from('base_budgets').insert({
    user_id:currentUser.id,
    category_id:newCategory.id,
    budget_amount:0
  });

  if(baseError){
    await supabase.from('categories').delete().eq('id',newCategory.id);
    showMessage('No pudimos completar la creación de la categoría.','error','app');
    return;
  }

  if(activePeriod){
    const {error:monthError}=await supabase.from('monthly_budgets').insert({
      user_id:currentUser.id,
      monthly_period_id:activePeriod.id,
      category_id:newCategory.id,
      budget_amount:0
    });
    if(monthError){
      showMessage('La categoría se creó, pero no pudimos añadirla al presupuesto de este mes.','error','app');
      await refreshCategoriesOnly();
      return;
    }
  }

  input.value='';
  await refreshCategoriesOnly();
  showMessage('Nueva categoría creada. Puedes asignarle presupuesto este mes.','success','app');
});

async function selectMonth(monthDate){
  selectedMonthDate=monthDate;
  activePeriod=await loadPeriod(monthDate);
  monthlyBudgets=await loadMonthlyBudgets(activePeriod?.id);
  transactions=await loadTransactions(activePeriod?.id);
  renderSelectedMonth();
}

function renderSelectedMonth(){
  const selectedDate=new Date(selectedMonthDate+'T12:00:00');
  const selectedLabel=monthLabel(selectedDate);
  document.querySelector('#selected-month-label').textContent=selectedLabel;
  document.querySelector('#return-current-month').disabled=selectedMonthDate===monthDateString();
  renderHome();
  renderBudgetRows();
  renderTransactionForm();
  renderTransactions();
}

function nextMonthDateString(monthDate){
  const d=new Date(monthDate+'T12:00:00');
  d.setMonth(d.getMonth()+1,1);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  return `${y}-${m}-01`;
}

document.querySelector('#return-current-month').addEventListener('click',async()=>{
  clearMessage('app');
  await selectMonth(monthDateString());
  setView('configure');
});

document.querySelector('#create-next-month').addEventListener('click',async()=>{
  clearMessage('app');
  const button=document.querySelector('#create-next-month');
  button.disabled=true;
  button.textContent='Preparando…';
  try{
    const nextMonth=nextMonthDateString(selectedMonthDate);
    const existing=await loadPeriod(nextMonth);
    if(existing){
      await selectMonth(nextMonth);
      setView('configure');
      showMessage(`${monthLabel(new Date(nextMonth+'T12:00:00'))} ya existía. Lo abrí para que puedas editarlo.`,'success','app');
      return;
    }

    const copiedBudgets={};
    for(const cat of allCategories){
      copiedBudgets[cat.id]=Number(monthlyBudgets[cat.id]??baseBudgets[cat.id]??0);
    }

    const {data:newPeriod,error:periodError}=await supabase.from('monthly_periods')
      .insert({user_id:currentUser.id,month_date:nextMonth,income:0})
      .select('id,income,month_date')
      .single();
    if(periodError)throw periodError;

    const rows=allCategories.map(cat=>({
      user_id:currentUser.id,
      monthly_period_id:newPeriod.id,
      category_id:cat.id,
      budget_amount:Number(copiedBudgets[cat.id]||0)
    }));

    if(rows.length){
      const {error:budgetError}=await supabase.from('monthly_budgets').insert(rows);
      if(budgetError){
        await supabase.from('monthly_periods').delete().eq('id',newPeriod.id);
        throw budgetError;
      }
    }

    selectedMonthDate=nextMonth;
    activePeriod=newPeriod;
    monthlyBudgets=copiedBudgets;
    transactions=[];
    renderSelectedMonth();
    setView('configure');
    showMessage(`${monthLabel(new Date(nextMonth+'T12:00:00'))} fue creado copiando los presupuestos del mes anterior. Ingresa el nuevo ingreso y ajusta solo lo que cambie.`,'success','app');
  }catch(error){
    console.error(error);
    showMessage('No pudimos crear el siguiente mes. Inténtalo nuevamente.','error','app');
  }finally{
    button.disabled=false;
    button.textContent='Crear siguiente mes';
  }
});

async function refreshAppData(){
  selectedMonthDate=monthDateString();
  const [loadedCategories,loadedBase,period]=await Promise.all([
    loadCategories(),loadBaseBudgets(),loadPeriod(selectedMonthDate)
  ]);
  allCategories=loadedCategories;
  categories=loadedCategories.filter(c=>c.is_active);
  baseBudgets=loadedBase;
  activePeriod=period;
  monthlyBudgets=await loadMonthlyBudgets(period?.id);
  transactions=await loadTransactions(period?.id);
  await loadHistoricalData();
  renderSelectedMonth();
  renderComparisons();
  renderCategoryManager();
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
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    setView('home');

    const profile=await loadProfile(currentUser.id);
    document.querySelector('#welcome-title').textContent=`Hola, ${profile.name}`;
    await refreshAppData();
  }catch(error){
    console.error(error);
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    showMessage('Ingresaste correctamente, pero hubo un problema al cargar una parte de tus datos. Actualiza la página.','error','app');
  }
}

supabase.auth.onAuthStateChange(()=>queueMicrotask(renderSession));
await renderSession();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Service worker no disponible',error));
  });
}
