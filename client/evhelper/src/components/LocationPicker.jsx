import React from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DEFAULT_MAP_CENTER,
  hasSecureGeolocationContext,
  normalizeCoordinates,
  selectedLocationIcon,
} from '../utils/mapUtils.js';

const MapViewport = ({ center, zoom }) => {
  const map = useMap();

  React.useEffect(() => {
    if (!center) {
      return;
    }

    map.setView([center.latitude, center.longitude], zoom, {
      animate: true,
    });
  }, [center, map, zoom]);

  return null;
};

const formatCoordinate = (value) => {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return value.toFixed(6);
};

const getTrackingErrorMessage = (error) => {
  if (error?.message === 'Location works only on HTTPS or localhost.') {
    return error.message;
  }

  if (error?.code === 1) {
    return 'Location access is required so the request always uses your current GPS position.';
  }

  return 'Unable to read your current GPS position. Check your browser location permission and try again.';
};

const LocationPicker = ({ onLocationSelect, onLocationStateChange }) => {
  const [mapCenter, setMapCenter] = React.useState(DEFAULT_MAP_CENTER);
  const [selectedLocation, setSelectedLocation] = React.useState(null);
  const [isDetectingLocation, setIsDetectingLocation] = React.useState(false);
  const [locationError, setLocationError] = React.useState('');
  const [trackingEnabled, setTrackingEnabled] = React.useState(false);
  const [locationAccuracy, setLocationAccuracy] = React.useState(null);
  const watchIdRef = React.useRef(null);

  const updateLocation = React.useCallback(
    (nextLocation, accuracy = null) => {
      const normalizedLocation = normalizeCoordinates(nextLocation);

      if (!normalizedLocation) {
        return;
      }

      setSelectedLocation(normalizedLocation);
      setMapCenter(normalizedLocation);
      setLocationAccuracy(Number.isFinite(Number(accuracy)) ? Number(accuracy) : null);
      onLocationSelect?.(normalizedLocation.latitude, normalizedLocation.longitude, {
        accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
      });
    },
    [onLocationSelect]
  );

  React.useEffect(() => {
    onLocationStateChange?.({
      hasLocation: Boolean(selectedLocation),
      isDetectingLocation,
      error: locationError,
      trackingEnabled,
      accuracy: locationAccuracy,
    });
  }, [isDetectingLocation, locationAccuracy, locationError, onLocationStateChange, selectedLocation, trackingEnabled]);

  const clearTrackingWatch = React.useCallback(() => {
    if (typeof window === 'undefined' || watchIdRef.current === null) {
      return;
    }

    window.navigator?.geolocation?.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  }, []);

  const detectLocation = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.navigator?.geolocation) {
      setMapCenter(DEFAULT_MAP_CENTER);
      setLocationError('Geolocation is not supported in this browser.');
      setIsDetectingLocation(false);
      return;
    }

    if (!hasSecureGeolocationContext()) {
      setMapCenter(DEFAULT_MAP_CENTER);
      setLocationError('Location works only on HTTPS or localhost.');
      setIsDetectingLocation(false);
      return;
    }

    clearTrackingWatch();
    setIsDetectingLocation(true);
    setLocationError('');
    setTrackingEnabled(true);

    watchIdRef.current = window.navigator.geolocation.watchPosition(
      (position) => {
        updateLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }, position.coords.accuracy);
        setIsDetectingLocation(false);
      },
      (error) => {
        setMapCenter(DEFAULT_MAP_CENTER);
        setLocationError(getTrackingErrorMessage(error));
        if (error?.code === 1) {
          setTrackingEnabled(false);
          clearTrackingWatch();
        }
        setIsDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [clearTrackingWatch, updateLocation]);

  React.useEffect(() => {
    return () => {
      clearTrackingWatch();
    };
  }, [clearTrackingWatch]);

  const buttonLabel = isDetectingLocation
    ? 'Detecting...'
    : trackingEnabled
      ? 'Refresh GPS'
      : 'Enable Current Location';

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-200">Current requester location</p>
          <p className="text-xs text-gray-400">
            This map follows your live browser GPS so helpers navigate to your current position.
          </p>
        </div>

        <button
          type="button"
          onClick={detectLocation}
          disabled={isDetectingLocation}
          className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
        <MapContainer
          center={[mapCenter.latitude, mapCenter.longitude]}
          zoom={selectedLocation ? 15 : 5}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewport center={selectedLocation || mapCenter} zoom={selectedLocation ? 15 : 5} />

          {selectedLocation ? (
            <Marker
              icon={selectedLocationIcon}
              position={[selectedLocation.latitude, selectedLocation.longitude]}
            />
          ) : null}
        </MapContainer>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
        {selectedLocation ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>
              Latitude: <strong className="text-white">{formatCoordinate(selectedLocation.latitude)}</strong>
            </span>
            <span>
              Longitude: <strong className="text-white">{formatCoordinate(selectedLocation.longitude)}</strong>
            </span>
            {locationAccuracy !== null ? (
              <span>
                Accuracy: <strong className="text-white">{Math.round(locationAccuracy)} m</strong>
              </span>
            ) : null}
          </div>
        ) : (
          <span>
            Tap "Enable Current Location" to start GPS tracking for this request.
          </span>
        )}
      </div>

      {locationAccuracy !== null && locationAccuracy > 150 ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          GPS accuracy is currently weak. Move outdoors or tap refresh for a better fix before submitting.
        </div>
      ) : null}

      {locationError ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {locationError}
        </div>
      ) : null}
    </div>
  );
};

export default LocationPicker;
