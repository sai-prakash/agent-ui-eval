import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  MODEL_ID,
  loadEmbedder,
  type EmbedderProgress,
} from './lib/embedder';
import { FIXTURES, PASS_THRESHOLD } from './lib/fixtures';
import { lintSummary } from './lib/lint';
import {
  runEval,
  summarize,
  type EvalResult,
} from './lib/eval';

type Phase = 'boot' | 'model' | 'eval' | 'ready' | 'error';
type Filter = 'all' | 'pass' | 'fail';

function formatBytes(n?: number): string {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function scorePct(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [progress, setProgress] = useState<EmbedderProgress | null>(null);
  const [evalProgress, setEvalProgress] = useState({
    done: 0,
    total: FIXTURES.length,
    label: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [rows, setRows] = useState<EvalResult[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    (async () => {
      try {
        setPhase('model');
        await new Promise<void>((r) => setTimeout(r, 0));
        const info = await loadEmbedder((p) => setProgress(p));
        setDeviceLabel(`${info.device} · ${info.dtype}`);
        setPhase('eval');
        const out = await runEval((done, total, label) => {
          setEvalProgress({ done, total, label });
        });
        setRows(out);
        setSelectedId(out[0]?.fixture.id ?? null);
        setPhase('ready');
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    })();
  }, []);

  const summary = useMemo(() => summarize(rows), [rows]);

  const filtered = useMemo(() => {
    if (filter === 'pass') return rows.filter((r) => r.passed);
    if (filter === 'fail') return rows.filter((r) => !r.passed);
    return rows;
  }, [rows, filter]);

  const selected =
    rows.find((r) => r.fixture.id === selectedId) ?? filtered[0] ?? null;

  const progressPct = useMemo(() => {
    if (phase === 'model') {
      return Math.min(100, Math.max(0, progress?.progress ?? 0));
    }
    if (phase === 'eval') {
      return (evalProgress.done / Math.max(1, evalProgress.total)) * 100;
    }
    return phase === 'ready' ? 100 : 0;
  }, [phase, progress, evalProgress]);

  const statusText =
    phase === 'boot'
      ? 'Starting…'
      : phase === 'model'
        ? `Downloading ${MODEL_ID}`
        : phase === 'eval'
          ? `Scoring ${evalProgress.label || 'fixtures'} (${evalProgress.done}/${evalProgress.total})`
          : phase === 'ready'
            ? 'Ready'
            : 'Failed to load';

  const loading = phase !== 'ready' && phase !== 'error';

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              on-device agent UI eval
            </div>
            <h1>Agent UI Eval</h1>
            <p className="subtitle">
              Side-by-side golden vs agent component renders. EmbeddingGemma
              cosine similarity plus lint flags for spacing, color tokens, and
              missing states — all in your browser.
            </p>
          </div>
          <aside className="privacy">
            <strong>How it scores</strong>
            <div>
              Pass when similarity ≥ {(PASS_THRESHOLD * 100).toFixed(0)}% and
              no lint flags. Model stays on-device after first download.
            </div>
          </aside>
        </div>
        <div className="chips">
          {[
            'React',
            'TypeScript',
            'Transformers.js',
            'WebGPU',
            'EmbeddingGemma',
          ].map((chip) => (
            <span className="chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      </header>

      <section className="panel">
        {loading && (
          <div className="status">
            <div className="status-title">
              <span>{statusText}</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="bar">
              <span style={{ width: `${progressPct}%` }} />
            </div>
            <div className="meta">
              {phase === 'model' && (
                <>
                  {progress?.file ? `${progress.file} · ` : ''}
                  {formatBytes(progress?.loaded)}
                  {progress?.total ? ` / ${formatBytes(progress.total)}` : ''}
                </>
              )}
              {phase === 'eval' &&
                'Embedding golden and agent screenshots, computing cosine similarity…'}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="status">
            <div className="status-title">
              <span style={{ color: 'var(--danger)' }}>Load failed</span>
            </div>
            <div className="meta">{error}</div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="summary-row">
            <div className="stat">
              <div className="stat-label">Suite</div>
              <div className="stat-value">
                {summary.passed}/{summary.total} pass
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Failed</div>
              <div className="stat-value fail">{summary.failed}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Avg similarity</div>
              <div className="stat-value">{scorePct(summary.avgScore)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Threshold</div>
              <div className="stat-value">{scorePct(PASS_THRESHOLD)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Device</div>
              <div className="stat-value small">{deviceLabel || '—'}</div>
            </div>
          </div>
        )}

        <p className="hint">
          Model: <code>{MODEL_ID}</code>
          {deviceLabel ? ` · ${deviceLabel}` : ''} · lint kinds: spacing · token ·
          missing state
        </p>
      </section>

      {phase === 'ready' && (
        <>
          <div className="results-header">
            <h2>Fixtures</h2>
            <div className="filters">
              {(
                [
                  ['all', `All (${rows.length})`],
                  ['fail', `Fail (${summary.failed})`],
                  ['pass', `Pass (${summary.passed})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`filter-btn${filter === id ? ' active' : ''}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="layout">
            <div className="case-list">
              {filtered.map((row) => (
                <button
                  type="button"
                  key={row.fixture.id}
                  className={`case-item${selected?.fixture.id === row.fixture.id ? ' selected' : ''}${row.passed ? ' is-pass' : ' is-fail'}`}
                  onClick={() => setSelectedId(row.fixture.id)}
                >
                  <div className="case-top">
                    <span className="category">{row.fixture.category}</span>
                    <span className={`verdict${row.passed ? ' pass' : ' fail'}`}>
                      {row.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <div className="case-title">{row.fixture.label}</div>
                  <div className="case-meta">
                    <span>{scorePct(row.score)}</span>
                    <span>{lintSummary(row.flags)}</span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="empty">No fixtures in this filter.</div>
              )}
            </div>

            {selected && (
              <div className="detail">
                <div className="detail-header">
                  <div>
                    <div className="category">{selected.fixture.category}</div>
                    <h3>{selected.fixture.label}</h3>
                    <p>{selected.fixture.description}</p>
                  </div>
                  <div className="detail-score">
                    <div
                      className={`verdict large${selected.passed ? ' pass' : ' fail'}`}
                    >
                      {selected.passed ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="score-big">{scorePct(selected.score)}</div>
                    <div className="meta">
                      cosine vs ≥ {scorePct(PASS_THRESHOLD)}
                    </div>
                  </div>
                </div>

                <div className="compare">
                  <figure>
                    <figcaption>Golden</figcaption>
                    <div className="frame">
                      <img
                        src={selected.fixture.goldenSrc}
                        alt={`${selected.fixture.label} golden`}
                      />
                    </div>
                  </figure>
                  <figure>
                    <figcaption>Agent</figcaption>
                    <div className="frame">
                      <img
                        src={selected.fixture.agentSrc}
                        alt={`${selected.fixture.label} agent`}
                      />
                    </div>
                  </figure>
                </div>

                <div className="flags">
                  <h4>Lint flags</h4>
                  {selected.flags.length === 0 ? (
                    <div className="flag ok">No spacing / token / state issues</div>
                  ) : (
                    <ul>
                      {selected.flags.map((f, i) => (
                        <li key={`${f.kind}-${i}`} className={`flag ${f.severity}`}>
                          <span className="flag-kind">{f.kind.replace('_', ' ')}</span>
                          {f.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="grid skeleton-grid" aria-busy="true">
          {FIXTURES.slice(0, 6).map((f) => (
            <article className="card skeleton-card" key={f.id}>
              <div className="card-media skeleton-block" />
              <div className="card-body">
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="footer">
        <span>
          Built for portfolio use · Apache-2.0 · embeddings via Transformers.js
        </span>
        <a
          href="https://github.com/sai-prakash/agent-ui-eval"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
