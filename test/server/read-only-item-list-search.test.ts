import { afterEach, describe, expect, it } from "vitest";

import { listItemsHandler, searchItemsHandler } from "../../src/server.js";

import { makeRunner, restoreProcessEnvAndMocks } from "./test-support.js";

afterEach(restoreProcessEnvAndMocks);

describe("read-only handlers", () => {
  it("listItemsHandler rejects conflicting selectors", async () => {
    const runner = makeRunner();
    await expect(
      listItemsHandler(runner, { vaultName: "work", shareId: "abc", output: "json" }),
    ).rejects.toThrow("Provide only one of vaultName or shareId");
  });

  it("listItemsHandler requires a scope selector", async () => {
    const runner = makeRunner();
    await expect(listItemsHandler(runner, { output: "json" })).rejects.toThrow(
      "Provide exactly one of vaultName or shareId",
    );
  });

  it("listItemsHandler supports share-id and vault selector modes", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await listItemsHandler(runner, {
      shareId: "s1",
      filterType: "login",
      filterState: "active",
      sortBy: "created-desc",
      output: "json",
    });
    await listItemsHandler(runner, { vaultName: "Work", output: "human" });

    expect(runner).toHaveBeenNthCalledWith(1, [
      "item",
      "list",
      "--share-id",
      "s1",
      "--filter-type",
      "login",
      "--filter-state",
      "active",
      "--sort-by",
      "created-desc",
      "--output",
      "json",
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, ["item", "list", "--output", "human", "--", "Work"]);
  });

  it("listItemsHandler paginates json output by default with item refs only", async () => {
    const payload = Array.from({ length: 130 }, (_, i) => ({
      id: `item-${i + 1}`,
      share_id: "share-1",
      vault_id: "vault-1",
      state: "active",
      create_time: "2026-01-01T00:00:00Z",
      modify_time: "2026-01-02T00:00:00Z",
      content: {
        title: `Title ${i + 1}`,
        password: "super-secret-value",
      },
    }));
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const structured = (result as any).structuredContent;

    expect(structured).toBeTruthy();
    expect(structured.pageSize).toBe(100);
    expect(structured.cursor).toBe("0");
    expect(structured.returned).toBe(100);
    expect(structured.total).toBe(130);
    expect(structured.nextCursor).toBe("100");
    expect(structured.items).toHaveLength(100);
    expect(structured.items[0]).toEqual({
      id: "item-1",
      share_id: "share-1",
      vault_id: "vault-1",
      type: null,
      title: "Title 1",
      display_title: "Title 1",
      state: "active",
      create_time: "2026-01-01T00:00:00Z",
      modify_time: "2026-01-02T00:00:00Z",
      uri: "pass://share-1/item-1",
    });
    expect(structured.items[99].title).toBe("Title 100");
    expect(structured.items[0].password).toBeUndefined();
  });

  it("listItemsHandler supports cursor and pageSize for follow-up pages", async () => {
    const payload = Array.from({ length: 75 }, (_, i) => ({
      id: `item-${i + 1}`,
      share_id: "s1",
    }));
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await listItemsHandler(runner, {
      shareId: "s1",
      output: "json",
      pageSize: 20,
      cursor: "40",
    });
    const structured = (result as any).structuredContent;

    expect(structured.pageSize).toBe(20);
    expect(structured.cursor).toBe("40");
    expect(structured.returned).toBe(20);
    expect(structured.total).toBe(75);
    expect(structured.nextCursor).toBe("60");
    expect(structured.items).toHaveLength(20);
    expect(structured.items[0].id).toEqual("item-41");
    expect(structured.items[19].id).toEqual("item-60");
    expect(structured.items[0].uri).toEqual("pass://s1/item-41");
  });

  it("listItemsHandler normalizes object payload shape with nested fields", async () => {
    const payload = {
      items: [
        {
          item_id: "i-1",
          share: { id: "share-1" },
          vault: { id: "vault-1" },
          create_time: "2026-01-01T00:00:00Z",
          modify_time: "2026-01-02T00:00:00Z",
          content: {},
        },
      ],
    };
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const [item] = (result as any).structuredContent.items;

    expect(item).toEqual({
      id: "i-1",
      share_id: "share-1",
      vault_id: "vault-1",
      type: null,
      title: null,
      display_title: "[untitled:i-1]",
      state: null,
      create_time: "2026-01-01T00:00:00Z",
      modify_time: "2026-01-02T00:00:00Z",
      uri: "pass://share-1/i-1",
    });
  });

  it("listItemsHandler extracts normalized item type from content.content.<Type>", async () => {
    const payload = [
      {
        id: "i-login",
        share_id: "s1",
        content: { title: "GitHub", content: { Login: { username: "u", password: "secret" } } },
      },
      {
        id: "i-credit",
        share_id: "s1",
        content: { title: "Card", content: { CreditCard: { number: "4111..." } } },
      },
      {
        id: "i-ssh",
        share_id: "s1",
        content: { title: "Key", content: { SSHKey: { private_key: "..." } } },
      },
    ];

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });
    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const items = (result as any).structuredContent.items;

    expect(items[0].type).toBe("login");
    expect(items[1].type).toBe("credit-card");
    expect(items[2].type).toBe("ssh-key");
    expect(items[0].password).toBeUndefined();
  });

  it("listItemsHandler ignores camelCase metadata keys in item list payload", async () => {
    const payload = [
      {
        id: "i-camel",
        shareId: "s-camel",
        vaultId: "v-camel",
        createTime: "2026-01-01T00:00:00Z",
        modifyTime: "2026-01-02T00:00:00Z",
        state: "Active",
        content: { title: "Camel Case Item", content: { Login: { password: "secret" } } },
      },
    ];

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });
    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const [item] = (result as any).structuredContent.items;

    expect(item).toEqual({
      id: "i-camel",
      share_id: null,
      vault_id: null,
      type: "login",
      title: "Camel Case Item",
      display_title: "Camel Case Item",
      state: "Active",
      create_time: null,
      modify_time: null,
      uri: null,
    });
    expect(item.password).toBeUndefined();
  });

  it("listItemsHandler normalizes unknown typed content keys to kebab-case", async () => {
    const payload = [
      {
        id: "i-unknown-type",
        share_id: "s1",
        content: {
          title: "Unknown Type",
          content: { MyCustomType: { opaque: "value" } },
        },
      },
    ];

    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });
    const result = await listItemsHandler(runner, { shareId: "s1", output: "json" });
    const [item] = (result as any).structuredContent.items;

    expect(item.type).toBe("my-custom-type");
  });

  it("listItemsHandler rejects invalid cursor values", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await expect(
      listItemsHandler(runner, {
        shareId: "s1",
        output: "json",
        cursor: "abc",
      }),
    ).rejects.toThrow("Invalid cursor");
  });

  it("listItemsHandler rejects pagination params for human output", async () => {
    const runner = makeRunner({ stdout: "ok", stderr: "" });

    await expect(
      listItemsHandler(runner, {
        shareId: "s1",
        output: "human",
        pageSize: 10,
      }),
    ).rejects.toThrow('Pagination is supported only with {"output":"json"}');
  });

  it("searchItemsHandler filters by title and returns paged item refs", async () => {
    const payload = [
      { id: "i-1", share_id: "s1", content: { title: "GitHub" } },
      { id: "i-2", share_id: "s1", content: { title: "GitLab" } },
      { id: "i-3", share_id: "s1", content: { title: "Jira" } },
      { id: "i-4", share_id: "s1", content: { password: "secret" } },
    ];
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: "" });

    const result = await searchItemsHandler(runner, {
      query: "git",
      field: "title",
      match: "contains",
      caseSensitive: false,
      shareId: "s1",
      pageSize: 1,
      cursor: "1",
    });
    const structured = (result as any).structuredContent;

    expect(runner).toHaveBeenCalledWith(["item", "list", "--share-id", "s1", "--output", "json"]);
    expect(structured.total).toBe(2);
    expect(structured.returned).toBe(1);
    expect(structured.nextCursor).toBeNull();
    expect(structured.queryMeta).toEqual({
      field: "title",
      match: "contains",
      caseSensitive: false,
    });
    expect(structured.items[0]).toMatchObject({
      id: "i-2",
      title: "GitLab",
      display_title: "GitLab",
      uri: "pass://s1/i-2",
    });
    expect(structured.items[0].password).toBeUndefined();
  });

  it("searchItemsHandler supports exact case-sensitive matching and passthrough filters", async () => {
    const payload = [
      { id: "i-1", share_id: "s1", content: { title: "GitHub" } },
      { id: "i-2", share_id: "s1", content: { title: "github" } },
    ];
    const runner = makeRunner({ stdout: JSON.stringify({ items: payload }), stderr: "" });

    const result = await searchItemsHandler(runner, {
      query: "GitHub",
      field: "title",
      match: "exact",
      caseSensitive: true,
      vaultName: "Work",
      filterType: "login",
      filterState: "active",
      sortBy: "created-desc",
    });
    const structured = (result as any).structuredContent;

    expect(runner).toHaveBeenCalledWith([
      "item",
      "list",
      "--filter-type",
      "login",
      "--filter-state",
      "active",
      "--sort-by",
      "created-desc",
      "--output",
      "json",
      "--",
      "Work",
    ]);
    expect(structured.total).toBe(1);
    expect(structured.items[0].id).toBe("i-1");
  });

  it("searchItemsHandler rejects conflicting selectors", async () => {
    const runner = makeRunner({ stdout: "[]", stderr: "" });

    await expect(
      searchItemsHandler(runner, {
        query: "x",
        field: "title",
        match: "contains",
        caseSensitive: false,
        shareId: "s1",
        vaultName: "Work",
      }),
    ).rejects.toThrow("Provide only one of vaultName or shareId");
  });
});
