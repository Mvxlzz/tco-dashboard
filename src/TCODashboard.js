import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer
} from 'recharts';
import {
  Calculator, TrendingUp, Clock, Recycle, Factory, Leaf, Gauge, Scale
} from 'lucide-react';

export default function TCODashboard() {
  const [params, setParams] = useState({
    // Neuteil
    herstellkosten: 50000,
    inbetriebnahme: 15000,
    betriebskosten: 8000,            // gilt für beide Szenarien p.a.
    entsorgungNeu: 2000,
    co2KostenNeu: 500,               // €/t
    distanzNeu: 500,                 // km

    // REMAN
    remanKosten: 25000,
    entsorgungReman: 1000,
    co2KostenReman: 200,             // €/t
    kostensteigerungJeReman: 3.0,    // PRO REMAN-Zyklus (%)
    distanzReman: 150,               // km

    // Zeit & Leistung
    standzeitNeu: 1460,              // Tage
    leadTimeNeu: 90,                 // Tage
    zinssatzNeu: 5.0,                // %
    hubeProStundeNeu: 120,

    standzeitReman: 1095,            // Tage
    leadTimeReman: 45,               // Tage
    zinssatzReman: 4.5,              // %
    hubeProStundeReman: 115,

    // Allgemein
    analysehorizont: 10,             // Jahre
    stundenProJahr: 3000,
    qualitaetsYield: 95,             // %
    performanceYield: 98,            // %
    inflation: 2.5,                  // %
    co2Steigerung: 4.0               // % p.a.
  });

  const updateParam = (key, value) => {
    const num = parseFloat(value);
    setParams(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

  const formatNumber = (value, decimals = 0) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

  const calculations = useMemo(() => {
    const p = params;
    const EPS = 1e-6;

    // Zeit in Jahren
    const standzeitNeuJ = p.standzeitNeu / 365;
    const standzeitRemanJ = p.standzeitReman / 365;
    const leadNeuJ = p.leadTimeNeu / 365;
    const leadRemJ = p.leadTimeReman / 365;

    // Realzinsen (Inflation raus)
    const rNeu = (1 + p.zinssatzNeu / 100) / (1 + p.inflation / 100) - 1;
    const rRem = (1 + p.zinssatzReman / 100) / (1 + p.inflation / 100) - 1;

    const periodeNeu = standzeitNeuJ + leadNeuJ;
    const periodeRem = standzeitRemanJ + leadRemJ;

    const pv = (value, rate, time) => {
      if (Math.abs(time) < EPS || Math.abs(rate) < EPS) return value;
      return value / Math.pow(1 + rate, time);
    };

    // CO2-Transport (hin+zurück), 490 g/km => t
    const gPerKm = 490;
    const tCo2Neu = (2 * p.distanzNeu * gPerKm) / 1_000_000;
    const tCo2Rem = (2 * p.distanzReman * gPerKm) / 1_000_000;

    // Events (Neukauf / Reman)
    const neukaufTimes = [];
    if (periodeNeu > 0) {
      for (let t = periodeNeu; t <= p.analysehorizont + EPS; t += periodeNeu) neukaufTimes.push(+t.toFixed(10));
    }

    const remanTimes = [];
    if (periodeRem > 0) {
      for (let t = standzeitNeuJ + leadRemJ; t <= p.analysehorizont + EPS; t += periodeRem) remanTimes.push(+t.toFixed(10));
    }

    const firstReman = remanTimes.length > 0 ? remanTimes[0] : 1e30;

    // Timeline: 0, Jahresenden, (fractionales Endjahr), Events, Produktions-Endpunkte
    const TL = [0];
    for (let j = 1; j <= Math.floor(p.analysehorizont); j++) TL.push(j);
    if (Math.abs(p.analysehorizont - Math.floor(p.analysehorizont)) > EPS) TL.push(p.analysehorizont);
    TL.push(...remanTimes, ...neukaufTimes);

    // Produktions-Endpunkte wie in VBA (für Output-Genauigkeit)
    TL.push(standzeitNeuJ);
    remanTimes.forEach(t => TL.push(t + standzeitRemanJ));

    // sort & unique (mit EPS)
    TL.sort((a, b) => a - b);
    const uniqueTL = [];
    for (let i = 0; i < TL.length; i++) {
      if (i === 0 || Math.abs(TL[i] - TL[i - 1]) > EPS) uniqueTL.push(TL[i]);
    }

    let tcoReman = p.herstellkosten + p.inbetriebnahme; // Startinvest
    let tcoNeu = p.herstellkosten + p.inbetriebnahme;
    let outRem = 0, outNeu = 0;

    const H = p.stundenProJahr;
    const q = p.qualitaetsYield / 100;
    const perf = p.performanceYield / 100;

    const data = [];

    for (let i = 0; i < uniqueTL.length; i++) {
      const t1 = uniqueTL[i];
      const t0 = i > 0 ? uniqueTL[i - 1] : 0;

      // OPEX am Jahresende (wie VBA)
      if (Math.abs(t1 - Math.round(t1)) <= EPS && t1 >= 1 - EPS && t1 <= p.analysehorizont + EPS) {
        const discR = t1 < firstReman - EPS ? rNeu : rRem;
        tcoReman += pv(p.betriebskosten, discR, t1);
        tcoNeu += pv(p.betriebskosten, rNeu, t1);
      }

      // REMAN-Event: lineare Eskalation je Zyklus (NICHT pro Jahr!)
      if (remanTimes.some(rt => Math.abs(rt - t1) <= EPS)) {
        const k = remanTimes.findIndex(rt => Math.abs(rt - t1) <= EPS) + 1;
        const mult = 1 + (k - 1) * (p.kostensteigerungJeReman / 100);
        const co2R = tCo2Rem * (p.co2KostenReman * Math.pow(1 + p.co2Steigerung / 100, t1));
        tcoReman += pv(p.remanKosten * mult + co2R, rRem, t1);
      }

      // Neukauf-Event (Neuteil ersetzt Neuteil)
      if (neukaufTimes.some(nt => Math.abs(nt - t1) <= EPS)) {
        const co2N = tCo2Neu * (p.co2KostenNeu * Math.pow(1 + p.co2Steigerung / 100, t1));
        tcoNeu += pv(p.entsorgungNeu, rNeu, t1);
        tcoNeu += pv(p.herstellkosten + p.inbetriebnahme + co2N, rNeu, t1);
      }

      // Output-Fenster (produktiv ja, Lead nein)
      // REMAN-Szenario: vor erstem REMAN = Neuteil-Rate, danach REMAN-Rate
      let idxR = -1;
      for (let j = 0; j < remanTimes.length; j++) if (remanTimes[j] <= t0 + EPS) idxR = j;

      let prodStartR, prodEndR, rateRem;
      if (idxR === -1) {
        prodStartR = 0; prodEndR = standzeitNeuJ; rateRem = p.hubeProStundeNeu;
      } else {
        prodStartR = remanTimes[idxR]; prodEndR = remanTimes[idxR] + standzeitRemanJ; rateRem = p.hubeProStundeReman;
      }

      const effProdRem = Math.max(0, Math.min(t1, prodEndR) - Math.max(t0, prodStartR));
      outRem += effProdRem * H * rateRem * q * perf;

      // NEU-Szenario
      let idxN = -1;
      for (let j = 0; j < neukaufTimes.length; j++) if (neukaufTimes[j] <= t0 + EPS) idxN = j;

      let prodStartN, prodEndN;
      if (idxN === -1) { prodStartN = 0; prodEndN = standzeitNeuJ; }
      else { prodStartN = neukaufTimes[idxN]; prodEndN = neukaufTimes[idxN] + standzeitNeuJ; }

      const effProdNeu = Math.max(0, Math.min(t1, prodEndN) - Math.max(t0, prodStartN));
      outNeu += effProdNeu * H * p.hubeProStundeNeu * q * perf;

      data.push({
        time: t1,
        tcoReman,
        tcoNeu,
        costPerOutputReman: outRem > 0 ? (tcoReman / outRem) * 100 : 0, // Cent
        costPerOutputNeu: outNeu > 0 ? (tcoNeu / outNeu) * 100 : 0
      });
    }

    // Entsorgung am Horizontende
    if (data.length) {
      const last = data[data.length - 1];
      if (Math.abs(last.time - p.analysehorizont) <= EPS) {
        last.tcoReman += pv(p.entsorgungReman, rRem, p.analysehorizont);
        last.tcoNeu += pv(p.entsorgungNeu, rNeu, p.analysehorizont);
      }
    }

    const finalPoint = data[data.length - 1] || {};
    const finalTcoReman = finalPoint.tcoReman || 0;
    const finalTcoNeu = finalPoint.tcoNeu || 0;
    const savings = finalTcoNeu - finalTcoReman;
    const savingsPercent = finalTcoNeu > 0 ? (savings / finalTcoNeu) * 100 : 0;

    // Mini-Charts: Werte + Deltas
    const co2NeuNow = p.co2KostenNeu;
    const co2RemNow = p.co2KostenReman;
    const co2Delta = co2RemNow - co2NeuNow;

    const leadDelta = p.leadTimeReman - p.leadTimeNeu;
    const entsorgDelta = p.entsorgungReman - p.entsorgungNeu;

    // "Gesamtkosten" (statisch, nicht diskontiert) – nur zur schnellen Übersicht
    const totalNeuStatic = p.herstellkosten + p.inbetriebnahme + p.betriebskosten + p.entsorgungNeu + p.co2KostenNeu;
    const totalRemStatic = p.remanKosten + p.entsorgungReman + p.co2KostenReman;
    const totalDelta = totalRemStatic - totalNeuStatic;

    return {
      tcoData: data,
      finalTcoReman,
      finalTcoNeu,
      savings,
      savingsPercent,
      // Mini-Kacheln
      leadTimeComparison: { neu: p.leadTimeNeu, reman: p.leadTimeReman, delta: leadDelta },
      co2Comparison: { neu: co2NeuNow, reman: co2RemNow, delta: co2Delta },
      recyclingComparison: { neu: p.entsorgungNeu, reman: p.entsorgungReman, delta: entsorgDelta },
      neuteilVsReman: { neu: totalNeuStatic, reman: totalRemStatic, delta: totalDelta }
    };
  }, [params]);

  const InputField = ({ label, value, onChange, step = 1 }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={onChange}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );

  const Section = ({ icon: Icon, title, children }) => (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <Calculator className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              TCO-Analyse: REMAN vs. Neuteil
            </h1>
          </div>
          <p className="text-sm text-gray-600">
            Δ zeigt jeweils den Unterschied REMAN − Neuteil.
          </p>
        </div>

        {/* Eingaben – neu gruppiert */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Section icon={Factory} title="Parameter Neuteil">
            <InputField label="Herstellkosten (€)" value={params.herstellkosten} onChange={(e) => updateParam('herstellkosten', e.target.value)} />
            <InputField label="Inbetriebnahmekosten (€)" value={params.inbetriebnahme} onChange={(e) => updateParam('inbetriebnahme', e.target.value)} />
            <InputField label="Betriebskosten/Jahr (auch REMAN) (€)" value={params.betriebskosten} onChange={(e) => updateParam('betriebskosten', e.target.value)} />
            <InputField label="Verschrottungserlöse/-Kosten (€)" value={params.entsorgungNeu} onChange={(e) => updateParam('entsorgungNeu', e.target.value)} />
            <InputField label="CO₂-Kosten (€/t)" value={params.co2KostenNeu} onChange={(e) => updateParam('co2KostenNeu', e.target.value)} />
            <InputField label="Standzeit Neuteil (Tage)" value={params.standzeitNeu} onChange={(e) => updateParam('standzeitNeu', e.target.value)} />
            <InputField label="Wiederbeschaffungszeit (Tage)" value={params.leadTimeNeu} onChange={(e) => updateParam('leadTimeNeu', e.target.value)} />
            <InputField label="Diskontzins Neuteil (%)" value={params.zinssatzNeu} step={0.1} onChange={(e) => updateParam('zinssatzNeu', e.target.value)} />
            <InputField label="Lastzyklen je Stunde (Hübe/h)" value={params.hubeProStundeNeu} onChange={(e) => updateParam('hubeProStundeNeu', e.target.value)} />
            <InputField label="Distanz (km)" value={params.distanzNeu} onChange={(e) => updateParam('distanzNeu', e.target.value)} />
          </Section>

          <Section icon={Recycle} title="Parameter REMAN">
            <InputField label="Kosten je Aufbereitung (€)" value={params.remanKosten} onChange={(e) => updateParam('remanKosten', e.target.value)} />
            <InputField label="Verschrottungserlöse/-Kosten (€)" value={params.entsorgungReman} onChange={(e) => updateParam('entsorgungReman', e.target.value)} />
            <InputField label="CO₂-Kosten (€/t)" value={params.co2KostenReman} onChange={(e) => updateParam('co2KostenReman', e.target.value)} />
            <InputField label="Standzeit REMAN (Tage)" value={params.standzeitReman} onChange={(e) => updateParam('standzeitReman', e.target.value)} />
            <InputField label="Wiederbeschaffungszeit (Tage)" value={params.leadTimeReman} onChange={(e) => updateParam('leadTimeReman', e.target.value)} />
            <InputField label="Diskontzins REMAN (%)" value={params.zinssatzReman} step={0.1} onChange={(e) => updateParam('zinssatzReman', e.target.value)} />
            <InputField label="Lastzyklen je Stunde (Hübe/h)" value={params.hubeProStundeReman} onChange={(e) => updateParam('hubeProStundeReman', e.target.value)} />
            <InputField label="Kostensteigerung je REMAN (%)" value={params.kostensteigerungJeReman} step={0.1} onChange={(e) => updateParam('kostensteigerungJeReman', e.target.value)} />
            <InputField label="Distanz (km)" value={params.distanzReman} onChange={(e) => updateParam('distanzReman', e.target.value)} />
          </Section>

          <Section icon={Gauge} title="Allgemein">
            <InputField label="Analysehorizont (Jahre)" value={params.analysehorizont} onChange={(e) => updateParam('analysehorizont', e.target.value)} />
            <InputField label="Betriebsstunden je Jahr" value={params.stundenProJahr} onChange={(e) => updateParam('stundenProJahr', e.target.value)} />
            <InputField label="Qualitäts-Yield (%)" value={params.qualitaetsYield} step={0.1} onChange={(e) => updateParam('qualitaetsYield', e.target.value)} />
            <InputField label="Performance-Yield (OEE) (%)" value={params.performanceYield} step={0.1} onChange={(e) => updateParam('performanceYield', e.target.value)} />
            <InputField label="Inflation (%)" value={params.inflation} step={0.1} onChange={(e) => updateParam('inflation', e.target.value)} />
            <InputField label="CO₂-Kostensteigerung (%/Jahr)" value={params.co2Steigerung} step={0.1} onChange={(e) => updateParam('co2Steigerung', e.target.value)} />
          </Section>
        </div>

        {/* KPI-Kacheln */}
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

        {/* Verlauf-Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                TCO-Verlauf über Zeit
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={calculations.tcoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(v) => formatNumber(v / 1000) + ' k'} />
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
              <h3 className="text-lg font-semibold text-gray-900">
                Kosten je Hub (Cent)
              </h3>
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

        {/* Mini-Bar-Charts mit Tooltips und Δ im Titel */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Leaf className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                CO₂-Kosten <span className="text-gray-500">Δ {formatNumber(calculations.co2Comparison.delta, 0)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.co2Comparison.neu },
                { name: 'REMAN', value: calculations.co2Comparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => [`${formatNumber(v, 0)} €/t`, 'CO₂-Kosten']} />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Lead Time (Tage) <span className="text-gray-500">Δ {formatNumber(calculations.leadTimeComparison.delta, 0)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.leadTimeComparison.neu },
                { name: 'REMAN', value: calculations.leadTimeComparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => [`${formatNumber(v, 0)} Tage`, 'Lead Time']} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Recycle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Entsorgung <span className="text-gray-500">Δ {formatCurrency(calculations.recyclingComparison.delta)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.recyclingComparison.neu },
                { name: 'REMAN', value: calculations.recyclingComparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => formatNumber(v / 1000) + ' k'} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'Entsorgung']} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="h-4 w-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Gesamtkosten (statisch) <span className="text-gray-500">Δ {formatCurrency(calculations.neuteilVsReman.delta)}</span>
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.neuteilVsReman.neu },
                { name: 'REMAN', value: calculations.neuteilVsReman.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => formatNumber(v / 1000) + ' k'} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'Summe']} />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
