import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const SUPABASE_URL='https://ddcwvfvxfpoojafpsyqy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_OtUbIQyOYdBYCgp3DwU1Pg_1ns2C-yq';
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const authView=document.querySelector('#auth-view');
const dashboardView=document.querySelector('#dashboard-view');
const loginForm=document.querySelector('#login-form');
const registerForm=document.querySelector('#register-form');
const tabLogin=document.querySelector('#tab-login');
const tabRegister=document.querySelector('#tab-register');
const authMessage=document.querySelector('#auth-message');
const logoutButton=document.querySelector('#logout-button');
const forgotPasswordButton=document.querySelector('#forgot-password');

function showMessage(message,type='info'){authMessage.textContent=message;authMessage.className=`message ${type}`;}
function clearMessage(){authMessage.textContent='';authMessage.className='message hidden';}
function setAuthMode(mode){clearMessage();const isLogin=mode==='login';loginForm.classList.toggle('hidden',!isLogin);registerForm.classList.toggle('hidden',isLogin);tabLogin.classList.toggle('active',isLogin);tabRegister.classList.toggle('active',!isLogin);}
tabLogin.addEventListener('click',()=>setAuthMode('login'));
tabRegister.addEventListener('click',()=>setAuthMode('register'));

loginForm.addEventListener('submit',async(e)=>{e.preventDefault();clearMessage();const email=document.querySelector('#login-email').value.trim();const password=document.querySelector('#login-password').value;const b=loginForm.querySelector('button[type="submit"]');b.disabled=true;b.textContent='Ingresando…';const {error}=await supabase.auth.signInWithPassword({email,password});b.disabled=false;b.textContent='Ingresar';if(error){showMessage('No pudimos iniciar sesión. Revisa el correo, la contraseña y que hayas confirmado tu email.','error');return;}await renderSession();});

registerForm.addEventListener('submit',async(e)=>{e.preventDefault();clearMessage();const name=document.querySelector('#register-name').value.trim();const email=document.querySelector('#register-email').value.trim();const password=document.querySelector('#register-password').value;const confirmation=document.querySelector('#register-password-confirm').value;if(password!==confirmation){showMessage('Las contraseñas no coinciden.','error');return;}const b=registerForm.querySelector('button[type="submit"]');b.disabled=true;b.textContent='Creando cuenta…';const {data,error}=await supabase.auth.signUp({email,password,options:{data:{name}}});b.disabled=false;b.textContent='Crear cuenta';if(error){showMessage(error.message||'No pudimos crear la cuenta.','error');return;}if(!data.session){showMessage('Cuenta creada. Revisa tu correo y confirma tu dirección antes de ingresar.','success');return;}await renderSession();});

forgotPasswordButton.addEventListener('click',async()=>{clearMessage();const email=document.querySelector('#login-email').value.trim();if(!email){showMessage('Escribe primero tu correo para enviarte el enlace de recuperación.','error');return;}const {error}=await supabase.auth.resetPasswordForEmail(email);if(error){showMessage(error.message||'No pudimos enviar el correo de recuperación.','error');return;}showMessage('Te enviamos un correo para recuperar tu contraseña.','success');});
logoutButton.addEventListener('click',async()=>{await supabase.auth.signOut();await renderSession();});

async function loadProfile(userId){const {data,error}=await supabase.from('profiles').select('name').eq('id',userId).single();if(error)throw error;return data;}
async function loadCategories(){const {data,error}=await supabase.from('categories').select('id,name,sort_order,is_active').eq('is_active',true).order('sort_order',{ascending:true});if(error)throw error;return data??[];}
function renderCategories(categories){const grid=document.querySelector('#categories-grid');document.querySelector('#category-count').textContent=categories.length;grid.innerHTML='';for(const c of categories){const item=document.createElement('article');item.className='category-card';const name=document.createElement('strong');name.textContent=c.name;const status=document.createElement('span');status.textContent='Lista para presupuestar';item.append(name,status);grid.appendChild(item);}}
async function renderSession(){const {data:{session}}=await supabase.auth.getSession();if(!session?.user){dashboardView.classList.add('hidden');authView.classList.remove('hidden');return;}try{const [profile,categories]=await Promise.all([loadProfile(session.user.id),loadCategories()]);document.querySelector('#welcome-title').textContent=`Hola, ${profile.name}`;renderCategories(categories);authView.classList.add('hidden');dashboardView.classList.remove('hidden');}catch(error){console.error(error);await supabase.auth.signOut();dashboardView.classList.add('hidden');authView.classList.remove('hidden');showMessage('La cuenta existe, pero no pudimos cargar su configuración. Vuelve a intentarlo.','error');}}
supabase.auth.onAuthStateChange(()=>queueMicrotask(renderSession));
await renderSession();