import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer
} from 'recharts';
import {
  Calculator, TrendingUp, Clock, Recycle, Factory, Leaf, Gauge, Scale
} from 'lucide-react';

/* ===== Hilfsfunktionen ===== */
const sumItems = (items) =>
  items.reduce((s, it) => s + (Number(String(it.amount).replace(',', '.')) || 0), 0);

/* ===== Reusable: eigenständiges Input-Feld (lokaler State, Commit bei Blur/Enter) ===== */
const StableInput = memo(function StableInput({ label, name, initialValue, onCommit }) {
  const [val, setVal] = useState(String(initialValue ?? ''));
  const ref = useRef(null);

  // Wenn initialValue sich von außen ändert (z.B. Reset), synchronisieren
  useEffect(() => {
    setVal(String(initialValue ?? ''));
  }, [initialValue]);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <input
        ref={ref}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onCommit(name, val)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onCommit(name, val);
            e.currentTarget.blur();
          }
        }}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
});

/* ===== Feld + Modal für Einzelkosten (mit lokalem Modal-State) ===== */
function ItemizedCostField({
  title, groupKey,
  valueStr, onCommitTotal,           // onCommitTotal(name, rawVal)
  costs, setCosts, formatCurrency,
  onOpenChange
}) {
  const [open, setOpen] = useState(false);
  const [localItems, setLocalItems] = useState([]);
  const [localDirect, setLocalDirect] = useState(String(valueStr ?? ''));

  const g = costs[groupKey] || { total: 0, items: [] };
  const items = g.items || [];
  const usesItems = items.length > 0;
  const effective = usesItems ? sumItems(items) : (Number(String(valueStr).replace(',', '.')) || 0);
  const badge = usesItems ? `Σ ${items.length}` : '—';

  // Wenn der Direktwert sich von außen ändert, spiegeln
  useEffect(() => {
    setLocalDirect(String(valueStr ?? ''));
  }, [valueStr]);

  const openModal = () => {
    setLocalItems(g.items || []);
    setOpen(true);
    onOpenChange?.(true);
  };

  const handleApplyChanges = () => {
    const next = { ...costs };
    next[groupKey] = { ...(next[groupKey] || { total: 0 }), items: localItems };
    setCosts(next);
    setOpen(false);
    onOpenChange?.(false);
  };

  const closeModal = () => {
    setOpen(false);
    onOpenChange?.(false);
  };

  return (
    <div>
      {/* Label-Zeile: Label selbst ist klickbar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={openModal}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
          title="Einzelkosten bearbeiten"
        >
          {title}
        </button>
        <span className="text-[10px] px-2 py-[2px] rounded-full bg-gray-100 text-gray-600">{badge}</span>
      </div>

      {/* Direktwert – lokal gesteuert; deaktiviert, wenn Items existieren */}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={localDirect}
        onChange={(e) => setLocalDirect(e.target.value)}
        onBlur={() => onCommitTotal(groupKey, localDirect)}
        onKeyDown={(e) => { if (e.key === 'Enter') { onCommitTotal(groupKey, localDirect); e.currentTarget.blur(); } }}
        disabled={usesItems}
        className={`w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500
                    ${usesItems ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
      />

      <div className="mt-1 text-[11px] text-gray-500">
        Effektiv: <b>{formatCurrency(effective)}</b>{usesItems ? ' (Summe Einzelkosten)' : ' (Direktwert)'}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" data-modal-root="1">
          <div className="absolute inset-0 bg-black/30" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">{title} – Einzelkosten</h4>
              <button className="text-gray-500 text-sm" onClick={closeModal}>Schließen</button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {localItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    className="col-span-7 px-2 py-1 text-sm border rounded-md"
                    placeholder={`Position ${idx + 1}`}
                    value={it.label || ''}
                    onChange={(e) => {
                      const nextItems = [...localItems];
                      nextItems[idx] = { ...nextItems[idx], label: e.target.value };
                      setLocalItems(nextItems);
                    }}
                  />
                  <input
                    className="col-span-4 px-2 py-1 text-sm border rounded-md"
                    placeholder="Betrag (€)"
                    inputMode="decimal"
                    value={String(it.amount ?? '')}
                    onChange={(e) => {
                      const nextItems = [...localItems];
                      nextItems[idx] = { ...nextItems[idx], amount: e.target.value };
                      setLocalItems(nextItems);
                    }}
                  />
                  <button
                    className="col-span-1 text-xs text-red-600"
                    onClick={() => {
                      setLocalItems(localItems.filter((_, i) => i !== idx));
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                className="mt-1 text-xs px-2 py-1 rounded bg-gray-100"
                onClick={() => {
                  if (localItems.length >= 8) return;
                  setLocalItems([...localItems, { label: '', amount: '' }]);
                }}
                disabled={localItems.length >= 8}
              >
                + Position hinzufügen {localItems.length >= 8 ? '(max. 8)' : ''}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Summe Einzelkosten: <b>{formatCurrency(sumItems(localItems))}</b>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 text-sm rounded border"
                  onClick={() => setLocalItems([])}
                >
                  Einzelkosten löschen
                </button>
                <button
                  className="px-3 py-1 text-sm rounded bg-blue-600 text-white"
                  onClick={handleApplyChanges}
                >
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Hauptkomponente ===== */
export default function TCODashboard() {
  // (Optional) Flag, falls du in Zukunft global auf offene Modals reagieren willst
  const [hasOpenModal, setHasOpenModal] = useState(false);

  // Modell-Parameter (werden NUR bei Commit aktualisiert)
  const [params, setParams] = useState({
    // Neuteil
    herstellkosten: 100000,
    inbetriebnahme: 25000,
    betriebskosten: 8000,
    entsorgungNeu: -2000,
    co2KostenNeu: 1000,
    distanzNeu: 200,

    // REMAN
    remanKosten: 45000,
    entsorgungReman: -2000,
    co2KostenReman: 1000,
    kostensteigerungJeReman: 3.0,
    distanzReman: 200,

    // Zeit & Leistung
    standzeitNeu: 1460,
    leadTimeNeu: 10,
    zinssatzNeu: 4.0,
    hubeProStundeNeu: 80,

    standzeitReman: 730,
    leadTimeReman: 10,
    zinssatzReman: 4.0,
    hubeProStundeReman: 40,

    // Allgemein
    analysehorizont: 10,
    stundenProJahr: 1760,
    qualitaetsYield: 97,
    performanceYield: 95,
    inflation: 2.0,
    co2Steigerung: 4.0
  });

  // Anzeige-Strings (nur als Quelle für initialValue der Inputs)
  const [form, setForm] = useState(() =>
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  );

  // Itemisierte Kosten
  const [costs, setCosts] = useState({
    herstellkosten: { total: Number(params.herstellkosten) || 0, items: [] },
    inbetriebnahme: { total: Number(params.inbetriebnahme) || 0, items: [] },
    betriebskosten: { total: Number(params.betriebskosten) || 0, items: [] },
    remanKosten:    { total: Number(params.remanKosten) || 0,    items: [] },
  });

  // Commit-Funktion: nimmt (key, rawVal) entgegen
  const commitParam = useCallback((key, rawVal) => {
    const raw = String(rawVal ?? form[key] ?? '').trim();
    if (raw === '') return;
    const normalized = raw.replace(',', '.');
    const num = Number(normalized);

    setParams(prev => ({ ...prev, [key]: Number.isFinite(num) ? num : 0 }));
    setForm(prev => ({ ...prev, [key]: raw })); // Anzeige aktualisieren

    // Falls es eine itemisierte Gruppe ist und KEINE Items existieren, total mitziehen
    if (['herstellkosten','inbetriebnahme','betriebskosten','remanKosten'].includes(key)) {
      setCosts(prev => {
        const g = prev[key] || { total: 0, items: [] };
        if (g.items && g.items.length > 0) return prev; // Items haben Vorrang
        return { ...prev, [key]: { ...g, total: Number.isFinite(num) ? num : 0 } };
      });
    }
  }, [form]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

  const formatNumber = (value, decimals = 0) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

  // Effektive Werte aus itemisierten Gruppen
  const effectiveCost = (group) => {
    const g = costs[group];
    if (!g) return Number(params[group]) || 0;
    return (g.items && g.items.length > 0) ? sumItems(g.items) : (Number(g.total) || 0);
  };

  /* ===== Berechnungen ===== */
  const calculations = useMemo(() => {
    const p = {
      ...params,
      herstellkosten:  effectiveCost('herstellkosten'),
      inbetriebnahme:  effectiveCost('inbetriebnahme'),
      betriebskosten:  effectiveCost('betriebskosten'),
      remanKosten:     effectiveCost('remanKosten'),
    };

    const EPS = 1e-6;
    const standzeitNeuJ = p.standzeitNeu / 365;
    const standzeitRemanJ = p.standzeitReman / 365;
    const leadNeuJ = p.leadTimeNeu / 365;
    const leadRemJ = p.leadTimeReman / 365;

    const rNeu = (1 + p.zinssatzNeu / 100) / (1 + p.inflation / 100) - 1;
    const rRem = (1 + p.zinssatzReman / 100) / (1 + p.inflation / 100) - 1;

    const periodeNeu = standzeitNeuJ + leadNeuJ;
    const periodeRem = standzeitRemanJ + leadRemJ;

    const pv = (value, rate, time) => value / Math.pow(1 + rate, time);

    // Transport-CO2 (hin+zurück), 490 g/km => t
    const gPerKm = 490;
    const tCo2Neu = (2 * p.distanzNeu * gPerKm) / 1_000_000;
    const tCo2Rem = (2 * p.distanzReman * gPerKm) / 1_000_000;

    const neukaufTimes = [];
    if (periodeNeu > 0) {
      for (let t = periodeNeu; t <= p.analysehorizont + EPS; t += periodeNeu) neukaufTimes.push(+t.toFixed(10));
    }

    const remanTimes = [];
    if (periodeRem > 0) {
      for (let t = standzeitNeuJ + leadRemJ; t <= p.analysehorizont + EPS; t += periodeRem) remanTimes.push(+t.toFixed(10));
    }

    const firstReman = remanTimes.length > 0 ? remanTimes[0] : 1e30;

    // Timeline
    const TL = [0];
    for (let j = 1; j <= Math.floor(p.analysehorizont); j++) TL.push(j);
    TL.push(p.analysehorizont, ...remanTimes, ...neukaufTimes, standzeitNeuJ);
    remanTimes.forEach(t => TL.push(t + standzeitRemanJ));

    const uniqueTL = [...new Set(TL.sort((a, b) => a - b))];

    let tcoReman = p.herstellkosten + p.inbetriebnahme;
    let tcoNeu = p.herstellkosten + p.inbetriebnahme;
    let outRem = 0, outNeu = 0;

    const H = p.stundenProJahr, q = p.qualitaetsYield / 100, perf = p.performanceYield / 100;

    const data = [];
    for (let i = 0; i < uniqueTL.length; i++) {
      const t1 = uniqueTL[i], t0 = i > 0 ? uniqueTL[i - 1] : 0;

      // OPEX am Jahresende – Diskontsatzwechsel ab erstem REMAN-Event
      if (Math.abs(t1 - Math.round(t1)) <= EPS && t1 >= 1) {
        const discR = (t1 + EPS < firstReman) ? rNeu : rRem;
        tcoReman += pv(p.betriebskosten, discR, t1);
        tcoNeu += pv(p.betriebskosten, rNeu, t1);
      }

      // REMAN-Event
      if (remanTimes.some(rt => Math.abs(rt - t1) <= EPS)) {
        const k = remanTimes.findIndex(rt => Math.abs(rt - t1) <= EPS) + 1;
        const mult = 1 + (k - 1) * (p.kostensteigerungJeReman / 100);
        const co2R = tCo2Rem * (p.co2KostenReman * Math.pow(1 + p.co2Steigerung / 100, t1));
        tcoReman += pv(p.remanKosten * mult + co2R, rRem, t1);
      }

      // Neukauf-Event
      if (neukaufTimes.some(nt => Math.abs(nt - t1) <= EPS)) {
        const co2N = tCo2Neu * (p.co2KostenNeu * Math.pow(1 + p.co2Steigerung / 100, t1));
        tcoNeu += pv(p.entsorgungNeu + p.herstellkosten + p.inbetriebnahme + co2N, rNeu, t1);
      }

      // Output-Zeitfenster
      const idxR = remanTimes.length ? remanTimes.reduce((acc, rt, idx) => (rt <= t0 + EPS ? idx : acc), -1) : -1;
      const prodStartR = idxR === -1 ? 0 : remanTimes[idxR];
      const prodEndR = idxR === -1 ? standzeitNeuJ : remanTimes[idxR] + standzeitRemanJ;
      const rateRem = idxR === -1 ? p.hubeProStundeNeu : p.hubeProStundeReman;

      outRem += Math.max(0, Math.min(t1, prodEndR) - Math.max(t0, prodStartR)) * H * rateRem * q * perf;

      const idxN = neukaufTimes.length ? neukaufTimes.reduce((acc, nt, idx) => (nt <= t0 + EPS ? idx : acc), -1) : -1;
      const prodStartN = idxN === -1 ? 0 : neukaufTimes[idxN];
      const prodEndN = prodStartN + standzeitNeuJ;

      outNeu += Math.max(0, Math.min(t1, prodEndN) - Math.max(t0, prodStartN)) * H * p.hubeProStundeNeu * q * perf;

      data.push({
        time: t1,
        tcoReman,
        tcoNeu,
        costPerOutputReman: outRem > 0 ? (tcoReman / outRem) * 100 : 0,
        costPerOutputNeu:   outNeu  > 0 ? (tcoNeu   / outNeu)  * 100 : 0
      });
    }

    // Entsorgung am Horizont
    tcoReman += pv(p.entsorgungReman, rRem, p.analysehorizont);
    tcoNeu   += pv(p.entsorgungNeu,   rNeu, p.analysehorizont);

    if (data.length) {
      const last = data[data.length - 1];
      last.tcoReman = tcoReman;
      last.tcoNeu = tcoNeu;
      last.costPerOutputReman = outRem > 0 ? (tcoReman / outRem) * 100 : 0;
      last.costPerOutputNeu   = outNeu  > 0 ? (tcoNeu   / outNeu)  * 100 : 0;
    }

    const finalPoint = data[data.length - 1] || {};
    const finalTcoReman = finalPoint.tcoReman || 0;
    const finalTcoNeu   = finalPoint.tcoNeu   || 0;
    const savings = finalTcoNeu - finalTcoReman;
    const savingsPercent = finalTcoNeu > 0 ? (savings / finalTcoNeu) * 100 : 0;

    const kphReman = finalPoint.costPerOutputReman || 0;
    const kphNeu   = finalPoint.costPerOutputNeu   || 0;
    const kphDelta = kphReman - kphNeu;
    const kphDeltaPct = kphNeu !== 0 ? (kphDelta / kphNeu) * 100 : 0;

    return {
      tcoData: data,
      finalTcoReman,
      finalTcoNeu,
      savings,
      savingsPercent,
      kphReman, kphNeu, kphDelta, kphDeltaPct,
      leadTimeComparison: { neu: p.leadTimeNeu, reman: p.leadTimeReman, delta: p.leadTimeReman - p.leadTimeNeu },
      co2Comparison: { neu: p.co2KostenNeu, reman: p.co2KostenReman, delta: p.co2KostenReman - p.co2KostenNeu },
      recyclingComparison: { neu: p.entsorgungNeu, reman: p.entsorgungReman, delta: p.entsorgungReman - p.entsorgungNeu },
      neuteilVsReman: {
        neu:  p.herstellkosten + p.inbetriebnahme + p.betriebskosten + p.entsorgungNeu + p.co2KostenNeu,
        reman:p.remanKosten + p.entsorgungReman + p.co2KostenReman,
        delta:(p.remanKosten + p.entsorgungReman + p.co2KostenReman) - (p.herstellkosten + p.inbetriebnahme + p.betriebskosten + p.entsorgungNeu + p.co2KostenNeu)
      }
    };
  }, [params, costs]);

  // Kurzhelfer zum Rendern normaler Felder
  const F = (name, label) => (
    <StableInput
      key={name}
      name={name}
      label={label}
      initialValue={form[name]}
      onCommit={commitParam}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Calculator className="h-8 w-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">
                  TCO-Dashboard: REMAN vs. Neuteil
                </h1>
              </div>
              <p className="text-sm text-gray-600">
                Δ zeigt jeweils den Unterschied REMAN − Neuteil.
              </p>
            </div>
            <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain opacity-90" />
          </div>
        </div>

        {/* Eingaben */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Section icon={Factory} title="Parameter Neuteil">
            <ItemizedCostField
              title="Herstellkosten (€)"
              groupKey="herstellkosten"
              valueStr={form.herstellkosten}
              onCommitTotal={commitParam}
              costs={costs} setCosts={setCosts} formatCurrency={formatCurrency}
              onOpenChange={(o) => setHasOpenModal(o)}
            />
            <ItemizedCostField
              title="Inbetriebnahmekosten (€)"
              groupKey="inbetriebnahme"
              valueStr={form.inbetriebnahme}
              onCommitTotal={commitParam}
              costs={costs} setCosts={setCosts} formatCurrency={formatCurrency}
              onOpenChange={(o) => setHasOpenModal(o)}
            />
            {F('entsorgungNeu', 'Verschrottungserlöse/-Kosten (€)')}
            {F('co2KostenNeu', 'CO₂-Kosten (€/t)')}
            {F('standzeitNeu', 'Standzeit Neuteil (Tage)')}
            {F('leadTimeNeu', 'Wiederbeschaffungszeit (Tage)')}
            {F('zinssatzNeu', 'Diskontzins Neuteil (%)')}
            {F('hubeProStundeNeu', 'Lastzyklen je Stunde (Hübe/h)')}
            {F('distanzNeu', 'Distanz (km)')}
          </Section>

          <Section icon={Recycle} title="Parameter REMAN">
            <ItemizedCostField
              title="Kosten je Aufbereitung (€)"
              groupKey="remanKosten"
              valueStr={form.remanKosten}
              onCommitTotal={commitParam}
              costs={costs} setCosts={setCosts} formatCurrency={formatCurrency}
              onOpenChange={(o) => setHasOpenModal(o)}
            />
            {F('entsorgungReman', 'Verschrottungserlöse/-Kosten (€)')}
            {F('co2KostenReman', 'CO₂-Kosten (€/t)')}
            {F('standzeitReman', 'Standzeit REMAN (Tage)')}
            {F('leadTimeReman', 'Wiederbeschaffungszeit (Tage)')}
            {F('zinssatzReman', 'Diskontzins REMAN (%)')}
            {F('hubeProStundeReman', 'Lastzyklen je Stunde (Hübe/h)')}
            {F('kostensteigerungJeReman', 'Kostensteigerung je REMAN (%)')}
            {F('distanzReman', 'Distanz (km)')}
          </Section>

          <Section icon={Gauge} title="Allgemein">
            <ItemizedCostField
              title="OPEX/Jahr (auch REMAN) (€)"
              groupKey="betriebskosten"
              valueStr={form.betriebskosten}
              onCommitTotal={commitParam}
              costs={costs} setCosts={setCosts} formatCurrency={formatCurrency}
              onOpenChange={(o) => setHasOpenModal(o)}
            />
            {F('analysehorizont', 'Analysehorizont (Jahre)')}
            {F('stundenProJahr', 'Betriebsstunden je Jahr')}
            {F('qualitaetsYield', 'Qualitäts-Yield (%)')}
            {F('performanceYield', 'Performance-Yield (OEE) (%)')}
            {F('inflation', 'Inflation (%)')}
            {F('co2Steigerung', 'CO₂-Kostensteigerung (%/Jahr)')}
          </Section>
        </div>

        {/* KPI-Kacheln (TCO) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">TCO REMAN</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(calculations.finalTcoReman)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">TCO Neuteil</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(calculations.finalTcoNeu)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">Einsparung</p>
            <p className={`text-xl font-bold ${calculations.savings > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(calculations.savings)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">Einsparung %</p>
            <p className={`text-xl font-bold ${calculations.savings > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(calculations.savingsPercent, 1)}%
            </p>
          </div>
        </div>

        {/* KPI-Kacheln (Kosten je Hub) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">Kosten/Hub REMAN</p>
            <p className="text-xl font-bold text-green-600">{formatNumber(calculations.kphReman, 2)} Cent</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">Kosten/Hub Neuteil</p>
            <p className="text-xl font-bold text-blue-600">{formatNumber(calculations.kphNeu, 2)} Cent</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">Δ Kosten/Hub</p>
            <p className={`text-xl font-bold ${calculations.kphDelta <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(calculations.kphDelta, 2)} Cent
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-xs font-medium text-gray-600">Δ Kosten/Hub %</p>
            <p className={`text-xl font-bold ${calculations.kphDeltaPct <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(calculations.kphDeltaPct, 1)}%
            </p>
          </div>
        </div>

        {/* Verlauf-Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">TCO-Verlauf über Zeit</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={calculations.tcoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000) + ' k'} />
                <Tooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : v)} />
                <Legend />
                <Line type="stepAfter" dataKey="tcoReman" stroke="#10b981" strokeWidth={2} name="Mit REMAN" dot={false} />
                <Line type="stepAfter" dataKey="tcoNeu" stroke="#3b82f6" strokeWidth={2} name="Ohne REMAN" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-4 w-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Kosten je Hub (Cent)</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={calculations.tcoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(v) => (typeof v === 'number' ? `${formatNumber(v, 2)} Cent` : v)} />
                <Legend />
                <Line type="stepAfter" dataKey="costPerOutputReman" stroke="#10b981" strokeWidth={2} name="Mit REMAN" dot={false} />
                <Line type="stepAfter" dataKey="costPerOutputNeu" stroke="#3b82f6" strokeWidth={2} name="Ohne REMAN" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mini-Bar-Charts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Leaf className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                CO₂-Kosten <span className="text-gray-500 font-normal">Δ {formatNumber(calculations.co2Comparison.delta, 0)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[{ name: 'Neuteil', value: calculations.co2Comparison.neu }, { name: 'REMAN', value: calculations.co2Comparison.reman }]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => [`${formatNumber(Number(v), 0)} €/t`, 'CO₂-Kosten']} />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Lead Time (Tage) <span className="text-gray-500 font-normal">Δ {formatNumber(calculations.leadTimeComparison.delta, 0)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[{ name: 'Neuteil', value: calculations.leadTimeComparison.neu }, { name: 'REMAN', value: calculations.leadTimeComparison.reman }]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => [`${formatNumber(Number(v), 0)} Tage`, 'Lead Time']} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Recycle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Entsorgung <span className="text-gray-500 font-normal">Δ {formatCurrency(calculations.recyclingComparison.delta)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[{ name: 'Neuteil', value: calculations.recyclingComparison.neu }, { name: 'REMAN', value: calculations.recyclingComparison.reman }]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000) + ' k'} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Entsorgung']} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="h-4 w-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Gesamtkosten (statisch) <span className="text-gray-500 font-normal">Δ {formatCurrency(calculations.neuteilVsReman.delta)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[{ name: 'Neuteil', value: calculations.neuteilVsReman.neu }, { name: 'REMAN', value: calculations.neuteilVsReman.reman }]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000) + ' k'} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Summe']} />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Kleine Section-Hilfskomponente */
function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
