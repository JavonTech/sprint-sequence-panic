import SprintGame from '@/components/SprintGame'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1rem',
      background: '#f8f7f4',
    }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', color: '#888', marginBottom: 8 }}>
          JAVON TECHNOLOGY
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
          Sprint Sequence Panic
        </h1>
        <p style={{ fontSize: 14, color: '#666', maxWidth: 420 }}>
          Can you ship tasks in the right order before time runs out?
        </p>
      </header>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <SprintGame />
      </div>
      <footer style={{ marginTop: '3rem', fontSize: 12, color: '#aaa', textAlign: 'center' }}>
        © {new Date().getFullYear()} Javon Technology Ltd. — javontechnology.com
      </footer>
    </main>
  )
}
