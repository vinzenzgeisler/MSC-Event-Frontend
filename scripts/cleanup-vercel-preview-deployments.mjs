import { pathToFileURL } from "node:url";

const API_BASE_URL = "https://api.vercel.com";

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function readError(response) {
  const body = await response.text();
  return body ? `: ${body}` : "";
}

export async function listPreviewDeployments({
  token,
  teamId,
  projectId,
  fetchImpl = fetch,
}) {
  const deployments = [];
  const cursors = new Set();
  let until;

  do {
    const url = new URL("/v7/deployments", API_BASE_URL);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("teamId", teamId);
    url.searchParams.set("limit", "100");
    if (until) {
      url.searchParams.set("until", String(until));
    }

    const response = await fetchImpl(url, { headers: authHeaders(token) });
    if (!response.ok) {
      throw new Error(
        `Vercel list failed (${response.status})${await readError(response)}`,
      );
    }

    const page = await response.json();
    deployments.push(
      ...(page.deployments ?? []).filter(
        (deployment) =>
          deployment.target == null &&
          deployment.state !== "DELETED" &&
          deployment.readyState !== "DELETED",
      ),
    );

    until = page.pagination?.next ?? null;
    if (until && cursors.has(until)) {
      throw new Error(`Vercel pagination returned duplicate cursor ${until}.`);
    }
    if (until) {
      cursors.add(until);
    }
  } while (until);

  return deployments;
}

export async function deletePreviewDeployment({
  deploymentId,
  token,
  teamId,
  fetchImpl = fetch,
}) {
  const url = new URL(
    `/v13/deployments/${encodeURIComponent(deploymentId)}`,
    API_BASE_URL,
  );
  url.searchParams.set("teamId", teamId);
  const response = await fetchImpl(url, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Vercel delete failed for ${deploymentId} (${response.status})${await readError(response)}`,
    );
  }
}

export async function cleanupPreviewDeployments({
  token,
  teamId,
  projectId,
  fetchImpl = fetch,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const deployments = await listPreviewDeployments({
    token,
    teamId,
    projectId,
    fetchImpl,
  });

  for (const deployment of deployments) {
    await deletePreviewDeployment({
      deploymentId: deployment.uid,
      token,
      teamId,
      fetchImpl,
    });
    console.log(`Deleted Preview deployment ${deployment.uid}`);
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const remaining = await listPreviewDeployments({
      token,
      teamId,
      projectId,
      fetchImpl,
    });
    if (remaining.length === 0) {
      console.log(
        `Deleted ${deployments.length} Vercel Preview deployment(s).`,
      );
      return deployments.length;
    }
    if (attempt < 5) {
      await wait(2000);
    }
  }

  throw new Error("Vercel Preview deployments remain after deletion.");
}

async function main() {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_ORG_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !teamId || !projectId) {
    throw new Error(
      "VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID are required.",
    );
  }
  await cleanupPreviewDeployments({ token, teamId, projectId });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
