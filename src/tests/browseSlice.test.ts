import { describe, it, expect } from "vitest";
import browseReducer, { browseShops } from "../redux/slices/browseSlice";
import shopReducer, { fetchShopList } from "../redux/slices/shopSlice";
import { IShop, IShopSummary } from "../typings/shop";

const summary = (_id: string): IShopSummary => ({ _id, name: _id, cover: "" });
const page = (ids: string[], next: string | null = null) => ({ shops: ids.map(summary), next });
type State = ReturnType<typeof browseReducer>;
const ids = (state: State) => state.shops.map((s) => s._id);

// A request for the first page of `q` (numbered `n`), or for the page after `cursor`.
const ask = (n: number, q: string, cursor?: string) => ({ id: String(n), arg: cursor ? { q, cursor } : { q } });
type Asked = ReturnType<typeof ask>;
const pending = (r: Asked) => browseShops.pending(r.id, r.arg);
const answered = (r: Asked, ids: string[], next: string | null = null) => browseShops.fulfilled(page(ids, next), r.id, r.arg);
const failed = (r: Asked) => browseShops.rejected(new Error("down"), r.id, r.arg);
type Action = Parameters<typeof browseReducer>[1];
const run = (...actions: Action[]) => actions.reduce(browseReducer, browseReducer(undefined, { type: "init" }));
const apply = (state: State, ...actions: Action[]) => actions.reduce(browseReducer, state);

// Request 1: every shop's first page, answered with `shops`.
const first = ask(1, "");
const held = (shops: string[], next: string | null = null) => [pending(first), answered(first, shops, next)];

describe("the home page's shops store", () => {
  it("leaves the manager's shops alone", () => {
    const mine = shopReducer(undefined, fetchShopList.fulfilled([{ _id: "mine" } as IShop], ""));
    const r = ask(1, "");

    expect(shopReducer(shopReducer(mine, pending(r)), answered(r, ["theirs"]))).toBe(mine);
  });

  it("ignores a search's answer that arrives after a later search's", () => {
    const lemon = ask(1, "lemon");
    const tea = ask(2, "tea");
    const state = run(pending(lemon), pending(tea), answered(tea, ["t"]), answered(lemon, ["l"]), failed(lemon));

    expect(ids(state)).toEqual(["t"]);
    expect([state.query, state.status]).toEqual(["tea", "ready"]);
  });

  it("keeps the shops held when the latest search fails, and says so", () => {
    const tea = ask(2, "tea");
    const state = run(...held(["a"]), pending(tea), failed(tea));

    expect(ids(state)).toEqual(["a"]);
    expect([state.query, state.wanted, state.status]).toEqual(["", "tea", "failed"]);
  });

  it("adds the next page to the list it continues, and nothing else", () => {
    const more = ask(2, "", "b");
    let state = run(...held(["a", "b"], "b"), pending(more));
    expect(state.moreStatus).toBe("loading");

    state = apply(state, answered(more, ["c"]));
    expect(ids(state)).toEqual(["a", "b", "c"]);
    expect([state.next, state.moreStatus]).toEqual([null, "ready"]);

    // The same page answered twice is added once.
    expect(ids(apply(state, answered(more, ["c"])))).toEqual(["a", "b", "c"]);
  });

  it("drops a next page of a list since replaced by a search", () => {
    const more = ask(2, "", "b");
    const tea = ask(3, "tea");
    const state = run(...held(["a", "b"], "b"), pending(more), pending(tea), answered(tea, ["t"], "t"), answered(more, ["c"]));

    expect(ids(state)).toEqual(["t"]);
    expect(state.next).toBe("t");
  });

  it("waits for a next page asked before a first page of the same search arrives", () => {
    const more = ask(2, "", "b");
    const again = ask(3, "");
    const state = run(...held(["a", "b"], "b"), pending(more), pending(again), answered(again, ["a", "b"], "b"));
    // Still loading, so "Show more" can't send it twice; then added once.
    expect(state.moreStatus).toBe("loading");
    expect(ids(apply(state, answered(more, ["c"])))).toEqual(["a", "b", "c"]);
  });

  it("stops waiting for a next page that no longer continues the list, when it answers", () => {
    // A refresh whose first page ends elsewhere: the page asked before no
    // longer continues it, and its answer, kept out, ends the wait.
    const more = ask(2, "", "b");
    const refresh = ask(3, "");
    const state = run(...held(["a", "b"], "b"), pending(more), pending(refresh), answered(refresh, ["a", "x"], "x"));
    expect(state.moreStatus).toBe("loading");

    expect(apply(state, answered(more, ["d"])).moreStatus).toBeUndefined();
    expect(apply(state, failed(more)).moreStatus).toBeUndefined();
    expect(ids(apply(state, answered(more, ["d"])))).toEqual(["a", "x"]);
  });

  it("stops waiting for an old list's next page when another search's first page arrives", () => {
    const more = ask(2, "", "a");
    const tea = ask(3, "tea");
    const state = run(...held(["a"], "a"), pending(more), pending(tea), answered(tea, ["t"], "t"));
    expect(state.moreStatus).toBeUndefined();

    // The new list's own next page isn't undone by the old one's answer.
    const teaMore = ask(4, "tea", "t");
    const later = apply(state, pending(teaMore), answered(more, ["b"]));
    expect([ids(later), later.moreStatus]).toEqual([["t"], "loading"]);
  });

  it("starts the list afresh when a search's first page arrives", () => {
    const more = ask(2, "", "a");
    const tea = ask(3, "tea");
    const state = run(...held(["a"], "a"), pending(more), failed(more), pending(tea), answered(tea, ["t"]));

    expect(ids(state)).toEqual(["t"]);
    expect([state.next, state.moreStatus]).toEqual([null, undefined]);
  });
});
