import { act, renderHook } from "@testing-library/react";
import { useDrafts } from "./useWorkspace";

beforeEach(() => sessionStorage.clear());

it("isolates drafts by ticket and mode, and restores them on reload", () => {
  const first = renderHook(() => useDrafts());
  act(() => first.result.current.updateDraft("demo:a", "Edited A"));
  act(() => first.result.current.updateDraft("demo:b", "Edited B"));
  act(() => first.result.current.updateDraft("live:a", "Live A"));
  first.unmount();
  const next = renderHook(() => useDrafts());
  expect(next.result.current.drafts).toEqual({
    "demo:a": "Edited A",
    "demo:b": "Edited B",
    "live:a": "Live A",
  });
});

it("keeps editing usable when browser storage is unavailable", () => {
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  const { result } = renderHook(() => useDrafts());
  act(() => result.current.updateDraft("demo:a", "Unsaved text"));
  expect(result.current.drafts["demo:a"]).toBe("Unsaved text");
  expect(result.current.persistent).toBe(false);
  spy.mockRestore();
});
