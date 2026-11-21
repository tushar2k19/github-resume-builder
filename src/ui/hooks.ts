import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

function subscribeQuery(query: string, cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(query);
  // Safari < 14 only has addListener.
  if (mq.addEventListener) {
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }
  mq.addListener(cb);
  return () => mq.removeListener(cb);
}

/** Live media query (listens for changes, not read once). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => subscribeQuery(query, cb),
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** One quiet motion toggle, persisted. Works alongside the OS prefers-reduced-motion setting. */
const MOTION_KEY = 'github-resume:motion-off';
const motionListeners = new Set<() => void>();
let motionOff = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MOTION_KEY) === '1';
  } catch {
    return false;
  }
})();

export function setMotionOff(next: boolean): void {
  motionOff = next;
  try {
    localStorage.setItem(MOTION_KEY, next ? '1' : '0');
  } catch {
    /* storage unavailable: the toggle still works for this tab */
  }
  motionListeners.forEach((l) => l());
}

export function useMotionOff(): boolean {
  return useSyncExternalStore(
    (cb) => {
      motionListeners.add(cb);
      return () => motionListeners.delete(cb);
    },
    () => motionOff,
    () => false,
  );
}

/** True when the OS asks for reduced motion OR the user switched motion off. */
export const usePrefersReducedMotion = (): boolean => {
  const os = useMediaQuery('(prefers-reduced-motion: reduce)');
  const off = useMotionOff();
  return os || off;
};
export const useFinePointer = (): boolean => useMediaQuery('(hover: hover) and (pointer: fine)');

/** True while the document is being printed (print media or before/afterprint). */
export function usePrinting(): boolean {
  const media = useMediaQuery('print');
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    const before = (): void => setFlag(true);
    const after = (): void => setFlag(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return media || flag;
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
  useEffect(() => {
    const onChange = (): void => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

/** True while the element intersects the viewport (with a small margin). */
export function useInViewport(ref: RefObject<Element>, rootMargin = '80px'): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) setInView(last.isIntersecting);
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

let webglCache: boolean | null = null;
export function detectWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webglCache = !!gl;
    const lose = (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export function useWebGL(): boolean {
  const [ok] = useState(() => (typeof document === 'undefined' ? false : detectWebGL()));
  return ok;
}
