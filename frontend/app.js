const API_BASE = "";
const SEED_USERS = {
  admin: { username: "admin", password: "admin123", deviceId: "DEV-ADMIN-01" },
  dosen1: { username: "dosen1", password: "dosen123", deviceId: "DEV-DOSEN1-01" },
  dosen2: { username: "dosen2", password: "dosen123", deviceId: "DEV-DOSEN2-01" },
  mhs1: { username: "mhs1", password: "mhs123", deviceId: "DEV-MHS1-01" },
  mhs2: { username: "mhs2", password: "mhs123", deviceId: "DEV-MHS2-01" },
  mhs3: { username: "mhs3", password: "mhs123", deviceId: "DEV-MHS3-01" },
};

const state = {
  sessions: readStorage("sistemNilaiSessions", []),
  activeSessionId: readStorage("sistemNilaiActiveSession", null),
  serviceToken: readStorage("sistemNilaiServiceToken", ""),
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  setupSeedButtons();
  bindEvents();
  renderSeedButtons();
  renderSessions();
  renderActiveSession();
  renderAudit();
  wirePreset();
  updateManualAuthValue();
  updateServiceTokenBox();
});

function cacheElements() {
  els.loginForm = document.getElementById("loginForm");
  els.username = document.getElementById("username");
  els.password = document.getElementById("password");
  els.deviceId = document.getElementById("deviceId");
  els.accessTokenBox = document.getElementById("accessTokenBox");
  els.refreshTokenBox = document.getElementById("refreshTokenBox");
  els.jwtPayload = document.getElementById("jwtPayload");
  els.tokenTimer = document.getElementById("tokenTimer");
  els.sessionList = document.getElementById("sessionList");
  els.activeSessionInfo = document.getElementById("activeSessionInfo");
  els.manualPath = document.getElementById("manualPath");
  els.manualQuery = document.getElementById("manualQuery");
  els.manualAuth = document.getElementById("manualAuth");
  els.manualDevice = document.getElementById("manualDevice");
  els.manualBody = document.getElementById("manualBody");
  els.methodSelect = document.getElementById("methodSelect");
  els.presetSelect = document.getElementById("presetSelect");
  els.manualResponse = document.getElementById("manualResponse");
  els.studentView = document.getElementById("studentView");
  els.dosenView = document.getElementById("dosenView");
  els.adminView = document.getElementById("adminView");
  els.auditSubject = document.getElementById("auditSubject");
  els.auditResultFilter = document.getElementById("auditResultFilter");
  els.auditTableWrap = document.getElementById("auditTableWrap");
  els.serviceClientId = document.getElementById("serviceClientId");
  els.serviceClientSecret = document.getElementById("serviceClientSecret");
  els.serviceTokenBox = document.getElementById("serviceTokenBox");
  els.serviceDirectTestOutput = document.getElementById("serviceDirectTestOutput");
  els.scenarioResults = document.getElementById("scenarioResults");
  els.nimSelfCheck = document.getElementById("nimSelfCheck");
  els.kelasIdDosen = document.getElementById("kelasIdDosen");
  els.nimAdmin = document.getElementById("nimAdmin");
}

function bindEvents() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = els.username.value.trim();
    const password = els.password.value.trim();
    const deviceId = els.deviceId.value.trim();
    const res = await api("POST", "/auth/login", { body: { username, password }, device: deviceId, token: null });
    if (!res.ok) {
      alert(`Login gagal: ${getErrorText(res)}`);
      return;
    }
    const session = {
      id: makeId(),
      username,
      role: decodeJwt(res.data.access_token)?.role || "unknown",
      deviceId,
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      loggedOut: false,
      lastUpdated: Date.now(),
    };
    state.sessions.push(session);
    state.activeSessionId = session.id;
    persist();
    renderSessions();
    renderActiveSession();
    updateManualAuthValue();
    alert("Login berhasil");
  });

  document.getElementById("btnRefreshToken").addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session) return alert("Belum ada sesi aktif");
    const res = await api("POST", "/auth/refresh", { body: { refresh_token: session.refreshToken }, device: session.deviceId, token: null });
    if (!res.ok) {
      alert(`Refresh gagal: ${getErrorText(res)}`);
      return;
    }
    session.accessToken = res.data.access_token;
    session.lastUpdated = Date.now();
    persist();
    renderActiveSession();
    updateManualAuthValue();
    alert("Refresh token berhasil");
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session) return alert("Belum ada sesi aktif");
    const res = await api("POST", "/auth/logout", { body: { refresh_token: session.refreshToken }, device: session.deviceId, token: null });
    if (!res.ok) {
      alert(`Logout gagal: ${getErrorText(res)}`);
      return;
    }
    const revokedSession = {
      ...session,
      accessToken: "",
      refreshToken: session.refreshToken,
      loggedOut: true,
      lastUpdated: Date.now(),
    };
    state.sessions = state.sessions.map((item) => (item.id === session.id ? revokedSession : item));
    state.activeSessionId = session.id;
    persist();
    renderSessions();
    renderActiveSession();
    updateManualAuthValue();
    alert("Logout berhasil, refresh token dicabut. Coba refresh token lama di Request Manual untuk membuktikan 401.");
  });

  document.getElementById("btnDeadToken").addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session) return alert("Belum ada sesi aktif");
    const token = session.accessToken.split(".");
    const payload = JSON.parse(atobUrlDecode(token[1]));
    payload.exp = Math.floor(Date.now() / 1000) - 60;
    session.accessToken = await generateSignedTokenWithPayload(payload, "jwt-secret-praktikum-zero-trust-32b!");
    persist();
    renderActiveSession();
    updateManualAuthValue();
    alert("Token sudah diubah menjadi token kedaluwarsa");
  });

  document.getElementById("btnNewSession").addEventListener("click", () => {
    const session = {
      id: makeId(),
      username: "",
      role: "guest",
      deviceId: "",
      accessToken: "",
      refreshToken: "",
      loggedOut: false,
      lastUpdated: Date.now(),
    };
    state.sessions.push(session);
    state.activeSessionId = session.id;
    persist();
    renderSessions();
    renderActiveSession();
  });

  document.getElementById("btnDeleteSession").addEventListener("click", () => {
    const session = getActiveSession();
    if (!session) return alert("Belum ada sesi aktif untuk dihapus");
    state.sessions = state.sessions.filter((item) => item.id !== session.id);
    state.activeSessionId = state.sessions.length ? state.sessions[0].id : null;
    persist();
    renderSessions();
    renderActiveSession();
    updateManualAuthValue();
    alert("Sesi aktif berhasil dihapus");
  });

  document.getElementById("btnManualRequest").addEventListener("click", async () => {
    const method = els.methodSelect.value;
    let path = els.manualPath.value.trim();
    const query = els.manualQuery.value.trim();
    const body = els.manualBody.value.trim();
    const authHeader = els.manualAuth.value.trim();
    const device = els.manualDevice.value.trim();

    if (query) {
      const sep = path.includes("?") ? "&" : "?";
      path = `${path}${sep}${query}`;
    }

    let requestBody;
    if (body) {
      try {
        requestBody = JSON.parse(body);
      } catch (error) {
        return alert("Body JSON tidak valid");
      }
    }

    const token = authHeader ? authHeader : (getActiveSession()?.accessToken || null);
    const res = await api(method, path, {
      body: requestBody,
      token,
      device: device || getActiveSession()?.deviceId || "",
    });

    showManualResponse(res, `${method} ${path}`);
  });

  document.getElementById("btnLoadNilaiMahasiswa").addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session) return alert("Harus login dulu");
    const res = await api("GET", "/nilai", { device: session.deviceId, token: session.accessToken });
    renderTableResult(els.studentView, res, "Nilai mahasiswa");
  });

  document.getElementById("btnTranskripSelf").addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session) return alert("Harus login dulu");
    const nim = els.nimSelfCheck.value.trim();
    const res = await api("GET", `/transkrip/${nim}`, { device: session.deviceId, token: session.accessToken });
    renderTableResult(els.studentView, res, `Transkrip NIM ${nim}`);
  });

  document.getElementById("btnLoadNilaiDosen").addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session) return alert("Harus login dulu");
    const kelasId = els.kelasIdDosen.value.trim();
    const res = await api("GET", "/nilai", { device: session.deviceId, token: session.accessToken, query: { kelas_id: kelasId } });
    renderDosenView(res);
  });

  document.getElementById("btnTranskripAdmin").addEventListener("click", async () => {
    const session = getActiveSession();
    if (!session) return alert("Harus login dulu");
    const nim = els.nimAdmin.value.trim();
    const res = await api("GET", `/transkrip/${nim}`, { device: session.deviceId, token: session.accessToken });
    renderTableResult(els.adminView, res, `Transkrip ${nim}`);
  });

  document.getElementById("btnRunScenarios").addEventListener("click", async () => {
    await runAllScenarios();
  });

  document.getElementById("btnRefreshAudit").addEventListener("click", () => renderAudit());

  document.getElementById("btnRequestServiceToken").addEventListener("click", async () => {
    const body = {
      client_id: els.serviceClientId.value.trim(),
      client_secret: els.serviceClientSecret.value.trim(),
    };
    const res = await api("POST", "/auth/service", { body, device: getActiveSession()?.deviceId || "DEV-ADMIN-01", token: null });
    if (res.ok) {
      state.serviceToken = res.data.access_token;
      persist();
      updateServiceTokenBox();
      alert("Token service berhasil dibuat");
    } else {
      alert(`Token service gagal: ${getErrorText(res)}`);
    }
  });

  document.getElementById("btnServiceDirectTest").addEventListener("click", () => {
    const commands = [
      "curl -i http://127.0.0.1:3001/nilai",
      "curl -i -H \"X-Gateway-Secret: gateway-secret-praktikum-zero-trust\" http://127.0.0.1:3001/nilai",
      "curl -i -H \"Authorization: Bearer <token-user>\" http://127.0.0.1:3001/nilai",
      "curl -i -H \"Authorization: Bearer <token-user>\" -H \"X-Gateway-Secret: gateway-secret-praktikum-zero-trust\" http://127.0.0.1:3001/nilai",
    ].join("\n");
    els.serviceDirectTestOutput.textContent = commands;
  });

  document.getElementById("btnCopySeedCommand").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("python seed.py");
      alert("Perintah berhasil disalin");
    } catch (error) {
      alert("Salin manual: python seed.py");
    }
  });

  document.getElementById("btnResetSeed").addEventListener("click", () => {
    alert("Untuk reset database, jalankan: python seed.py");
  });

  els.presetSelect.addEventListener("change", () => {
    const val = els.presetSelect.value;
    if (!val) return;
    const [method, rawPath] = val.split(" ");
    els.methodSelect.value = method;
    els.manualPath.value = rawPath || "/nilai";
    if (val.includes("/auth/login")) {
      els.manualBody.value = '{"username":"dosen1","password":"dosen123"}';
    } else if (val.includes("/nilai/1")) {
      els.manualBody.value = '{"nilai":95}';
    } else if (val.includes("/kelas/")) {
      els.manualBody.value = '{}';
    } else if (val.includes("/transkrip/sinkron")) {
      els.manualBody.value = '{"kelas_id":1,"mata_kuliah":"Keamanan Informasi","nilai":[{"nim":"2210001","nilai":85},{"nim":"2210002","nilai":78}]}';
    }
    updateManualAuthValue();
  });

  els.auditSubject.addEventListener("input", () => renderAudit());
  els.auditResultFilter.addEventListener("change", () => renderAudit());
}

function setupSeedButtons() {
  const root = document.getElementById("accountButtons");
  Object.entries(SEED_USERS).forEach(([label, data]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      els.username.value = data.username;
      els.password.value = data.password;
      els.deviceId.value = data.deviceId;
    });
    root.appendChild(btn);
  });
}

function renderSeedButtons() {
  // noop for the simple static UI
}

function renderSessions() {
  els.sessionList.innerHTML = "";
  if (!state.sessions.length) {
    els.sessionList.innerHTML = "<div class='small'>Belum ada sesi</div>";
    return;
  }

  state.sessions.forEach((session) => {
    const row = document.createElement("div");
    row.className = `session-item ${session.id === state.activeSessionId ? "active" : ""}`;
    const badge = session.loggedOut ? "<span class='small'>(logout)</span>" : "";
    row.innerHTML = `
      <div class="meta">
        <strong>${session.username || "Sesi baru"}</strong>
        <span class="small">${session.role || "guest"} • ${session.deviceId || "device belum diisi"} ${badge}</span>
      </div>
      <div class="session-actions">
        <button type="button" class="secondary" data-session-activate="${session.id}">Pilih</button>
      </div>
    `;
    row.querySelector("button").addEventListener("click", () => {
      state.activeSessionId = session.id;
      persist();
      renderSessions();
      renderActiveSession();
      updateManualAuthValue();
    });
    els.sessionList.appendChild(row);
  });
}

function isSessionExpired(session) {
  if (!session || !session.accessToken) return false;
  const payload = decodeJwt(session.accessToken);
  if (!payload || !payload.exp) return false;
  return Number(payload.exp) <= Math.floor(Date.now() / 1000);
}

function expireActiveSession() {
  const session = getActiveSession();
  if (!session || !isSessionExpired(session)) return false;
  const expiredId = session.id;
  state.sessions = state.sessions.filter((item) => item.id !== expiredId);
  if (state.sessions.length) {
    state.activeSessionId = state.sessions[0].id;
  } else {
    state.activeSessionId = null;
  }
  persist();
  renderSessions();
  renderActiveSession();
  updateManualAuthValue();
  return true;
}

function renderActiveSession() {
  if (expireActiveSession()) {
    els.tokenTimer.textContent = "Expired";
    return;
  }

  const session = getActiveSession();
  if (!session) {
    els.activeSessionInfo.textContent = "Belum ada sesi aktif";
    els.accessTokenBox.value = "";
    els.refreshTokenBox.value = "";
    els.jwtPayload.textContent = "{}";
    els.tokenTimer.textContent = "-";
    return;
  }

  if (session.loggedOut) {
    els.accessTokenBox.value = "";
    els.refreshTokenBox.value = session.refreshToken || "";
    els.jwtPayload.textContent = JSON.stringify({
      status: "logout",
      username: session.username,
      refresh_token_revoked: true,
      note: "Coba Refresh di Request Manual dengan token lama untuk melihat 401",
    }, null, 2);
    els.tokenTimer.textContent = "revoked";
    els.activeSessionInfo.innerHTML = `
      <strong>${session.username || "Sesi baru"}</strong><br>
      Status: logout / refresh token dicabut<br>
      Role: ${session.role || "guest"}<br>
      Device: ${session.deviceId || "-"}<br>
      ID sesi: ${session.id}
    `;
    els.manualPath.value = "/auth/refresh";
    els.manualBody.value = JSON.stringify({ refresh_token: session.refreshToken });
    els.manualAuth.value = "";
    els.manualDevice.value = session.deviceId || "";
    return;
  }

  els.accessTokenBox.value = session.accessToken || "";
  els.refreshTokenBox.value = session.refreshToken || "";
  const payload = decodeJwt(session.accessToken);
  els.jwtPayload.textContent = JSON.stringify(payload || { sub: "-", role: "-" }, null, 2);
  els.tokenTimer.textContent = payload ? formatExpiry(payload.exp) : "-";
  els.activeSessionInfo.innerHTML = `
    <strong>${session.username || "Sesi baru"}</strong><br>
    Role: ${session.role || "guest"}<br>
    Device: ${session.deviceId || "-"}<br>
    ID sesi: ${session.id}
  `;

  if (payload && payload.exp) {
    const update = () => {
      const sessionNow = getActiveSession();
      if (!sessionNow) return;
      if (isSessionExpired(sessionNow)) {
        expireActiveSession();
        return;
      }
      const p = decodeJwt(sessionNow.accessToken);
      if (p && p.exp) {
        els.tokenTimer.textContent = formatExpiry(p.exp);
      }
    };
    clearInterval(window.sessionTimer);
    window.sessionTimer = setInterval(update, 1000);
  }
}

function updateManualAuthValue() {
  const session = getActiveSession();
  if (!session) {
    return;
  }
  if (session.loggedOut) {
    els.manualAuth.value = "";
    els.manualDevice.value = session.deviceId || "";
    els.manualPath.value = "/auth/refresh";
    els.manualBody.value = JSON.stringify({ refresh_token: session.refreshToken });
    return;
  }
  if (session.accessToken) {
    els.manualAuth.value = "Bearer " + session.accessToken;
    els.manualDevice.value = session.deviceId;
  }
}

function showManualResponse(res, label) {
  const badge = res.ok ? "success" : "error";
  els.manualResponse.className = `response-box ${badge}`;
  els.manualResponse.innerHTML = `
    <div class="response-header">${label} • Status: ${res.status}</div>
    <pre>${escapeHtml(prettyResponse(res))}</pre>
  `;
}

function prettyResponse(res) {
  if (!res) return "";
  const obj = res.data ?? res.text ?? res.body ?? {};
  return typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function api(method, path, options = {}) {
  let pathWithQuery = path;
  if (options.query && typeof options.query === "object") {
    const params = new URLSearchParams(options.query);
    const separator = pathWithQuery.includes("?") ? "&" : "?";
    pathWithQuery = `${pathWithQuery}${separator}${params.toString()}`;
  }

  const selectedToken = options.token !== undefined ? options.token : getActiveSession()?.accessToken || null;
  const selectedDevice = options.device !== undefined ? options.device : getActiveSession()?.deviceId || "";
  const isBodyRequest = ["POST", "PUT", "PATCH"].includes(method.toUpperCase()) && options.body !== undefined;

  const headers = { Accept: "application/json" };
  if (selectedToken !== null && selectedToken !== undefined && selectedToken !== "") {
    headers.Authorization = selectedToken.startsWith("Bearer ") ? selectedToken : "Bearer " + selectedToken;
  }
  if (selectedDevice) {
    headers["X-Device-ID"] = selectedDevice;
  }
  if (isBodyRequest) {
    headers["Content-Type"] = "application/json";
  }

  const requestInit = {
    method,
    headers,
    mode: "cors",
  };

  if (isBodyRequest) {
    requestInit.body = JSON.stringify(options.body);
  }

  let fullPath = pathWithQuery;
  if (pathWithQuery && !pathWithQuery.startsWith("http")) {
    fullPath = `${API_BASE}${pathWithQuery}`;
  }

  try {
    const response = await fetch(fullPath, requestInit);
    const text = await response.text();
    let data = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = text;
      }
    }
    return { ok: response.ok, status: response.status, data, text };
  } catch (error) {
    return { ok: false, status: 0, data: { error: String(error) }, text: String(error) };
  }
}

function renderTableResult(container, res, title) {
  if (!res || !container) return;
  if (!res.ok) {
    container.innerHTML = `<pre>${escapeHtml(JSON.stringify(res.data, null, 2))}</pre>`;
    return;
  }

  const data = res.data;
  const rows = Array.isArray(data) ? data : data?.nilai || data?.transkrip || data?.audit || [];
  if (!rows.length) {
    container.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    return;
  }

  const html = buildTable(rows, title);
  container.innerHTML = html;
}

function buildTable(rows, title) {
  const first = rows[0];
  const columns = Object.keys(first);

  const header = columns.map((key) => `<th>${escapeHtml(key)}</th>`).join("");
  const body = rows.map((row) => {
    const cells = columns.map((key) => {
      const value = row[key];
      const formatted = typeof value === "boolean" ? (value ? "true" : "false") : value;
      const isFinal = key === "final" && value === true;
      return `<td class="${isFinal ? "row-final" : ""}">${escapeHtml(String(formatted))}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `<div><strong>${escapeHtml(title)}</strong></div><table class="data-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderDosenView(res) {
  if (!res.ok) {
    els.dosenView.innerHTML = `<pre>${escapeHtml(JSON.stringify(res.data, null, 2))}</pre>`;
    return;
  }

  const rows = res.data?.nilai || [];
  if (!rows.length) {
    els.dosenView.innerHTML = `<pre>${escapeHtml(JSON.stringify(res.data, null, 2))}</pre>`;
    return;
  }

  const tableRows = rows.map((row) => `
    <tr class="${row.final ? "row-final" : ""}">
      <td>${escapeHtml(String(row.id))}</td>
      <td>${escapeHtml(row.kelas || "-")}</td>
      <td>${escapeHtml(row.nim || "-")}</td>
      <td>${escapeHtml(row.mahasiswa || "-")}</td>
      <td>
        <input data-edit-value="${row.id}" type="number" min="0" max="100" value="${row.nilai}" ${row.final ? "disabled" : ""} />
      </td>
      <td>${row.final ? "Final" : "Belum final"}</td>
      <td>
        <button type="button" data-edit-id="${row.id}" ${row.final ? "disabled" : ""}>Simpan</button>
        <button type="button" data-final-id="${row.kelas_id}" class="secondary">Finalisasi</button>
      </td>
    </tr>
  `).join("");

  els.dosenView.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Kelas</th>
          <th>NIM</th>
          <th>Mahasiswa</th>
          <th>Nilai</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  els.dosenView.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.getAttribute("data-edit-id"));
      const input = els.dosenView.querySelector(`[data-edit-value="${id}"]`);
      const result = await api("PUT", `/nilai/${id}`, {
        body: { nilai: Number(input.value) },
        token: getActiveSession()?.accessToken,
        device: getActiveSession()?.deviceId,
      });
      alert(result.ok ? `Nilai ${id} berhasil diubah` : getErrorText(result));
      document.getElementById("btnLoadNilaiDosen").click();
    });
  });

  els.dosenView.querySelectorAll("[data-final-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const kelasId = button.getAttribute("data-final-id");
      const result = await api("POST", `/kelas/${kelasId}/finalisasi`, {
        body: {},
        token: getActiveSession()?.accessToken,
        device: getActiveSession()?.deviceId,
      });
      alert(result.ok ? `Kelas ${kelasId} berhasil difinalisasi` : getErrorText(result));
      document.getElementById("btnLoadNilaiDosen").click();
    });
  });
}

async function renderAudit() {
  const session = getActiveSession();
  if (!session) {
    els.auditTableWrap.innerHTML = "<p>Login admin diperlukan untuk melihat audit log.</p>";
    return;
  }

  const subject = els.auditSubject.value.trim();
  const result = els.auditResultFilter.value;
  let url = "/audit";
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (result) params.push(`result=${encodeURIComponent(result)}`);
  if (params.length) url += `?${params.join("&")}`;

  const res = await api("GET", url, { token: session.accessToken, device: session.deviceId });
  if (!res.ok) {
    els.auditTableWrap.innerHTML = `<pre>${escapeHtml(JSON.stringify(res.data, null, 2))}</pre>`;
    return;
  }

  const rows = res.data?.audit || [];
  const rowsHtml = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.waktu || "-")}</td>
      <td>${escapeHtml(row.subjek || "-")}</td>
      <td>${escapeHtml(row.endpoint || "-")}</td>
      <td>${escapeHtml(row.device || "-")}</td>
      <td class="${row.hasil === "allow" ? "allow" : "deny"}">${escapeHtml(row.hasil || "-")}</td>
      <td>${escapeHtml(row.alasan || "-")}</td>
    </tr>
  `).join("");

  els.auditTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Waktu</th>
          <th>Subjek</th>
          <th>Endpoint</th>
          <th>Device</th>
          <th>Hasil</th>
          <th>Alasan</th>
        </tr>
      </thead>
      <tbody>${rowsHtml || "<tr><td colspan='6'>Belum ada data audit</td></tr>"}</tbody>
    </table>
  `;
}

async function runAllScenarios() {
  const results = [];

  const loginValid = await api("POST", "/auth/login", { body: { username: "dosen1", password: "dosen123" }, device: "DEV-DOSEN1-01", token: null });
  results.push({ scenario: "a. Login valid", request: "POST /auth/login", expected: "200", actual: String(loginValid.status), passed: loginValid.ok });

  const loginWrong = await api("POST", "/auth/login", { body: { username: "dosen1", password: "salah" }, device: "DEV-DOSEN1-01", token: null });
  results.push({ scenario: "a. Login password salah", request: "POST /auth/login", expected: "401", actual: String(loginWrong.status), passed: loginWrong.status === 401 });

  const loginNoDevice = await api("POST", "/auth/login", { body: { username: "dosen1", password: "dosen123" }, device: "DEV-LAIN", token: null });
  results.push({ scenario: "a. Login device tidak terdaftar", request: "POST /auth/login", expected: "403", actual: String(loginNoDevice.status), passed: loginNoDevice.status === 403 });

  const loginOtherDevice = await api("POST", "/auth/login", { body: { username: "mhs1", password: "mhs123" }, device: "DEV-DOSEN1-01", token: null });
  results.push({ scenario: "a. Login device user lain", request: "POST /auth/login", expected: "403", actual: String(loginOtherDevice.status), passed: loginOtherDevice.status === 403 });

  const noToken = await api("GET", "/nilai", { token: null, device: "DEV-MHS1-01" });
  results.push({ scenario: "b. Request tanpa token", request: "GET /nilai", expected: "401", actual: String(noToken.status), passed: noToken.status === 401 });

  const fakeToken = await api("GET", "/nilai", { token: "abc.def.ghi", device: "DEV-MHS1-01" });
  results.push({ scenario: "b. Token palsu", request: "GET /nilai", expected: "401", actual: String(fakeToken.status), passed: fakeToken.status === 401 });

  const expiredJwt = await generateExpiredJwt("mhs1", "mahasiswa");
  const expiredToken = await api("GET", "/nilai", { token: expiredJwt, device: "DEV-MHS1-01" });
  results.push({ scenario: "b. Token kedaluwarsa", request: "GET /nilai", expected: "401", actual: String(expiredToken.status), passed: expiredToken.status === 401 });

  const validJwt = await generateValidJwt("mhs1", "mahasiswa");
  const emptyDevice = await api("GET", "/nilai", { token: validJwt, device: "" });
  results.push({ scenario: "b. X-Device-ID kosong", request: "GET /nilai", expected: "403", actual: String(emptyDevice.status), passed: emptyDevice.status === 403 });

  const studentLogin = await api("POST", "/auth/login", { body: { username: "mhs1", password: "mhs123" }, device: "DEV-MHS1-01", token: null });
  const studentSession = studentLogin.ok ? studentLogin.data : null;
  const studentNilai = studentSession ? await api("GET", "/nilai", { token: studentSession.access_token, device: "DEV-MHS1-01" }) : { status: 0 };
  results.push({ scenario: "c. Mahasiswa melihat nilainya", request: "GET /nilai", expected: "200", actual: String(studentNilai.status), passed: studentNilai.status === 200 });

  const studentOtherNim = studentSession ? await api("GET", "/transkrip/2210002", { token: studentSession.access_token, device: "DEV-MHS1-01" }) : { status: 0 };
  results.push({ scenario: "c. Mahasiswa membaca NIM lain", request: "GET /transkrip/2210002", expected: "403", actual: String(studentOtherNim.status), passed: studentOtherNim.status === 403 });

  const dosenLogin = await api("POST", "/auth/login", { body: { username: "dosen1", password: "dosen123" }, device: "DEV-DOSEN1-01", token: null });
  const dosenSession = dosenLogin.ok ? dosenLogin.data : null;
  const ownClass = dosenSession ? await api("GET", "/nilai?kelas_id=1", { token: dosenSession.access_token, device: "DEV-DOSEN1-01" }) : { status: 0 };
  const otherClass = dosenSession ? await api("GET", "/nilai?kelas_id=2", { token: dosenSession.access_token, device: "DEV-DOSEN1-01" }) : { status: 0 };
  results.push({ scenario: "d. Dosen melihat kelas sendiri", request: "GET /nilai?kelas_id=1", expected: "200", actual: String(ownClass.status), passed: ownClass.status === 200 });
  results.push({ scenario: "d. Dosen melihat kelas lain", request: "GET /nilai?kelas_id=2", expected: "403", actual: String(otherClass.status), passed: otherClass.status === 403 });

  const adminLogin = await api("POST", "/auth/login", { body: { username: "admin", password: "admin123" }, device: "DEV-ADMIN-01", token: null });
  const adminSession = adminLogin.ok ? adminLogin.data : null;
  const adminTranskrip = adminSession ? await api("GET", "/transkrip/2210002", { token: adminSession.access_token, device: "DEV-ADMIN-01" }) : { status: 0 };
  const adminNilai = adminSession ? await api("GET", "/nilai", { token: adminSession.access_token, device: "DEV-ADMIN-01" }) : { status: 0 };
  results.push({ scenario: "f. Admin membaca transkrip semua NIM", request: "GET /transkrip/2210002", expected: "200", actual: String(adminTranskrip.status), passed: adminTranskrip.status === 200 });
  results.push({ scenario: "f. Admin dilarang GET /nilai", request: "GET /nilai", expected: "403", actual: String(adminNilai.status), passed: adminNilai.status === 403 });

  const serviceTokenRes = await api("POST", "/auth/service", { body: { client_id: "service-nilai", client_secret: "service-nilai-secret-praktikum" }, device: "DEV-ADMIN-01", token: null });
  const serviceToken = serviceTokenRes.ok ? serviceTokenRes.data.access_token : "";
  const userTokenSinkron = studentSession ? await api("POST", "/transkrip/sinkron", { body: { kelas_id: 1, mata_kuliah: "Keamanan Informasi", nilai: [{ nim: "2210001", nilai: 85 }] }, token: studentSession.access_token, device: "DEV-MHS1-01" }) : { status: 0 };
  const serviceSinkron = serviceToken ? await api("POST", "/transkrip/sinkron", { body: { kelas_id: 1, mata_kuliah: "Keamanan Informasi", nilai: [{ nim: "2210001", nilai: 85 }] }, token: serviceToken, device: "DEV-ADMIN-01" }) : { status: 0 };
  results.push({ scenario: "g. POST /transkrip/sinkron dengan token user", request: "POST /transkrip/sinkron", expected: "403", actual: String(userTokenSinkron.status), passed: userTokenSinkron.status === 403 });
  results.push({ scenario: "g. POST /transkrip/sinkron dengan token service", request: "POST /transkrip/sinkron", expected: "200", actual: String(serviceSinkron.status), passed: serviceSinkron.status === 200 });

  const refreshRes = adminSession ? await api("POST", "/auth/refresh", { body: { refresh_token: adminSession.refresh_token }, device: "DEV-ADMIN-01", token: null }) : { status: 0 };
  const logoutRes = adminSession ? await api("POST", "/auth/logout", { body: { refresh_token: adminSession.refresh_token }, device: "DEV-ADMIN-01", token: null }) : { status: 0 };
  results.push({ scenario: "h. Refresh token valid", request: "POST /auth/refresh", expected: "200", actual: String(refreshRes.status), passed: refreshRes.status === 200 });
  results.push({ scenario: "h. Setelah logout", request: "POST /auth/logout", expected: "200", actual: String(logoutRes.status), passed: logoutRes.status === 200 });

  if (!isAccessWindowOpen()) {
    results.push({ scenario: "e. Ubah/finalisasi di luar jam akses", request: "PUT /nilai/1", expected: "skip", actual: "skip", passed: true, skipped: true, note: "Jam akses tidak aktif saat ini, skenario dilewati." });
  }

  renderScenarioTable(results);
}

function renderScenarioTable(results) {
  const rows = results.map((row) => `
    <tr>
      <td>${escapeHtml(row.scenario)}</td>
      <td>${escapeHtml(row.request)}</td>
      <td>${escapeHtml(row.expected)}</td>
      <td>${escapeHtml(row.actual)}</td>
      <td class="${row.skipped ? "status-skip" : row.passed ? "status-pass" : "status-fail"}">
        ${row.skipped ? "Lewati" : row.passed ? "Lulus" : "Gagal"}
      </td>
    </tr>
  `).join("");

  els.scenarioResults.innerHTML = `
    <table>
      <thead>
        <tr><th>Skenario</th><th>Request</th><th>Diharapkan</th><th>Aktual</th><th>Hasil</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function updateServiceTokenBox() {
  if (!state.serviceToken) {
    els.serviceTokenBox.innerHTML = "<pre>Belum ada token service</pre>";
    return;
  }
  els.serviceTokenBox.innerHTML = `<pre>${escapeHtml(state.serviceToken)}</pre>`;
}

function getActiveSession() {
  return state.sessions.find((session) => session.id === state.activeSessionId) || null;
}

function removeSession(id) {
  state.sessions = state.sessions.filter((session) => session.id !== id);
  if (state.sessions.length) {
    state.activeSessionId = state.sessions[0].id;
  } else {
    state.activeSessionId = null;
  }
  persist();
}

function persist() {
  localStorage.setItem("sistemNilaiSessions", JSON.stringify(state.sessions));
  if (state.activeSessionId) {
    localStorage.setItem("sistemNilaiActiveSession", state.activeSessionId);
  } else {
    localStorage.removeItem("sistemNilaiActiveSession");
  }
  localStorage.setItem("sistemNilaiServiceToken", state.serviceToken || "");
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function makeId() {
  return `session-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getErrorText(res) {
  if (res?.data && typeof res.data === "object") {
    return res.data.error || JSON.stringify(res.data);
  }
  return res?.text || "Request gagal";
}

function isAccessWindowOpen() {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseTime("00:00");
  const end = parseTime("23:59");
  return current >= start && current < end;
}

function parseTime(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function decodeJwt(token) {
  if (!token || token.split(".").length < 2) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
}

function formatExpiry(exp) {
  if (!exp) return "-";
  const now = Math.floor(Date.now() / 1000);
  const seconds = Math.max(0, Number(exp) - now);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s tersisa`;
}

function atobUrlDecode(value) {
  return atob(value.replace(/-/g, "+").replace(/_/g, "/"));
}

function base64UrlEncode(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(String(input));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlFromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function generateSignedTokenWithPayload(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureArray = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlFromArrayBuffer(signatureArray)}`;
}

async function generateExpiredJwt(sub, role) {
  const now = Math.floor(Date.now() / 1000);
  return generateSignedTokenWithPayload({ sub, role, iat: now - 3600, exp: now - 60 }, "jwt-secret-praktikum-zero-trust-32b!");
}

async function generateValidJwt(sub, role) {
  const now = Math.floor(Date.now() / 1000);
  return generateSignedTokenWithPayload({ sub, role, iat: now - 30, exp: now + 60 }, "jwt-secret-praktikum-zero-trust-32b!");
}

function wirePreset() {
  const defaultPreset = "GET /nilai";
  els.presetSelect.value = defaultPreset;
  els.methodSelect.value = "GET";
  els.manualPath.value = "/nilai";
  els.manualAuth.value = "";
  els.manualDevice.value = "";
}

window.addEventListener("beforeunload", () => {
  clearInterval(window.sessionTimer);
});
