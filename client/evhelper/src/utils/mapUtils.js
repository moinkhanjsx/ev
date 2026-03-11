import L from "leaflet";

export const DEFAULT_MAP_CENTER = {
  latitude: 20.5937,
  longitude: 78.9629,
};

const buildDivIcon = (color) =>
  L.divIcon({
    className: "ev-map-marker",
    html: `
      <div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${color};border:3px solid #ffffff;box-shadow:0 8px 24px rgba(0,0,0,0.35);"></div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });

export const selectedLocationIcon = buildDivIcon("#06b6d4");
export const requesterLocationIcon = buildDivIcon("#ef4444");
export const navigatorLocationIcon = buildDivIcon("#22c55e");

export const normalizeCoordinates = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const latitude =
    typeof value.latitude === "number" ? value.latitude : Number.parseFloat(value.latitude);
  const longitude =
    typeof value.longitude === "number" ? value.longitude : Number.parseFloat(value.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
};

export const getLatLngTuple = (value) => {
  const normalized = normalizeCoordinates(value);
  return normalized ? [normalized.latitude, normalized.longitude] : null;
};

export const hasSecureGeolocationContext = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.isSecureContext) {
    return true;
  }

  const hostname = window.location?.hostname || "";
  return hostname === "localhost" || hostname === "127.0.0.1";
};

export const getBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.navigator?.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    if (!hasSecureGeolocationContext()) {
      reject(new Error("Location works only on HTTPS or localhost."));
      return;
    }

    window.navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  });

export const formatDistance = (distanceInMeters) => {
  const distance = Number(distanceInMeters);

  if (!Number.isFinite(distance) || distance <= 0) {
    return "0 km";
  }

  if (distance < 1000) {
    return `${Math.round(distance)} m`;
  }

  return `${(distance / 1000).toFixed(1)} km`;
};

export const formatDuration = (durationInSeconds) => {
  const duration = Number(durationInSeconds);

  if (!Number.isFinite(duration) || duration <= 0) {
    return "0 min";
  }

  const hours = Math.floor(duration / 3600);
  const minutes = Math.round((duration % 3600) / 60);

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
};
