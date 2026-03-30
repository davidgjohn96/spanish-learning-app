import { useMemo, useState } from 'react'
import './App.css'
import { getDueCount, initProfileIfNeeded } from './engine/profile.js'
import { starterLesson } from './content/es/starterLesson.js'
import { getReviewQueue, gradeCard, runLesson } from './engine/session.js'

function App() {
  const [route, setRoute] = useState({ name: 'home' })

  return (
    <div className="appShell">
      <header className="topBar">
        <button
          className="linkButton"
          onClick={() => setRoute({ name: 'home' })}
        >
          Habla
        </button>
        <div className="topBarRight">
          <span className="pill">Spanish (beta)</span>
        </div>
      </header>

      <main className="main">
        {route.name === 'home' ? (
          <Home
            onStartLesson={() => setRoute({ name: 'lesson' })}
            onReview={() => setRoute({ name: 'review' })}
          />
        ) : null}
        {route.name === 'lesson' ? (
          <Lesson onDone={() => setRoute({ name: 'review' })} />
        ) : null}
        {route.name === 'review' ? (
          <Review onDone={() => setRoute({ name: 'home' })} />
        ) : null}
      </main>

      <footer className="footer">
        <span className="muted">
          Tip: this MVP stores progress in your browser (localStorage).
        </span>
      </footer>
    </div>
  )
}

export default App

function Home({ onStartLesson, onReview }) {
  const dueCount = useMemo(() => {
    initProfileIfNeeded()
    return getDueCount()
  }, [])

  return (
    <section className="card">
      <h1 className="h1">Learn Spanish, 5 minutes a day</h1>
      <p className="lead">
        A tiny MVP focused on what works: active recall + spaced repetition.
      </p>

      <div className="row">
        <button className="primary" onClick={onStartLesson}>
          Start today’s lesson
        </button>
        <button className="secondary" onClick={onReview}>
          Review ({dueCount} due)
        </button>
      </div>

      <div className="divider" />

      <h2 className="h2">What you’ll do today</h2>
      <ul className="list">
        <li>Read a short dialogue (comprehensible input).</li>
        <li>Learn 6 high-frequency chunks.</li>
        <li>Review with spaced repetition (SRS).</li>
      </ul>
    </section>
  )
}

function Lesson({ onDone }) {
  const { dialogue, chunks } = starterLesson

  return (
    <section className="card">
      <h1 className="h1">Today’s lesson</h1>
      <p className="lead">Mini-dialogue (tap to reveal meaning).</p>

      <div className="dialogue">
        {dialogue.lines.map((line) => (
          <RevealLine key={line.id} line={line} />
        ))}
      </div>

      <div className="divider" />

      <h2 className="h2">Key chunks</h2>
      <div className="grid">
        {chunks.map((c) => (
          <ChunkCard key={c.id} chunk={c} />
        ))}
      </div>

      <div className="divider" />

      <button
        className="primary"
        onClick={() => {
          runLesson(starterLesson)
          onDone()
        }}
      >
        Add these to my review
      </button>
    </section>
  )
}

function Review({ onDone }) {
  const queue = useMemo(() => getReviewQueue(), [])
  const current = queue[0]

  if (!current) {
    return (
      <section className="card">
        <h1 className="h1">Review</h1>
        <p className="lead">You’re all caught up. Nice.</p>
        <button className="primary" onClick={onDone}>
          Back to home
        </button>
      </section>
    )
  }

  return <ReviewCard key={current.cardId} item={current} onDone={onDone} />
}

function RevealLine({ line }) {
  const [open, setOpen] = useState(false)

  return (
    <button className="revealLine" onClick={() => setOpen((v) => !v)}>
      <div className="revealTop">
        <span className="mono">{line.es}</span>
        <span className="tag">{open ? 'hide' : 'reveal'}</span>
      </div>
      {open ? <div className="revealBottom muted">{line.en}</div> : null}
    </button>
  )
}

function ChunkCard({ chunk }) {
  const [open, setOpen] = useState(false)

  return (
    <button className="chunkCard" onClick={() => setOpen((v) => !v)}>
      <div className="chunkEs">{chunk.es}</div>
      <div className="chunkMeta muted">
        {chunk.note}{' '}
        <span className="tag">{open ? 'hide' : 'reveal'}</span>
      </div>
      {open ? <div className="chunkEn">{chunk.en}</div> : null}
    </button>
  )
}

function ReviewCard({ item, onDone }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)

  const card = item.card

  return (
    <section className="card">
      <h1 className="h1">Review</h1>
      <p className="lead">Type the Spanish. Then grade yourself.</p>

      <div className="prompt">
        <div className="muted small">English</div>
        <div className="promptText">{card.en}</div>
      </div>

      <label className="inputLabel">
        <span className="muted small">Your answer</span>
        <input
          className="textInput"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type in Spanish…"
          autoFocus
        />
      </label>

      {!revealed ? (
        <button className="secondary" onClick={() => setRevealed(true)}>
          Reveal answer
        </button>
      ) : (
        <>
          <div className="answerBox">
            <div className="muted small">Target</div>
            <div className="answerText mono">{card.es}</div>
          </div>

          <div className="row">
            <button
              className="grade bad"
              onClick={() => {
                gradeCard(card.id, 'again')
                window.location.reload()
              }}
            >
              Again
            </button>
            <button
              className="grade ok"
              onClick={() => {
                gradeCard(card.id, 'hard')
                window.location.reload()
              }}
            >
              Hard
            </button>
            <button
              className="grade good"
              onClick={() => {
                gradeCard(card.id, 'good')
                window.location.reload()
              }}
            >
              Good
            </button>
            <button
              className="grade great"
              onClick={() => {
                gradeCard(card.id, 'easy')
                window.location.reload()
              }}
            >
              Easy
            </button>
          </div>

          <div className="divider" />
          <button className="secondary" onClick={onDone}>
            Done for now
          </button>
        </>
      )}
    </section>
  )
}
