// Tab switching
const tabs = document.querySelectorAll('.tab');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');

function switchTab(target){
  tabs.forEach(t=>t.classList.toggle('active', t.dataset.tab===target));
  formLogin.classList.toggle('hidden', target!=='login');
  formRegister.classList.toggle('hidden', target!=='register');
}

tabs.forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));
document.querySelectorAll('[data-switch]').forEach(a=>{
  a.addEventListener('click',(e)=>{e.preventDefault();switchTab(a.dataset.switch)});
});

// Toggle password visibility
function togglePass(id, el){
  const input = document.getElementById(id);
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  el.innerHTML = isPass
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// Password strength checker
function checkStrength(val){
  const bars = document.querySelectorAll('#strength .strength-bar');
  const text = document.getElementById('strength-text');
  bars.forEach(b=>b.className='strength-bar');

  if(!val){text.textContent='// Seguridad: --';return}

  let score = 0;
  if(val.length>=8) score++;
  if(/[A-Z]/.test(val)) score++;
  if(/[0-9]/.test(val)) score++;
  if(/[^A-Za-z0-9]/.test(val)) score++;

  const labels = ['Débil','Aceptable','Buena','Excelente'];
  for(let i=0;i<score;i++){
    bars[i].classList.add('strength-bar', 's'+score);
  }
  text.textContent = '// Seguridad: ' + (labels[score-1] || '--');
}

// Submit handler
function handleSubmit(type){
  const btn = (type==='login'?formLogin:formRegister).querySelector('.btn-submit');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Procesando...';
  setTimeout(()=>{
    btn.innerHTML = '✓ Listo';
    btn.style.background = 'var(--acid)';
    setTimeout(()=>{
      btn.disabled = false;
      btn.innerHTML = original;
      btn.style.background = '';
    }, 1500);
  }, 1200);
}
