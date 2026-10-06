import { describe, it, expect } from "vitest";
import shopReducer, { browseShops, fetchShopList } from "../redux/slices/shopSlice";
import { IShop, IShopSummary } from "../typings/shop";

const shop = (_id: string) => ({ _id, name: _id, menu: [], tables: [] }) as unknown as IShop;
const summary = (_id: string): IShopSummary => ({ _id, name: _id, cover: "" });
const page = (ids: string[], next: string | null = null) => ({ shops: ids.map(summary), next });
const ids = (state: ReturnType<typeof shopReducer>) => state.all.map((s) => s._id);

// A request for the first page of `q` (numbered `n`), or for the page after `cursor`.
const ask = (n: number, q: string, cursor?: string) => ({ id: String(n), arg: cursor ? { q, cursor } : { q } });
type Asked = ReturnType<typeof ask>;
const pending = (r: Asked) => browseShops.pending(r.id, r.arg);
const answered = (r: Asked, ids: string[], next: string | null = null) => browseShops.fulfilled(page(ids, next), r.id, r.arg);
const failed = (r: Asked) => browseShops.rejected(new Error("down"), r.id, r.arg);
const run = (...actions: Parameters<typeof shopReducer>[1][]) => actions.reduce(shopReducer, shopReducer(undefined, { type: "init" }));

describe("shops store", () => {
  it("keeps the manager's shops when the home page's shops arrive after them", () => {
    const first = ask(1, "");
    let state = shopReducer(undefined, fetchShopList.fulfilled([shop("mine")], ""));
    state = shopReducer(state, pending(first));
    state = shopReducer(state, answered(first, ["mine", "theirs"]));

    expect(state.data.map((s) => s._id)).toEqual(["mine"]);
    expect(ids(state)).toEqual(["mine", "theirs"]);
  });

  it("ignores a search's answer that arrives after a later search's", () => {
    const lemon = ask(1, "lemon");
    const tea = ask(2, "tea");
    const state = run(pending(lemon), pending(tea), answered(tea, ["t"]), answered(lemon, ["l"]), failed(lemon));

    expect(ids(state)).toEqual(["t"]);
    expect(state.allQuery).toBe("tea");
    expect(state.allStatus).toBe("ready");
  });

  it("keeps the shops held when the latest search fails, and says so", () => {
    const all = ask(1, "");
    const tea = ask(2, "tea");
    const state = run(pending(all), answered(all, ["a"]), pending(tea), failed(tea));

    expect(ids(state)).toEqual(["a"]);
    expect([state.allQuery, state.allWanted, state.allStatus]).toEqual(["", "tea", "failed"]);
  });

  it("adds the next page to the list it continues, and nothing else", () => {
    const first = ask(1, "");
    const more = ask(2, "", "b");
    let state = run(pending(first), answered(first, ["a", "b"], "b"), pending(more));
    expect(state.allMoreStatus).toBe("loading");

    state = shopReducer(state, answered(more, ["c"], null));
    expect(ids(state)).toEqual(["a", "b", "c"]);
    expect([state.allNext, state.allMoreStatus]).toEqual([null, "ready"]);

    // The same page answered twice is added once.
    state = shopReducer(state, answered(more, ["c"], null));
    expect(ids(state)).toEqual(["a", "b", "c"]);
  });

  it("drops a next page of a list since replaced by a search", () => {
    const first = ask(1, "");
    const more = ask(2, "", "b");
    const tea = ask(3, "tea");
    const state = run(pending(first), answered(first, ["a", "b"], "b"), pending(more), pending(tea), answered(tea, ["t"], "t"), answered(more, ["c"]));

    expect(ids(state)).toEqual(["t"]);
    expect(state.allNext).toBe("t");
  });

  it("waits for a next page asked before a first page arrives, and stops waiting when it's dropped", () => {
    const first = ask(1, "");
    const more = ask(2, "", "b");
    const again = ask(3, "");
    let state = run(pending(first), answered(first, ["a", "b"], "b"), pending(more), pending(again), answered(again, ["a", "b"], "b"));
    // Still loading, so "Show more" can't send it twice; then added once.
    expect(state.allMoreStatus).toBe("loading");
    state = shopReducer(state, answered(more, ["c"]));
    expect(ids(state)).toEqual(["a", "b", "c"]);

    // A refresh whose first page ends elsewhere: the page asked before no
    // longer continues it, and its answer, kept out, ends the wait.
    const more2 = ask(5, "", "b");
    const refresh = ask(6, "");
    state = run(pending(first), answered(first, ["a", "b"], "b"), pending(more2), pending(refresh), answered(refresh, ["a", "x"], "x"));
    expect(state.allMoreStatus).toBe("loading");
    expect(shopReducer(state, answered(more2, ["d"])).allMoreStatus).toBeUndefined();
    expect(shopReducer(state, failed(more2)).allMoreStatus).toBeUndefined();
    expect(ids(shopReducer(state, answered(more2, ["d"])))).toEqual(["a", "x"]);
  });

  it("stops waiting for an old list's next page when another search's first page arrives", () => {
    const first = ask(1, "");
    const more = ask(2, "", "a");
    const tea = ask(3, "tea");
    let state = run(pending(first), answered(first, ["a"], "a"), pending(more), pending(tea), answered(tea, ["t"], "t"));
    expect(state.allMoreStatus).toBeUndefined();

    // The new list's own next page isn't undone by the old one's answer.
    const teaMore = ask(4, "tea", "t");
    state = run(pending(first), answered(first, ["a"], "a"), pending(more), pending(tea), answered(tea, ["t"], "t"), pending(teaMore), answered(more, ["b"]));
    expect([ids(state), state.allMoreStatus]).toEqual([["t"], "loading"]);
  });

  it("starts the list afresh when a search's first page arrives", () => {
    const first = ask(1, "");
    const more = ask(2, "", "a");
    const tea = ask(3, "tea");
    const state = run(pending(first), answered(first, ["a"], "a"), pending(more), failed(more), pending(tea), answered(tea, ["t"]));

    expect(ids(state)).toEqual(["t"]);
    expect([state.allNext, state.allMoreStatus]).toEqual([null, undefined]);
  });
});
