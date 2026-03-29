'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string
  name: string
  hint: string
}

interface Round {
  label: string
  difficulty: 'easy' | 'medium' | 'hard'
  diffLabel: string
  constraints: string
  tasks: Task[]
  correctOrder: string[]
  explanation: string[]
}

interface BreakdownRow {
  name: string
  pts: string
  ok: boolean
  note: string
}

// ── Game data ─────────────────────────────────────────────────────────────────

const ROUNDS: Round[] = [
  {
    label: "Your first app feature is dropping — what order do you ship in?",
    difficulty: 'easy',
    diffLabel: 'Easy — feel it out',
    constraints: "You can't build what isn't set up yet. You can't launch what isn't tested. Always fix urgent bugs before adding new stuff.",
    tasks: [
      { id: 'a', name: 'Set up the dev environment', hint: 'nothing works until this is done' },
      { id: 'b', name: "Squash the login bug everyone's complaining about", hint: 'urgent — users are locked out right now' },
      { id: 'c', name: 'Build the new feature', hint: 'needs the environment ready first' },
      { id: 'd', name: 'Test that the feature actually works', hint: "don't skip this — ever" },
      { id: 'e', name: 'Push it live', hint: 'this is always the last step' },
      { id: 'f', name: 'Post the release notes', hint: "after it's live, not before" },
    ],
    correctOrder: ['a', 'b', 'c', 'd', 'e', 'f'],
    explanation: ['Set up first — always', 'Fix what\'s broken BEFORE building new stuff', 'Now you can build', 'Test before anyone touches it', 'Ship it', 'Tell people what changed'],
  },
  {
    label: "Your team's building a checkout flow. What breaks if you get the order wrong?",
    difficulty: 'medium',
    diffLabel: 'Medium — think it through',
    constraints: "Backend before UI — you can't style something that doesn't exist. Security sign-off is non-negotiable before users can pay. Docs come after the thing is built.",
    tasks: [
      { id: 'a', name: 'Connect the Stripe payment API', hint: 'the backend — everything else sits on this' },
      { id: 'b', name: 'Build the checkout screen', hint: 'the UI — needs the API hooked up first' },
      { id: 'c', name: 'Get security and compliance reviewed', hint: "you legally can't skip this before taking payments" },
      { id: 'd', name: 'Stress test with 1000 fake transactions', hint: 'QA — only after security gives the green light' },
      { id: 'e', name: 'Write up how the API works for the team', hint: "docs — after it's built, not during" },
      { id: 'f', name: 'Turn it on for all users', hint: 'the big rollout — absolutely last' },
    ],
    correctOrder: ['a', 'b', 'c', 'd', 'e', 'f'],
    explanation: ['API first — the foundation', 'UI on top of the API', 'Security gates going live', 'Load test once secure', 'Document what you built', 'Flip the switch last'],
  },
  {
    label: "Production is down. Your team is panicking in Slack. What do you do first?",
    difficulty: 'hard',
    diffLabel: 'Hard — no hand-holding',
    constraints: "Never fix what you don't understand yet. Never push to prod without testing first. Don't message stakeholders while you're still guessing — only after the fix is confirmed live.",
    tasks: [
      { id: 'a', name: 'Figure out what actually broke and why', hint: 'diagnose before you touch anything' },
      { id: 'b', name: 'Write the fix', hint: 'after you know the root cause' },
      { id: 'c', name: 'Test the fix on staging — not on prod', hint: 'never skip staging in a crisis' },
      { id: 'd', name: 'Push the fix to production', hint: 'only after staging passes' },
      { id: 'e', name: "Message stakeholders that you're back up", hint: 'communicate the win, not the panic' },
      { id: 'f', name: 'Write the postmortem so this never happens again', hint: 'most skipped, most important step' },
    ],
    correctOrder: ['a', 'b', 'c', 'd', 'e', 'f'],
    explanation: ['Diagnose first — always', 'Fix what you found', 'Staging is your safety net', 'Deploy once confirmed', 'Now tell leadership', 'Close the loop — learn from it'],
  },
]

const TIMES = [55, 45, 38]

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SprintGame() {
  const [round, setRound] = useState(0)
  const [phase, setPhase] = useState<'playing' | 'results' | 'wall'>('playing')
  const [totalScore, setTotalScore] = useState(0)
  const [penalties, setPenalties] = useState(0)
  const [poolIds, setPoolIds] = useState<string[]>([])
  const [seqIds, setSeqIds] = useState<string[]>([])
  const [timerSecs, setTimerSecs] = useState(TIMES[0])
  const [checked, setChecked] = useState(false)
  const [highlights, setHighlights] = useState<Record<string, 'correct' | 'wrong'>>({})
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([])
  const [roundScore, setRoundScore] = useState(0)
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const draggingRef = useRef<string | null>(null)

  const r = ROUNDS[round]

  // Init round
  useEffect(() => {
    setPoolIds(shuffle(r.tasks).map(t => t.id))
    setSeqIds([])
    setChecked(false)
    setHighlights({})
    setFeedback(null)
    setTimerSecs(TIMES[round])
  }, [round])

  // Timer
  useEffect(() => {
    if (checked || phase !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimerSecs(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!)
          handleCheck(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [round, checked, phase])

  const taskMap = Object.fromEntries(r.tasks.map(t => [t.id, t]))

  const handleCheck = useCallback((auto = false) => {
    if (checked) return
    setChecked(true)
    clearInterval(timerRef.current!)

    const correct = r.correctOrder
    if (seqIds.length === 0) {
      setRoundScore(0)
      setBreakdown([])
      setPhase('results')
      return
    }

    let pts = 0, pen = 0
    const rows: BreakdownRow[] = []
    const hl: Record<string, 'correct' | 'wrong'> = {}

    seqIds.forEach((id, i) => {
      const cp = correct.indexOf(id)
      const diff = Math.abs(i - cp)
      const name = taskMap[id].name
      if (diff === 0) {
        pts += 10; hl[id] = 'correct'
        rows.push({ name, pts: '+10', ok: true, note: r.explanation[cp] })
      } else if (diff === 1) {
        pts += 4; pen++; hl[id] = 'correct'
        rows.push({ name, pts: '+4', ok: true, note: 'One slot off — almost' })
      } else {
        pen += 2; hl[id] = 'wrong'
        rows.push({ name, pts: `−${diff * 3}`, ok: false, note: `Slot ${i + 1} — should be slot ${cp + 1}` })
      }
    })

    correct.forEach(id => {
      if (!seqIds.includes(id)) {
        pen += 2
        rows.push({ name: taskMap[id].name, pts: '−8', ok: false, note: 'Never placed in sequence' })
      }
    })

    const max = TIMES[round]
    const bonus = timerSecs > Math.round(max * 0.45) ? 10 : timerSecs > Math.round(max * 0.22) ? 5 : 0
    if (bonus > 0) rows.push({ name: 'Speed bonus', pts: `+${bonus}`, ok: true, note: `${timerSecs}s remaining` })

    pts = Math.max(0, pts + bonus)
    const okCount = rows.filter(b => b.ok).length
    const pct = Math.round((okCount / correct.length) * 100)

    setHighlights(hl)
    setFeedback({
      msg: pct >= 80 ? 'That sequence slaps — great PM instincts.' : pct >= 50 ? 'Mostly right, but a few dependencies got violated.' : 'A few constraints broken — reread the rules above.',
      ok: pct >= 60,
    })
    setTotalScore(s => s + pts)
    setPenalties(p => p + pen)
    setRoundScore(pts)
    setBreakdown(rows)

    setTimeout(() => setPhase('results'), 900)
  }, [checked, seqIds, round, timerSecs, r])

  const addToSeq = (id: string) => {
    setPoolIds(p => p.filter(x => x !== id))
    setSeqIds(s => s.includes(id) ? s : [...s, id])
  }

  const removeFromSeq = (id: string) => {
    setSeqIds(s => s.filter(x => x !== id))
    setPoolIds(p => [...p, id])
  }

  const moveSeq = (id: string, dir: -1 | 1) => {
    setSeqIds(s => {
      const i = s.indexOf(id)
      if (i === -1) return s
      const j = i + dir
      if (j < 0 || j >= s.length) return s
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const handleEmailSubmit = async () => {
    if (!email.includes('@')) return
    setEmailLoading(true)
    try {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, score: totalScore, rounds_completed: 3 }),
      })
      setEmailSent(true)
    } catch {
      setEmailSent(true) // fail silently in MVP
    }
    setEmailLoading(false)
  }

  const nextRound = () => {
    if (round >= 2) {
      setPhase('wall')
    } else {
      setPhase('playing')
      setRound(r => r + 1)
    }
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const timerPct = Math.round((timerSecs / TIMES[round]) * 100)
  const timerColor = timerPct > 50 ? '#7F77DD' : timerPct > 25 ? '#EF9F27' : '#E24B4A'
  const grade = roundScore >= 55 ? 'You are built different — PM instincts are real'
    : roundScore >= 35 ? 'Solid work — you get how dependencies flow'
    : roundScore >= 15 ? "Good start — a few more reps and you'll get it"
    : "You'll get there — read the constraints next time"

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'wall') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: 44, fontWeight: 600, marginBottom: 8 }}>{totalScore} pts</div>
        <div style={{ fontSize: 17, color: '#666', marginBottom: '2rem' }}>
          {totalScore >= 150 ? 'PM legend status unlocked.' : totalScore >= 90 ? 'Solid across all 3 rounds.' : 'Room to grow — keep going.'}
        </div>
        {emailSent ? (
          <div style={{ background: '#E1F5EE', border: '0.5px solid #5DCAA5', borderRadius: 12, padding: '1.5rem', maxWidth: 400, margin: '0 auto' }}>
            <div style={{ fontWeight: 600, color: '#085041', marginBottom: 6 }}>You're in.</div>
            <div style={{ fontSize: 13, color: '#0F6E56' }}>Check your inbox — harder scenarios incoming.</div>
          </div>
        ) : (
          <div style={{ background: '#f2f0ec', borderRadius: 12, padding: '1.5rem', maxWidth: 400, margin: '0 auto' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>You've used your 3 free rounds</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: '1rem' }}>Sign up to unlock harder scenarios, track your PM score, and flex your results.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 14, background: '#fff' }}
              />
              <button
                onClick={handleEmailSubmit}
                disabled={emailLoading}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}
              >
                {emailLoading ? '...' : 'Unlock'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>No spam. Just harder sprints.</div>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'results') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{r.label}</div>
        <div style={{ fontSize: 44, fontWeight: 600, marginBottom: 4 }}>{roundScore} pts</div>
        <div style={{ fontSize: 17, color: '#666', marginBottom: '1rem' }}>{grade}</div>

        <div style={{ textAlign: 'left', maxWidth: 440, margin: '0 auto 1.5rem', fontSize: 13 }}>
          {breakdown.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, padding: '6px 0', borderBottom: '0.5px solid #e5e5e5', alignItems: 'baseline' }}>
              <span style={{ flex: 1, color: '#1a1a1a' }}>{row.name}</span>
              <span style={{ fontSize: 11, color: '#999', width: 150, flexShrink: 0 }}>{row.note}</span>
              <span style={{ fontWeight: 600, width: 36, textAlign: 'right', color: row.ok ? '#0F6E56' : '#A32D2D' }}>{row.pts}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: '1.5rem' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i <= round ? '#7F77DD' : '#ddd', display: 'inline-block' }} />
          ))}
        </div>

        {round < 2 ? (
          <button onClick={nextRound} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}>
            Next scenario ({2 - round} left) →
          </button>
        ) : (
          <button onClick={nextRound} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}>
            See final score →
          </button>
        )}
      </div>
    )
  }

  // Playing phase
  return (
    <div>
      {/* HUD */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'round', val: `${round + 1}/3` },
          { label: 'score', val: totalScore },
          { label: 'penalties', val: penalties },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: '#eeece8', borderRadius: 8, padding: '8px 14px', minWidth: 72 }}>
            <div style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{val}</div>
          </div>
        ))}
        <div style={{ background: '#eeece8', borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>time — <span style={{ fontWeight: 600, color: timerSecs <= 8 ? '#A32D2D' : timerSecs <= 15 ? '#854F0B' : '#1a1a1a' }}>{timerSecs}s</span></div>
          <div style={{ background: '#d5d2cc', borderRadius: 4, height: 7, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: 7, borderRadius: 4, background: timerColor, width: `${timerPct}%`, transition: 'width 0.9s linear, background 0.5s' }} />
          </div>
        </div>
      </div>

      {/* How to play */}
      <div style={{ display: 'flex', gap: 10, background: '#E1F5EE', border: '0.5px solid #5DCAA5', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#085041', lineHeight: 1.6 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>☝️</span>
        <span><strong>How to play:</strong> Drag tasks from the left into the <strong style={{ color: '#3C3489' }}>purple box on the right</strong>. Use ↑ ↓ arrows to reorder. Hit <em>Check my sequence</em> when ready.</span>
      </div>

      {/* Difficulty + scenario */}
      <div style={{
        display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, marginBottom: 8,
        background: r.difficulty === 'easy' ? '#E1F5EE' : r.difficulty === 'medium' ? '#FAEEDA' : '#FCEBEB',
        color: r.difficulty === 'easy' ? '#0F6E56' : r.difficulty === 'medium' ? '#854F0B' : '#A32D2D',
      }}>
        {r.diffLabel}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
      <div style={{ background: '#EEEDFE', border: '0.5px solid #AFA9EC', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#3C3489', lineHeight: 1.6 }}>
        <strong>Rules:</strong> {r.constraints}
      </div>

      {/* Lanes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Pool */}
        <div style={{ background: '#eeece8', borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: '0.05em', marginBottom: 8 }}>TASK POOL — drag these across</div>
          <div
            style={{ minHeight: 320, borderRadius: 8, border: '1.5px dashed #ccc', padding: 6 }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const id = draggingRef.current
              if (!id || !seqIds.includes(id)) return
              removeFromSeq(id)
              draggingRef.current = null
            }}
          >
            {poolIds.map(id => (
              <div
                key={id}
                draggable
                onDragStart={() => { draggingRef.current = id }}
                onDragEnd={() => { draggingRef.current = null }}
                style={{ background: '#fff', border: '0.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', marginBottom: 7, cursor: 'grab', userSelect: 'none' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{taskMap[id].name}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>{taskMap[id].hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sequence */}
        <div style={{ background: '#534AB7', border: '2px solid #7F77DD', borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#CECBF6', letterSpacing: '0.05em', marginBottom: 8 }}>YOUR SEQUENCE — drop here, reorder with arrows</div>

          {seqIds.length === 0 ? (
            <div
              style={{ minHeight: 320, borderRadius: 8, border: '2px dashed #7F77DD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: '#CECBF6', textAlign: 'center', padding: 20 }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const id = draggingRef.current
                if (id && poolIds.includes(id)) addToSeq(id)
                draggingRef.current = null
              }}
            >
              <span style={{ fontSize: 28 }}>⬇</span>
              <span>Drag tasks into this box</span>
              <span style={{ fontSize: 11, color: '#AFA9EC' }}>Then use ↑ ↓ to order them correctly</span>
            </div>
          ) : (
            <>
              <div>
                {seqIds.map((id, i) => {
                  const hl = highlights[id]
                  return (
                    <div key={id} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      background: hl === 'correct' ? 'rgba(29,158,117,.25)' : hl === 'wrong' ? 'rgba(226,75,74,.2)' : 'rgba(255,255,255,.12)',
                      border: `0.5px solid ${hl === 'correct' ? '#5DCAA5' : hl === 'wrong' ? '#F09595' : 'rgba(255,255,255,.2)'}`,
                      borderRadius: 8, padding: '9px 8px', marginBottom: 7,
                    }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{taskMap[id].name}</div>
                        <div style={{ fontSize: 11, color: '#CECBF6', marginTop: 3 }}>{taskMap[id].hint}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                        <button onClick={() => moveSeq(id, -1)} disabled={i === 0} style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.2 : 1, fontSize: 12 }}>▲</button>
                        <button onClick={() => moveSeq(id, 1)} disabled={i === seqIds.length - 1} style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: i === seqIds.length - 1 ? 'default' : 'pointer', opacity: i === seqIds.length - 1 ? 0.2 : 1, fontSize: 12 }}>▼</button>
                      </div>
                      <button onClick={() => removeFromSeq(id)} style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid rgba(255,255,255,.2)', background: 'transparent', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                    </div>
                  )
                })}
              </div>
              <div
                style={{ minHeight: 36, borderRadius: 8, border: '1.5px dashed #7F77DD', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const id = draggingRef.current
                  if (id && poolIds.includes(id)) addToSeq(id)
                  draggingRef.current = null
                }}
              >
                <span style={{ fontSize: 11, color: '#AFA9EC', pointerEvents: 'none' }}>drop here to add to bottom</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => handleCheck(false)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#534AB7', color: '#fff', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}>
          Check my sequence →
        </button>
        <button onClick={() => { clearInterval(timerRef.current!); setPhase('results') }} style={{ padding: '10px 16px', borderRadius: 8, border: '0.5px solid #ccc', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 14 }}>
          Skip round
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 8, background: feedback.ok ? '#E1F5EE' : '#FCEBEB', color: feedback.ok ? '#085041' : '#791F1F', fontSize: 13 }}>
          {feedback.msg}
        </div>
      )}
    </div>
  )
}
