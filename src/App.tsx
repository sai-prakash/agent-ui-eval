import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Header, LivePanel, PrivacyNote, liveError, pct, useAutoResume, type LiveState } from './components/Chrome';
import { friendlyError, GpuFailedError } from './lib/errors';
import { MODEL_ID } from './lib/model';
import { FIXTURES } from './lib/fixtures';
import { compareImages, DIFF_THRESHOLD, verdict, type VisualReport } from './lib/visual';
import { gradeAll, gradePair } from './lib/grading';
import { compareUploadedImages, rasterize } from './lib/raster';
import { MAX_UPLOAD_BYTES, validateUpload } from './lib/uploads';
import examplesData from './data/examples.json';

// Model code (Transformers.js + ONNX Runtime) loads only when you opt in.
const liveMod = () => import('./lib/eval');

const PRE_SIM: Record<string, number> = Object.fromEntries(examplesData.pairs.map((p) => [p.id, p.score]));
const KEY_LABEL = { spacing: 'Spacing', token: 'Colour token', missing_state: 'Missing state' } as const;

function Heatmap({ v }: { v: VisualReport }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(v.diff), v.width, v.height), 0, 0);
    ctx.strokeStyle = ctx.fillStyle = '#ffd60a';
    ctx.lineWidth = 2;
    ctx.font = `bold ${Math.max(12, Math.round(v.width / 36))}px sans-serif`;
    v.flags.forEach((f, i) => {
      ctx.strokeRect(f.box.x + 0.5, f.box.y + 0.5, f.box.w, f.box.h);
      ctx.fillText(String(i + 1), f.box.x + 3, Math.max(14, f.box.y - 3));
    });
  }, [v]);
  const n = v.flags.length;
  return (
    <canvas
      ref={ref}
      width={v.width}
      height={v.height}
      className="heatmap"
      aria-label={`Pixel difference heatmap: ${(v.diffPct * 100).toFixed(2)}% of pixels changed, ${n} flagged area${n === 1 ? '' : 's'}`}
    />
  );
}

/** Numbered to match the boxes drawn on the heatmap. */
function Flags({ v }: { v: VisualReport }) {
  return (
    <>
      <p className="small"><strong>Found automatically</strong> <span className="muted">(numbers match the yellow boxes)</span></p>
      {v.flags.length ? (
        <ol className="small" data-testid="auto-flags">{v.flags.map((x, i) => <li key={i}>{x.message}</li>)}</ol>
      ) : (
        <p className="small muted">Nothing flagged.</p>
      )}
    </>
  );
}

function PixelLine({ v }: { v: VisualReport }) {
  return (
    <p className="small">
      Pixels changed: {(v.diffPct * 100).toFixed(2)}% <span className="muted">(passes at {(DIFF_THRESHOLD * 100).toFixed(1)}% or less with nothing flagged)</span>
    </p>
  );
}

function ModelSimilarity({ score, source }: { score: number; source: string }) {
  return (
    <p className="secondary" data-testid="model-sim">
      Model similarity (context only): {score.toFixed(3)} cosine, {source}. It does not affect the verdict.
    </p>
  );
}

function Verdict({ pass }: { pass: boolean }) {
  return <span className={pass ? 'pass' : 'fail'}>{pass ? 'Pass' : 'Needs fixes'}</span>;
}

/** Local preview URL for an uploaded file, revoked when the file changes. */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
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
  const [own, setOwn] = useState<VisualReport | null>(null);
  const [ownSim, setOwnSim] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const aUrl = useObjectUrl(a);
  const bUrl = useObjectUrl(b);
  const generation = useRef(0);
  const invalidate = () => { generation.current++; setOwn(null); setOwnSim(null); setBusy(false); setErr(null); setLive(s => s.kind === 'loading' ? { kind: 'idle' } : s); };
  const pickFile = (file: File | null, setter: (file: File | null) => void) => {
    invalidate();
    try { if (file) validateUpload(file); setter(file); }
    catch (e) { setter(null); setErr(e instanceof Error ? e.message : String(e)); }
  };

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
  const grade = done ? gradeAll(FIXTURES.map((x) => ({ f: x, v: visual[x.id]! }))) : null;

  const startLive = async () => {
    invalidate();
    const request = ++generation.current;
    const current = () => request === generation.current;
    setLive({ kind: 'loading', progress: null, step: 'Loading the model code…' });
    try {
      const { loadEmbedder, similarityLive } = await liveMod();
      const info = await loadEmbedder((p) => { if (current()) setLive({ kind: 'loading', progress: p }); });
      const out = await similarityLive((d, t) => { if (current()) setLive({ kind: 'loading', progress: null, step: `Comparing pair ${d + 1} of ${t} in your browser…` }); });
      if (!current()) return;
      setSim(out);
      setSimSource('live');
      setLive({ kind: 'ready', device: info.device === 'webgpu' ? 'GPU' : 'CPU' });
    } catch (e) {
      if (current()) setLive(liveError(e));
      else if (e instanceof GpuFailedError) liveError(e); // Runtime recovery survives request invalidation.
    }
  };
  useAutoResume(() => void startLive());

  const runOwn = async () => {
    if (!a || !b) return;
    const modelReady = liveState.kind === 'ready';
    invalidate();
    const request = ++generation.current;
    const current = () => request === generation.current;
    setBusy(true);
    try {
      const result = await compareUploadedImages(a, b);
      if (!current()) return;
      setOwn(result);
      setBusy(false);
      // Model similarity is extra context, only when the user already loaded the model.
      if (modelReady) {
        try {
          const score = await (await liveMod()).compareOwn(a, b);
          if (current()) setOwnSim(score);
        } catch (e) { console.error(e); if (current()) setErr("The pixel checks above are done, but the model couldn't score this pair. Try Compare again."); }
      }
    } catch (e) {
      if (current()) { setBusy(false); setErr(e instanceof Error ? e.message : friendlyError(e)); }
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
            <button key={x.id} className="chip" aria-pressed={sel === x.id} onClick={() => { invalidate(); setSel(x.id); }}>
              {p !== null && <span className={p ? 'pass' : 'fail'} aria-label={p ? 'passes' : 'needs fixes'}>{p ? '✓' : '✗'}</span>} {x.label}
            </button>
          );
        })}
      </div>
      {visualErr && <p className="err small" role="alert">The pixel check couldn't read the sample images in this browser.</p>}

      <div className="card" style={{ marginTop: 16 }} data-testid="results">
        <div className="pair three">
          <div><p className="small muted">Approved design</p><img src={f.goldenSrc} alt={`${f.label}, approved design`} /></div>
          <div><p className="small muted">What the agent built</p><img src={f.agentSrc} alt={`${f.label}, agent version`} /></div>
          <div><p className="small muted">What changed (red = different pixels, yellow = flagged area)</p>{v && <Heatmap v={v} />}</div>
        </div>
        {v && (
          <>
            <h3>{f.label}: <Verdict pass={passOf(sel)!} /></h3>
            <PixelLine v={v} />
            <Flags v={v} />
            <p className="small"><strong>Answer key</strong> <span className="muted">(defects the demo author planted, used only to grade the checks above; the verdict never reads it)</span></p>
            {f.defects.length ? (
              <ul className="small">{gradePair(f, v).keyed.map((k, i) => <li key={i}>{k.caught ? '✓ caught' : '✗ missed'} · {KEY_LABEL[k.defect]}: {k.note}</li>)}</ul>
            ) : (
              <p className="small muted">None. This pair is the control: the agent matched the design.</p>
            )}
            <ModelSimilarity score={sim[sel]!} source={simSource === 'pre' ? 'precomputed' : 'computed in your browser'} />
          </>
        )}
      </div>
      <p className="note">
        The verdict comes from pixel differences plus the automated flags. Nothing else decides it.
      </p>
      {grade && (
        <p className="note" data-testid="catch-rate">
          <strong>On the sample data:</strong> across {grade.pairs} sample pairs, the checks caught {grade.caught} of {grade.total} planted
          defects in the right place (matching category and overlapping the planted area), and raised {grade.falsePositives} flag{grade.falsePositives === 1 ? '' : 's'} that
          {grade.falsePositives === 1 ? " doesn't" : " don't"} match any planted defect. Counted live in this browser. The thresholds were tuned on these same samples, so treat this as a sanity check, not a benchmark.
        </p>
      )}

      <h2 className="section-title">Check your own pair</h2>
      <div className="card upload">
        <p className="small muted">
          Runs the same pixel checks on your images, right here in your browser. No model download needed.
          PNG, JPEG, WebP, or SVG with a set width and height, up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB each.
        </p>
        <div className="row">
          <label className="field">
            <span>1. Approved design (the reference)</span>
            <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null, setA)} data-testid="upload-approved" />
          </label>
          <label className="field">
            <span>2. What the agent built</span>
            <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null, setB)} data-testid="upload-agent" />
          </label>
          <button className="btn primary" disabled={!a || !b || busy} onClick={() => void runOwn()}>
            {busy ? 'Comparing…' : 'Compare'}
          </button>
        </div>
        {err && <p className="err small" role="alert">{err}</p>}
        {own && (
          <div aria-live="polite" data-testid="own-result">
            <div className="pair three" style={{ marginTop: 12 }}>
              <div><p className="small muted">Approved design</p>{aUrl && <img src={aUrl} alt="Your approved design" />}</div>
              <div><p className="small muted">What the agent built</p>{bUrl && <img src={bUrl} alt="Your agent version" />}</div>
              <div><p className="small muted">What changed (red = different pixels, yellow = flagged area)</p><Heatmap v={own} /></div>
            </div>
            <h3>Your pair: <Verdict pass={verdict(null, own)} /></h3>
            {own.resizeNote && (
              <p className="small notice">
                The two images were different sizes. {own.resizeNote} Scaling can add small differences on its own, so read the flags with that in mind.
              </p>
            )}
            <PixelLine v={own} />
            <Flags v={own} />
            {ownSim !== null && <ModelSimilarity score={ownSim} source="computed in your browser" />}
          </div>
        )}
      </div>

      <h2 className="section-title">Optional: model similarity</h2>
      <p className="small muted">
        An image embedding model gives each pair an overall similarity score. It's shown for context only: on the samples it rates
        every pair between {pct(Math.min(...examplesData.pairs.map((p) => p.score)))} and {pct(Math.max(...examplesData.pairs.map((p) => p.score)))} similar,
        so it can't tell the planted mistakes apart.
      </p>
      <LivePanel state={liveState} onStart={startLive} readyText="Similarity was re-scored for every sample pair, and your own pairs will get a similarity score too." />

      <footer>Pixel diff: pixelmatch. Optional model: {MODEL_ID} via Transformers.js. Apache-2.0.</footer>
    </div>
  );
}
