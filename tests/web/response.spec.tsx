import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  createConnectedMockZMKApp,
  ZMKAppProvider,
} from "@cormoran/zmk-studio-react-hook/testing";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import { PhysicalLayoutSection, SUBSYSTEM_IDENTIFIER } from "../../web/src/App";
import { Response } from "../../web/src/proto/zmk/physical_layouts/physical_layouts";

jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({ call_rpc: jest.fn() }));

const payload = (response: Parameters<typeof Response.create>[0]) =>
  Response.encode(Response.create(response)).finish();
const valid = () =>
  payload({
    physicalLayout: {
      devices: [
        {
          identifier: "ball",
          displayName: "Retained ball",
          enabled: true,
          trackball: { attrs: { x: -100, y: 200, size: 120 } },
        },
      ],
    },
  });
const invalidResponses = [
  ["missing payload", null],
  ["empty payload", new Uint8Array()],
  ["unknown response", Uint8Array.from([0x1a, 0])],
  ["empty error response", payload({ error: {} })],
  [
    "trackball without attributes",
    payload({
      physicalLayout: { devices: [{ identifier: "ball", trackball: {} }] },
    }),
  ],
  [
    "encoder without attributes",
    payload({ physicalLayout: { rotaryEncoders: [{}] } }),
  ],
  [
    "touch pad without attributes",
    payload({
      physicalLayout: { devices: [{ identifier: "pad", touchPad: {} }] },
    }),
  ],
  [
    "custom module without attributes",
    payload({
      physicalLayout: { devices: [{ identifier: "custom", customModule: {} }] },
    }),
  ],
  ...[0, -1].flatMap((size) => [
    [
      `trackball size ${size}`,
      payload({
        physicalLayout: {
          devices: [{ identifier: "ball", trackball: { attrs: { size } } }],
        },
      }),
    ],
    [
      `encoder size ${size}`,
      payload({ physicalLayout: { rotaryEncoders: [{ attrs: { size } }] } }),
    ],
    [
      `touch pad width ${size}`,
      payload({
        physicalLayout: {
          devices: [
            {
              identifier: "pad",
              touchPad: { attrs: { width: size, height: 100 } },
            },
          ],
        },
      }),
    ],
    [
      `custom module height ${size}`,
      payload({
        physicalLayout: {
          devices: [
            {
              identifier: "custom",
              customModule: { attrs: { width: 100, height: size } },
            },
          ],
        },
      }),
    ],
    [
      `touch pad height ${size}`,
      payload({
        physicalLayout: {
          devices: [
            {
              identifier: "pad",
              touchPad: { attrs: { width: 100, height: size } },
            },
          ],
        },
      }),
    ],
    [
      `custom module width ${size}`,
      payload({
        physicalLayout: {
          devices: [
            {
              identifier: "custom",
              customModule: { attrs: { width: size, height: 100 } },
            },
          ],
        },
      }),
    ],
  ]),
] as const;

async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}
function showPanel() {
  const app = createConnectedMockZMKApp({
    subsystems: [SUBSYSTEM_IDENTIFIER],
  });
  return render(
    <ZMKAppProvider value={app}>
      <PhysicalLayoutSection />
    </ZMKAppProvider>,
  );
}

describe("Physical layout response boundary", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it.each(invalidResponses)(
    "rejects %s, retains a loaded layout, and recovers on the same connection",
    async (_name, rejected) => {
      let bytes: Uint8Array | null = valid();
      (call_rpc as jest.Mock).mockImplementation((_connection, request) =>
        Promise.resolve(
          request.custom ? { custom: { call: { payload: bytes } } } : {},
        ),
      );
      showPanel();
      await settle();
      expect(screen.getByText("0 keyswitches, 1 module")).toBeInTheDocument();
      bytes = rejected;
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await settle();
      expect(document.querySelector(".error-message")).toHaveTextContent(
        /physical layout response/i,
      );
      expect(screen.getByText("0 keyswitches, 1 module")).toBeInTheDocument();
      expect(screen.getAllByText("Retained ball")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
      bytes = payload({ physicalLayout: {} });
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await settle();
      expect(screen.getByText("0 keyswitches, 0 modules")).toBeInTheDocument();
      expect(document.querySelector(".error-message")).not.toBeInTheDocument();
      expect(call_rpc).toHaveBeenCalledTimes(6);
    },
  );

  it("renders every family, disabled encoder indexes, signed geometry and rotated bounds", async () => {
    const bytes = payload({
      physicalLayout: {
        devices: [
          {
            identifier: "ball",
            displayName: "Ball",
            enabled: true,
            trackball: { attrs: { x: 0, y: 0, size: 120 } },
          },
          {
            identifier: "pad",
            displayName: "Pad",
            touchPad: {
              attrs: {
                x: 500,
                y: 500,
                width: 200,
                height: 100,
                r: 9000,
                rx: 500,
                ry: 500,
              },
            },
          },
          {
            identifier: "custom",
            displayName: "Display",
            enabled: true,
            customModule: {
              type: "display",
              attrs: {
                x: -300,
                y: -200,
                width: 100,
                height: 50,
                r: -9000,
                rx: -300,
                ry: -200,
              },
            },
            links: [
              { deviceIdentifier: "synthetic", subsystemIdentifier: "test" },
            ],
          },
        ],
        rotaryEncoders: [
          { enabled: false, attrs: { x: 700, y: 100, size: 80 } },
          { enabled: true, attrs: { x: 800, y: 100, size: 60 } },
        ],
      },
    });
    (call_rpc as jest.Mock).mockImplementation((_connection, request) =>
      Promise.resolve(
        request.custom ? { custom: { call: { payload: bytes } } } : {},
      ),
    );
    showPanel();
    await settle();
    expect(screen.getByText("0 keyswitches, 5 modules")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Physical layout" }),
    ).toHaveAttribute("viewBox", "-340 -340 1240 1080");
    expect(
      document.querySelector('g[transform="rotate(90 500 500)"]'),
    ).toHaveClass("layout-module-disabled");
    expect(
      document.querySelector('g[transform="rotate(-90 -300 -200)"]'),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Rotary Encoder 0")).toHaveLength(2);
    expect(screen.getAllByText("Rotary Encoder 1")).toHaveLength(2);
    expect(document.querySelectorAll("g.layout-module-disabled")).toHaveLength(
      2,
    );
    expect(screen.getByText("synthetic (test)")).toBeInTheDocument();
  });

  it("rejects duplicate identifiers across families without leaving stale shapes on recovery", async () => {
    let bytes = valid();
    (call_rpc as jest.Mock).mockImplementation((_connection, request) =>
      Promise.resolve(
        request.custom ? { custom: { call: { payload: bytes } } } : {},
      ),
    );
    showPanel();
    await settle();
    const stable = {
      identifier: "stable",
      displayName: "Stable module",
      enabled: true,
      customModule: { attrs: { x: 0, y: 0, width: 100, height: 100 } },
    };
    bytes = payload({
      physicalLayout: {
        devices: [
          {
            identifier: "shared",
            displayName: "Ghost ball",
            trackball: { attrs: { x: 0, y: 0, size: 120 } },
          },
          {
            identifier: "shared",
            displayName: "Ghost pad",
            touchPad: { attrs: { x: 200, y: 0, width: 100, height: 100 } },
          },
          stable,
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await settle();
    const rejection = document.querySelector(".error-message")?.textContent;
    bytes = payload({ physicalLayout: { devices: [stable] } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await settle();
    expect(screen.getByText("0 keyswitches, 1 module")).toBeInTheDocument();
    expect(document.querySelectorAll("rect.layout-module")).toHaveLength(1);
    expect(document.querySelectorAll("article.module-row")).toHaveLength(1);
    expect(screen.queryByText("Ghost ball")).not.toBeInTheDocument();
    expect(screen.queryByText("Ghost pad")).not.toBeInTheDocument();
    expect(rejection).toMatch(
      /duplicate identifiers.*physical layout response/i,
    );
    expect(document.querySelector(".error-message")).not.toBeInTheDocument();
  });
});
