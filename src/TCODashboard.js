import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { Calculator, TrendingUp, Clock, Recycle, Factory, Leaf } from 'lucide-react';

export default function TCODashboard() {
  const [params, setParams] = useState({
    herstellkosten: 50000,
    inbetriebnahme: 15000,
    betriebskosten: 8000,
    entsorgungNeu: 2000,
    co2KostenNeu: 500,
    remanKosten: 25000,
    entsorgungReman: 1000,
    co2KostenReman: 200,
    analysehorizont: 10,
    stundenProJahr: 3000,
    qualitaetsYield: 95,
    performanceYield: 98,
    inflation: 2.5,
    standzeitNeu: 1460,
    leadTimeNeu: 90,
    zinssatzNeu: 5.0,
    hubeProStundeNeu: 120,
    standzeitReman: 1095,
    leadTimeReman: 45,
    remanSteigerung: 3.0,
    zinssatzReman: 4.5,
    hubeProStundeReman: 115,
    distanzNeu: 500,
    distanzReman: 150,
    co2Steigerung: 4.0
  });

  const calculations = useMemo(() => {
    const p = params;
    const EPS = 0.000001;
    
    const standzeitNeuJahre = p.standzeitNeu / 365;
    const standzeitRemanJahre = p.standzeitReman / 365;
    const leadTimeNeuJahre = p.leadTimeNeu / 365;
    const leadTimeRemanJahre = p.leadTimeReman / 365;
    
    const realZinsNeu = (1 + p.zinssatzNeu / 100) / (1 + p.inflation / 100) - 1;
    const realZinsReman = (1 + p.zinssatzReman / 100) / (1 + p.inflation / 100) - 1;
    
    const periodeNeu = standzeitNeuJahre + leadTimeNeuJahre;
    const periodeReman = standzeitRemanJahre + leadTimeRemanJahre;

    const pv = (value, rate, time) => {
      if (time === 0 || rate === 0) return value;
      return value / Math.pow(1 + rate, time);
    };

    const gPerKm = 490;
    const tCo2Neu = 2 * p.distanzNeu * gPerKm / 1000000;
    const tCo2Reman = 2 * p.distanzReman * gPerKm / 1000000;

    const neukaufTimes = [];
    const remanTimes = [];

    if (periodeNeu > 0) {
      let t = periodeNeu;
      while (t <= p.analysehorizont + EPS) {
        neukaufTimes.push(t);
        t += periodeNeu;
      }
    }

    if (periodeReman > 0) {
      let t = standzeitNeuJahre + leadTimeRemanJahre;
      while (t <= p.analysehorizont + EPS) {
        remanTimes.push(t);
        t += periodeReman;
      }
    }

    const firstReman = remanTimes.length > 0 ? remanTimes[0] : 1e30;
    
    const timeline = [0];
    for (let j = 1; j <= Math.floor(p.analysehorizont); j++) {
      timeline.push(j);
    }
    if (Math.abs(p.analysehorizont - Math.floor(p.analysehorizont)) > EPS) {
      timeline.push(p.analysehorizont);
    }
    timeline.push(...remanTimes, ...neukaufTimes);
    timeline.sort((a, b) => a - b);
    
    const uniqueTimeline = [];
    for (let i = 0; i < timeline.length; i++) {
      if (i === 0 || Math.abs(timeline[i] - timeline[i-1]) > EPS) {
        uniqueTimeline.push(timeline[i]);
      }
    }

    const tcoData = [];
    let tcoReman = p.herstellkosten + p.inbetriebnahme;
    let tcoNeu = p.herstellkosten + p.inbetriebnahme;
    let outputReman = 0;
    let outputNeu = 0;

    for (let i = 0; i < uniqueTimeline.length; i++) {
      const currentTime = uniqueTimeline[i];
      const prevTime = i > 0 ? uniqueTimeline[i-1] : 0;

      if (Math.abs(currentTime - Math.round(currentTime)) <= EPS && 
          currentTime >= 1 - EPS && 
          currentTime <= p.analysehorizont + EPS) {
        const discountRate = currentTime < firstReman - EPS ? realZinsNeu : realZinsReman;
        tcoReman += pv(p.betriebskosten, discountRate, currentTime);
        tcoNeu += pv(p.betriebskosten, realZinsNeu, currentTime);
      }

      const isRemanEvent = remanTimes.some(rt => Math.abs(rt - currentTime) <= EPS);
      if (isRemanEvent) {
        const k = remanTimes.findIndex(rt => Math.abs(rt - currentTime) <= EPS) + 1;
        const multiplier = 1 + (k - 1) * (p.remanSteigerung / 100);
        const co2Cost = tCo2Reman * (p.co2KostenReman * Math.pow(1 + p.co2Steigerung / 100, currentTime));
        tcoReman += pv(p.remanKosten * multiplier + co2Cost, realZinsReman, currentTime);
      }

      const isNeukaufEvent = neukaufTimes.some(nt => Math.abs(nt - currentTime) <= EPS);
      if (isNeukaufEvent) {
        const co2Cost = tCo2Neu * (p.co2KostenNeu * Math.pow(1 + p.co2Steigerung / 100, currentTime));
        tcoNeu += pv(p.entsorgungNeu, realZinsNeu, currentTime);
        tcoNeu += pv(p.herstellkosten + p.inbetriebnahme + co2Cost, realZinsNeu, currentTime);
      }

      let idxR = -1;
      for (let j = 0; j < remanTimes.length; j++) {
        if (remanTimes[j] <= prevTime + EPS) idxR = j;
      }

      let rateRem;
      if (idxR === -1) {
        rateRem = p.hubeProStundeNeu;
      } else {
        rateRem = p.hubeProStundeReman;
      }

      const effProdRem = Math.max(0, Math.min(currentTime, idxR === -1 ? standzeitNeuJahre : remanTimes[idxR] + standzeitRemanJahre) - 
                                   Math.max(prevTime, idxR === -1 ? 0 : remanTimes[idxR]));
      outputReman += effProdRem * p.stundenProJahr * rateRem * (p.qualitaetsYield / 100) * (p.performanceYield / 100);

      let idxN = -1;
      for (let j = 0; j < neukaufTimes.length; j++) {
        if (neukaufTimes[j] <= prevTime + EPS) idxN = j;
      }

      const effProdNeu = Math.max(0, Math.min(currentTime, idxN === -1 ? standzeitNeuJahre : neukaufTimes[idxN] + standzeitNeuJahre) - 
                                  Math.max(prevTime, idxN === -1 ? 0 : neukaufTimes[idxN]));
      outputNeu += effProdNeu * p.stundenProJahr * p.hubeProStundeNeu * (p.qualitaetsYield / 100) * (p.performanceYield / 100);

      tcoData.push({
        time: currentTime,
        tcoReman: tcoReman,
        tcoNeu: tcoNeu,
        costPerOutputReman: outputReman > 0 ? (tcoReman / outputReman) * 100 : 0,
        costPerOutputNeu: outputNeu > 0 ? (tcoNeu / outputNeu) * 100 : 0
      });
    }

    if (uniqueTimeline.length > 0) {
      const lastIndex = tcoData.length - 1;
      if (lastIndex >= 0 && Math.abs(tcoData[lastIndex].time - p.analysehorizont) <= EPS) {
        tcoData[lastIndex].tcoReman += pv(p.entsorgungReman, realZinsReman, p.analysehorizont);
        tcoData[lastIndex].tcoNeu += pv(p.entsorgungNeu, realZinsNeu, p.analysehorizont);
      }
    }

    const finalData = tcoData[tcoData.length - 1] || {};
    const savings = (finalData.tcoNeu || 0) - (finalData.tcoReman || 0);

    return {
      tcoData,
      finalTcoReman: finalData.tcoReman || 0,
      finalTcoNeu: finalData.tcoNeu || 0,
      savings,
      savingsPercent: finalData.tcoNeu > 0 ? (savings / finalData.tcoNeu) * 100 : 0,
      leadTimeComparison: { neu: p.leadTimeNeu, reman: p.leadTimeReman },
      co2Comparison: { neu: p.co2KostenNeu, reman: p.co2KostenReman },
      recyclingComparison: { neu: p.entsorgungNeu, reman: p.entsorgungReman },
      neuteilVsReman: {
        neu: p.herstellkosten + p.inbetriebnahme + p.betriebskosten + p.entsorgungNeu + p.co2KostenNeu,
        reman: p.remanKosten + p.entsorgungReman + p.co2KostenReman
      }
    };
  }, [params]);

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const formatCurrency = (value) => 
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(value);

  const formatNumber = (value, decimals = 0) => 
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Calculator className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">TCO-Analyse: REMAN vs. Neuteil</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Kosten Neuteil</h3>
            <div className="space-y-2">
              <InputField label="Herstellkosten (€)" value={params.herstellkosten} onChange={(e) => updateParam('herstellkosten', e.target.value)} />
              <InputField label="Inbetriebnahme (€)" value={params.inbetriebnahme} onChange={(e) => updateParam('inbetriebnahme', e.target.value)} />
              <InputField label="Betriebskosten/Jahr (€)" value={params.betriebskosten} onChange={(e) => updateParam('betriebskosten', e.target.value)} />
              <InputField label="Entsorgung (€)" value={params.entsorgungNeu} onChange={(e) => updateParam('entsorgungNeu', e.target.value)} />
              <InputField label="CO2-Kosten (€/t)" value={params.co2KostenNeu} onChange={(e) => updateParam('co2KostenNeu', e.target.value)} />
              <InputField label="Distanz (km)" value={params.distanzNeu} onChange={(e) => updateParam('distanzNeu', e.target.value)} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Kosten REMAN</h3>
            <div className="space-y-2">
              <InputField label="REMAN-Kosten (€)" value={params.remanKosten} onChange={(e) => updateParam('remanKosten', e.target.value)} />
              <InputField label="Entsorgung (€)" value={params.entsorgungReman} onChange={(e) => updateParam('entsorgungReman', e.target.value)} />
              <InputField label="CO2-Kosten (€/t)" value={params.co2KostenReman} onChange={(e) => updateParam('co2KostenReman', e.target.value)} />
              <InputField label="Distanz (km)" value={params.distanzReman} onChange={(e) => updateParam('distanzReman', e.target.value)} />
              <InputField label="Kostensteigerung (%/Jahr)" value={params.remanSteigerung} onChange={(e) => updateParam('remanSteigerung', e.target.value)} step="0.1" />
              <InputField label="Zinssatz REMAN (%)" value={params.zinssatzReman} onChange={(e) => updateParam('zinssatzReman', e.target.value)} step="0.1" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Zeit & Leistung</h3>
            <div className="space-y-2">
              <InputField label="Standzeit Neu (Tage)" value={params.standzeitNeu} onChange={(e) => updateParam('standzeitNeu', e.target.value)} />
              <InputField label="Lead Time Neu (Tage)" value={params.leadTimeNeu} onChange={(e) => updateParam('leadTimeNeu', e.target.value)} />
              <InputField label="Zinssatz Neu (%)" value={params.zinssatzNeu} onChange={(e) => updateParam('zinssatzNeu', e.target.value)} step="0.1" />
              <InputField label="Hübe/Stunde Neu" value={params.hubeProStundeNeu} onChange={(e) => updateParam('hubeProStundeNeu', e.target.value)} />
              <InputField label="Standzeit REMAN (Tage)" value={params.standzeitReman} onChange={(e) => updateParam('standzeitReman', e.target.value)} />
              <InputField label="Lead Time REMAN (Tage)" value={params.leadTimeReman} onChange={(e) => updateParam('leadTimeReman', e.target.value)} />
              <InputField label="Hübe/Stunde REMAN" value={params.hubeProStundeReman} onChange={(e) => updateParam('hubeProStundeReman', e.target.value)} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Allgemein</h3>
            <div className="space-y-2">
              <InputField label="Analysehorizont (Jahre)" value={params.analysehorizont} onChange={(e) => updateParam('analysehorizont', e.target.value)} />
              <InputField label="Stunden/Jahr" value={params.stundenProJahr} onChange={(e) => updateParam('stundenProJahr', e.target.value)} />
              <InputField label="Qualitäts-Yield (%)" value={params.qualitaetsYield} onChange={(e) => updateParam('qualitaetsYield', e.target.value)} step="0.1" />
              <InputField label="Performance-Yield (%)" value={params.performanceYield} onChange={(e) => updateParam('performanceYield', e.target.value)} step="0.1" />
              <InputField label="Inflation (%)" value={params.inflation} onChange={(e) => updateParam('inflation', e.target.value)} step="0.1" />
              <InputField label="CO2-Steigerung (%/Jahr)" value={params.co2Steigerung} onChange={(e) => updateParam('co2Steigerung', e.target.value)} step="0.1" />
            </div>
          </div>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">TCO-Verlauf über Zeit</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={calculations.tcoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis tickFormatter={(v) => formatNumber(v/1000) + 'k'} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Line type="stepAfter" dataKey="tcoReman" stroke="#10b981" strokeWidth={2} name="Mit REMAN" dot={false} />
                <Line type="stepAfter" dataKey="tcoNeu" stroke="#3b82f6" strokeWidth={2} name="Ohne REMAN" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kosten je Hub (Cent)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={calculations.tcoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(v) => formatNumber(v, 2) + ' Cent'} />
                <Legend />
                <Line type="stepAfter" dataKey="costPerOutputReman" stroke="#10b981" strokeWidth={2} name="Mit REMAN" dot={false} />
                <Line type="stepAfter" dataKey="costPerOutputNeu" stroke="#3b82f6" strokeWidth={2} name="Ohne REMAN" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">CO2-Kosten</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.co2Comparison.neu },
                { name: 'REMAN', value: calculations.co2Comparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Lead Time (Tage)</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.leadTimeComparison.neu },
                { name: 'REMAN', value: calculations.leadTimeComparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Entsorgung</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.recyclingComparison.neu },
                { name: 'REMAN', value: calculations.recyclingComparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Gesamtkosten</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.neuteilVsReman.neu },
                { name: 'REMAN', value: calculations.neuteilVsReman.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => formatNumber(v/1000) + 'k'} />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
