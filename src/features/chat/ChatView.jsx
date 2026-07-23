import { useState } from 'react';

export default function ChatView() {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setAnswer('');

    try {
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, grade: '2학년', department: '소프트웨어개발' }),
      });
      const data = await res.json();
      setAnswer(data.answer || '응답이 없습니다.');
    } catch {
      setAnswer('백엔드 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>챗봇 테스트</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="예: 인턴십 준비 어떻게 해?" />
        <button type="submit" disabled={loading}>{loading ? '전송 중...' : '질문 보내기'}</button>
      </form>
      {answer && <p style={{ marginTop: '0.8rem' }}>{answer}</p>}
    </section>
  );
}
