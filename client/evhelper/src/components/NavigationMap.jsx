import React from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import {
  DEFAULT_MAP_CENTER,
  formatDistance,
  formatDuration,
  getBrowserLocation,
  getLatLngTuple,
  navigatorLocationIcon,
  normalizeCoordinates,
  requesterLocationIcon,
} from '../utils/mapUtils.js';

const MapViewport = ({ navigatorLocation, requestLocation }) => {
  const map = useMap();

  React.useEffect(() => {
    const points = [navigatorLocation, requestLocation]
      .map((point) => getLatLngTuple(point))
      .filter(Boolean)
      .map(([latitude, longitude]) => L.latLng(latitude, longitude));

    if (points.length === 0) {
      map.setView([DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude], 5, {
        animate: true,
      });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14, {
        animate: true,
      });
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [40, 40],
      animate: true,
    });
  }, [map, navigatorLocation, requestLocation]);

  return null;
};

const MapInteractionHandler = ({ onSelectNavigatorLocation }) => {
  useMapEvents({
    click(event) {
      onSelectNavigatorLocation({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
};

const RoutingMachine = ({ navigatorLocation, requestLocation, onRouteSummaryChange, onRouteError }) => {
  const map = useMap();

  React.useEffect(() => {
    let routingControl;
    let disposed = false;

    const addRouting = async () => {
      if (!navigatorLocation || !requestLocation) {
        onRouteSummaryChange(null);
        return;
      }

      try {
        await import('leaflet-routing-machine');

        if (disposed) {
          return;
        }

        routingControl = L.Routing.control({
          waypoints: [
            L.latLng(navigatorLocation.latitude, navigatorLocation.longitude),
            L.latLng(requestLocation.latitude, requestLocation.longitude),
          ],
          router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
          }),
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          routeWhileDragging: false,
          show: false,
          lineOptions: {
            styles: [
              {
                color: '#22c55e',
                opacity: 0.85,
                weight: 5,
              },
            ],
          },
          createMarker: () => null,
        }).addTo(map);

        routingControl.on('routesfound', (event) => {
          const route = event.routes?.[0];

          if (!route?.summary) {
            onRouteSummaryChange(null);
            return;
          }

          onRouteSummaryChange({
            distance: route.summary.totalDistance,
            duration: route.summary.totalTime,
          });
          onRouteError('');
        });

        routingControl.on('routingerror', () => {
          onRouteSummaryChange(null);
          onRouteError('Unable to calculate a route right now. You can still use the map markers.');
        });
      } catch (error) {
        onRouteSummaryChange(null);
        onRouteError('Navigation routing could not be loaded in this browser.');
      }
    };

    addRouting();

    return () => {
      disposed = true;
      if (routingControl) {
        map.removeControl(routingControl);
      }
    };
  }, [map, navigatorLocation, onRouteError, onRouteSummaryChange, requestLocation]);

  return null;
};

const NavigationMap = ({ requestLocation, userLocation }) => {
  const destinationLocation = React.useMemo(
    () => normalizeCoordinates(requestLocation),
    [requestLocation]
  );
  const initialUserLocation = React.useMemo(
    () => normalizeCoordinates(userLocation),
    [userLocation]
  );
  const [navigatorLocation, setNavigatorLocation] = React.useState(initialUserLocation);
  const [isLocating, setIsLocating] = React.useState(false);
  const [locationError, setLocationError] = React.useState('');
  const [routeSummary, setRouteSummary] = React.useState(null);
  const [routeError, setRouteError] = React.useState('');

  React.useEffect(() => {
    setNavigatorLocation(initialUserLocation);
  }, [destinationLocation, initialUserLocation]);

  const handleNavigatorLocationChange = React.useCallback((nextLocation) => {
    const normalizedLocation = normalizeCoordinates(nextLocation);

    if (!normalizedLocation) {
      return;
    }

    setNavigatorLocation(normalizedLocation);
    setLocationError('');
  }, []);

  const detectNavigatorLocation = React.useCallback(async () => {
    setIsLocating(true);
    setLocationError('');

    try {
      const currentLocation = await getBrowserLocation();
      setNavigatorLocation(normalizeCoordinates(currentLocation));
    } catch (error) {
      setLocationError(
        error?.message === 'Location works only on HTTPS or localhost.'
          ? error.message
          : error?.code === 1
            ? 'Location access was denied. Tap the map to place your location manually.'
            : 'Unable to detect your current location. Tap the map to place it manually.'
      );
    } finally {
      setIsLocating(false);
    }
  }, []);

  if (!destinationLocation) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-300">
        Navigation is unavailable because this request does not include map coordinates.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Destination</p>
          <p className="mt-1 text-sm font-medium text-white">Charging Request Location</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Distance</p>
          <p className="mt-1 text-sm font-medium text-white">
            {routeSummary ? formatDistance(routeSummary.distance) : isLocating ? 'Locating...' : '--'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Estimated Time</p>
          <p className="mt-1 text-sm font-medium text-white">
            {routeSummary ? formatDuration(routeSummary.duration) : isLocating ? 'Locating...' : '--'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <p className="text-sm text-gray-300">
          Use your current location or tap the map to place your own starting point.
        </p>
        <button
          type="button"
          onClick={detectNavigatorLocation}
          disabled={isLocating}
          className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating ? 'Locating...' : 'Use My Current Location'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
        <MapContainer
          center={[destinationLocation.latitude, destinationLocation.longitude]}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewport navigatorLocation={navigatorLocation} requestLocation={destinationLocation} />
          <MapInteractionHandler onSelectNavigatorLocation={handleNavigatorLocationChange} />
          <RoutingMachine
            navigatorLocation={navigatorLocation}
            requestLocation={destinationLocation}
            onRouteSummaryChange={setRouteSummary}
            onRouteError={setRouteError}
          />

          <Marker
            icon={requesterLocationIcon}
            position={[destinationLocation.latitude, destinationLocation.longitude]}
          >
            <Popup>Charging Request Location</Popup>
          </Marker>

          {navigatorLocation ? (
            <Marker
              draggable
              icon={navigatorLocationIcon}
              position={[navigatorLocation.latitude, navigatorLocation.longitude]}
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target;
                  const markerPosition = marker.getLatLng();
                  handleNavigatorLocationChange({
                    latitude: markerPosition.lat,
                    longitude: markerPosition.lng,
                  });
                },
              }}
            >
              <Popup>Your Location</Popup>
            </Marker>
          ) : null}
        </MapContainer>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
        {navigatorLocation
          ? 'You can drag the green marker or tap the map to refine your starting point.'
          : 'Tap "Use My Current Location" or place your starting point manually on the map.'}
      </div>

      {locationError ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {locationError}
        </div>
      ) : null}

      {routeError ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {routeError}
        </div>
      ) : null}
    </div>
  );
};

export default NavigationMap;
