const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision mediump float;

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((uv.x - u_pointer.x) * aspect, uv.y - u_pointer.y);
  float distortion = (noise(uv * 22.0 + u_time * 0.12) - 0.5) * 0.008;
  float vertical = 1.0 - smoothstep(0.006, 0.052, abs(p.x + distortion));
  float horizontal = 1.0 - smoothstep(0.006, 0.052, abs(p.y - distortion));
  float cross = max(vertical, horizontal);
  float core = max(
    1.0 - smoothstep(0.0, 0.008, abs(p.x)),
    1.0 - smoothstep(0.0, 0.008, abs(p.y))
  );
  float radius = length(p);
  float pulse = 0.82 + 0.18 * sin(u_time * 1.7 - radius * 21.0);
  float fragments = step(0.91, noise(floor(uv * 90.0) + floor(u_time * 5.0)))
    * (1.0 - smoothstep(0.04, 0.34, min(abs(p.x), abs(p.y))));
  vec3 ember = mix(vec3(0.72, 0.09, 0.015), vec3(1.0, 0.38, 0.08), core);
  float alpha = cross * 0.22 * pulse + core * 0.18 + fragments * 0.16;
  gl_FragColor = vec4(ember, alpha);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function mountArenaField(canvas: HTMLCanvasElement): void {
  if (canvas.dataset.fieldMounted === "true") return;
  canvas.dataset.fieldMounted = "true";
  const window = canvas.ownerDocument.defaultView;
  if (!window || typeof canvas.getContext !== "function") return;

  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
  } catch {
    return;
  }
  if (!gl) return;

  const program = createProgram(gl);
  if (!program) return;
  const buffer = gl.createBuffer();
  const position = gl.getAttribLocation(program, "a_position");
  if (!buffer || position < 0) return;
  const resolution = gl.getUniformLocation(program, "u_resolution");
  const pointer = gl.getUniformLocation(program, "u_pointer");
  const time = gl.getUniformLocation(program, "u_time");

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.useProgram(program);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0, 0, 0, 0);
  canvas.dataset.fieldActive = "true";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const target = { x: 0.62, y: 0.52 };
  const current = { ...target };
  let visible = true;
  let frame = 0;
  let stopped = false;

  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  };

  const draw = (timestamp: number): void => {
    if (stopped) return;
    if (!canvas.isConnected) {
      stop();
      return;
    }
    frame = window.requestAnimationFrame(draw);
    if (!visible || canvas.ownerDocument.visibilityState === "hidden") return;
    resize();
    current.x += (target.x - current.x) * 0.055;
    current.y += (target.y - current.y) * 0.055;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform2f(pointer, current.x, 1 - current.y);
    gl.uniform1f(time, prefersReducedMotion.matches ? 0 : timestamp * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const move = (event: PointerEvent): void => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    target.x = Math.max(0.28, Math.min(0.82, (event.clientX - bounds.left) / bounds.width));
    target.y = Math.max(0.24, Math.min(0.76, (event.clientY - bounds.top) / bounds.height));
  };

  const resizeObserver = typeof window.ResizeObserver === "function"
    ? new window.ResizeObserver(resize)
    : null;
  resizeObserver?.observe(canvas);
  const intersectionObserver = typeof window.IntersectionObserver === "function"
    ? new window.IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? false;
      }, { rootMargin: "120px" })
    : null;
  intersectionObserver?.observe(canvas);
  canvas.addEventListener("pointermove", move, { passive: true });

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    window.cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    canvas.removeEventListener("pointermove", move);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };

  resize();
  frame = window.requestAnimationFrame(draw);
}
