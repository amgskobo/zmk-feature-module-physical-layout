import { act, render, screen, waitFor } from "@testing-library/react";
import {
  createConnectedMockZMKApp,
  ZMKAppProvider,
} from "@cormoran/zmk-studio-react-hook/testing";
import { call_rpc } from "@zmkfirmware/zmk-studio-ts-client";
import { PhysicalLayoutSection, SUBSYSTEM_IDENTIFIER } from "../../web/src/App";
import { Response } from "../../web/src/proto/zmk/physical_layouts/physical_layouts";

jest.mock("@zmkfirmware/zmk-studio-ts-client", () => ({ call_rpc: jest.fn() }));

const reply = (displayName: string) => ({
  custom: {
    call: {
      payload: Response.encode(
        Response.create({
          physicalLayout: {
            devices: [
              {
                identifier: displayName,
                displayName,
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

it.each(["success", "error"])(
  "ignores an old connection's automatic layout %s after a new connection loads",
  async (outcome) => {
    const first = createConnectedMockZMKApp({
      subsystems: [SUBSYSTEM_IDENTIFIER],
    });
    const second = createConnectedMockZMKApp({
      subsystems: [SUBSYSTEM_IDENTIFIER],
    });
    expect(first.state.connection).not.toBe(second.state.connection);
    let finish!: (value: ReturnType<typeof reply>) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<ReturnType<typeof reply>>((resolve, fail) => {
      finish = resolve;
      reject = fail;
    });
    let firstCalls = 0;
    (call_rpc as jest.Mock).mockImplementation((connection, request) => {
      if (!request.custom) return Promise.resolve({});
      if (connection === first.state.connection) {
        firstCalls++;
        return pending;
      }
      return Promise.resolve(reply("second-trackball"));
    });
    const view = render(
      <ZMKAppProvider value={first}>
        <PhysicalLayoutSection />
      </ZMKAppProvider>,
    );
    await waitFor(() => expect(firstCalls).toBe(1));
    view.rerender(
      <ZMKAppProvider value={second}>
        <PhysicalLayoutSection />
      </ZMKAppProvider>,
    );
    await screen.findAllByText("second-trackball");
    await act(async () => {
      if (outcome === "success") finish(reply("stale-first-trackball"));
      else reject(new Error("stale first layout failed"));
    });
    expect(screen.getAllByText("second-trackball").length).toBeGreaterThan(0);
    expect(screen.queryByText("stale-first-trackball")).not.toBeInTheDocument();
    expect(
      screen.queryByText("stale first layout failed"),
    ).not.toBeInTheDocument();
  },
);

it("keeps a new connection loading when an old request finishes", async () => {
  const first = createConnectedMockZMKApp({
    subsystems: [SUBSYSTEM_IDENTIFIER],
  });
  const second = createConnectedMockZMKApp({
    subsystems: [SUBSYSTEM_IDENTIFIER],
  });
  let finishFirst!: (value: ReturnType<typeof reply>) => void;
  let finishSecond!: (value: ReturnType<typeof reply>) => void;
  const pendingFirst = new Promise<ReturnType<typeof reply>>((resolve) => {
    finishFirst = resolve;
  });
  const pendingSecond = new Promise<ReturnType<typeof reply>>((resolve) => {
    finishSecond = resolve;
  });
  let firstCalls = 0;
  let secondCalls = 0;
  (call_rpc as jest.Mock).mockImplementation((connection, request) => {
    if (!request.custom) return Promise.resolve({});
    if (connection === first.state.connection) {
      firstCalls++;
      return pendingFirst;
    }
    secondCalls++;
    return pendingSecond;
  });
  const view = render(
    <ZMKAppProvider value={first}>
      <PhysicalLayoutSection />
    </ZMKAppProvider>,
  );
  await waitFor(() => expect(firstCalls).toBe(1));
  view.rerender(
    <ZMKAppProvider value={second}>
      <PhysicalLayoutSection />
    </ZMKAppProvider>,
  );
  await waitFor(() => expect(secondCalls).toBe(1));
  await act(async () => {
    finishFirst(reply("stale-first-trackball"));
  });
  expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  expect(screen.queryByText("stale-first-trackball")).not.toBeInTheDocument();
  await act(async () => {
    finishSecond(reply("second-trackball"));
  });
  expect(screen.getAllByText("second-trackball").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
});

it("retires a pending layout error when the panel unmounts", async () => {
  const first = createConnectedMockZMKApp({
    subsystems: [SUBSYSTEM_IDENTIFIER],
  });
  const second = createConnectedMockZMKApp({
    subsystems: [SUBSYSTEM_IDENTIFIER],
  });
  let reject!: (error: Error) => void;
  const pending = new Promise<ReturnType<typeof reply>>((_resolve, fail) => {
    reject = fail;
  });
  let firstCalls = 0;
  (call_rpc as jest.Mock).mockImplementation((connection, request) => {
    if (!request.custom) return Promise.resolve({});
    if (connection === first.state.connection) {
      firstCalls++;
      return pending;
    }
    return Promise.resolve(reply("second-trackball"));
  });
  const view = render(
    <ZMKAppProvider value={first}>
      <PhysicalLayoutSection />
    </ZMKAppProvider>,
  );
  await waitFor(() => expect(firstCalls).toBe(1));
  view.unmount();
  render(
    <ZMKAppProvider value={second}>
      <PhysicalLayoutSection />
    </ZMKAppProvider>,
  );
  await screen.findAllByText("second-trackball");
  await act(async () => {
    reject(new Error("unmounted layout failed"));
  });
  expect(screen.getAllByText("second-trackball").length).toBeGreaterThan(0);
  expect(screen.queryByText("unmounted layout failed")).not.toBeInTheDocument();
});

it.each(["success", "error"])(
  "retires an old layout %s when only the subsystem index changes",
  async (outcome) => {
    const app = createConnectedMockZMKApp({
      subsystems: [SUBSYSTEM_IDENTIFIER],
    });
    const connection = app.state.connection;
    let index = 0;
    app.findSubsystem = jest.fn(() => ({
      index,
      identifier: SUBSYSTEM_IDENTIFIER,
    }));
    let finish!: (value: ReturnType<typeof reply>) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<ReturnType<typeof reply>>((resolve, fail) => {
      finish = resolve;
      reject = fail;
    });
    let calls = 0;
    const indices: number[] = [];
    (call_rpc as jest.Mock).mockImplementation((_connection, request) => {
      if (!request.custom) return Promise.resolve({});
      indices.push(request.custom.call.subsystemIndex);
      return ++calls === 1
        ? pending
        : Promise.resolve(reply("new-index-trackball"));
    });
    const view = render(
      <ZMKAppProvider value={app}>
        <PhysicalLayoutSection />
      </ZMKAppProvider>,
    );
    await waitFor(() => expect(calls).toBe(1));
    index = 1;
    view.rerender(
      <ZMKAppProvider value={app}>
        <PhysicalLayoutSection />
      </ZMKAppProvider>,
    );
    await screen.findAllByText("new-index-trackball");
    expect(app.state.connection).toBe(connection);
    expect(indices).toEqual([0, 1]);
    await act(async () => {
      if (outcome === "success") finish(reply("retired-index-trackball"));
      else reject(new Error("retired index layout failed"));
    });
    expect(screen.getAllByText("new-index-trackball").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByText("retired-index-trackball"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("retired index layout failed"),
    ).not.toBeInTheDocument();
  },
);
