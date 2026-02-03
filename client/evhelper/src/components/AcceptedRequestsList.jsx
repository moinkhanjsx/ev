import React from 'react';
import { useAuth } from '../context/AuthContext';

const AcceptedRequestsList = ({ requests, onCompleteRequest, onOpenChat }) => {
  const { state } = useAuth();
  const getStatusClass = (status) => {
    switch (status) {
      case 'ACCEPTED': return 'ev-status-accepted';
      default: return 'ev-status-completed';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ACCEPTED': return '🤝';
      default: return '✅';
    }
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
      {requests.map((request) => (
        <div key={request._id} className="ev-formal-card ev-formal-compact p-4 sm:p-6 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl sm:text-3xl">{getStatusIcon(request.status)}</div>
              <div className="flex flex-col gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(request.status)}`}>
                  {request.status}
                </span>
                <span className="px-2 py-1 text-xs font-semibold bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded">
                  ACCEPTED
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">📍 Location</h4>
                  <p className="text-gray-400">{request.location}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">👤 Requester</h4>
                  <p className="text-gray-400">{request.requesterId?.name}</p>
                  <p className="text-gray-400 text-sm">{request.requesterId?.email}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">🏙️ Requester City</h4>
                  <p className="text-gray-400">{request.requesterId?.city}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">📞 Contact</h4>
                  <p className="text-gray-400">{request.phoneNumber}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">💬 Message</h4>
                  <p className="text-gray-400 break-words">{request.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                <span>🕒 Accepted: {new Date(request.acceptedAt).toLocaleString()}</span>
                {request.estimatedTime && (
                  <span>⏱️ ~{request.estimatedTime} min</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 mt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                {request.tokenCost} tokens • Status: {request.status}
              </div>
              <button
                type="button"
                onClick={() => onOpenChat?.(request)}
                className="ev-formal-button w-full sm:w-auto text-sm sm:text-base"
              >
                Open Chat
              </button>
              
              {/* Action button for completing the request - only for original requester */}
              {request.status === 'ACCEPTED' && onCompleteRequest && 
               request.requesterId?._id === state.user?._id && (
                <button
                  onClick={() => onCompleteRequest(request._id)}
                  className="ev-formal-button w-full sm:w-auto text-sm sm:text-base"
                >
                  Mark as Completed
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AcceptedRequestsList;
