import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Header, LivePanel, PrivacyNote, liveError, pct, useAutoResume, type LiveState } from './components/Chrome';
import { friendlyError } from './lib/errors';
import { MODEL_ID } from './lib/model';
import { FIXTURES, type FixtureCase } from './lib/fixtures';
import { compareImages, DIFF_THRESHOLD, KIND_TO_KEY, SIM_THRESHOLD, verdict, type VisualReport } from './lib/visual';
import { rasterize } from './lib/raster';
import examplesData from './data/examples.json';

// Model code (Transformers.js + ONNX Runtime) loads only when you opt in.
const liveMod = () => import('./lib/eval');

const PRE_SIM: Record<string, number> = Object.fromEntries(examplesData.pairs.map((p) => [p.id, p.score]));
const KEY_LABEL = { spacing: 'Spacing', token: 'Colour token', missing_state: 'Missing state' } as const;

function keyCaught(f: FixtureCase, v: VisualReport) {
  return f.defects.map((d, i) => ({
    label: `${KEY_LABEL[d]}: ${f.defectNotes[i] ?? ''}`,
    caught: v.flags.some((fl) => KIND_TO_KEY[fl.kind].includes(d)),
  }));
}

function Heatmap({ v, agentSrc }: { v: VisualReport; agentSrc: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(v.diff), v.width, v.height), 0, 0);
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 2;
    for (const f of v.flags) ctx.strokeRect(f.box.x + 0.5, f.box.y + 0.5, f.box.w, f.box.h);
  }, [v, agentSrc]);
  return <canvas ref={ref} width={v.width} height={v.height} style={{ width: '100%', borderRadius: 8 }} aria-label="Pixel difference heatmap" />;
}

export default function App() {
  const [liveState, setLive] = useState<LiveState>({ kind: 'idle' });
  const [sim, setSim] = useState<Record<string, number>>(PRE_SIM);
  const [simSource, setSimSource] = useState<'pre' | 'live'>('pre');
  const [visual, setVisual] = useState<Record<string, VisualReport>>({});
  const [visualErr, setVisualErr] = useState(false);
  const [sel, setSel] = useState(FIXTURES[0]!.id);
  const [a, setA] = useState<File | null>(null);
  const [b, setB] = useState<File | null>(null);
  const [own, setOwn] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ready = liveState.kind === 'ready';

  // Pixel + structure checks need no model: run them right away on page load.
  useEffect(() => {
    (async () => {
      try {
        const out: Record<string, VisualReport> = {};
        for (const f of FIXTURES) out[f.id] = compareImages(await rasterize(f.goldenSrc), await rasterize(f.agentSrc));
        setVisual(out);
      } catch (e) {
        console.error(e);
        setVisualErr(true);
      }
    })();
  }, []);

  const f = FIXTURES.find((x) => x.id === sel)!;
  const v = visual[sel];
  const passOf = (id: string) => (visual[id] ? verdict(sim[id] ?? null, visual[id]!) : null);
  const done = Object.keys(visual).length === FIXTURES.length;
  const passed = FIXTURES.filter((x) => passOf(x.id)).length;
  const keyTotals = done ? FIXTURES.flatMap((x) => keyCaught(x, visual[x.id]!)) : [];

  const startLive = async () => {
    setLive({ kind: 'loading', progress: null, step: 'Loading the model code…' });
    try {
      const { loadEmbedder, similarityLive } = await liveMod();
      const info = await loadEmbedder((p) => setLive({ kind: 'loading', progress: p }));
      const out = await similarityLive((d, t) => setLive({ kind: 'loading', progress: null, step: `Comparing pair ${d + 1} of ${t} in your browser…` }));
      setSim(out);
      setSimSource('live');
      setLive({ kind: 'ready', device: info.device === 'webgpu' ? 'GPU' : 'CPU' });
    } catch (e) {
      setLive(liveError(e));
    }
  };
  useAutoResume(() => void startLive());

  const runOwn = async () => {
    if (!a || !b) return;
    try {
      setOwn(await (await liveMod()).compareOwn(a, b));
      setErr(null);
    } catch (e) {
      setErr(friendlyError(e));
    }
  };

  return (
    <div className="page">
      <Header
        title="Agent UI Check"
        line="For teams letting AI agents build UI: compare what the agent built with the approved design, see exactly which pixels changed, and get flagged issues."
        repo="agent-ui-eval"
      />
      <PrivacyNote />

      <h2 className="section-title">
        {FIXTURES.length} sample pairs{done ? ` · ${passed} pass, ${FIXTURES.length - passed} need fixes` : ' · checking…'}
      </h2>
      <div className="chips" data-testid="examples">
        {FIXTURES.map((x) => {
          const p = passOf(x.id);
          return (
            <button key={x.id} className="chip" aria-pressed={sel === x.id} onClick={() => setSel(x.id)}>
              {p !== null && <span className={p ? 'pass' : 'fail'}>{p ? '✓' : '✗'}</span>} {x.label}
            </button>
          );
        })}
      </div>
      {visualErr && <p className="err small" role="alert">The pixel check couldn't read the sample images in this browser.</p>}

      <div className="card" style={{ marginTop: 16 }} data-testid="results">
        <div className="pair" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div><p className="small muted">Approved design</p><img src={f.goldenSrc} alt={`${f.label}, approved design`} /></div>
          <div><p className="small muted">What the agent built</p><img src={f.agentSrc} alt={`${f.label}, agent version`} /></div>
          <div><p className="small muted">What changed (red = different pixels, yellow = flagged area)</p>{v && <Heatmap v={v} agentSrc={f.agentSrc} />}</div>
        </div>
        {v && (
          <>
            <h3>
              {f.label}: <span className={passOf(sel) ? 'pass' : 'fail'}>{passOf(sel) ? 'Pass' : 'Needs fixes'}</span>
            </h3>
            <ul className="small">
              <li>Pixels changed: {(v.diffPct * 100).toFixed(2)}% (pass at {(DIFF_THRESHOLD * 100).toFixed(1)}% or less)</li>
              <li>Overall look, by the model: {pct(sim[sel]!)} similar (pass at {pct(SIM_THRESHOLD)} or more; {simSource === 'pre' ? 'precomputed' : 'computed in your browser'})</li>
            </ul>
            <p className="small"><strong>Found automatically</strong></p>
            {v.flags.length ? (
              <ul className="small" data-testid="auto-flags">{v.flags.map((x, i) => <li key={i}>{x.message}</li>)}</ul>
            ) : (
              <p className="small muted">Nothing flagged.</p>
            )}
            <p className="small"><strong>Answer key</strong> <span className="muted">(defects the demo author planted, used only to grade the checks above)</span></p>
            {f.defects.length ? (
              <ul className="small">{keyCaught(f, v).map((k, i) => <li key={i}>{k.caught ? '✓ caught' : '✗ missed'} · {k.label}</li>)}</ul>
            ) : (
              <p className="small muted">None. This pair is the control: the agent matched the design.</p>
            )}
          </>
        )}
      </div>
      <p className="note">
        The verdict comes from three automated signals: the pixel difference, simple checks that read the changed areas (new colours not in
        the approved palette, elements that moved, resized or disappeared), and the model's similarity score. The model alone rates every pair
        above 97% similar, so it can't catch small slips by itself.{' '}
        {done && `On these ${FIXTURES.length} sample pairs the checks catch ${keyTotals.filter((k) => k.caught).length} of ${keyTotals.length} planted defects and pass the control.`}{' '}
        The thresholds were tuned on these same samples, so treat that as a sanity check, not a benchmark.
      </p>

      <LivePanel state={liveState} onStart={startLive} readyText="Similarity was re-scored live for every pair. Compare two of your own images below." />
      <div className="row">
        <label className="small">Approved design <input type="file" accept="image/*" disabled={!ready} onChange={(e) => setA(e.target.files?.[0] ?? null)} /></label>
        <label className="small">Agent version <input type="file" accept="image/*" disabled={!ready} onChange={(e) => setB(e.target.files?.[0] ?? null)} /></label>
        <button className="btn" disabled={!ready || !a || !b} onClick={() => void runOwn()}>Compare</button>
        {own !== null && <span className="score">{pct(own)} similar</span>}
      </div>
      {err && <p className="err small" role="alert">{err}</p>}

      <footer>Model: {MODEL_ID} via Transformers.js. Pixel diff: pixelmatch. Apache-2.0.</footer>
    </div>
  );
}
