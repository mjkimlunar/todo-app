const formEl = document.getElementById('reset-form');
const newPasswordInput = document.getElementById('new-password');
const newPasswordConfirmInput = document.getElementById('new-password-confirm');
const resetBtn = document.getElementById('reset-btn');
const resetMessageEl = document.getElementById('reset-message');
const resetErrorEl = document.getElementById('reset-error');
const backToLoginEl = document.getElementById('back-to-login');

function getAccessTokenFromHash() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

const accessToken = getAccessTokenFromHash();

if (!accessToken) {
  formEl.style.display = 'none';
  resetErrorEl.textContent = '유효하지 않은 링크예요. 로그인 화면에서 재설정 이메일을 다시 요청해주세요.';
}

resetBtn.addEventListener('click', async () => {
  resetMessageEl.textContent = '';
  resetErrorEl.textContent = '';

  const password = newPasswordInput.value;
  const confirm = newPasswordConfirmInput.value;

  if (password.length < 6) {
    resetErrorEl.textContent = '비밀번호는 6자 이상이어야 해요.';
    return;
  }
  if (password !== confirm) {
    resetErrorEl.textContent = '비밀번호가 서로 달라요.';
    return;
  }

  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    resetErrorEl.textContent = body.error || '비밀번호 변경에 실패했어요.';
    return;
  }

  formEl.style.display = 'none';
  resetMessageEl.textContent = '비밀번호가 변경됐어요. 이제 로그인 화면에서 새 비밀번호로 로그인해주세요.';
  backToLoginEl.style.display = '';
});
