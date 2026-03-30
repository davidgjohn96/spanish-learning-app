import { useMemo, useState } from 'react'
import './App.css'
import { spanishLessons, getSpanishLessonById } from './content/es/index.js'
import {
  initProfileIfNeeded,
  isLessonUnlocked,
  setActiveLanguage,
} from './engine/profile.js'
import { answersMatch } from './engine/answerCheck.js'
import { getReviewQueue, gradeCard, runLesson } from './engine/session.js'
import { useProgressStats } from './hooks/useProfileSync.js'

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
        <LanguagePicker />
      </header>

      <main className="main">
        {route.name === 'home' ? (
          <Home
            onOpenLesson={(lessonId) =>
              setRoute({ name: 'lesson', lessonId })
            }
            onReview={() => setRoute({ name: 'review' })}
          />
        ) : null}
        {route.name === 'lesson' ? (
          <Lesson
            lessonId={route.lessonId}
            onBack={() => setRoute({ name: 'home' })}
            onDone={() => setRoute({ name: 'review' })}
          />
        ) : null}
        {route.name === 'review' ? (
          <Review
            onDone={() => setRoute({ name: 'home' })}
            onBack={() => setRoute({ name: 'home' })}
          />
        ) : null}
      </main>

      <footer className="footer">
        <span className="muted">
          Progress is stored in your browser (localStorage).
        </span>
      </footer>
    </div>
  )
}

export default App

const LANGUAGES = [
  { code: 'es', label: 'Español', enabled: true },
  { code: 'fr', label: 'Français', enabled: false },
  { code: 'de', label: 'Deutsch', enabled: false },
  { code: 'ja', label: '日本語', enabled: false },
]

function LanguagePicker() {
  const stats = useProgressStats()
  const active = stats.activeLanguage ?? 'es'

  return (
    <div className="langPicker" role="group" aria-label="Learning language">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={
            active === lang.code ? 'langChip langChipActive' : 'langChip'
          }
          disabled={!lang.enabled}
          title={
            lang.enabled
              ? `Study ${lang.label}`
              : `${lang.label} — coming soon`
          }
          onClick={() => {
            if (lang.enabled) setActiveLanguage(lang.code)
          }}
        >
          {lang.label}
          {!lang.enabled ? <span className="langSoon"> soon</span> : null}
        </button>
      ))}
    </div>
  )
}

function Home({ onOpenLesson, onReview }) {
  initProfileIfNeeded()
  const stats = useProgressStats()

  return (
    <div className="homeStack">
      <section className="card">
        <h1 className="h1">Learn Spanish, 5 minutes a day</h1>
        <p className="lead">
          Active recall + spaced repetition, with short dialogues you can
          understand.
        </p>
      </section>

      <section className="card cardTight">
        <h2 className="h2">Your progress</h2>
        <div className="statGrid">
          <div className="stat">
            <div className="statValue">{stats.streak}</div>
            <div className="statLabel">Day streak</div>
          </div>
          <div className="stat">
            <div className="statValue">{stats.dueCount}</div>
            <div className="statLabel">Due now</div>
          </div>
          <div className="stat">
            <div className="statValue">{stats.cardsInRotation}</div>
            <div className="statLabel">Cards in review</div>
          </div>
          <div className="stat">
            <div className="statValue">
              {stats.completedLessons}/{spanishLessons.length}
            </div>
            <div className="statLabel">Lessons done</div>
          </div>
        </div>
        <div className="row rowSpaced">
          <button className="primary" onClick={onReview}>
            Review ({stats.dueCount} due)
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="h2">Lessons</h2>
        <p className="muted small lessonHint">
          Complete each lesson to unlock the next. Finishing adds its phrases to
          your review deck.
        </p>
        <ul className="lessonList">
          {spanishLessons.map((lesson, index) => {
            const unlocked = isLessonUnlocked(lesson.id)
            const isDone = stats.completedLessonIds.includes(lesson.id)

            return (
              <li key={lesson.id} className="lessonRow">
                <div className="lessonMeta">
                  <span className="lessonTitle">
                    {index + 1}. {lesson.title}
                  </span>
                  {!unlocked ? (
                    <span className="tag tagMuted">Locked</span>
                  ) : isDone ? (
                    <span className="tag tagDone">Done</span>
                  ) : (
                    <span className="tag tagOpen">Open</span>
                  )}
                </div>
                <button
                  className="primary lessonBtn"
                  disabled={!unlocked}
                  onClick={() => unlocked && onOpenLesson(lesson.id)}
                >
                  {unlocked ? (isDone ? 'Review lesson' : 'Start') : 'Locked'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function Lesson({ lessonId, onBack, onDone }) {
  const lesson = getSpanishLessonById(lessonId)
  const unlocked = lesson ? isLessonUnlocked(lesson.id) : false

  if (!lesson) {
    return (
      <section className="card">
        <h1 className="h1">Lesson not found</h1>
        <button className="secondary" onClick={onBack}>
          Back
        </button>
      </section>
    )
  }

  if (!unlocked) {
    return (
      <section className="card">
        <h1 className="h1">Locked</h1>
        <p className="lead">Finish the previous lesson first.</p>
        <button className="secondary" onClick={onBack}>
          Back
        </button>
      </section>
    )
  }

  const { dialogue, chunks } = lesson

  return (
    <section className="card">
      <div className="lessonHeader">
        <button type="button" className="backLink" onClick={onBack}>
          ← Back
        </button>
        <h1 className="h1">{lesson.title}</h1>
      </div>
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

      <div className="row">
        <button
          className="primary"
          onClick={() => {
            runLesson(lesson)
            onDone()
          }}
        >
          Add these to my review
        </button>
      </div>
    </section>
  )
}

function Review({ onDone, onBack }) {
  const [queueTick, setQueueTick] = useState(0)
  const queue = useMemo(() => getReviewQueue(), [queueTick])
  const current = queue[0]

  if (!current) {
    return (
      <section className="card">
        <h1 className="h1">Review</h1>
        <p className="lead">You’re all caught up. Nice.</p>
        <div className="row">
          <button className="primary" onClick={onDone}>
            Home
          </button>
        </div>
      </section>
    )
  }

  return (
    <ReviewCard
      key={current.cardId}
      item={current}
      onGraded={() => setQueueTick((n) => n + 1)}
      onDone={onDone}
      onBack={onBack}
    />
  )
}

function RevealLine({ line }) {
  const [open, setOpen] = useState(false)

  return (
    <button type="button" className="revealLine" onClick={() => setOpen((v) => !v)}>
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
    <button type="button" className="chunkCard" onClick={() => setOpen((v) => !v)}>
      <div className="chunkEs">{chunk.es}</div>
      <div className="chunkMeta muted">
        {chunk.note}{' '}
        <span className="tag">{open ? 'hide' : 'reveal'}</span>
      </div>
      {open ? <div className="chunkEn">{chunk.en}</div> : null}
    </button>
  )
}

function ReviewCard({ item, onGraded, onDone, onBack }) {
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const card = item.card

  const handleCheck = () => {
    const trimmed = answer.trim()
    if (!trimmed) return
    setIsCorrect(answersMatch(card.es, trimmed))
    setChecked(true)
  }

  const handleGrade = (grade) => {
    gradeCard(card.id, grade)
    setAnswer('')
    setChecked(false)
    setIsCorrect(false)
    onGraded()
  }

  return (
    <section className="card">
      <div className="lessonHeader">
        <button type="button" className="backLink" onClick={onBack}>
          ← Home
        </button>
        <h1 className="h1">Review</h1>
      </div>
      <p className="lead">Type the Spanish, check your answer, then rate how it felt.</p>

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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !checked) {
              e.preventDefault()
              handleCheck()
            }
          }}
          placeholder="Type in Spanish…"
          autoFocus
          readOnly={checked}
        />
      </label>

      {!checked ? (
        <button
          type="button"
          className="secondary"
          onClick={handleCheck}
          disabled={!answer.trim()}
        >
          Check
        </button>
      ) : (
        <>
          <div
            className={
              isCorrect ? 'checkFeedback checkOk' : 'checkFeedback checkNo'
            }
            role="status"
          >
            {isCorrect ? 'Match — nice.' : 'Not quite — compare with the target below.'}
          </div>

          <div className="answerBox">
            <div className="muted small">Target</div>
            <div className="answerText mono">{card.es}</div>
          </div>

          <div className="row rowGrades">
            <button
              type="button"
              className="grade bad"
              onClick={() => handleGrade('again')}
            >
              Again
            </button>
            <button
              type="button"
              className="grade ok"
              onClick={() => handleGrade('hard')}
            >
              Hard
            </button>
            <button
              type="button"
              className="grade good"
              onClick={() => handleGrade('good')}
            >
              Good
            </button>
            <button
              type="button"
              className="grade great"
              onClick={() => handleGrade('easy')}
            >
              Easy
            </button>
          </div>

          <div className="divider" />
          <button type="button" className="secondary" onClick={onDone}>
            Done for now
          </button>
        </>
      )}
    </section>
  )
}
