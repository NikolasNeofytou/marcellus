/**
 * WebGPU Renderer — GPU-accelerated geometry rendering with Canvas2D fallback.
 *
 * Architecture:
 *   1. On init, probe for WebGPU support (`navigator.gpu`).
 *   2. If available, create device/pipeline and render via instanced quads.
 *   3. If unavailable, fall back to the existing Canvas2D `canvasRenderer.ts`.
 *
 * The renderer exposes a backend-agnostic `ILayoutRenderer` interface so the
 * rest of the app never cares which path is active.
 */

import type { CanvasGeometry } from "../stores/geometryStore";
import type { LayerDef } from "../stores/layerStore";

// ── Public interface ──

export interface RenderViewport {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface ILayoutRenderer {
  readonly backend: "webgpu" | "canvas2d";
  init(canvas: HTMLCanvasElement): Promise<void>;
  resize(width: number, height: number): void;
  render(
    geometries: CanvasGeometry[],
    layers: LayerDef[],
    viewport: RenderViewport,
  ): void;
  destroy(): void;
}

// ── Feature detection ──

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// ── WebGPU implementation ──

/** Minimal WGSL shader for instanced axis-aligned rectangles. */
const RECT_SHADER = /* wgsl */ `
struct Uniforms {
  vpCenterX : f32,
  vpCenterY : f32,
  vpZoom    : f32,
  canvasW   : f32,
  canvasH   : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct RectInstance {
  @location(0) posMin  : vec2<f32>,  // layout min-x, min-y
  @location(1) posMax  : vec2<f32>,  // layout max-x, max-y
  @location(2) color   : vec4<f32>,
};

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) color     : vec4<f32>,
};

@vertex
fn vsMain(
  @builtin(vertex_index) vi : u32,
  inst : RectInstance,
) -> VSOut {
  // Unit quad: 0→(0,0) 1→(1,0) 2→(0,1) 3→(1,0) 4→(1,1) 5→(0,1)
  let quadX = select(0.0, 1.0, vi == 1u || vi == 3u || vi == 4u);
  let quadY = select(0.0, 1.0, vi == 2u || vi == 4u || vi == 5u);

  let lx = mix(inst.posMin.x, inst.posMax.x, quadX);
  let ly = mix(inst.posMin.y, inst.posMax.y, quadY);

  // Layout → NDC
  let sx = (lx - u.vpCenterX) * u.vpZoom / (u.canvasW * 0.5);
  let sy = (ly - u.vpCenterY) * u.vpZoom / (u.canvasH * 0.5);

  var out : VSOut;
  out.pos = vec4<f32>(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fsMain(inp : VSOut) -> @location(0) vec4<f32> {
  return inp.color;
}
`;

export class WebGPURenderer implements ILayoutRenderer {
  readonly backend = "webgpu" as const;

  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  private format!: GPUTextureFormat;
  private width = 0;
  private height = 0;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No WebGPU adapter");
    this.device = await adapter.requestDevice();

    const ctx = canvas.getContext("webgpu");
    if (!ctx) throw new Error("Cannot get webgpu context");
    this.context = ctx;

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: "premultiplied" });

    // Uniform buffer: 5 x f32
    this.uniformBuffer = this.device.createBuffer({
      size: 5 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = this.device.createShaderModule({ code: RECT_SHADER });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
    });

    this.uniformBindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: shaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 8 * 4, // 2 + 2 + 4 floats
            stepMode: "instance",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },   // posMin
              { shaderLocation: 1, offset: 8, format: "float32x2" },   // posMax
              { shaderLocation: 2, offset: 16, format: "float32x4" },  // color
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });

    this.width = canvas.width;
    this.height = canvas.height;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  render(
    geometries: CanvasGeometry[],
    layers: LayerDef[],
    vp: RenderViewport,
  ): void {
    // Build instance buffer from rect geometries
    const rects: number[] = [];
    for (const geom of geometries) {
      if (geom.type !== "rect" || geom.points.length < 2) continue;
      const layer = layers.find((l) => l.id === geom.layerId);
      if (!layer || !layer.visible) continue;
      const [p1, p2] = geom.points;
      const rgba = hexToRgbaArray(layer.color, layer.fillAlpha ?? 0.4);
      rects.push(
        Math.min(p1.x, p2.x), Math.min(p1.y, p2.y),
        Math.max(p1.x, p2.x), Math.max(p1.y, p2.y),
        rgba[0], rgba[1], rgba[2], rgba[3],
      );
    }

    const instanceCount = rects.length / 8;
    if (instanceCount === 0) return;

    const instanceData = new Float32Array(rects);
    const instanceBuffer = this.device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(instanceBuffer, 0, instanceData);

    // Uniforms
    const uniforms = new Float32Array([vp.centerX, vp.centerY, vp.zoom, this.width, this.height]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.uniformBindGroup);
    pass.setVertexBuffer(0, instanceBuffer);
    pass.draw(6, instanceCount); // 6 verts per quad (triangle-list)
    pass.end();

    this.device.queue.submit([encoder.finish()]);
    instanceBuffer.destroy();
  }

  destroy(): void {
    this.uniformBuffer?.destroy();
    this.device?.destroy();
  }
}

// ── Canvas2D fallback ──

export class Canvas2DRenderer implements ILayoutRenderer {
  readonly backend = "canvas2d" as const;
  private ctx!: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get 2d context");
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  render(
    geometries: CanvasGeometry[],
    layers: LayerDef[],
    vp: RenderViewport,
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
    const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;

    for (const geom of geometries) {
      const layer = layers.find((l) => l.id === geom.layerId);
      if (!layer || !layer.visible) continue;

      ctx.fillStyle = hexToRgbaCSS(layer.color, layer.fillAlpha ?? 0.4);
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = 1;

      if (geom.type === "rect" && geom.points.length >= 2) {
        const [p1, p2] = geom.points;
        const sx = toSX(Math.min(p1.x, p2.x));
        const sy = toSY(Math.max(p1.y, p2.y));
        const sw = Math.abs(p2.x - p1.x) * vp.zoom;
        const sh = Math.abs(p2.y - p1.y) * vp.zoom;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx, sy, sw, sh);
      } else if (geom.type === "polygon" && geom.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(toSX(geom.points[0].x), toSY(geom.points[0].y));
        for (let i = 1; i < geom.points.length; i++) {
          ctx.lineTo(toSX(geom.points[i].x), toSY(geom.points[i].y));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  destroy(): void {
    // nothing to destroy
  }
}

// ── Factory ──

export async function createRenderer(canvas: HTMLCanvasElement): Promise<ILayoutRenderer> {
  if (isWebGPUAvailable()) {
    try {
      const renderer = new WebGPURenderer();
      await renderer.init(canvas);
      console.log("[OpenSilicon] Using WebGPU renderer");
      return renderer;
    } catch (err) {
      console.warn("[OpenSilicon] WebGPU init failed, falling back to Canvas2D:", err);
    }
  }
  const renderer = new Canvas2DRenderer();
  await renderer.init(canvas);
  console.log("[OpenSilicon] Using Canvas2D renderer (fallback)");
  return renderer;
}

// ── Utility ──

function hexToRgbaArray(hex: string, alpha: number): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b, alpha];
}

function hexToRgbaCSS(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
