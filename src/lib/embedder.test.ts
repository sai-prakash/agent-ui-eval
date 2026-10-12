import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ infer: vi.fn(), load: vi.fn(), process: vi.fn(), gpu: vi.fn() }));
vi.mock('@huggingface/transformers', () => ({
  AutoConfig: { from_pretrained: vi.fn(async () => ({})) },
  AutoModel: { from_pretrained: mocks.load },
  AutoProcessor: { from_pretrained: vi.fn(async () => mocks.process) },
  env: { backends: { onnx: {} } },
  RawImage: class {},
}));
vi.mock('./gpu', () => ({ detectWebGPU: mocks.gpu, FORCE_WASM_KEY: 'cpu', AUTO_RESUME_KEY: 'resume', SIMULATE_GPU_FAIL: false }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.clearAllMocks(); });
it('reloads and resumes on failure in the first GPU image inference', async () => {
  const storage = new Map<string,string>();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => storage.get(k), setItem: (k: string,v: string) => storage.set(k,v) });
  mocks.gpu.mockResolvedValue(true); mocks.load.mockResolvedValue(mocks.infer);
  mocks.process.mockResolvedValue({}); mocks.infer.mockRejectedValue(new Error('GPU inference failed'));
  const { loadEmbedder } = await import('./embedder');
  await expect(loadEmbedder()).rejects.toThrow('gpu-failed');
  expect(mocks.infer).toHaveBeenCalledOnce();
  expect(storage.get('cpu')).toBe('1'); expect(storage.get('resume')).toBe('1');
});
it('uses self-hosted CPU binary after a GPU reload', async () => {
  vi.stubGlobal('sessionStorage', { getItem: () => '1' });
  vi.stubGlobal('location', { href: 'http://localhost/' });
  mocks.load.mockResolvedValue(mocks.infer);
  const { loadEmbedder } = await import('./embedder');
  expect(await loadEmbedder()).toEqual({ device:'wasm', dtype:'q8' });
  const { env } = await import('@huggingface/transformers');
  expect(env.backends.onnx?.wasm?.wasmPaths).toEqual({
    mjs:'http://localhost/ort/ort-wasm-simd-threaded.mjs', wasm:'http://localhost/ort/ort-wasm-simd-threaded.wasm',
  });
});
