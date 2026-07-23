import { useState } from 'react';

export default function RegulationView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      setMessage(data.token ? `로그인 성공: ${data.token}` : data.message || '로그인 실패');
    } catch {
      setMessage('인증 API 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>로그인 테스트</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" />
        <button type="submit" disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
      </form>
      {message && <p style={{ marginTop: '0.8rem' }}>{message}</p>}
    </section>
  );
}
