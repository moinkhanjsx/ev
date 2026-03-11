import React, { Suspense, lazy } from 'react';

const NavigationMap = lazy(() => import('./NavigationMap.jsx'));

const formatTokenValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }

  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? `${numericValue}` : numericValue.toFixed(2);
};

const AcceptedRequestsList = ({ requests, onSubmitSettlement, submittingSettlementId, onOpenChat }) => {
  const [sharedUnitsByRequest, setSharedUnitsByRequest] = React.useState({});
  const [navigationRequestId, setNavigationRequestId] = React.useState(null);

  React.useEffect(() => {
    setSharedUnitsByRequest((previous) => {
      const next = { ...previous };

      for (const request of requests || []) {
        if (next[request._id] === undefined) {
          next[request._id] = request.settlement?.sharedUnits ?? '';
        }
      }

      return next;
    });
  }, [requests]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'ACCEPTED': return 'ev-status-accepted';
      case 'EXPIRED': return 'ev-status-expired';
      default: return 'ev-status-completed';
    }
  };

  const handleSubmit = (requestId) => {
    if (!onSubmitSettlement) {
      return;
    }

    onSubmitSettlement(requestId, {
      sharedUnits: sharedUnitsByRequest[requestId],
    });
  };

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <p className="text-lg text-gray-400">No accepted requests</p>
        <p className="text-sm text-gray-500 mt-2">Your accepted requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const settlement = request.settlement || {};
        const sharedUnitsValue = sharedUnitsByRequest[request._id] ?? '';
        const settlementSubmitted = settlement.status === 'PROPOSED';
        const buttonLabel = settlementSubmitted ? 'Update Shared Amount' : 'Submit Shared Amount';
        const isSubmitting = submittingSettlementId === request._id;
        const hasNavigation =
          Number.isFinite(Number(request.locationCoordinates?.latitude)) &&
          Number.isFinite(Number(request.locationCoordinates?.longitude));
        const isNavigationOpen = navigationRequestId === request._id;

        return (
          <div key={request._id} className="ev-formal-card ev-formal-compact p-4 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl sm:text-3xl">🤝</div>
                  <div className="flex flex-col gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(request.status)}`}>
                      {request.status}
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded">
                      ACTIVE HELPER
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-1">Location</h4>
                      <p className="text-gray-400">{request.location}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-1">Requester</h4>
                      <p className="text-gray-400">{request.requesterId?.name}</p>
                      <p className="text-gray-400 text-sm">{request.requesterId?.email}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-1">Requester City</h4>
                      <p className="text-gray-400">{request.requesterId?.city}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-1">Contact</h4>
                      <p className="text-gray-400">{request.phoneNumber}</p>
                    </div>
                  </div>

                  {request.message && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-1">Message</h4>
                      <p className="text-gray-400 break-words">{request.message}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                    <span>Accepted: {new Date(request.acceptedAt).toLocaleString()}</span>
                    {request.estimatedTime ? <span>Estimated: ~{request.estimatedTime} min</span> : null}
                    <span>Deposit already held: {formatTokenValue(request.tokenCost)} tokens</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-200 mb-2" htmlFor={`shared-units-${request._id}`}>
                      Charging shared
                    </label>
                    <input
                      id={`shared-units-${request._id}`}
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={sharedUnitsValue}
                      onChange={(event) =>
                        setSharedUnitsByRequest((previous) => ({
                          ...previous,
                          [request._id]: event.target.value,
                        }))
                      }
                      className="ev-input ev-formal-input w-full"
                      placeholder="Enter shared units"
                    />
                    <p className="text-xs text-gray-500 mt-2">1 shared charging unit = 1 token.</p>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end">
                    <button
                      type="button"
                      onClick={() => handleSubmit(request._id)}
                      disabled={isSubmitting}
                      className="ev-formal-button w-full md:w-auto"
                    >
                      {isSubmitting ? 'Saving...' : buttonLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChat?.(request)}
                      className="ev-formal-button w-full md:w-auto"
                    >
                      Open Chat
                    </button>
                    {hasNavigation ? (
                      <button
                        type="button"
                        onClick={() =>
                          setNavigationRequestId((currentValue) =>
                            currentValue === request._id ? null : request._id
                          )
                        }
                        className="ev-formal-button w-full md:w-auto"
                      >
                        {isNavigationOpen ? 'Hide Navigation' : 'View Navigation'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {settlementSubmitted ? (
                  <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    You proposed <strong>{formatTokenValue(settlement.sharedUnits)}</strong> charging units for{' '}
                    <strong>{formatTokenValue(settlement.tokenAmount)}</strong> tokens. Waiting for the requester to agree.
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
                    Submit the exact amount you shared. The requester will review it and confirm the token transfer.
                  </div>
                )}

                {isNavigationOpen ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-white">Navigation</h4>
                      <p className="text-xs text-gray-400">
                        Live route to the requester using OpenStreetMap and OSRM.
                      </p>
                    </div>

                    <div className="h-[420px]">
                      <Suspense
                        fallback={
                          <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-slate-950/30 text-sm text-gray-400">
                            Loading navigation...
                          </div>
                        }
                      >
                        <NavigationMap requestLocation={request.locationCoordinates} />
                      </Suspense>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AcceptedRequestsList;
