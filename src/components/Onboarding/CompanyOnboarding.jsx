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
    // Mehrpersonal-Planung
    minHoursForMultiEmployee: 16,
    minHoursPerEmployee: 6,
    maxEfficiencyLossPercent: 10,
    allowParallelRoomWork: true,
    // Überstunden & Task-Aufteilung
    maxOvertimePercent: 15,
    minTaskSplitTime: 60,
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
        // Mehrpersonal-Planung
        minHoursForMultiEmployee: settings.minHoursForMultiEmployee || 16,
        minHoursPerEmployee: settings.minHoursPerEmployee || 6,
        maxEfficiencyLossPercent: settings.maxEfficiencyLossPercent || 10,
        allowParallelRoomWork: settings.allowParallelRoomWork ?? true,
        // Überstunden & Task-Aufteilung
        maxOvertimePercent: settings.maxOvertimePercent ?? 15,
        minTaskSplitTime: settings.minTaskSplitTime ?? 60,
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (parseFloat(value) || 0),
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
      // Mehrpersonal-Planung
      minHoursForMultiEmployee: formData.minHoursForMultiEmployee,
      minHoursPerEmployee: formData.minHoursPerEmployee,
      maxEfficiencyLossPercent: formData.maxEfficiencyLossPercent,
      allowParallelRoomWork: formData.allowParallelRoomWork,
      // Überstunden & Task-Aufteilung
      maxOvertimePercent: formData.maxOvertimePercent,
      minTaskSplitTime: formData.minTaskSplitTime,
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

        {/* Mehrpersonal-Planung */}
        <div className="form-group" style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", color: "#333" }}>👥 Mehrpersonal-Planung</h3>
          <p style={{ color: "#666", fontSize: "13px", marginBottom: "15px" }}>
            Definieren Sie, ab wann der Einsatz mehrerer Mitarbeiter in Betracht gezogen wird.
          </p>
          
          <div style={{ display: "grid", gap: "20px" }}>
            {/* Ab wieviel Stunden Mehrpersonal */}
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Mehrpersonal-Schwelle (ab dieser Gesamtarbeitszeit):
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="number"
                  name="minHoursForMultiEmployee"
                  value={formData.minHoursForMultiEmployee}
                  onChange={handleChange}
                  min="8"
                  max="80"
                  style={{ width: "80px" }}
                />
                <span>Stunden</span>
              </div>
              <small style={{ color: "#888" }}>
                Erst ab dieser Stundenzahl wird Mehrpersonal in Betracht gezogen (z.B. 16h = 2 Arbeitstage)
              </small>
            </div>
            
            {/* Minimum Stunden pro Mitarbeiter */}
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Minimum pro Mitarbeiter:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="number"
                  name="minHoursPerEmployee"
                  value={formData.minHoursPerEmployee}
                  onChange={handleChange}
                  min="2"
                  max="8"
                  step="0.5"
                  style={{ width: "80px" }}
                />
                <span>Stunden pro Person</span>
              </div>
              <small style={{ color: "#888" }}>
                Jeder Mitarbeiter sollte mindestens diese Stunden Arbeit haben (vermeidet Leerlauf)
              </small>
            </div>
            
            {/* Max Effizienzverlust */}
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Max. akzeptabler Effizienzverlust:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="number"
                  name="maxEfficiencyLossPercent"
                  value={formData.maxEfficiencyLossPercent}
                  onChange={handleChange}
                  min="0"
                  max="30"
                  style={{ width: "80px" }}
                />
                <span>%</span>
              </div>
              <small style={{ color: "#888" }}>
                Bei diesem Effizienzverlust durch Aufteilung wird auf Mehrpersonal verzichtet
              </small>
            </div>
            
            {/* Parallelarbeit erlauben */}
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="allowParallelRoomWork"
                  checked={formData.allowParallelRoomWork}
                  onChange={handleChange}
                  style={{ width: "18px", height: "18px" }}
                />
                <span>Parallelarbeit in verschiedenen Räumen erlauben</span>
              </label>
              <small style={{ color: "#888", display: "block", marginLeft: "28px" }}>
                Wenn aktiv, können mehrere Mitarbeiter gleichzeitig in verschiedenen Räumen arbeiten (erfordert Kundenfreigabe)
              </small>
            </div>
          </div>
        </div>

        {/* Überstunden & Task-Aufteilung */}
        <div className="form-group" style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", color: "#333" }}>⏰ Überstunden & Task-Aufteilung</h3>
          <p style={{ color: "#666", fontSize: "13px", marginBottom: "15px" }}>
            Definieren Sie, wie mit Überstunden und der Aufteilung von Arbeiten auf mehrere Tage umgegangen werden soll.
          </p>
          
          <div style={{ display: "grid", gap: "20px" }}>
            {/* Max. Überstunden */}
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Maximale Überstunden-Toleranz:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="number"
                  name="maxOvertimePercent"
                  value={formData.maxOvertimePercent}
                  onChange={handleChange}
                  min="0"
                  max="50"
                  style={{ width: "80px" }}
                />
                <span>%</span>
              </div>
              <small style={{ color: "#888" }}>
                Bei 8h Arbeitstag und 15%: Max. 9:12h erlaubt. Kleine Rest-Arbeiten werden lieber heute abgeschlossen.
              </small>
            </div>
            
            {/* Mindest-Restzeit für Aufteilung */}
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>
                Mindestzeit für Task-Aufteilung:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="number"
                  name="minTaskSplitTime"
                  value={formData.minTaskSplitTime}
                  onChange={handleChange}
                  min="15"
                  max="180"
                  step="15"
                  style={{ width: "80px" }}
                />
                <span>Minuten</span>
              </div>
              <small style={{ color: "#888" }}>
                Wenn der Rest einer Arbeit unter diesem Wert liegt, werden lieber Überstunden gemacht als einen neuen Tag anzufangen.
              </small>
            </div>
            
            {/* Erklärung */}
            <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "6px", fontSize: "13px", color: "#555" }}>
              <strong>Beispiel:</strong> Bei 7:53h Arbeit und 7 Minuten Rest-Task → Statt Tag 2 mit nur 7 Minuten wird Tag 1 auf 8:00h verlängert.
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
