import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupPreviewDeployments,
  listPreviewDeployments,
} from "./cleanup-vercel-preview-deployments.mjs";

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test("lists every page and keeps only Preview deployments", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (!url.searchParams.has("until")) {
      return response({
        deployments: [
          { uid: "preview-1", target: null, state: "READY" },
          { uid: "prod-1", target: "production", state: "READY" },
        ],
        pagination: { next: 123 },
      });
    }
    return response({
      deployments: [
        { uid: "preview-2", target: null, readyState: "READY" },
        { uid: "deleted-1", target: null, state: "DELETED" },
      ],
      pagination: { next: null },
    });
  };

  const deployments = await listPreviewDeployments({
    token: "token",
    teamId: "team",
    projectId: "project",
    fetchImpl,
  });

  assert.deepEqual(
    deployments.map((deployment) => deployment.uid),
    ["preview-1", "preview-2"],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].searchParams.get("until"), "123");
});

test("deletes Preview deployments and verifies an empty result", async () => {
  const deleted = [];
  let listCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    if (options.method === "DELETE") {
      deleted.push(url.pathname.split("/").pop());
      return response({ state: "DELETED" });
    }
    listCalls += 1;
    return response({
      deployments:
        listCalls === 1
          ? [
              { uid: "preview-1", target: null, state: "READY" },
              { uid: "preview-2", target: null, state: "ERROR" },
            ]
          : [],
      pagination: { next: null },
    });
  };

  const count = await cleanupPreviewDeployments({
    token: "token",
    teamId: "team",
    projectId: "project",
    fetchImpl,
    wait: async () => {},
  });

  assert.equal(count, 2);
  assert.deepEqual(deleted, ["preview-1", "preview-2"]);
});
