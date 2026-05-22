import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { API_URL } from './data.js'
import { formatDate, statusLabel } from './utils.js'

const emptyOutputs = { summary: [], flashcards: [], quiz: [], concepts: [], qa: [] }
const welcomeMessages = [
  {
    role: 'assistant',
    content: 'Upload or select a source, then ask a question. Lexis answers from your material.',
  },
]

const icons = {
  add: 'M12 5v14m-7-7h14',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m6-6-6 6 6 6',
  book: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4 4V4z',
  card: 'M5 7h14v10H5V7zm3 3h8M8 14h5',
  chat: 'M4 5h16v11H8l-4 4V5z',
  check: 'M5 13l4 4L19 7',
  close: 'M7 7l10 10M17 7 7 17',
  doc: 'M7 3h7l4 4v14H7V3zm7 0v5h5',
  home: 'M4 11 12 4l8 7v9H5v-9z',
  logo: 'M12 3l2.2 5.6L20 11l-5.8 2.4L12 21l-2.2-7.6L4 11l5.8-2.4L12 3z',
  menu: 'M5 7h14M5 12h14M5 17h14',
  note: 'M7 5h10M7 9h10M7 13h7M5 3h14v18H5V3z',
  search: 'M10 4a6 6 0 1 0 4.2 10.2L20 20',
  send: 'M5 12 19 5l-4 14-3-6-7-1z',
  spark: 'M12 3l1.2 5.2L18 10l-4.8 1.8L12 17l-1.2-5.2L6 10l4.8-1.8L12 3z',
  trash: 'M6 7h12m-9 0V5h6v2m-7 3 .8 9m6.4-9-.8 9',
  upload: 'M12 16V5m0 0L8 9m4-4 4 4M5 19h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',
}

function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name] || icons.logo} />
    </svg>
  )
}

function LoadingDots({ label = 'Loading' }) {
  return (
    <span className="loading-dots" aria-label={label}>
      <i />
      <i />
      <i />
    </span>
  )
}

function isReady(document) {
  return document?.status === 'ready'
}

function initials(email = '') {
  return email.slice(0, 2).toUpperCase() || 'LX'
}

function contentOf(item) {
  if (!item) return ''
  if (typeof item === 'string') return item
  return item.content || item.summary || item.answer || item.explanation || JSON.stringify(item)
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('lexis_token') || '')
  const [user, setUser] = useState(null)
  const [authView, setAuthView] = useState('landing')
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [documents, setDocuments] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [mobilePanel, setMobilePanel] = useState('chat')
  const [outputs, setOutputs] = useState(emptyOutputs)
  const [messages, setMessages] = useState(welcomeMessages)
  const [question, setQuestion] = useState('')
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [activeArtifact, setActiveArtifact] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef(null)

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) || null,
    [documents, selectedId],
  )
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token])

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || data.detail || 'Request failed')
    return data
  }, [headers])

  const clearSession = useCallback(() => {
    localStorage.removeItem('lexis_token')
    setToken('')
    setUser(null)
    setDocuments([])
    setSelectedId('')
    setOutputs(emptyOutputs)
    setMessages(welcomeMessages)
    setActiveArtifact('')
    setAuthView('landing')
  }, [])

  const loadMe = useCallback(async () => {
    try {
      const data = await request('/auth/me')
      setUser(data.user)
    } catch {
      clearSession()
    }
  }, [clearSession, request])

  const loadDocuments = useCallback(async () => {
    setBusy('documents')
    try {
      const data = await request('/documents')
      const nextDocuments = data.data || []
      setDocuments(nextDocuments)
      setSelectedId((current) => current || nextDocuments[0]?.id || '')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy('')
    }
  }, [request])

  const refreshProcessingStatuses = useCallback(async () => {
    const processing = documents.filter((document) => document.status === 'processing')
    if (!processing.length) return

    try {
      const entries = await Promise.all(processing.map(async (document) => {
        const response = await request(`/documents/${document.id}/status`)
        const status = Array.isArray(response.data) ? response.data[0]?.status : response.data?.status
        return status ? [document.id, status] : null
      }))
      const statusMap = Object.fromEntries(entries.filter(Boolean))
      setDocuments((current) => current.map((document) => (
        statusMap[document.id] ? { ...document, status: statusMap[document.id] } : document
      )))
    } catch {
      await loadDocuments()
    }
  }, [documents, loadDocuments, request])

  const loadOutputs = useCallback(async (documentId) => {
    const safeLoad = async (path) => {
      try {
        const data = await request(path)
        return data.data || []
      } catch {
        return []
      }
    }

    const [summary, flashcards, quiz, concepts, qa] = await Promise.all([
      safeLoad(`/documents/${documentId}/summary`),
      safeLoad(`/documents/${documentId}/flashcards`),
      safeLoad(`/documents/${documentId}/quiz`),
      safeLoad(`/documents/${documentId}/concepts`),
      safeLoad(`/documents/${documentId}/qa`),
    ])

    setOutputs({ summary, flashcards, quiz, concepts, qa })
    setMessages(qa.length ? qa : welcomeMessages)
  }, [request])

  useEffect(() => {
    if (!token) return
    localStorage.setItem('lexis_token', token)
    loadMe()
    loadDocuments()
  }, [loadDocuments, loadMe, token])

  useEffect(() => {
    if (selectedDocument && token) loadOutputs(selectedDocument.id)
  }, [loadOutputs, selectedDocument, token])

  useEffect(() => {
    if (!token || !documents.some((document) => document.status === 'processing')) return undefined
    const timer = window.setInterval(refreshProcessingStatuses, 3000)
    return () => window.clearInterval(timer)
  }, [documents, refreshProcessingStatuses, token])

  async function submitAuth(event) {
    event.preventDefault()
    setBusy('auth')
    setNotice('')
    try {
      const data = await request(`/auth/${authMode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })

      if (authMode === 'register') {
        setAuthMode('login')
        setNotice('Account created. Sign in to continue.')
      } else {
        setToken(data.access_token)
        setUser(data.user)
      }
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy('')
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    setBusy('upload')
    setNotice('')

    try {
      const data = await request('/documents/upload', { method: 'POST', body: formData })
      setDocuments((current) => [data.document, ...current])
      setSelectedId(data.document.id)
      setNotice('Source uploaded. Lexis is processing it now.')
      setMobilePanel('chat')
      setActiveArtifact('')
      window.setTimeout(refreshProcessingStatuses, 1200)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy('')
      event.target.value = ''
    }
  }

  async function generate(kind) {
    if (!selectedDocument) {
      setNotice('Select a source first.')
      return
    }
    if (!isReady(selectedDocument)) {
      setNotice('This source is still processing. Tools unlock when it is ready.')
      await refreshProcessingStatuses()
      return
    }

    setBusy(kind)
    setNotice('')
    setActiveArtifact(kind)
    try {
      await request(`/documents/${selectedDocument.id}/${kind}`, { method: 'POST', body: JSON.stringify({}) })
      await loadOutputs(selectedDocument.id)
      setMobilePanel('studio')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy('')
    }
  }

  async function askQuestion(event, override) {
    event?.preventDefault()
    const text = (override || question).trim()
    if (!text || !selectedDocument) return
    if (!isReady(selectedDocument)) {
      setNotice('This source is still processing. Try again when it is ready.')
      await refreshProcessingStatuses()
      return
    }

    setQuestion('')
    setMessages((current) => [...current, { role: 'user', content: text }])
    setBusy('qa')
    setNotice('')

    try {
      const data = await request(`/documents/${selectedDocument.id}/qa`, {
        method: 'POST',
        body: JSON.stringify({ question: text }),
      })
      setMessages((current) => [...current, { role: 'assistant', content: data.answer, sources: data.sources }])
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message }])
    } finally {
      setBusy('')
    }
  }

  async function deleteDocument() {
    if (!selectedDocument) return
    setBusy('delete')
    setNotice('')
    try {
      await request(`/documents/${selectedDocument.id}`, { method: 'DELETE' })
      const remaining = documents.filter((document) => document.id !== selectedDocument.id)
      setDocuments(remaining)
      setSelectedId(remaining[0]?.id || '')
      setOutputs(emptyOutputs)
      setMessages(welcomeMessages)
      setActiveArtifact('')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy('')
    }
  }

  if (!token) {
    return authView === 'auth' ? (
      <AuthPage
        authEmail={authEmail}
        authMode={authMode}
        authPassword={authPassword}
        busy={busy}
        notice={notice}
        setAuthEmail={setAuthEmail}
        setAuthMode={setAuthMode}
        setAuthPassword={setAuthPassword}
        setAuthView={setAuthView}
        submitAuth={submitAuth}
      />
    ) : (
      <LandingPage setAuthMode={setAuthMode} setAuthView={setAuthView} />
    )
  }

  return (
    <main className="glass-app">
      <input ref={fileInput} className="file-input" type="file" accept=".pdf,.txt,.md,.doc,.docx" onChange={uploadFile} />
      {notice ? <button className="notice-toast" onClick={() => setNotice('')}><Icon name="close" /> {notice}</button> : null}
      <div className="mobile-tabs" role="tablist" aria-label="Workspace panels">
        {[
          ['sources', 'Sources'],
          ['chat', 'Chat'],
          ['studio', 'Studio'],
        ].map(([id, label]) => (
          <button className={mobilePanel === id ? 'active' : ''} key={id} onClick={() => setMobilePanel(id)}>{label}</button>
        ))}
      </div>
      <section className={`workspace-grid ${activeArtifact ? 'artifact-open' : ''}`}>
        <SourcesPanel
          active={mobilePanel === 'sources'}
          busy={busy}
          documents={documents}
          onSelect={(document) => {
            setSelectedId(document.id)
            setMobilePanel('chat')
          }}
          onUpload={() => fileInput.current?.click()}
          onLogout={clearSession}
          selectedId={selectedId}
          user={user}
        />
        <ChatPanel
          active={mobilePanel === 'chat'}
          askQuestion={askQuestion}
          busy={busy}
          document={selectedDocument}
          messages={messages}
          question={question}
          setQuestion={setQuestion}
        />
        <StudioPanel
          active={mobilePanel === 'studio'}
          activeArtifact={activeArtifact}
          busy={busy}
          deleteDocument={deleteDocument}
          document={selectedDocument}
          generate={generate}
          outputs={outputs}
          onOpenArtifact={(kind) => {
            setActiveArtifact(kind)
            setMobilePanel('studio')
          }}
          selectedAnswer={selectedAnswer}
          setSelectedAnswer={setSelectedAnswer}
        />
        {activeArtifact ? (
          <ArtifactPanel
            active={mobilePanel === 'studio'}
            artifact={activeArtifact}
            busy={busy}
            document={selectedDocument}
            generate={generate}
            onClose={() => setActiveArtifact('')}
            outputs={outputs}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
          />
        ) : null}
      </section>
    </main>
  )
}

function LandingPage({ setAuthMode, setAuthView }) {
  const features = [
    ['Upload your sources', 'Bring in PDFs, lecture notes, docs, markdown, and slides. Lexis turns them into a source-grounded study notebook.', 'upload'],
    ['Instant study insight', 'Ask questions, request summaries, and surface key relationships without leaving the notebook.', 'spark'],
    ['See the source', 'Keep answers beside the material they came from so your study loop stays verifiable and calm.', 'doc'],
    ['Practice actively', 'Generate flashcards, quizzes, concepts, and study summaries from your own class material.', 'card'],
  ]
  const useCases = [
    ['Power study sessions', 'Upload chapters and lectures, then ask Lexis to explain hard concepts in simpler language.', 'book', 'Explain glycolysis like I am revising at 11pm.'],
    ['Organize messy research', 'Turn scattered notes into summaries, concepts, and review questions before an exam or deadline.', 'note', '12 concepts found · 4 weak spots'],
    ['Review with momentum', 'Move from source chat to flashcards and quizzes without rebuilding context in another tool.', 'check', 'Card 7 of 24 · good recall'],
  ]
  const testimonials = [
    ['“Lexis makes dense papers feel approachable without losing the source.”', 'Maya, biomed student'],
    ['“The workspace finally keeps chat, notes, and review tools in one place.”', 'Jonas, software engineering'],
    ['“It feels like a calmer NotebookLM for class material.”', 'Anh, university student'],
  ]
  const faqs = [
    ['What can I upload?', 'Lexis currently supports PDFs, text, markdown, Word documents, and notes that can be processed into searchable study sources.'],
    ['Are answers grounded in my documents?', 'Yes. The chat and study tools are built around your uploaded sources, so outputs are based on the material inside the selected notebook.'],
    ['Can I generate flashcards and quizzes?', 'Yes. Use Studio to generate summaries, flashcards, quizzes, and key concepts from the selected source.'],
    ['Is this meant to replace reading?', 'No. Lexis is designed to help you understand, review, and verify your material faster while keeping the original source nearby.'],
  ]

  function openAuth(mode) {
    setAuthMode(mode)
    setAuthView('auth')
  }

  return (
    <main className="public-page">
      <nav className="public-nav">
        <Brand />
        <div>
          <a href="#features">Features</a>
          <a href="#use-cases">Use cases</a>
          <a href="#faq">FAQ</a>
        </div>
        <div>
          <button className="ghost-button" onClick={() => openAuth('login')}>Sign in</button>
          <button className="primary-button" onClick={() => openAuth('register')}>Start free</button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow"><Icon name="spark" /> Notebook-style learning, reimagined</span>
          <h1>Understand anything you upload.</h1>
          <p>Lexis is your AI study partner, grounded in the information you trust. Upload your sources, ask questions, and turn class material into summaries, flashcards, quizzes, and concepts.</p>
          <div className="hero-actions">
            <button className="primary-button big" onClick={() => openAuth('register')}>Create workspace <Icon name="arrow" /></button>
            <button className="ghost-button big" onClick={() => openAuth('login')}>I already have one</button>
          </div>
          <div className="hero-metrics">
            <span><strong>4</strong> study modes</span>
            <span><strong>1</strong> grounded chat</span>
            <span><strong>0</strong> tab juggling</span>
          </div>
        </div>

        <div className="hero-product" id="workspace">
          <div className="mini-topbar"><span /><span /><span /><strong>Lexis notebook</strong></div>
          <div className="mini-workspace">
            <aside>
              <strong>Sources</strong>
              <span className="active">DTAP.pdf</span>
              <span>Lecture notes.pdf</span>
              <span>Case brief.md</span>
            </aside>
            <section>
              <small>Ask your sources</small>
              <h3>What are the main clinical decision points?</h3>
              <p>The document emphasizes timing, contraindications, and follow-up review. Three source chunks support this answer.</p>
            </section>
            <aside>
              <strong>Studio</strong>
              <button>Summary</button>
              <button>Flashcards</button>
              <button>Quiz</button>
            </aside>
          </div>
          <div className="floating-card source-float">
            <Icon name="doc" />
            <span>Architecture.pdf</span>
            <strong>Ready</strong>
          </div>
          <div className="floating-card quiz-float">
            <Icon name="check" />
            <span>Quiz score</span>
            <strong>8 / 10</strong>
          </div>
        </div>
      </section>

      <section className="visual-flow" aria-label="Lexis workflow">
        {[
          ['Upload', 'Add sources'],
          ['Ask', 'Chat with context'],
          ['Create', 'Generate study tools'],
          ['Review', 'Practice with feedback'],
        ].map(([title, body], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{title}</strong>
            <small>{body}</small>
          </article>
        ))}
      </section>

      <section className="feature-band" id="features">
        {features.map(([title, body, icon]) => (
          <article key={title}>
            <Icon name={icon} />
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="use-case-section" id="use-cases">
        <div className="section-intro">
          <span className="eyebrow">How people use Lexis</span>
          <h2>From raw sources to actual understanding.</h2>
          <p>Keep the material, reasoning, and review workflow together instead of bouncing between disconnected AI outputs.</p>
        </div>
        <div className="use-case-grid">
          {useCases.map(([title, body, icon, preview]) => (
            <article key={title}>
              <Icon name={icon} />
              <h3>{title}</h3>
              <p>{body}</p>
              <div className="use-case-preview">
                <span>{preview}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="showcase-section">
        <div className="showcase-copy">
          <span className="eyebrow">Visual study workspace</span>
          <h2>Every output has somewhere useful to live.</h2>
          <p>Summaries, concepts, flashcards, and quizzes open into their own study surfaces, while your source chat stays nearby for follow-up questions.</p>
        </div>
        <div className="showcase-board">
          <article className="summary-preview">
            <span>Summary</span>
            <strong>Agility and Architecture</strong>
            <p>Key tension: adapting late while deciding structure early.</p>
          </article>
          <article className="flash-preview">
            <small>Flashcard</small>
            <strong>What is a walking skeleton?</strong>
            <span>Click to reveal</span>
          </article>
          <article className="concept-preview-card">
            <span>Concept map</span>
            <div><i /> <i /> <i /> <i /></div>
          </article>
        </div>
      </section>

      <section className="testimonial-section">
        <div className="section-intro">
          <span className="eyebrow">What people are saying</span>
          <h2>Built for students who want signal, not noise.</h2>
        </div>
        <div className="testimonial-track">
          {testimonials.map(([quote, person], index) => (
            <figure key={person}>
              <div className="testimonial-person">
                <span>{person.slice(0, 2).toUpperCase()}</span>
                <small>★★★★★</small>
              </div>
              <blockquote>{quote}</blockquote>
              <figcaption>{person}</figcaption>
              <em>{String(index + 1).padStart(2, '0')}</em>
            </figure>
          ))}
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="faq-intro">
          <span className="eyebrow">Wondering something?</span>
          <h2>Frequently asked questions</h2>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <Brand />
          <p>Your AI knowledge workspace for source-grounded study.</p>
        </div>
        <nav>
          <strong>Product</strong>
          <a href="#features">Features</a>
          <a href="#use-cases">Use cases</a>
          <a href="#faq">FAQ</a>
        </nav>
        <nav>
          <strong>Study tools</strong>
          <a>Summaries</a>
          <a>Flashcards</a>
          <a>Quizzes</a>
        </nav>
        <small>© 2026 Lexis. Built for focused learning.</small>
      </footer>
    </main>
  )
}

function AuthPage({ authEmail, authMode, authPassword, busy, notice, setAuthEmail, setAuthMode, setAuthPassword, setAuthView, submitAuth }) {
  return (
    <main className="auth-page">
      <button className="auth-brand" onClick={() => setAuthView('landing')}><Brand /></button>
      <form className="auth-card" onSubmit={submitAuth}>
        <span className="eyebrow"><Icon name="spark" /> Lexis account</span>
        <h1>{authMode === 'login' ? 'Welcome back' : 'Create your notebook'}</h1>
        <p>{authMode === 'login' ? 'Sign in to open your sources.' : 'Start a glassy source workspace in a few seconds.'}</p>
        <div className="auth-switch">
          <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Sign in</button>
          <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Register</button>
        </div>
        <Field label="Email" icon="user" value={authEmail} onChange={setAuthEmail} type="email" />
        <Field label="Password" icon="book" value={authPassword} onChange={setAuthPassword} type="password" />
        {notice ? <div className="inline-notice">{notice}</div> : null}
        <button className="primary-button full" disabled={busy === 'auth'}>{busy === 'auth' ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
    </main>
  )
}

function Field({ label, icon, value, onChange, type }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <Icon name={icon} />
        <input value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={label} required />
      </div>
    </label>
  )
}

function Brand() {
  return (
    <span className="brand">
      <span><Icon name="logo" /></span>
      <strong>Lexis</strong>
    </span>
  )
}

function SourcesPanel({ active, busy, documents, onLogout, onSelect, onUpload, selectedId, user }) {
  return (
    <aside className={`glass-panel sources-panel ${active ? 'mobile-active' : ''}`}>
      <div className="workspace-brandbar">
        <Brand />
        <button className="avatar-button" onClick={onLogout} title="Log out">{initials(user?.email)}</button>
      </div>
      <PanelHeading icon="book" title="Sources" meta={`${documents.length} uploaded`} />
      <button className="upload-drop" disabled={busy === 'upload'} onClick={onUpload}>
        {busy === 'upload' ? <LoadingDots label="Uploading source" /> : <Icon name="upload" />}
        <strong>{busy === 'upload' ? 'Uploading...' : 'Add source'}</strong>
        <span>PDF, notes, doc, or markdown</span>
      </button>
      <div className="source-list">
        {documents.length ? documents.map((document) => (
          <button className={selectedId === document.id ? 'active' : ''} key={document.id} onClick={() => onSelect(document)}>
            <span className="source-icon"><Icon name="doc" /></span>
            <span>
              <strong>{document.filename}</strong>
              <small>{formatDate(document.created_at)}</small>
            </span>
            <em className={`status-dot ${document.status}`} title={statusLabel(document.status)} />
          </button>
        )) : (
          <div className="empty-state">
            <Icon name="doc" />
            <p>Your uploaded material will appear here.</p>
          </div>
        )}
      </div>
    </aside>
  )
}

function ChatPanel({ active, askQuestion, busy, document, messages, question, setQuestion }) {
  const suggestions = ['Summarize this source', 'What should I review first?', 'Create a 20 minute study plan']
  const messageEndRef = useRef(null)

  useEffect(() => {
    if (!document) return
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [document, messages.length, busy])

  return (
    <section className={`glass-panel chat-panel ${active ? 'mobile-active' : ''}`}>
      <div className="document-title">
        <div>
          <span className={`status-pill ${document?.status || 'empty'}`}>{document ? statusLabel(document.status) : 'no source'}</span>
          <h1>{document?.filename || 'Select a source to begin'}</h1>
        </div>
        <Icon name="spark" />
      </div>

      <div className="message-list">
        {!document ? (
          <div className="chat-placeholder">
            <Icon name="chat" />
            <h2>Your source chat lives here</h2>
            <p>Add a source from the left panel, then ask for summaries, explanations, comparisons, or study plans.</p>
          </div>
        ) : null}
        {document ? messages.map((message, index) => (
          <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
            <span>{message.role === 'assistant' ? <Icon name="spark" /> : initials('you')}</span>
            <div>
              <p>{message.content}</p>
              {message.sources?.length ? (
                <div className="source-chips">
                  {message.sources.slice(0, 4).map((source) => <small key={source.chunk_index}>Chunk {source.chunk_index}</small>)}
                </div>
              ) : null}
            </div>
          </article>
        )) : null}
        {busy === 'qa' ? (
          <article className="message assistant typing-message">
            <span><Icon name="spark" /></span>
            <div>
              <LoadingDots label="Lexis is thinking" />
              <p>Lexis is reading your source...</p>
            </div>
          </article>
        ) : null}
        <div ref={messageEndRef} className="message-end" />
      </div>

      <div className="prompt-suggestions">
        {suggestions.map((item) => <button disabled={!document || busy === 'qa'} key={item} onClick={(event) => askQuestion(event, item)}>{item}</button>)}
      </div>
      <form className="ask-box" onSubmit={askQuestion}>
        <input disabled={!document} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={document ? 'Ask anything about this source...' : 'Select or upload a source first'} />
        <button disabled={!document || busy === 'qa'}>{busy === 'qa' ? <LoadingDots label="Sending question" /> : <Icon name="send" />}</button>
      </form>
    </section>
  )
}

function StudioPanel({ active, activeArtifact, busy, deleteDocument, document, generate, outputs, onOpenArtifact, selectedAnswer, setSelectedAnswer }) {
  const tools = [
    ['summary', 'Summary', 'Condense the source into clean notes.', 'note'],
    ['flashcards', 'Flashcards', 'Practice active recall from your material.', 'card'],
    ['quiz', 'Quiz', 'Test yourself with generated questions.', 'check'],
    ['concepts', 'Concepts', 'Extract key ideas and definitions.', 'spark'],
  ]

  return (
    <aside className={`glass-panel studio-panel ${active ? 'mobile-active' : ''}`}>
      <PanelHeading icon="spark" title="Studio" meta={document ? 'Source tools' : 'Waiting'} />
      <div className="tool-grid">
        {tools.map(([kind, title, body, icon]) => (
          <button className={`${activeArtifact === kind ? 'active' : ''} ${busy === kind ? 'loading' : ''}`} disabled={!document || busy === kind} key={kind} onClick={() => generate(kind)}>
            {busy === kind ? <LoadingDots label={`Generating ${title}`} /> : <Icon name={icon} />}
            <strong>{busy === kind ? 'Generating...' : title}</strong>
            <span>{body}</span>
          </button>
        ))}
      </div>

      <section className="output-stack">
        <OutputCard title="Summary" empty="No summary yet." action={outputs.summary.length ? () => onOpenArtifact('summary') : () => generate('summary')} actionLabel={outputs.summary.length ? 'Open' : 'Generate'}>
          {outputs.summary.slice(0, 2).map((item, index) => <p key={item.id || index}>{contentOf(item)}</p>)}
        </OutputCard>
        <OutputCard title="Flashcards" empty="Generate cards to study." action={outputs.flashcards.length ? () => onOpenArtifact('flashcards') : null} actionLabel="Open">
          {outputs.flashcards.slice(0, 3).map((card, index) => <p key={card.id || index}><strong>{card.front}</strong></p>)}
        </OutputCard>
        <QuizPreview outputs={outputs} onOpenQuiz={() => onOpenArtifact('quiz')} selectedAnswer={selectedAnswer} setSelectedAnswer={setSelectedAnswer} />
        <ConceptPreview onOpen={() => onOpenArtifact('concepts')} outputs={outputs} />
      </section>

      <div className="document-meta">
        <Meta label="Uploaded" value={formatDate(document?.created_at)} />
        <Meta label="Pages" value={document?.page_count || 'Processing'} />
        <button className="danger-button" disabled={!document || busy === 'delete'} onClick={deleteDocument}><Icon name="trash" /> Delete source</button>
      </div>
    </aside>
  )
}

function PanelHeading({ icon, meta, title }) {
  return (
    <header className="panel-heading">
      <div><Icon name={icon} /><strong>{title}</strong></div>
      <span>{meta}</span>
    </header>
  )
}

function OutputCard({ action, actionLabel = 'Generate', children, empty, title }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <article className="output-card">
      <header>
        <h2>{title}</h2>
        {action ? <button onClick={action}>{actionLabel}</button> : null}
      </header>
      {hasChildren ? children : <p className="muted">{empty}</p>}
    </article>
  )
}

function QuizPreview({ outputs, onOpenQuiz, selectedAnswer, setSelectedAnswer }) {
  const question = outputs.quiz[0]
  const options = Array.isArray(question?.options) ? question.options : Object.values(question?.options || {})

  return (
    <article className="output-card mini-quiz">
      <header>
        <h2>Quiz</h2>
        {question ? <button onClick={onOpenQuiz}>Open</button> : null}
      </header>
      {question ? (
        <>
          <p>{question.question}</p>
          {options.slice(0, 4).map((option, index) => (
            <button className={selectedAnswer === option ? 'selected' : ''} key={option} onClick={() => setSelectedAnswer(option)}>
              <span>{String.fromCharCode(65 + index)}</span>{option}
            </button>
          ))}
        </>
      ) : <p className="muted">Generate a quiz to preview questions.</p>}
    </article>
  )
}

function ConceptPreview({ onOpen, outputs }) {
  return (
    <OutputCard title="Concepts" empty="No concept map yet." action={outputs.concepts.length ? onOpen : null} actionLabel="Open">
      {outputs.concepts.slice(0, 4).map((concept, index) => (
        <details key={concept.id || index}>
          <summary>{concept.concept || concept.name || `Concept ${index + 1}`}</summary>
          <p>{concept.explanation || concept.definition || contentOf(concept)}</p>
        </details>
      ))}
    </OutputCard>
  )
}

function Meta({ label, value }) {
  return <div className="meta-row"><span>{label}</span><strong>{value || '-'}</strong></div>
}

function ArtifactPanel({ active, artifact, busy, document, generate, onClose, outputs, selectedAnswer, setSelectedAnswer }) {
  const labels = {
    summary: ['Summary', 'Generated notes from this source'],
    flashcards: ['Flashcards', 'Practice cards based on this source'],
    quiz: ['Quiz', 'Questions from your material'],
    concepts: ['Concepts', 'Key terms and explanations'],
  }
  const [title, subtitle] = labels[artifact] || labels.summary

  return (
    <section className={`glass-panel artifact-panel ${active ? 'mobile-active' : ''}`}>
      <header className="artifact-heading">
        <div>
          <button className="crumb-button" onClick={onClose}><Icon name="back" /> Studio</button>
          <h2>{title}</h2>
          <p>{subtitle}{document ? ` · ${document.filename}` : ''}</p>
        </div>
        <button className="icon-button" onClick={onClose} title="Close artifact"><Icon name="close" /></button>
      </header>

      <div className="artifact-body">
        {artifact === 'summary' ? <SummaryArtifact busy={busy} generate={generate} outputs={outputs} /> : null}
        {artifact === 'flashcards' ? <FlashcardArtifact outputs={outputs} /> : null}
        {artifact === 'quiz' ? <QuizArtifact outputs={outputs} selectedAnswer={selectedAnswer} setSelectedAnswer={setSelectedAnswer} /> : null}
        {artifact === 'concepts' ? <ConceptArtifact busy={busy} generate={generate} outputs={outputs} /> : null}
      </div>
    </section>
  )
}

function SummaryArtifact({ busy, generate, outputs }) {
  if (!outputs.summary.length) {
    return <ArtifactEmpty busy={busy === 'summary'} icon="note" label="Generate summary" onClick={() => generate('summary')} title="No summary has been generated yet." />
  }

  return (
    <div className="reading-artifact">
      {outputs.summary.map((item, index) => (
        <article key={item.id || index}>
          <span className="eyebrow"><Icon name="spark" /> Source summary</span>
          <p>{contentOf(item)}</p>
        </article>
      ))}
    </div>
  )
}

function FlashcardArtifact({ outputs }) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const cards = outputs.flashcards.length ? outputs.flashcards : [{ front: 'Generate flashcards to start studying.', back: 'Your answers will appear here.' }]
  const card = cards[index % cards.length]

  function nextCard() {
    setRevealed(false)
    setIndex((value) => (value + 1) % cards.length)
  }

  function previousCard() {
    setRevealed(false)
    setIndex((value) => (value - 1 + cards.length) % cards.length)
  }

  return (
    <>
      <button className={`study-card ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed((value) => !value)}>
        <small>{revealed ? 'Back' : 'Front'} · Card {index + 1} of {cards.length}</small>
        <p>{revealed ? card.back : card.front}</p>
        <span>Click to flip</span>
      </button>
      <div className="artifact-nav">
        <button onClick={previousCard}><Icon name="back" /> Previous</button>
        <span>{index + 1} / {cards.length}</span>
        <button onClick={nextCard}>Next <Icon name="arrow" /></button>
      </div>
      <div className="rating-row">
        {['Again', 'Hard', 'Good', 'Easy'].map((rating) => <button key={rating} onClick={nextCard}>{rating}</button>)}
      </div>
    </>
  )
}

function QuizArtifact({ outputs }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const questions = outputs.quiz.length ? outputs.quiz : [{ question: 'Generate a quiz from the studio panel to begin.', options: [] }]
  const question = questions[index % questions.length]
  const options = Array.isArray(question?.options) ? question.options : Object.values(question?.options || {})
  const selectedAnswer = answers[index] || ''
  const correctAnswer = question?.correct_answer || question?.answer || ''

  function optionLetter(option, optionIndex) {
    const match = String(option).match(/^\s*([A-D])\s*[:.)-]/i)
    return (match?.[1] || String.fromCharCode(65 + optionIndex)).toUpperCase()
  }

  function isCorrectOption(option, optionIndex) {
    const normalizedCorrect = String(correctAnswer).trim().toUpperCase()
    const normalizedOption = String(option).trim().toUpperCase()
    return normalizedCorrect === optionLetter(option, optionIndex) || normalizedCorrect === normalizedOption
  }

  function answerClass(option, optionIndex) {
    if (!selectedAnswer) return ''
    const isSelected = selectedAnswer === option
    const isCorrect = isCorrectOption(option, optionIndex)
    if (isCorrect) return 'correct'
    if (isSelected) return 'incorrect'
    return ''
  }

  function chooseAnswer(option) {
    setAnswers((current) => ({ ...current, [index]: option }))
  }

  function goToQuestion(nextIndex) {
    setIndex((nextIndex + questions.length) % questions.length)
  }

  return (
    <section className="quiz-modal">
      <div className="quiz-progress">
        <span className="status-pill ready">Question {index + 1} of {questions.length}</span>
        <span>{selectedAnswer ? (options.some((option, optionIndex) => selectedAnswer === option && isCorrectOption(option, optionIndex)) ? 'Correct' : 'Review answer') : 'Choose one answer'}</span>
      </div>
      <h2>{question?.question || 'Generate a quiz from the studio panel to begin.'}</h2>
      {options.map((option, index) => (
        <button className={answerClass(option, index)} key={option} onClick={() => chooseAnswer(option)}>
          <span>{String.fromCharCode(65 + index)}</span>{option}
        </button>
      ))}
      {selectedAnswer ? <p className="explanation">{question?.explanation || 'Answer saved.'}</p> : null}
      <div className="artifact-nav">
        <button onClick={() => goToQuestion(index - 1)}><Icon name="back" /> Previous</button>
        <span>{Object.keys(answers).length} answered</span>
        <button onClick={() => goToQuestion(index + 1)}>Next <Icon name="arrow" /></button>
      </div>
    </section>
  )
}

function ConceptArtifact({ busy, generate, outputs }) {
  if (!outputs.concepts.length) {
    return <ArtifactEmpty busy={busy === 'concepts'} icon="spark" label="Generate concepts" onClick={() => generate('concepts')} title="No concepts have been generated yet." />
  }

  return (
    <div className="concept-artifact">
      {outputs.concepts.map((concept, index) => (
        <article key={concept.id || index}>
          <strong>{concept.concept || concept.name || `Concept ${index + 1}`}</strong>
          <p>{concept.explanation || concept.definition || contentOf(concept)}</p>
        </article>
      ))}
    </div>
  )
}

function ArtifactEmpty({ busy, icon, label, onClick, title }) {
  return (
    <div className={`artifact-empty ${busy ? 'loading' : ''}`}>
      {busy ? <LoadingDots label={label} /> : <Icon name={icon} />}
      <h3>{busy ? 'Building this for you...' : title}</h3>
      {busy ? (
        <div className="loading-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <button className="primary-button" disabled={busy} onClick={onClick}>{busy ? 'Generating...' : label}</button>
    </div>
  )
}

export default App
