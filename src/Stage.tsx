import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { Audience } from './Audience.tsx'
import type { Seat } from '../shared/types.ts'

export type PerformanceState = {
  hits: Record<Seat, number>
  active: Record<Seat, boolean>
  bpm: number
}

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`
// Small, feathered displacements give the painted performers articulated motion:
// breath and sway, a plucking hand, piano wrists, drumsticks and cymbals.
// The displacement returns to zero at each boundary, leaving the room stationary.
const fragmentSource = `
precision mediump float;
varying vec2 uv;
uniform sampler2D scene;
uniform float time;
uniform float beat;
uniform vec4 hits;
uniform vec4 active;
float region(vec2 p, vec2 center, vec2 radius) {
  return 1. - smoothstep(.3, 1., length((p - center) / radius));
}
void main() {
  vec2 p = vec2(uv.x, 1. - uv.y);
  vec2 q = p;
  float sway = sin(time * beat * 3.14159);
  // horn, bass, piano, drums, in their left-to-right stage order
  float horn = region(p, vec2(.339, .49), vec2(.054, .155));
  q.x += horn * active.x * (.0026 * sway + .0012 * hits.x);
  q.y += region(p, vec2(.34,.355), vec2(.034,.041)) * active.x * .0018 * sway;
  q.x += region(p, vec2(.324,.47), vec2(.027,.07)) * hits.x * .002;
  float bass = region(p, vec2(.448,.49), vec2(.062,.16));
  q.x += bass * active.y * .0018 * sin(time * beat * 1.5708 + 1.);
  q.y += region(p, vec2(.449,.488), vec2(.034,.038)) * hits.y * .005;
  q.x += region(p, vec2(.469,.375), vec2(.022,.045)) * hits.y * .002;
  float piano = region(p, vec2(.583,.55), vec2(.05,.11));
  q.y += piano * active.z * .002 * sway;
  q.y += region(p, vec2(.619,.56), vec2(.035,.028)) * hits.z * .005;
  q.x += region(p, vec2(.59,.46), vec2(.032,.04)) * active.z * .0025 * sway;
  q.y += region(p, vec2(.817,.51), vec2(.05,.085)) * active.w * .0015 * sway;
  q.y += region(p, vec2(.804,.557), vec2(.03,.024)) * hits.w * .006;
  q.y -= region(p, vec2(.848,.54), vec2(.026,.024)) * hits.w * .006;
  q.y += region(p, vec2(.766,.512), vec2(.043,.023)) * hits.w * sin(time * 34.) * .0025;
  q.y += region(p, vec2(.894,.501), vec2(.035,.021)) * hits.w * sin(time * 30.) * .0025;
  vec3 color = texture2D(scene, vec2(q.x, 1. - q.y)).rgb;
  // Local candle flicker, never a flash over the whole scene.
  float candle = region(p, vec2(.386,.866), vec2(.033,.052))
    + region(p, vec2(.657,.806), vec2(.025,.044))
    + region(p, vec2(.661,.501), vec2(.024,.042));
  color += vec3(.045,.023,.005) * candle * (.5 + .5 * sin(time * 4.7) * sin(time * 7.1));
  gl_FragColor = vec4(color, 1.);
}
`

export function Stage({
  performance,
  visitors,
}: {
  performance: MutableRefObject<PerformanceState>
  visitors: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    })
    if (!gl) return
    const shaders: WebGLShader[] = []
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      shaders.push(shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource)
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()!
    if (!vertex || !fragment) {
      shaders.forEach((s) => gl.deleteShader(s))
      gl.deleteProgram(program)
      return
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((s) => gl.deleteShader(s))
      gl.deleteProgram(program)
      return
    }
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    const uniforms = {
      time: gl.getUniformLocation(program, 'time'),
      beat: gl.getUniformLocation(program, 'beat'),
      hits: gl.getUniformLocation(program, 'hits'),
      active: gl.getUniformLocation(program, 'active'),
    }
    let frame = 0
    let disposed = false
    let visible = true
    let loaded = false
    let lastFrame = 0
    const order: Seat[] = ['horn', 'bass', 'piano', 'drums']
    const render = (now: number) => {
      if (disposed) return
      frame = requestAnimationFrame(render)
      if (!loaded || !visible || document.hidden || now - lastFrame < 32) return
      if (reducedMotion.matches) {
        canvas.style.opacity = '0'
        return
      }
      lastFrame = now
      const state = performance.current
      gl.uniform1f(uniforms.time, now / 1000)
      gl.uniform1f(uniforms.beat, state.bpm / 60)
      gl.uniform4fv(
        uniforms.hits,
        order.map((seat) =>
          Math.exp(-Math.max(0, now - state.hits[seat]) / 110),
        ),
      )
      gl.uniform4fv(
        uniforms.active,
        order.map((seat) => (state.active[seat] ? 1 : 0)),
      )
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      canvas.style.opacity = '1'
    }
    const image = new Image()
    image.onload = () => {
      if (disposed) return
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      loaded = true
      frame = requestAnimationFrame(render)
    }
    image.src = '/art/club-empty.webp'
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    observer.observe(canvas)
    const lost = (event: Event) => {
      event.preventDefault()
      canvas.style.opacity = '0'
      loaded = false
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', lost)
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      shaders.forEach((shader) => gl.deleteShader(shader))
    }
  }, [performance])

  return (
    <div className="stage-art">
      <img
        src="/art/club-empty.webp"
        alt="Inside Jezz Quarter: a saxophonist, bassist, pianist and drummer playing in a blue-lit jazz club, seen from a candlelit table."
        fetchPriority="high"
        width="1659"
        height="948"
      />
      <canvas ref={canvasRef} aria-hidden="true" />
      <Audience visitors={visitors} />
    </div>
  )
}
