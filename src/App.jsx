import { useState } from 'react';
import { signup } from './shared/api';
import './App.css';

const initialForm = { name: '', email: '', password: '', passwordConfirm: '' };

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!form.email || !form.password) {
      setMessage('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    if (form.password.length < 8) {
      setMessage('비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signup({ name: form.name, email: form.email, password: form.password });
      if (result.status !== 'success') {
        setMessage(result.message || '회원가입을 완료하지 못했습니다.');
        return;
      }
      localStorage.setItem('accessToken', result.token);
      setComplete(true);
      setForm(initialForm);
    } catch {
      setMessage('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-intro" aria-label="서비스 소개">
        <a className="brand" href="/">GSM GUIDE</a>
        <div>
          <p className="kicker">학생을 위한 진로 안내 서비스</p>
          <h1>함께 준비하는<br />나의 다음 단계</h1>
          <p className="intro-copy">학교 일정과 규정, 진로 정보를 한곳에서 확인하세요.</p>
        </div>
      </section>

      <section className="signup-panel" aria-labelledby="signup-title">
        {complete ? (
          <div className="success-state" role="status">
            <span className="success-icon">✓</span>
            <h2>가입이 완료되었어요</h2>
            <p>이제 GSM GUIDE의 정보를 확인할 수 있습니다.</p>
            <button type="button" onClick={() => setComplete(false)}>다른 계정으로 가입</button>
          </div>
        ) : (
          <>
            <div className="panel-heading">
              <p>계정 만들기</p>
              <h2 id="signup-title">회원가입</h2>
              <span>이미 계정이 있나요? <a href="#login">로그인</a></span>
            </div>

            <form className="signup-form" onSubmit={handleSubmit} noValidate>
              <label htmlFor="name">이름 <em>선택</em></label>
              <input id="name" name="name" value={form.name} onChange={updateField} maxLength="30" autoComplete="name" placeholder="이름을 입력하세요" />

              <label htmlFor="email">이메일</label>
              <input id="email" name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" placeholder="example@gsm.hs.kr" required />

              <label htmlFor="password">비밀번호</label>
              <input id="password" name="password" type="password" value={form.password} onChange={updateField} minLength="8" autoComplete="new-password" placeholder="8자 이상 입력하세요" required />

              <label htmlFor="passwordConfirm">비밀번호 확인</label>
              <input id="passwordConfirm" name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={updateField} minLength="8" autoComplete="new-password" placeholder="비밀번호를 다시 입력하세요" required />

              {message && <p className="form-message" role="alert">{message}</p>}
              <button className="submit-button" type="submit" disabled={submitting}>{submitting ? '가입 처리 중...' : '회원가입'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
