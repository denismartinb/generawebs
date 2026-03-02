"use strict";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 180000;
const MAX_HTML_CHARS = 4_000_000;

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function parseBody(rawBody) {
  if (!rawBody) return {};
  if (typeof rawBody === "object") return rawBody;
  if (typeof rawBody === "string") {
    try {
      return JSON.parse(rawBody);
    } catch (error) {
      return {};
    }
  }
  return {};
}

function sanitizeProjectName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function isValidProjectName(value) {
  return /^proyecto-[a-z0-9-]{1,100}$/.test(value);
}

function buildApiUrl(path, teamId) {
  const cleanPath = String(path || "").trim() || "/";
  const base = `https://api.vercel.com${cleanPath}`;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}teamId=${encodeURIComponent(teamId)}`;
}

function extractVercelError(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  if (payload.error && typeof payload.error === "object") {
    const code = String(payload.error.code || "").trim();
    const message = String(payload.error.message || "").trim();
    if (code && message) return `${code}: ${message}`;
    if (message) return message;
    if (code) return code;
  }
  const message = String(payload.message || "").trim();
  if (message) return message;
  return fallback;
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function vercelRequest({ method, path, token, teamId, body }) {
  const response = await fetch(buildApiUrl(path, teamId), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await parseJsonSafe(response);
  return { response, payload };
}

async function ensureProject({ token, teamId, projectName }) {
  const existing = await vercelRequest({
    method: "GET",
    path: `/v9/projects/${encodeURIComponent(projectName)}`,
    token,
    teamId
  });

  if (existing.response.ok) return { created: false, project: existing.payload || {} };
  if (existing.response.status !== 404) {
    const fallback = `No se pudo consultar el proyecto (${existing.response.status}).`;
    throw new Error(extractVercelError(existing.payload, fallback));
  }

  const created = await vercelRequest({
    method: "POST",
    path: "/v10/projects",
    token,
    teamId,
    body: {
      name: projectName
    }
  });

  if (!created.response.ok) {
    const fallback = `No se pudo crear el proyecto (${created.response.status}).`;
    throw new Error(extractVercelError(created.payload, fallback));
  }

  return { created: true, project: created.payload || {} };
}

async function createDeployment({ token, teamId, projectName, html }) {
  const result = await vercelRequest({
    method: "POST",
    path: "/v13/deployments?skipAutoDetectionConfirmation=1",
    token,
    teamId,
    body: {
      name: projectName,
      target: "production",
      projectSettings: {
        framework: null
      },
      files: [
        {
          file: "index.html",
          data: html
        }
      ]
    }
  });

  if (!result.response.ok) {
    const fallback = `No se pudo crear el despliegue (${result.response.status}).`;
    throw new Error(extractVercelError(result.payload, fallback));
  }

  return result.payload || {};
}

async function readDeployment({ token, teamId, deploymentId }) {
  const result = await vercelRequest({
    method: "GET",
    path: `/v13/deployments/${encodeURIComponent(deploymentId)}`,
    token,
    teamId
  });
  if (!result.response.ok) {
    const fallback = `No se pudo consultar el despliegue (${result.response.status}).`;
    throw new Error(extractVercelError(result.payload, fallback));
  }
  return result.payload || {};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady({ token, teamId, deploymentId }) {
  const start = Date.now();
  let latest = null;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    latest = await readDeployment({ token, teamId, deploymentId });
    const state = String(latest.readyState || latest.state || "").toUpperCase();
    if (["READY", "ERROR", "CANCELED"].includes(state)) return latest;
    await sleep(POLL_INTERVAL_MS);
  }
  return latest || {};
}

function resolvePublicUrl({ deployment, projectName }) {
  const projectDomain = `${projectName}.vercel.app`;
  const aliases = [];
  if (Array.isArray(deployment?.alias)) {
    deployment.alias.forEach((alias) => {
      const candidate = String(alias || "").trim();
      if (candidate) aliases.push(candidate);
    });
  }
  const exact = aliases.find((entry) => entry.toLowerCase() === projectDomain.toLowerCase());
  if (exact) return /^https?:\/\//i.test(exact) ? exact : `https://${exact}`;

  const anyVercelAlias = aliases.find((entry) => entry.toLowerCase().endsWith(".vercel.app"));
  if (anyVercelAlias) return /^https?:\/\//i.test(anyVercelAlias) ? anyVercelAlias : `https://${anyVercelAlias}`;

  const deployUrl = String(deployment?.url || "").trim();
  if (deployUrl) return /^https?:\/\//i.test(deployUrl) ? deployUrl : `https://${deployUrl}`;

  return `https://${projectDomain}`;
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    return json(res, 200, { ok: true, service: "publish", method: "POST" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method Not Allowed" });
  }

  const token = String(process.env.VERCEL_TOKEN || "").trim();
  const teamId = String(process.env.VERCEL_TEAM_ID || "").trim();
  const publishKey = String(process.env.PUBLISH_API_KEY || "").trim();
  const providedKey = String(req.headers["x-publish-key"] || "").trim();

  if (publishKey && providedKey !== publishKey) {
    return json(res, 401, { error: "Unauthorized publish request." });
  }

  if (!token) {
    return json(res, 500, { error: "VERCEL_TOKEN no está configurado en el servidor." });
  }
  if (!teamId) {
    return json(res, 500, { error: "VERCEL_TEAM_ID no está configurado en el servidor." });
  }

  const body = parseBody(req.body);
  const projectName = sanitizeProjectName(body.projectName);
  const html = String(body.html || "");

  if (!isValidProjectName(projectName)) {
    return json(res, 400, { error: "Nombre de proyecto no válido. Debe tener formato proyecto-nombre." });
  }

  if (!html || html.length < 20) {
    return json(res, 400, { error: "HTML vacío o inválido." });
  }

  if (html.length > MAX_HTML_CHARS) {
    return json(res, 413, { error: "El HTML generado es demasiado grande para publicarse." });
  }

  try {
    const ensured = await ensureProject({ token, teamId, projectName });
    const created = await createDeployment({ token, teamId, projectName, html });
    const deploymentId = String(created.id || "").trim();
    let finalDeployment = created;

    const initialState = String(created.readyState || created.state || "").toUpperCase();
    if (deploymentId && !["READY", "ERROR", "CANCELED"].includes(initialState)) {
      finalDeployment = await waitForReady({ token, teamId, deploymentId });
    }

    const finalState = String(finalDeployment.readyState || finalDeployment.state || "").toUpperCase();
    if (finalState && finalState !== "READY") {
      const fallback = `El despliegue terminó en estado ${finalState || "desconocido"}.`;
      throw new Error(extractVercelError(finalDeployment, fallback));
    }

    const url = resolvePublicUrl({ deployment: finalDeployment, projectName });
    return json(res, 200, {
      ok: true,
      url,
      projectName,
      projectCreated: Boolean(ensured.created),
      deploymentId: deploymentId || String(finalDeployment.id || "").trim()
    });
  } catch (error) {
    const message = error && error.message ? error.message : "No se pudo publicar en Vercel.";
    return json(res, 500, { error: message });
  }
};
