import { useState } from 'react';
import './App.css';
import { Header, LivePanel, PrivacyNote, pct, type LiveState } from './components/Chrome';
import { friendlyError, loadEmbedder, MODEL_ID } from './lib/embedder';
import { FIXTURES, PASS_THRESHOLD } from './lib/fixtures';
import { compareOwn, runEvalLive, toResult, type EvalResult } from './lib/eval';
import examplesData from './data/examples.json';

const PRE: EvalResult[] = FIXTURES.map((f) => toResult(f, examplesData.pairs.find((p) => p.id === f.id)!.score));

export default function App() {
  const [live, setLive] = useState<LiveState>({ kind: 'idle' });
  const [rows, setRows] = useState<EvalResult[]>(PRE);
  const [source, setSource] = useState<'example' | 'live'>('example');
  const [sel, setSel] = useState(FIXTURES[0]!.id);
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [own, setOwn] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ready = live.kind === 'ready';
  const row = rows.find((r) => r.fixture.id === sel)!;
  const passed = rows.filter((r) => r.passed).length;

  const startLive = async () => {
    setLive({ kind: 'loading', progress: null });
    try {
      const info = await loadEmbedder((p) => setLive({ kind: 'loading', progress: p }));
      const out = await runEvalLive((d, t) => setLive({ kind: 'loading', progress: null, step: `Comparing pair ${d + 1} of ${t} in your browser…` }));
      setRows(out);
      setSource('live');
      setLive({ kind: 'ready', device: info.device === 'webgpu' ? 'GPU' : 'CPU' });
    } catch (e) {
      console.error(e);
      setLive({ kind: 'error', message: friendlyError(e) });
    }
  };

  const runOwn = async () => {
    if (!a || !b) return;
    try {
      setOwn(await compareOwn(a, b));
      setErr(null);
    } catch (e) {
      setErr(friendlyError(e));
    }
  };

  return (
    <div className="page">
      <Header
        title="Agent UI Check"
        line="For teams letting AI agents build UI: compare what the agent built with the approved design, side by side, and flag what's off."
        repo="agent-ui-eval"
      />
      <PrivacyNote />

      <h2 className="section-title">
        {FIXTURES.length} sample pairs · {passed} pass, {rows.length - passed} need fixes
        {source === 'example' ? ' (precomputed, no download)' : ' (re-run in your browser)'}
      </h2>
      <div className="chips" data-testid="examples">
        {rows.map((r) => (
          <button key={r.fixture.id} className="chip" aria-pressed={sel === r.fixture.id} onClick={() => setSel(r.fixture.id)}>
            <span className={r.passed ? 'pass' : 'fail'}>{r.passed ? '✓' : '✗'}</span> {r.fixture.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }} data-testid="results">
        <div className="pair">
          <div><p className="small muted">Approved design</p><img src={row.fixture.goldenSrc} alt={`${row.fixture.label}, approved design`} /></div>
          <div><p className="small muted">What the agent built</p><img src={row.fixture.agentSrc} alt={`${row.fixture.label}, agent version`} /></div>
        </div>
        <h3>
          {row.fixture.label}: <span className={row.passed ? 'pass' : 'fail'}>{row.passed ? 'Pass' : 'Needs fixes'}</span>
        </h3>
        <p>Looks {pct(row.score)} similar to the approved design (passes visually at {pct(PASS_THRESHOLD)} or more).</p>
        {row.flags.length > 0 ? (
          <ul className="small">{row.flags.map((f, i) => <li key={i}>{f.message}</li>)}</ul>
        ) : (
          <p className="small muted">No issues flagged. This pair is the control: the agent matched the design.</p>
        )}
      </div>
      <p className="note">
        Similarity comes from the model comparing the two images ({source === 'example' ? 'precomputed at build time' : 'computed just now in your browser'}).
        Honest caveat: every pair scores above 97%, so similarity alone misses small colour and spacing slips. The issues listed are the
        defects planted in each sample, which is why the rule checks matter more than the score here.
      </p>

      <LivePanel state={live} onStart={startLive} readyText="All pairs were re-scored live. Compare two of your own images below." />
      <div className="row">
        <label className="small">Approved design <input type="file" accept="image/*" disabled={!ready} onChange={(e) => setA(e.target.files?.[0] ?? null)} /></label>
        <label className="small">Agent version <input type="file" accept="image/*" disabled={!ready} onChange={(e) => setB(e.target.files?.[0] ?? null)} /></label>
        <button className="btn" disabled={!ready || !a || !b} onClick={() => void runOwn()}>Compare</button>
        {own !== null && <span className="score">{pct(own)} similar</span>}
      </div>
      {err && <p className="err small" role="alert">{err}</p>}

      <footer>Model: {MODEL_ID} via Transformers.js. Apache-2.0.</footer>
    </div>
  );
}
