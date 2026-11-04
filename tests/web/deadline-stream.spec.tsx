import { ReadableStream, WritableStream } from "node:stream/web";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  createConnectedMockZMKApp,
  ZMKAppProvider,
} from "@cormoran/zmk-studio-react-hook/testing";
import type {
  Request,
  RequestResponse,
  RpcConnection,
} from "@zmkfirmware/zmk-studio-ts-client";
import { PhysicalLayoutSection, SUBSYSTEM_IDENTIFIER } from "../../web/src/App";
import { Response } from "../../web/src/proto/zmk/physical_layouts/physical_layouts";

// Keep the actual SDK call_rpc/global mutex and Web Stream reader/writer APIs.
// Only the peer's replies and a disconnected stream are controlled here.
function peer(missingOfficial: boolean) {
  let replies!: ReadableStreamDefaultController<RequestResponse>;
  const requests: Request[] = [];
  const connection = {
    label: "Synthetic stream peer",
    current_request: 0,
    notification_readable: new ReadableStream(),
    request_response_readable: new ReadableStream<RequestResponse>({
      start(controller) {
        replies = controller;
      },
    }),
    request_writable: new WritableStream<Request>({
      write(request) {
        requests.push(request);
        if (request.custom) {
          replies.enqueue({
            requestId: request.requestId,
            custom: {
              call: {
                payload: Response.encode(
                  Response.create({ physicalLayout: {} }),
                ).finish(),
              },
            },
          } as RequestResponse);
        } else if (!missingOfficial) {
          replies.enqueue({
            requestId: request.requestId,
            keymap: {
              getPhysicalLayouts: {
                activeLayoutIndex: 0,
                layouts: [{ name: "Reconnected stream", keys: [] }],
              },
            },
          } as RequestResponse);
        }
      },
    }),
  } as unknown as RpcConnection;
  const app = createConnectedMockZMKApp({
    subsystems: [SUBSYSTEM_IDENTIFIER],
  });
  app.state.connection = connection;
  return {
    app,
    requests,
    disconnect: () => replies.error(new Error("Disconnected")),
  };
}

it("bounds the real SDK mutex wait, refuses queued retries and resumes with a replacement stream", async () => {
  jest.useFakeTimers();
  const first = peer(true);
  const second = peer(false);
  const panel = (app: typeof first.app) => (
    <ZMKAppProvider value={app}>
      <PhysicalLayoutSection />
    </ZMKAppProvider>
  );
  try {
    const view = render(panel(first.app));
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(first.requests).toHaveLength(2);
    expect(first.app.state.connection?.request_response_readable.locked).toBe(
      true,
    );
    await act(async () => jest.advanceTimersByTimeAsync(5000));
    expect(
      screen.getByText(/Disconnect and reconnect to retry/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(first.requests).toHaveLength(2);
    // The SDK still owns the read: a UI deadline alone cannot release it.
    expect(first.app.state.connection?.request_response_readable.locked).toBe(
      true,
    );
    await act(async () => first.disconnect());
    view.rerender(panel(second.app));
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(second.requests).toHaveLength(2);
    expect(
      screen.getByText("0 keyswitches, 0 modules, Reconnected stream"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Disconnect and reconnect to retry/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    await act(async () => jest.advanceTimersByTimeAsync(5000));
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    await act(async () => first.disconnect());
    jest.useRealTimers();
  }
});
