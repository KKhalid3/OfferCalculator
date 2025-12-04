import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  saveCompanySettings,
  fetchCompanySettings,
} from "../../store/slices/companySettingsSlice";

export default function CompanyOnboarding({ onComplete }) {
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.companySettings.settings);
  const loading = useSelector((state) => state.companySettings.loading);

  const [formData, setFormData] = useState({
    laborRate: 65,
    dailyHours: 8.25,
    dailyHoursFriday: 7,
    weeklyHours: 40,
    minTimeAloneHours: 1,
    minTimeAloneMinutes: 30,
    siteSetupHours: 1,
    siteSetupMinutes: 0,
    siteClearanceHours: 1,
    siteClearanceMinutes: 0,
  });

  useEffect(() => {
    dispatch(fetchCompanySettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings) {
      const minTimeAlone = settings.minTimeAlone || 90;
      const siteSetup = settings.siteSetup || 60;
      const siteClearance = settings.siteClearance || 60;

      setFormData({
        laborRate: settings.laborRate || 65,
        dailyHours: settings.dailyHours || 8.25,
        dailyHoursFriday: settings.dailyHoursFriday || 7,
        weeklyHours: settings.weeklyHours || 40,
        minTimeAloneHours: Math.floor(minTimeAlone / 60),
        minTimeAloneMinutes: minTimeAlone % 60,
        siteSetupHours: Math.floor(siteSetup / 60),
        siteSetupMinutes: siteSetup % 60,
        siteClearanceHours: Math.floor(siteClearance / 60),
        siteClearanceMinutes: siteClearance % 60,
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const settingsToSave = {
      id: "company_settings",
      laborRate: formData.laborRate,
      dailyHours: formData.dailyHours,
      dailyHoursFriday: formData.dailyHoursFriday,
      weeklyHours: formData.weeklyHours,
      minTimeAlone:
        formData.minTimeAloneHours * 60 + formData.minTimeAloneMinutes,
      siteSetup: formData.siteSetupHours * 60 + formData.siteSetupMinutes,
      siteClearance:
        formData.siteClearanceHours * 60 + formData.siteClearanceMinutes,
      onboardingCompleted: true,
    };

    await dispatch(saveCompanySettings(settingsToSave));

    if (onComplete) {
      onComplete();
    }
  };

  if (loading) {
    return <div className="loading">Lade Einstellungen...</div>;
  }

  return (
    <div className="card onboarding-card">
      <h2>🏢 Unternehmens-Einstellungen</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Diese Einstellungen gelten für alle Kalkulationen Ihres Unternehmens.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Stundenlohn */}
        <div className="form-group">
          <label>Stundenlohn (netto, all-inclusive):</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="number"
              name="laborRate"
              value={formData.laborRate}
              onChange={handleChange}
              step="0.01"
              min="0"
              style={{ width: "100px" }}
            />
            <span>€/h</span>
          </div>
          <small style={{ color: "#888" }}>
            Inkl. Lohnnebenkosten, Gemeinkosten und Gewinn
          </small>
        </div>

        {/* Arbeitszeiten */}
        <div className="form-group" style={{ marginTop: "20px" }}>
          <label>Arbeitszeiten:</label>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <span>Mo-Do:</span>
              <input
                type="number"
                name="dailyHours"
                value={formData.dailyHours}
                onChange={handleChange}
                step="0.25"
                min="0"
                max="12"
                style={{ width: "80px", marginLeft: "10px" }}
              />
              <span style={{ marginLeft: "5px" }}>h/Tag</span>
            </div>
            <div>
              <span>Freitag:</span>
              <input
                type="number"
                name="dailyHoursFriday"
                value={formData.dailyHoursFriday}
                onChange={handleChange}
                step="0.25"
                min="0"
                max="12"
                style={{ width: "80px", marginLeft: "10px" }}
              />
              <span style={{ marginLeft: "5px" }}>h</span>
            </div>
          </div>
        </div>

        {/* Mindestzeit */}
        <div className="form-group" style={{ marginTop: "20px" }}>
          <label>Mindestzeit pro Tag (bei kleinen Leistungen):</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="number"
              name="minTimeAloneHours"
              value={formData.minTimeAloneHours}
              onChange={handleChange}
              min="0"
              max="8"
              style={{ width: "60px" }}
            />
            <span>h</span>
            <input
              type="number"
              name="minTimeAloneMinutes"
              value={formData.minTimeAloneMinutes}
              onChange={handleChange}
              min="0"
              max="59"
              step="15"
              style={{ width: "60px" }}
            />
            <span>min</span>
          </div>
          <small style={{ color: "#888" }}>
            Wird angewendet, wenn kalkulierte Zeit unter diesem Wert liegt
          </small>
        </div>

        {/* Baustellenpauschale */}
        <div className="form-group" style={{ marginTop: "20px" }}>
          <label>Baustellenpauschale (einmalig je Projekt):</label>
          <div
            style={{
              display: "flex",
              gap: "30px",
              flexWrap: "wrap",
              marginTop: "10px",
            }}
          >
            <div>
              <span>Einrichtung:</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  marginTop: "5px",
                }}
              >
                <input
                  type="number"
                  name="siteSetupHours"
                  value={formData.siteSetupHours}
                  onChange={handleChange}
                  min="0"
                  max="8"
                  style={{ width: "60px" }}
                />
                <span>h</span>
                <input
                  type="number"
                  name="siteSetupMinutes"
                  value={formData.siteSetupMinutes}
                  onChange={handleChange}
                  min="0"
                  max="59"
                  step="15"
                  style={{ width: "60px" }}
                />
                <span>min</span>
              </div>
            </div>
            <div>
              <span>Räumung:</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  marginTop: "5px",
                }}
              >
                <input
                  type="number"
                  name="siteClearanceHours"
                  value={formData.siteClearanceHours}
                  onChange={handleChange}
                  min="0"
                  max="8"
                  style={{ width: "60px" }}
                />
                <span>h</span>
                <input
                  type="number"
                  name="siteClearanceMinutes"
                  value={formData.siteClearanceMinutes}
                  onChange={handleChange}
                  min="0"
                  max="59"
                  step="15"
                  style={{ width: "60px" }}
                />
                <span>min</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "30px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button type="submit" style={{ padding: "12px 24px" }}>
            💾 Einstellungen speichern
          </button>
        </div>
      </form>
    </div>
  );
}
