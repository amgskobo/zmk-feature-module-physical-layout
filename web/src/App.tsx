import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.css";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import { connect as serial_connect } from "@zmkfirmware/zmk-studio-ts-client/transport/serial";
import type { KeyPhysicalAttrs } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import {
  ZMKConnection,
  ZMKCustomSubsystem,
  ZMKAppContext,
} from "@cormoran/zmk-studio-react-hook";
import {
  Request,
  Response,
  type PhysicalDevice,
  type RectPhysicalAttrs,
  type RotaryEncoder,
} from "./proto/zmk/physical_layouts/physical_layouts";

export const SUBSYSTEM_IDENTIFIER = "cormoran__physical_layouts";
const retiredConnections = new WeakSet<object>();

class LayoutTimeoutError extends Error {
  constructor() {
    super("Layout request timed out. Disconnect and reconnect to retry.");
  }
}

async function withLayoutDeadline<T>(
  load: () => Promise<T>,
  signal: AbortSignal
): Promise<T> {
  let timer: number | undefined;
  let retire!: () => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(new LayoutTimeoutError()), 5000);
    retire = () => reject(new Error("Layout request retired"));
    signal.addEventListener("abort", retire, { once: true });
  });
  try {
    return await Promise.race([
      deadline,
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return load();
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", retire);
  }
}

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Physical Layout Studio</h1>
        <p>Keyboard and module geometry</p>
      </header>

      <ZMKConnection
        renderDisconnected={({ connect, isLoading, error }) => (
          <section className="panel">
            <h2>Device Connection</h2>
            {isLoading && <p>Connecting...</p>}
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}
            {!isLoading && (
              <button
                className="btn btn-primary"
                onClick={() => connect(serial_connect)}
              >
                Connect Serial
              </button>
            )}
          </section>
        )}
        renderConnected={({ disconnect, deviceName }) => (
          <>
            <section className="panel">
              <h2>Device Connection</h2>
              <div className="device-info">
                <h3>Connected to: {deviceName}</h3>
              </div>
              <button className="btn btn-secondary" onClick={disconnect}>
                Disconnect
              </button>
            </section>

            <PhysicalLayoutSection />
          </>
        )}
      />

      <footer className="app-footer">
        <p>Custom Studio RPC subsystem: {SUBSYSTEM_IDENTIFIER}</p>
      </footer>
    </div>
  );
}

type LayoutState = {
  keys: KeyPhysicalAttrs[];
  activeLayoutName: string | null;
  modules: PhysicalDevice[];
  rotaryEncoders: RotaryEncoder[];
};

const EMPTY_LAYOUT: LayoutState = {
  keys: [],
  activeLayoutName: null,
  modules: [],
  rotaryEncoders: [],
};

type ModulePresentation = {
  kind: "trackball" | "rotary-encoder" | "touch-pad" | "custom-module";
  identifier: string;
  displayName: string;
  enabled: boolean;
  label: string;
  attrs: RectPhysicalAttrs;
  sizeText: string;
  links: PhysicalDevice["links"];
};

function modulePresentations(module: PhysicalDevice): ModulePresentation[] {
  if (module.trackball?.attrs) {
    return [
      {
        kind: "trackball",
        identifier: module.identifier,
        displayName: module.displayName,
        enabled: module.enabled,
        label: "trackball",
        attrs: {
          x: module.trackball.attrs.x,
          y: module.trackball.attrs.y,
          width: module.trackball.attrs.size,
          height: module.trackball.attrs.size,
          r: 0,
          rx: 0,
          ry: 0,
        },
        sizeText: `${module.trackball.attrs.size} x ${module.trackball.attrs.size}`,
        links: module.links,
      },
    ];
  }

  if (module.touchPad?.attrs) {
    return [
      {
        kind: "touch-pad",
        identifier: module.identifier,
        displayName: module.displayName,
        enabled: module.enabled,
        label: "touch pad",
        attrs: module.touchPad.attrs,
        sizeText: `${module.touchPad.attrs.width} x ${module.touchPad.attrs.height}`,
        links: module.links,
      },
    ];
  }

  if (module.customModule?.attrs) {
    return [
      {
        kind: "custom-module",
        identifier: module.identifier,
        displayName: module.displayName,
        enabled: module.enabled,
        label: module.customModule.type || "custom module",
        attrs: module.customModule.attrs,
        sizeText: `${module.customModule.attrs.width} x ${module.customModule.attrs.height}`,
        links: module.links,
      },
    ];
  }

  return [];
}

function rotaryEncoderPresentation(
  encoder: RotaryEncoder,
  index: number
): ModulePresentation[] {
  if (!encoder.attrs) return [];

  return [
    {
      kind: "rotary-encoder",
      identifier: `rotary-encoder:${index}`,
      displayName: `Rotary Encoder ${index}`,
      enabled: encoder.enabled,
      label: "rotary encoder",
      attrs: {
        x: encoder.attrs.x,
        y: encoder.attrs.y,
        width: encoder.attrs.size,
        height: encoder.attrs.size,
        r: 0,
        rx: 0,
        ry: 0,
      },
      sizeText: `${encoder.attrs.size} x ${encoder.attrs.size}`,
      links: [],
    },
  ];
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function rotationDegrees(centidegrees: number) {
  return centidegrees / 100;
}

function geometryOf(item: KeyPhysicalAttrs | ModulePresentation) {
  return "attrs" in item ? item.attrs : item;
}

type LayoutGeometry = KeyPhysicalAttrs | RectPhysicalAttrs;

function rotatedBoundsOf(item: LayoutGeometry) {
  const corners = [
    { x: item.x, y: item.y },
    { x: item.x + item.width, y: item.y },
    { x: item.x + item.width, y: item.y + item.height },
    { x: item.x, y: item.y + item.height },
  ];

  if (!item.r) {
    return corners;
  }

  const radians = rotationDegrees(item.r) * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return corners.map((corner) => {
    const dx = corner.x - item.rx;
    const dy = corner.y - item.ry;

    return {
      x: item.rx + dx * cos - dy * sin,
      y: item.ry + dx * sin + dy * cos,
    };
  });
}

function buildViewBox(
  keys: KeyPhysicalAttrs[],
  presentations: ModulePresentation[]
) {
  const geometries: LayoutGeometry[] = [
    ...keys,
    ...presentations.map((module) => module.attrs),
  ];

  if (!geometries.length) {
    return { minX: 0, minY: 0, width: 600, height: 300 };
  }

  const points = geometries.flatMap(rotatedBoundsOf);
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const padding = 40;

  return {
    minX: minX - padding,
    minY: minY - padding,
    width: Math.max(maxX - minX + padding * 2, 200),
    height: Math.max(maxY - minY + padding * 2, 160),
  };
}

function transformFor(item: KeyPhysicalAttrs | ModulePresentation) {
  const attrs = geometryOf(item);

  return attrs.r
    ? `rotate(${rotationDegrees(attrs.r)} ${attrs.rx} ${attrs.ry})`
    : "";
}

export function PhysicalLayoutSection() {
  const zmkApp = useContext(ZMKAppContext);
  const [view, setView] = useState<{
    connection: unknown;
    subsystemIndex: number | undefined;
    layout: LayoutState;
    error: string | null;
    isLoading: boolean;
  }>({
    connection: null,
    subsystemIndex: undefined,
    layout: EMPTY_LAYOUT,
    error: null,
    isLoading: false,
  });
  const generation = useRef(0);
  const pendingLoad = useRef<AbortController | null>(null);

  const subsystem = zmkApp?.findSubsystem(SUBSYSTEM_IDENTIFIER);
  const connection = zmkApp?.state.connection;
  const subsystemIndex = subsystem?.index;
  const current =
    view.connection === connection && view.subsystemIndex === subsystemIndex;
  const layout = current ? view.layout : EMPTY_LAYOUT;
  const error = current ? view.error : null;
  const isLoading = current && view.isLoading;

  const loadPhysicalLayout = useCallback(async () => {
    if (!connection || subsystemIndex === undefined) return;

    const token = ++generation.current;
    pendingLoad.current?.abort();
    const controller = new AbortController();
    pendingLoad.current = controller;
    const active = () => token === generation.current;
    setView((previous) => ({
      connection,
      subsystemIndex,
      layout:
        previous.connection === connection &&
        previous.subsystemIndex === subsystemIndex
          ? previous.layout
          : EMPTY_LAYOUT,
      error: null,
      isLoading: true,
    }));

    try {
      if (retiredConnections.has(connection)) {
        throw new LayoutTimeoutError();
      }
      const service = new ZMKCustomSubsystem(connection, subsystemIndex);

      const request = Request.create({
        getPhysicalLayout: {},
      });

      const payload = Request.encode(request).finish();
      const [modulePayload, keymapResponse] = await withLayoutDeadline(
        () =>
          Promise.all([
            service.callRPC(payload),
            call_rpc(connection, {
              keymap: { getPhysicalLayouts: true },
            }).catch(() => null),
          ]),
        controller.signal
      );
      if (!active()) return;

      const physicalLayouts = keymapResponse?.keymap?.getPhysicalLayouts;
      const activeLayout =
        physicalLayouts?.layouts[physicalLayouts.activeLayoutIndex];

      const nextLayout: LayoutState = {
        keys: activeLayout?.keys ?? [],
        activeLayoutName: activeLayout?.name ?? null,
        modules: [],
        rotaryEncoders: [],
      };

      if (modulePayload) {
        const resp = Response.decode(modulePayload);
        if (resp.physicalLayout) {
          nextLayout.modules = resp.physicalLayout.devices;
          nextLayout.rotaryEncoders = resp.physicalLayout.rotaryEncoders ?? [];
        } else if (resp.error) {
          throw new Error(resp.error.message);
        }
      }

      setView((previous) => ({ ...previous, layout: nextLayout }));
    } catch (error) {
      if (error instanceof LayoutTimeoutError) {
        // A deadline does not cancel the SDK's pending stream read/global mutex.
        // Never queue more requests on this connection, even after a late reply.
        retiredConnections.add(connection);
      }
      if (active())
        setView((previous) => ({
          ...previous,
          error:
            error instanceof Error
              ? error.message
              : "Failed to load layout data",
        }));
    } finally {
      if (pendingLoad.current === controller) pendingLoad.current = null;
      if (active()) setView((previous) => ({ ...previous, isLoading: false }));
    }
  }, [connection, subsystemIndex]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPhysicalLayout(), 0);
    return () => {
      window.clearTimeout(timer);
      ++generation.current;
      pendingLoad.current?.abort();
      pendingLoad.current = null;
    };
  }, [loadPhysicalLayout]);

  const physicalModules = useMemo(
    () => [
      ...layout.modules.flatMap(modulePresentations),
      ...layout.rotaryEncoders.flatMap(rotaryEncoderPresentation),
    ],
    [layout.modules, layout.rotaryEncoders]
  );
  const viewBox = useMemo(
    () => buildViewBox(layout.keys, physicalModules),
    [layout.keys, physicalModules]
  );

  if (!zmkApp) return null;

  if (!subsystem) {
    return (
      <section className="panel">
        <div className="warning-message">
          <p>
            Subsystem "{SUBSYSTEM_IDENTIFIER}" not found. Make sure your
            firmware includes the physical layout module.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel layout-panel">
      <div className="section-heading">
        <div>
          <h2>Physical Layout</h2>
          <p>
            {pluralize(layout.keys.length, "keyswitch", "keyswitches")},{" "}
            {pluralize(physicalModules.length, "module")}
            {layout.activeLayoutName ? `, ${layout.activeLayoutName}` : ""}
          </p>
        </div>
        <button
          className="btn btn-primary"
          disabled={isLoading}
          onClick={() => void loadPhysicalLayout()}
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <svg
        className="layout-canvas"
        role="img"
        aria-label="Physical layout"
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      >
        {layout.keys.map((key, index) => (
          <g
            className="layout-keyswitch"
            key={`key-${index}`}
            transform={transformFor(key)}
          >
            <rect
              className="layout-key"
              x={key.x}
              y={key.y}
              width={key.width}
              height={key.height}
              rx={6}
            />
            <text
              className="layout-key-label"
              x={key.x + key.width / 2}
              y={key.y + key.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {index}
            </text>
          </g>
        ))}
        {physicalModules.map((presentation) => {
          const cornerRadius =
            presentation.kind === "trackball" ||
            presentation.kind === "rotary-encoder"
              ? presentation.attrs.width / 2
              : 8;

          return (
            <g
              className={presentation.enabled ? "" : "layout-module-disabled"}
              key={presentation.identifier}
              transform={transformFor(presentation)}
            >
              <rect
                className={`layout-module layout-module-${presentation.kind}`}
                x={presentation.attrs.x}
                y={presentation.attrs.y}
                width={presentation.attrs.width}
                height={presentation.attrs.height}
                rx={cornerRadius}
              />
              <text
                className="layout-module-label"
                x={presentation.attrs.x + presentation.attrs.width / 2}
                y={presentation.attrs.y + presentation.attrs.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {presentation.displayName}
              </text>
            </g>
          );
        })}
      </svg>

      {error && <p className="error-message">{error}</p>}

      {physicalModules.length > 0 && (
        <div className="module-list">
          {physicalModules.map((presentation) => {
            return (
              <article className="module-row" key={presentation.identifier}>
                <div>
                  <h3>{presentation.displayName}</h3>
                  <p>
                    {presentation.label}
                    {presentation.enabled ? "" : " disabled"}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>Position</dt>
                    <dd>
                      {presentation.attrs.x}, {presentation.attrs.y}
                    </dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{presentation.sizeText}</dd>
                  </div>
                  <div>
                    <dt>Links</dt>
                    <dd>
                      {presentation.links.length
                        ? presentation.links
                            .map(
                              (link) =>
                                `${link.deviceIdentifier} (${link.subsystemIdentifier})`
                            )
                            .join(", ")
                        : "None"}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default App;
