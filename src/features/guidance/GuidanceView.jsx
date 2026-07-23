import { useState } from 'react';

export default function GuidanceView() {
  const [topic, setTopic] = useState('인턴십');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult('');

    try {
      const res = await fetch('http://localhost:3000/api/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, grade: '2학년', department: '소프트웨어개발' }),
      });
      const data = await res.json();
      setResult(data.answer || '가이드가 없습니다.');
    } catch {
      setResult('가이드 API 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>개인화 가이드</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 규정, 일정, 인턴십" />
        <button type="submit" disabled={loading}>{loading ? '조회 중...' : '가이드 받기'}</button>
      </form>
      {result && <p style={{ marginTop: '0.8rem' }}>{result}</p>}
    </section>
  );
}
