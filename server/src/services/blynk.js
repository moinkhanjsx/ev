import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");

const DEFAULT_BLYNK_BASE_URL = "https://blynk.cloud";
const DEFAULT_BLYNK_DASHBOARD_URL =
  "https://blynk.cloud/dashboard/649019/global/devices/1/organization/649019/devices/2014075/dashboard";
const DEFAULT_CACHE_TTL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HELPER_DIR = path.join(PROJECT_ROOT, "blynkhelper");

let snapshotCache = {
  fetchedAt: 0,
  value: null
};

let envDatastreamConfigCache = null;

const createBlynkError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizePin = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const humanizeName = (value) =>
  String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bcode\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const getBlynkBaseUrl = () => trimTrailingSlash(process.env.BLYNK_BASE_URL || DEFAULT_BLYNK_BASE_URL);

const getDashboardUrl = () => process.env.BLYNK_DASHBOARD_URL?.trim() || DEFAULT_BLYNK_DASHBOARD_URL;

const getCacheTtlMs = () => {
  const parsed = parseInt(process.env.BLYNK_CACHE_TTL_MS || `${DEFAULT_CACHE_TTL_MS}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_TTL_MS;
};

const getTimeoutMs = () => {
  const parsed = parseInt(process.env.BLYNK_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const getHelperDir = () => {
  const configured = process.env.BLYNK_HELPER_DIR?.trim();
  if (!configured) {
    return DEFAULT_HELPER_DIR;
  }

  return path.isAbsolute(configured) ? configured : path.join(PROJECT_ROOT, configured);
};

const shouldDiscoverSketchProfiles = () => {
  const rawValue = process.env.BLYNK_DISABLE_SKETCH_DISCOVERY?.trim().toLowerCase();
  return !["1", "true", "yes", "on"].includes(rawValue || "");
};

const toPositiveIntegerOrNull = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const coerceConfiguredValue = (valueType, value) => {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  if (valueType === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (valueType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(normalized)) return true;
    if (["false", "0", "off", "no"].includes(normalized)) return false;
  }

  return value;
};

const normalizeDatastreamConfigEntry = (entry, index) => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const dataStreamId = toPositiveIntegerOrNull(entry.dataStreamId);
  const pin = normalizePin(entry.pin);
  const writable = Boolean(entry.writable);
  const valueType = typeof entry.valueType === "string" ? entry.valueType.trim().toLowerCase() : "";

  if (!pin && !Number.isInteger(dataStreamId)) {
    return null;
  }

  return {
    key: typeof entry.key === "string" && entry.key.trim() ? entry.key.trim() : `stream_${index + 1}`,
    label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : pin || `Stream ${index + 1}`,
    pin,
    dataStreamId,
    unit: typeof entry.unit === "string" ? entry.unit.trim() : "",
    writable,
    kind: typeof entry.kind === "string" && entry.kind.trim()
      ? entry.kind.trim().toLowerCase()
      : writable
        ? "toggle"
        : "metric",
    description: typeof entry.description === "string" ? entry.description.trim() : "",
    show: entry.show !== false,
    valueType,
    onValue: coerceConfiguredValue(valueType, entry.onValue ?? 1),
    offValue: coerceConfiguredValue(valueType, entry.offValue ?? 0),
    commandValue: coerceConfiguredValue(valueType, entry.commandValue ?? null),
    onLabel: typeof entry.onLabel === "string" && entry.onLabel.trim() ? entry.onLabel.trim() : "Start",
    offLabel: typeof entry.offLabel === "string" && entry.offLabel.trim() ? entry.offLabel.trim() : "Stop"
  };
};

const getEnvDatastreamConfig = () => {
  if (envDatastreamConfigCache) {
    return envDatastreamConfigCache;
  }

  const rawValue = process.env.BLYNK_DATASTREAMS_JSON?.trim() || process.env.BLYNK_DATASTREAMS?.trim();
  if (!rawValue) {
    envDatastreamConfigCache = [];
    return envDatastreamConfigCache;
  }

  let parsedValue;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch (error) {
    throw createBlynkError(500, "BLYNK_DATASTREAMS_JSON must be valid JSON.");
  }

  if (!Array.isArray(parsedValue)) {
    throw createBlynkError(500, "BLYNK_DATASTREAMS_JSON must be an array.");
  }

  envDatastreamConfigCache = parsedValue
    .map((entry, index) => normalizeDatastreamConfigEntry(entry, index))
    .filter(Boolean);

  return envDatastreamConfigCache;
};

const getDefaultSketchDatastreamConfig = (profile) => [
  normalizeDatastreamConfigEntry(
    {
      key: "voltage",
      label: "Battery Voltage",
      pin: "v0",
      unit: "V",
      valueType: "number",
      description: `Voltage reading from ${profile.analogPin || "A0"}`
    },
    0
  ),
  normalizeDatastreamConfigEntry(
    {
      key: "batteryPercent",
      label: "Battery Level",
      pin: "v1",
      unit: "%",
      valueType: "number",
      description: "Battery percentage derived in the sketch"
    },
    1
  ),
  normalizeDatastreamConfigEntry(
    {
      key: "chargeStatus",
      label: "Charge Status",
      pin: "v2",
      valueType: "string",
      description: "Realtime state text pushed by the ESP sketch"
    },
    2
  ),
  normalizeDatastreamConfigEntry(
    {
      key: "chargeRelay",
      label: "Charge Relay",
      pin: "v3",
      writable: true,
      kind: "toggle",
      valueType: "number",
      onValue: 1,
      offValue: 0,
      onLabel: "Start Charging",
      offLabel: "Stop Charging",
      description: `Relay output on ${profile.relayPin || "D1"}`
    },
    3
  )
].filter(Boolean);

const extractResponsePayload = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

const extractErrorMessage = (payload, fallbackMessage) => {
  if (payload && typeof payload === "object" && payload.error?.message) {
    return payload.error.message;
  }

  if (payload && typeof payload === "object" && payload.message) {
    return payload.message;
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  return fallbackMessage;
};

const requestBlynk = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(getTimeoutMs())
  });

  const payload = await extractResponsePayload(response);
  if (!response.ok) {
    throw createBlynkError(
      response.status,
      extractErrorMessage(payload, `Blynk request failed with status ${response.status}.`)
    );
  }

  return payload;
};

const buildAuthHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json"
});

const toIsoString = (value) => {
  if (!value) return null;

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) ? new Date(numericValue) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const stringifyValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value === null || value === undefined ? "" : String(value);
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isToggleOn = (value, entry) => stringifyValue(value) === stringifyValue(entry.onValue);

const buildRawEntry = ({ source, configEntry }) => {
  const pin = normalizePin(configEntry?.pin || source?.pin);
  const dataStreamId = configEntry?.dataStreamId ?? toPositiveIntegerOrNull(source?.dataStreamId);

  if (!pin && !Number.isInteger(dataStreamId)) {
    return null;
  }

  const label =
    configEntry?.label ||
    source?.dataStreamLabel ||
    source?.dataStreamAlias ||
    source?.label ||
    pin ||
    `Datastream ${dataStreamId}`;

  return {
    key: configEntry?.key || pin || `stream_${dataStreamId}`,
    label,
    pin,
    dataStreamId,
    unit: configEntry?.unit || "",
    value: source?.value ?? source ?? null,
    updatedAt: toIsoString(source?.updatedAt),
    writable: Boolean(configEntry?.writable),
    kind: configEntry?.kind || (configEntry?.writable ? "toggle" : "metric"),
    description: configEntry?.description || "",
    show: configEntry?.show !== false,
    valueType: configEntry?.valueType || "",
    onValue: configEntry?.onValue ?? 1,
    offValue: configEntry?.offValue ?? 0,
    commandValue: configEntry?.commandValue ?? null,
    onLabel: configEntry?.onLabel || "Start",
    offLabel: configEntry?.offLabel || "Stop"
  };
};

const buildRawDatastreamsFromPlatform = (dataStreamValues, configEntries) => {
  const values = Array.isArray(dataStreamValues) ? dataStreamValues : [];
  const byPin = new Map();
  const byId = new Map();

  values.forEach((item) => {
    const pin = normalizePin(item?.pin);
    if (pin) {
      byPin.set(pin, item);
    }

    const dataStreamId = toPositiveIntegerOrNull(item?.dataStreamId);
    if (Number.isInteger(dataStreamId)) {
      byId.set(dataStreamId, item);
    }
  });

  const seenMarkers = new Set();
  const mappedEntries = configEntries
    .map((entry) => {
      const source = Number.isInteger(entry.dataStreamId)
        ? byId.get(entry.dataStreamId)
        : byPin.get(entry.pin);

      if (source) {
        seenMarkers.add(`${normalizePin(source.pin)}:${toPositiveIntegerOrNull(source.dataStreamId) ?? ""}`);
      }

      return buildRawEntry({ source, configEntry: entry });
    })
    .filter(Boolean);

  const fallbackEntries = values
    .filter((item) => !seenMarkers.has(`${normalizePin(item?.pin)}:${toPositiveIntegerOrNull(item?.dataStreamId) ?? ""}`))
    .map((item) => buildRawEntry({ source: item }))
    .filter(Boolean);

  return [...mappedEntries, ...fallbackEntries];
};

const buildRawDatastreamsFromDeviceValues = (rawValues, configEntries) => {
  const normalizedMap = new Map(
    Object.entries(rawValues || {}).map(([pin, value]) => [normalizePin(pin), value])
  );

  const seenPins = new Set();
  const mappedEntries = configEntries
    .map((entry) => {
      const sourceValue = normalizedMap.get(entry.pin);
      if (entry.pin) {
        seenPins.add(entry.pin);
      }

      return buildRawEntry({
        source: sourceValue === undefined ? null : { pin: entry.pin, value: sourceValue },
        configEntry: entry
      });
    })
    .filter(Boolean);

  const fallbackEntries = [...normalizedMap.entries()]
    .filter(([pin]) => pin && !seenPins.has(pin))
    .map(([pin, value]) => buildRawEntry({ source: { pin, value } }))
    .filter(Boolean)
    .sort((left, right) => left.pin.localeCompare(right.pin));

  return [...mappedEntries, ...fallbackEntries];
};

const findEntry = (rawDatastreams, matcher) => rawDatastreams.find((entry) => matcher(entry)) || null;

const deriveFlowDirection = (statusText, relayActive) => {
  const normalized = String(statusText || "").toLowerCase();

  if (normalized.includes("low battery")) {
    return { key: "low-battery", label: "Low Battery" };
  }

  if (normalized.includes("charging")) {
    return { key: "receiving", label: "Receiving Power" };
  }

  if (normalized.includes("discharging")) {
    return { key: "sending", label: "Sending Power" };
  }

  if (relayActive) {
    return { key: "receiving", label: "Receiving Power" };
  }

  return { key: "idle", label: "Idle" };
};

const buildDerivedState = (rawDatastreams) => {
  const voltageEntry = findEntry(
    rawDatastreams,
    (entry) => entry.key === "voltage" || entry.pin === "v0"
  );
  const batteryEntry = findEntry(
    rawDatastreams,
    (entry) => entry.key === "batteryPercent" || entry.pin === "v1"
  );
  const statusEntry = findEntry(
    rawDatastreams,
    (entry) => entry.key === "chargeStatus" || entry.key === "status" || entry.pin === "v2"
  );
  const relayEntry = findEntry(
    rawDatastreams,
    (entry) => entry.key === "chargeRelay" || entry.key === "relay" || entry.pin === "v3"
  );

  const statusText = stringifyValue(statusEntry?.value);
  const relayActive = relayEntry ? isToggleOn(relayEntry.value, relayEntry) : false;
  const flow = deriveFlowDirection(statusText, relayActive);

  return {
    voltage: toNumberOrNull(voltageEntry?.value),
    batteryPercent: toNumberOrNull(batteryEntry?.value),
    statusText: statusText || "Unknown",
    relayActive,
    relayValue: relayEntry?.value ?? null,
    flowDirection: flow.key,
    flowLabel: flow.label
  };
};

const buildMetrics = (rawDatastreams) => {
  const visibleStreams = rawDatastreams.filter((entry) => entry.show !== false);
  const metrics = visibleStreams.filter((entry) => !entry.writable || entry.kind === "metric");
  const source = metrics.length > 0 ? metrics : visibleStreams;

  return source.map((entry) => ({
    key: entry.key,
    label: entry.label,
    value: entry.value,
    formattedValue: stringifyValue(entry.value),
    unit: entry.unit,
    pin: entry.pin,
    dataStreamId: entry.dataStreamId,
    updatedAt: entry.updatedAt,
    description: entry.description
  }));
};

const buildControls = (rawDatastreams, deviceKey) =>
  rawDatastreams
    .filter((entry) => entry.show !== false && entry.writable)
    .map((entry) => {
      const active = isToggleOn(entry.value, entry);
      return {
        key: entry.key,
        deviceKey,
        label: entry.label,
        pin: entry.pin,
        dataStreamId: entry.dataStreamId,
        description: entry.description,
        kind: entry.kind,
        currentValue: entry.value,
        formattedValue: stringifyValue(entry.value),
        active,
        actionLabel: active ? entry.offLabel : entry.onLabel,
        nextValue: active ? entry.offValue : entry.onValue
      };
    });

const buildDeviceSnapshot = ({
  profile,
  rawDatastreams,
  rawValues,
  connected,
  statusLabel,
  lastSeenAt,
  error = ""
}) => {
  const safeStreams = rawDatastreams.filter(Boolean);
  const derivedState = buildDerivedState(safeStreams);

  return {
    key: profile.key,
    configured: true,
    mode: profile.mode,
    source: profile.source,
    sourceLabel: profile.sourceLabel,
    dashboardUrl: profile.dashboardUrl,
    error,
    refreshedAt: new Date().toISOString(),
    device: {
      id: profile.deviceId ?? null,
      name: profile.name,
      templateId: profile.templateId || "",
      templateName: profile.templateName || "",
      connected: Boolean(connected) && !error,
      statusLabel: error ? "Unavailable" : statusLabel || (connected ? "Online" : "Offline"),
      boardType: profile.boardType || "",
      firmwareVersion: profile.firmwareVersion || "",
      lastSeenAt: error ? null : lastSeenAt || null,
      sketchFile: profile.source === "sketch" ? profile.sourceLabel : "",
      analogPin: profile.analogPin || "",
      relayPin: profile.relayPin || ""
    },
    derivedState,
    metrics: buildMetrics(safeStreams),
    controls: buildControls(safeStreams, profile.key),
    rawDatastreams: safeStreams
      .filter((entry) => entry.show !== false)
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        pin: entry.pin,
        dataStreamId: entry.dataStreamId,
        value: entry.value,
        formattedValue: stringifyValue(entry.value),
        unit: entry.unit,
        updatedAt: entry.updatedAt,
        writable: entry.writable
      })),
    rawValues
  };
};

const buildProfileErrorSnapshot = (profile, error) =>
  buildDeviceSnapshot({
    profile,
    rawDatastreams: buildRawDatastreamsFromDeviceValues({}, profile.datastreamConfig || []),
    rawValues: {},
    connected: false,
    statusLabel: "Unavailable",
    lastSeenAt: null,
    error: error.message || "Failed to load device data."
  });

const parseSketchProfile = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  const authTokenMatch = content.match(/#define\s+BLYNK_AUTH_TOKEN\s+"([^"]+)"/);
  if (!authTokenMatch?.[1]) {
    return null;
  }

  const templateIdMatch = content.match(/#define\s+BLYNK_TEMPLATE_ID\s+"([^"]+)"/);
  const templateNameMatch = content.match(/#define\s+BLYNK_TEMPLATE_NAME\s+"([^"]+)"/);
  const analogPinMatch = content.match(/#define\s+ANALOG_PIN\s+([A-Za-z0-9_]+)/);
  const relayPinMatch = content.match(/#define\s+RELAY_PIN\s+([A-Za-z0-9_]+)/);
  const fileName = path.basename(filePath);
  const inferredName = humanizeName(fileName).replace(/\s+Code$/i, "").trim() || humanizeName(fileName);
  const profile = {
    key: slugify(inferredName || fileName) || slugify(fileName),
    name: inferredName || templateNameMatch?.[1] || "Sketch Device",
    templateId: templateIdMatch?.[1] || "",
    templateName: templateNameMatch?.[1] || "",
    token: authTokenMatch[1].trim(),
    mode: "device-token",
    source: "sketch",
    sourceLabel: fileName,
    dashboardUrl: getDashboardUrl(),
    boardType: /ESP8266WiFi/i.test(content) ? "ESP8266" : "",
    firmwareVersion: "",
    analogPin: analogPinMatch?.[1] || "",
    relayPin: relayPinMatch?.[1] || "",
    deviceId: null
  };

  profile.datastreamConfig = getDefaultSketchDatastreamConfig(profile);
  return profile;
};

const getSketchProfiles = () => {
  if (!shouldDiscoverSketchProfiles()) {
    return [];
  }

  const helperDir = getHelperDir();
  if (!fs.existsSync(helperDir) || !fs.statSync(helperDir).isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(helperDir)
    .filter((fileName) => fileName.toLowerCase().endsWith(".ino"))
    .map((fileName) => parseSketchProfile(path.join(helperDir, fileName)))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
};

const getEnvMode = () => {
  if (process.env.BLYNK_ACCESS_TOKEN?.trim() && process.env.BLYNK_DEVICE_ID?.trim()) {
    return "platform";
  }

  if (process.env.BLYNK_DEVICE_TOKEN?.trim()) {
    return "device-token";
  }

  return null;
};

const getEnvProfiles = () => {
  const mode = getEnvMode();
  if (!mode) {
    return [];
  }

  if (mode === "platform") {
    return [
      {
        key: "configured-platform-device",
        name: process.env.BLYNK_DEVICE_NAME?.trim() || "Configured Blynk Device",
        templateId: "",
        templateName: "",
        mode: "platform",
        source: "env",
        sourceLabel: "server/.env",
        dashboardUrl: getDashboardUrl(),
        boardType: "",
        firmwareVersion: "",
        analogPin: "",
        relayPin: "",
        deviceId: toPositiveIntegerOrNull(process.env.BLYNK_DEVICE_ID?.trim()),
        accessToken: process.env.BLYNK_ACCESS_TOKEN?.trim(),
        datastreamConfig: getEnvDatastreamConfig()
      }
    ];
  }

  return [
    {
      key: "configured-device-token",
      name: process.env.BLYNK_DEVICE_NAME?.trim() || "Configured Blynk Device",
      templateId: "",
      templateName: "",
      mode: "device-token",
      source: "env",
      sourceLabel: "server/.env",
      dashboardUrl: getDashboardUrl(),
      boardType: "",
      firmwareVersion: "",
      analogPin: "",
      relayPin: "",
      deviceId: null,
      token: process.env.BLYNK_DEVICE_TOKEN?.trim(),
      datastreamConfig: getEnvDatastreamConfig()
    }
  ];
};

const getProfiles = () => {
  const dedupe = new Map();

  [...getEnvProfiles(), ...getSketchProfiles()].forEach((profile) => {
    const marker = profile.mode === "platform"
      ? `platform:${profile.deviceId}`
      : `token:${profile.token}`;

    if (!profile.datastreamConfig) {
      profile.datastreamConfig = [];
    }

    if (!dedupe.has(marker)) {
      dedupe.set(marker, profile);
    }
  });

  return [...dedupe.values()];
};

const fetchPlatformProfileSnapshot = async (profile) => {
  if (!profile.accessToken || !profile.deviceId) {
    throw createBlynkError(500, "Platform profile requires BLYNK_ACCESS_TOKEN and BLYNK_DEVICE_ID.");
  }

  const baseUrl = getBlynkBaseUrl();
  const deviceUrl = new URL("/api/v1/organization/device", baseUrl);
  deviceUrl.searchParams.set("deviceId", `${profile.deviceId}`);

  const onlineUrl = new URL("/api/v1/organization/device/online", baseUrl);
  onlineUrl.searchParams.set("deviceId", `${profile.deviceId}`);

  const [deviceInfo, onlineStatus] = await Promise.all([
    requestBlynk(deviceUrl, { headers: buildAuthHeaders(profile.accessToken) }),
    requestBlynk(onlineUrl, { headers: buildAuthHeaders(profile.accessToken) })
  ]);

  const rawDatastreams = buildRawDatastreamsFromPlatform(deviceInfo?.dataStreamValues, profile.datastreamConfig || []);
  return buildDeviceSnapshot({
    profile: {
      ...profile,
      name: deviceInfo?.name || profile.name,
      boardType: deviceInfo?.hardwareInfo?.boardType || profile.boardType,
      firmwareVersion: deviceInfo?.hardwareInfo?.version || profile.firmwareVersion
    },
    rawDatastreams,
    rawValues: Object.fromEntries(rawDatastreams.map((entry) => [entry.pin || entry.key, entry.value])),
    connected: Boolean(onlineStatus?.connected),
    statusLabel: deviceInfo?.lifecycleStatus?.name || (onlineStatus?.connected ? "Online" : "Offline"),
    lastSeenAt: toIsoString(deviceInfo?.lastReceivedEventAt || deviceInfo?.disconnectTime || deviceInfo?.connectTime)
  });
};

const fetchDeviceTokenProfileSnapshot = async (profile) => {
  if (!profile.token) {
    throw createBlynkError(500, "Device-token profile requires a Blynk auth token.");
  }

  const baseUrl = getBlynkBaseUrl();
  const datastreamsUrl = new URL("/external/api/getAll", baseUrl);
  datastreamsUrl.searchParams.set("token", profile.token);

  const onlineUrl = new URL("/external/api/isHardwareConnected", baseUrl);
  onlineUrl.searchParams.set("token", profile.token);

  const [rawValues, connected] = await Promise.all([
    requestBlynk(datastreamsUrl),
    requestBlynk(onlineUrl)
  ]);

  const rawDatastreams = buildRawDatastreamsFromDeviceValues(rawValues, profile.datastreamConfig || []);
  return buildDeviceSnapshot({
    profile,
    rawDatastreams,
    rawValues,
    connected: Boolean(connected),
    statusLabel: connected ? "Online" : "Offline",
    lastSeenAt: null
  });
};

const fetchProfileSnapshot = async (profile) => {
  if (profile.mode === "platform") {
    return fetchPlatformProfileSnapshot(profile);
  }

  return fetchDeviceTokenProfileSnapshot(profile);
};

const fetchProfileSnapshotSafe = async (profile) => {
  try {
    return await fetchProfileSnapshot(profile);
  } catch (error) {
    return buildProfileErrorSnapshot(profile, error);
  }
};

const buildSummary = (devices) => ({
  deviceCount: devices.length,
  onlineCount: devices.filter((device) => device.device?.connected).length,
  chargingCount: devices.filter((device) => device.derivedState?.flowDirection === "receiving").length,
  sendingCount: devices.filter((device) => device.derivedState?.flowDirection === "sending").length,
  lowBatteryCount: devices.filter((device) => device.derivedState?.flowDirection === "low-battery").length,
  errorCount: devices.filter((device) => device.error).length
});

const buildEmptySnapshot = (message) => ({
  configured: false,
  mode: null,
  dashboardUrl: getDashboardUrl(),
  cacheTtlMs: getCacheTtlMs(),
  refreshedAt: new Date().toISOString(),
  summary: {
    deviceCount: 0,
    onlineCount: 0,
    chargingCount: 0,
    sendingCount: 0,
    lowBatteryCount: 0,
    errorCount: 0
  },
  devices: [],
  primaryDeviceKey: null,
  device: null,
  metrics: [],
  controls: [],
  rawDatastreams: [],
  rawValues: {},
  message
});

const buildAggregateSnapshot = (profiles, devices) => {
  const primaryDevice = devices.find((device) => device.device?.connected) || devices[0] || null;
  const sourceMode = profiles.length === 0
    ? null
    : profiles.every((profile) => profile.source === "sketch")
      ? "sketch-discovery"
      : profiles.length === 1 && profiles[0].source === "env"
        ? profiles[0].mode
        : "mixed";

  return {
    configured: profiles.length > 0,
    mode: sourceMode,
    dashboardUrl: getDashboardUrl(),
    cacheTtlMs: getCacheTtlMs(),
    refreshedAt: new Date().toISOString(),
    summary: buildSummary(devices),
    devices,
    primaryDeviceKey: primaryDevice?.key || null,
    device: primaryDevice?.device || null,
    metrics: primaryDevice?.metrics || [],
    controls: primaryDevice?.controls || [],
    rawDatastreams: primaryDevice?.rawDatastreams || [],
    rawValues: primaryDevice?.rawValues || {},
    message: devices.every((device) => device.error)
      ? "Device profiles were discovered, but every Blynk request failed."
      : ""
  };
};

const resolveProfileForControl = (profiles, deviceKey) => {
  if (deviceKey) {
    const matched = profiles.find((profile) => profile.key === deviceKey);
    if (!matched) {
      throw createBlynkError(404, `Unknown Blynk device "${deviceKey}".`);
    }
    return matched;
  }

  if (profiles.length === 1) {
    return profiles[0];
  }

  throw createBlynkError(400, "deviceKey is required when multiple Blynk devices are configured.");
};

const resolveWritableConfigEntry = (profile, { key, pin }) => {
  const configEntries = (profile.datastreamConfig || []).filter((entry) => entry.writable);

  if (key) {
    const matchedByKey = configEntries.find((entry) => entry.key === key);
    if (matchedByKey) return matchedByKey;
  }

  if (pin) {
    const normalizedPin = normalizePin(pin);
    const matchedByPin = configEntries.find((entry) => entry.pin === normalizedPin);
    if (matchedByPin) return matchedByPin;
  }

  return null;
};

const resolveControlValue = ({ entry, requestedValue, currentValue }) => {
  if (requestedValue === undefined) {
    if (entry.kind === "toggle") {
      return isToggleOn(currentValue, entry) ? entry.offValue : entry.onValue;
    }

    if (entry.commandValue !== null) {
      return entry.commandValue;
    }

    throw createBlynkError(400, `A value is required to control "${entry.label}".`);
  }

  if (typeof requestedValue === "boolean" && entry.kind === "toggle") {
    return requestedValue ? entry.onValue : entry.offValue;
  }

  if (requestedValue === "toggle" && entry.kind === "toggle") {
    return isToggleOn(currentValue, entry) ? entry.offValue : entry.onValue;
  }

  return coerceConfiguredValue(entry.valueType, requestedValue);
};

const sendPlatformValue = async (profile, entry, value) => {
  let dataStreamId = entry.dataStreamId;

  if (!Number.isInteger(dataStreamId)) {
    const latestSnapshot = await fetchPlatformProfileSnapshot(profile);
    const matched = latestSnapshot.rawDatastreams.find((item) => item.pin === entry.pin);
    dataStreamId = matched?.dataStreamId ?? null;
  }

  if (!Number.isInteger(dataStreamId)) {
    throw createBlynkError(
      400,
      `Control mapping for "${entry.label}" requires a dataStreamId when using the platform API.`
    );
  }

  const updateUrl = new URL("/api/v1/organization/device/datastream", getBlynkBaseUrl());
  await requestBlynk(updateUrl, {
    method: "POST",
    headers: buildAuthHeaders(profile.accessToken),
    body: JSON.stringify({
      deviceId: profile.deviceId,
      dataStreamId,
      value
    })
  });
};

const sendDeviceTokenValue = async (profile, entry, value) => {
  if (!entry.pin) {
    throw createBlynkError(400, `Control mapping for "${entry.label}" requires a pin.`);
  }

  const updateUrl = new URL("/external/api/update", getBlynkBaseUrl());
  updateUrl.searchParams.set("token", profile.token);
  updateUrl.searchParams.set(entry.pin, `${value}`);
  await requestBlynk(updateUrl);
};

export const isBlynkConfigured = () => getProfiles().length > 0;

export const clearBlynkSnapshotCache = () => {
  snapshotCache = {
    fetchedAt: 0,
    value: null
  };
};

export const getBlynkSnapshot = async ({ force = false } = {}) => {
  const cacheTtlMs = getCacheTtlMs();
  const now = Date.now();

  if (!force && snapshotCache.value && now - snapshotCache.fetchedAt < cacheTtlMs) {
    return snapshotCache.value;
  }

  const profiles = getProfiles();
  if (profiles.length === 0) {
    const emptySnapshot = buildEmptySnapshot(
      "No Blynk device configuration was found. The app will auto-discover sketches from blynkhelper/*.ino or use server/.env."
    );
    snapshotCache = {
      fetchedAt: now,
      value: emptySnapshot
    };
    return emptySnapshot;
  }

  const devices = await Promise.all(profiles.map((profile) => fetchProfileSnapshotSafe(profile)));
  const snapshot = buildAggregateSnapshot(profiles, devices);
  snapshotCache = {
    fetchedAt: now,
    value: snapshot
  };

  return snapshot;
};

export const sendBlynkControl = async ({ deviceKey, key, pin, value }) => {
  const profiles = getProfiles();
  if (profiles.length === 0) {
    throw createBlynkError(
      503,
      "Blynk is not configured. Add .ino files in blynkhelper or set BLYNK_DEVICE_TOKEN / BLYNK_ACCESS_TOKEN in server/.env."
    );
  }

  const profile = resolveProfileForControl(profiles, deviceKey);
  const entry = resolveWritableConfigEntry(profile, { key, pin });
  if (!entry) {
    throw createBlynkError(
      400,
      `Unknown writable control for device "${profile.name}".`
    );
  }

  const snapshot = await getBlynkSnapshot({ force: true });
  const deviceSnapshot = snapshot.devices.find((device) => device.key === profile.key);
  const currentValue =
    deviceSnapshot?.rawDatastreams.find((item) => item.key === entry.key || item.pin === entry.pin)?.value ?? null;
  const resolvedValue = resolveControlValue({
    entry,
    requestedValue: value,
    currentValue
  });

  if (profile.mode === "platform") {
    await sendPlatformValue(profile, entry, resolvedValue);
  } else {
    await sendDeviceTokenValue(profile, entry, resolvedValue);
  }

  clearBlynkSnapshotCache();
  return getBlynkSnapshot({ force: true });
};
