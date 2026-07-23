import ChatView from './features/chat/ChatView';
import GuidanceView from './features/guidance/GuidanceView';
import RegulationView from './features/regulations/RegulationView';

export default function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">GSM 학생 지원 어시스턴트</p>
          <h1>학사 일정, 규정, 진로 준비를 한 곳에서</h1>
          <p>학생 질문에 맞춰 학사 일정, 규정 해설, 개인화 가이드를 바로 확인할 수 있는 데모 서비스입니다.</p>
        </div>
      </header>

      <section className="feature-grid">
        <ChatView />
        <GuidanceView />
        <RegulationView />
      </section>
    </main>
  );
}

