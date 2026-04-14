import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getApiErrorMessage } from "../utils/auth.js";

const BlynkDevicePanel = () => {
  const { state } = useAuth();
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDashboardUrl = async () => {
      try {
        const response = await api.get("/blynk/device");
        if (!active) {
          return;
        }

        setDashboardUrl(response.data?.dashboardUrl || "");
        setError("");
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(getApiErrorMessage(requestError, "Blynk dashboard is not available right now."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (state.isAuthenticated) {
      void loadDashboardUrl();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [state.isAuthenticated]);

  if (!state.isAuthenticated) {
    return null;
  }

  return (
    <div className="ev-formal-card ev-card-spacing">
      <div className="ev-section">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="ev-formal-title">View Status</h2>
            <p className="ev-formal-subtitle">
              Open the original Blynk dashboard in a new tab for the live hardware view.
            </p>
          </div>

          {dashboardUrl ? (
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="ev-formal-button w-full lg:w-auto text-sm sm:text-base"
            >
              Open
            </a>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-gray-300">
            <div className="ev-loading"></div>
            <span>Loading dashboard link...</span>
          </div>
        ) : null}

        {!loading && !dashboardUrl && error ? (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BlynkDevicePanel;
