import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  createConnectedMockZMKApp,
  ZMKAppProvider,
} from "@cormoran/zmk-studio-react-hook/testing";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import { PhysicalLayoutSection, SUBSYSTEM_IDENTIFIER } from "../../web/src/App";
import { Response } from "../../web/src/proto/zmk/physical_layouts/physical_layouts";

jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({ call_rpc: jest.fn() }));

const timeoutMessage =
  "Layout request timed out. Disconnect and reconnect to retry.";
const moduleReply = (name: string) => ({
  custom: {
    call: {
      payload: Response.encode(
        Response.create({
          physicalLayout: {
            devices: [
              {
                identifier: name,
                displayName: name,
                enabled: true,
                trackball: { attrs: { x: 0, y: 0, size: 120 } },
              },
            ],
          },
        }),
      ).finish(),
    },
  },
});
const keyReply = (name = "Current layout") => ({
  keymap: {
    getPhysicalLayouts: {
      activeLayoutIndex: 0,
      layouts: [
        {
          name,
          keys: [{ x: 0, y: 0, width: 100, height: 100, r: 0, rx: 0, ry: 0 }],
        },
      ],
    },
  },
});
const makeApp = () =>
  createConnectedMockZMKApp({ subsystems: [SUBSYSTEM_IDENTIFIER] });
type App = ReturnType<typeof makeApp>;
const panel = (app: App) => (
  <ZMKAppProvider value={app}>
    <PhysicalLayoutSection />
  </ZMKAppProvider>
);
async function advance(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe("Layout request deadline", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it.each(["success", "error"])(
    "bounds a lost official reply, retires its late %s and recovers on reconnect",
    async (outcome) => {
      const first = makeApp();
      const second = makeApp();
      let finish!: (value: ReturnType<typeof keyReply>) => void;
      let reject!: (error: Error) => void;
      const missing = new Promise<ReturnType<typeof keyReply>>(
        (resolve, fail) => {
          finish = resolve;
          reject = fail;
        },
      );
      (call_rpc as jest.Mock).mockImplementation((connection, request) => {
        if (request.custom)
          return Promise.resolve(
            moduleReply(connection === first.state.connection ? "old" : "new"),
          );
        return connection === first.state.connection
          ? missing
          : Promise.resolve(keyReply());
      });
      let view = render(panel(first));
      await advance();
      expect(call_rpc).toHaveBeenCalledTimes(2);
      await advance(4999);
      expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
      expect(screen.queryByText(timeoutMessage)).not.toBeInTheDocument();
      await advance(1);
      expect(screen.getByText(timeoutMessage)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await advance();
      expect(call_rpc).toHaveBeenCalledTimes(2);
      expect(screen.getByText(timeoutMessage)).toBeInTheDocument();
      await act(async () => {
        if (outcome === "success") finish(keyReply("Stale layout"));
        else reject(new Error("Stale failure"));
      });
      expect(screen.queryByText("Stale layout")).not.toBeInTheDocument();
      expect(screen.queryByText("Stale failure")).not.toBeInTheDocument();
      expect(screen.getByText(timeoutMessage)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await advance();
      expect(call_rpc).toHaveBeenCalledTimes(2);
      view.unmount();
      view = render(panel(first));
      await advance();
      expect(call_rpc).toHaveBeenCalledTimes(2);
      expect(screen.getByText(timeoutMessage)).toBeInTheDocument();
      view.rerender(panel(second));
      await advance();
      expect(
        screen.getByText("1 keyswitch, 1 module, Current layout"),
      ).toBeInTheDocument();
      expect(screen.getAllByText("new").length).toBeGreaterThan(0);
      expect(screen.queryByText(timeoutMessage)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    },
  );

  it("bounds a missing custom reply with the same reconnect requirement", async () => {
    (call_rpc as jest.Mock).mockImplementation((_connection, request) =>
      request.custom ? new Promise(() => {}) : Promise.resolve(keyReply()),
    );
    render(panel(makeApp()));
    await advance();
    await advance(5000);
    expect(screen.getByText(timeoutMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await advance();
    expect(call_rpc).toHaveBeenCalledTimes(2);
  });

  it("keeps public module geometry available when the official secured read rejects", async () => {
    (call_rpc as jest.Mock).mockImplementation((_connection, request) =>
      request.custom
        ? Promise.resolve(moduleReply("Public module"))
        : Promise.reject(new Error("Locked official read")),
    );
    render(panel(makeApp()));
    await advance();
    expect(screen.getByText("0 keyswitches, 1 module")).toBeInTheDocument();
    expect(screen.getAllByText("Public module").length).toBeGreaterThan(0);
    expect(screen.queryByText("Locked official read")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    // The selected SDK keeps its own timeout until it fires after success.
    await advance(5000);
    expect(screen.queryByText(timeoutMessage)).not.toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("recovers from a malformed module response without retiring a settled connection", async () => {
    const rpc = call_rpc as jest.Mock;
    rpc.mockImplementation((_connection, request) =>
      Promise.resolve(
        request.custom
          ? { custom: { call: { payload: Uint8Array.from([0x12, 0xff]) } } }
          : keyReply(),
      ),
    );
    render(panel(makeApp()));
    await advance();
    expect(document.querySelector(".error-message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    rpc.mockImplementation((_connection, request) =>
      Promise.resolve(request.custom ? moduleReply("Recovered") : keyReply()),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await advance();
    expect(screen.getAllByText("Recovered").length).toBeGreaterThan(0);
    expect(document.querySelector(".error-message")).not.toBeInTheDocument();
    await advance(5000);
    expect(document.querySelector(".error-message")).not.toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(["connection", "index", "unmount"])(
    "clears a retired deadline on %s without timing out the replacement",
    async (boundary) => {
      const first = makeApp();
      let index = 0;
      first.findSubsystem = jest.fn(() => ({
        index,
        identifier: SUBSYSTEM_IDENTIFIER,
      }));
      (call_rpc as jest.Mock).mockImplementation((_connection, request) =>
        request.custom
          ? Promise.resolve(moduleReply("Current module"))
          : new Promise(() => {}),
      );
      const view = render(panel(first));
      await advance();
      await advance(4000);
      if (boundary === "unmount") {
        view.unmount();
        await advance(60000);
        expect(jest.getTimerCount()).toBe(0);
        expect(call_rpc).toHaveBeenCalledTimes(2);
        return;
      }
      let finish!: (value: ReturnType<typeof keyReply>) => void;
      const pending = new Promise<ReturnType<typeof keyReply>>((resolve) => {
        finish = resolve;
      });
      (call_rpc as jest.Mock).mockImplementation((_connection, request) =>
        request.custom
          ? Promise.resolve(moduleReply("Replacement module"))
          : pending,
      );
      index = 1;
      view.rerender(panel(boundary === "connection" ? makeApp() : first));
      await advance();
      expect(call_rpc).toHaveBeenCalledTimes(4);
      await advance(1000);
      expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
      expect(screen.queryByText(timeoutMessage)).not.toBeInTheDocument();
      await act(async () => finish(keyReply("Replacement layout")));
      expect(
        screen.getByText("1 keyswitch, 1 module, Replacement layout"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
      await advance(60000);
      expect(screen.queryByText(timeoutMessage)).not.toBeInTheDocument();
      expect(jest.getTimerCount()).toBe(0);
    },
  );
});
