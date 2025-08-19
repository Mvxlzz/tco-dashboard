import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { Calculator, TrendingUp, Clock, Recycle, Factory, Leaf } from 'lucide-react';

const TCODashboard = () => {
  const [params, setParams] = useState({
    herstellkosten: 50000,
    inbetriebnahme: 15000,
    betriebskosten: 8000,
    entsorgungNeu: 2000,
    remanKosten: 25000,
    entsorgungReman: 1000,
    co2KostenNeu: 500,
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
    const {
      herstellkosten, inbetriebnahme, betriebskosten, entsorgungNeu,
      remanKosten, entsorgungReman, co2KostenNeu, co2KostenReman,
      analysehorizont, stundenProJahr, qualitaetsYield, performanceYield,
      inflation, standzeitNeu, leadTimeNeu, zinssatzNeu, hubeProStundeNeu,
      standzeitReman, leadTimeReman, remanSteigerung, zinssatzReman,
      hubeProStundeReman, distanzNeu, distanzReman, co2Steigerung
    } = params;

    const standzeitNeuJahre = standzeitNeu / 365;
    const standzeitRemanJahre = standzeitReman / 365;
    const leadTimeNeuJahre = leadTimeNeu / 365;
    const leadTimeRemanJahre = leadTimeReman / 365;

    const realZinsNeu = (1 + zinssatzNeu / 100) / (1 + inflation / 100) - 1;
    const realZinsReman = (1 + zinssatzReman / 100) / (1 + inflation / 100) - 1;

    const periodeNeu = standzeitNeuJahre + leadTimeNeuJahre;
    const periodeReman = standzeitRemanJahre + leadTimeRemanJahre;

    const pv = (value, rate, time) => {
      if (time === 0 || rate === 0) return value;
      return value / Math.pow(1 + rate, time);
    };

    const neukaufTimes = [];
    const remanTimes = [];

    let t = periodeNeu;
    while (t <= analysehorizont + 0.000001) {
      neukaufTimes.push(t);
      t += periodeNeu;
    }

    t = standzeitNeuJahre + leadTimeRemanJahre;
    while (t <= analysehorizont + 0.000001) {
      remanTimes.push(t);
      t += periodeReman;
    }

    const firstReman = remanTimes.length > 0 ? remanTimes[0] : 1e30;

    const timeline = [0];
    for (let j = 1; j <= Math.floor(analysehorizont); j++) {
      timeline.push(j);
    }
    if (Math.abs(analysehorizont - Math.floor(analysehorizont)) > 0.001) {
      timeline.push(analysehorizont);
    }
    timeline.push(...remanTimes, ...neukaufTimes);
    timeline.sort((a, b) => a - b);

    const uniqueTimeline = [];
    for (let i = 0; i < timeline.length; i++) {
      if (i === 0 || Math.abs(timeline[i] - timeline[i-1]) > 0.000001) {
        uniqueTimeline.push(timeline[i]);
      }
    }

    const tcoData = [];
    let tcoReman = herstellkosten + inbetriebnahme;
    let tcoNeu = herstellkosten + inbetriebnahme;
    let outputReman = 0;
    let outputNeu = 0;

    for (let i = 0; i < uniqueTimeline.length; i++) {
      const currentTime = uniqueTimeline[i];
      const prevTime = i > 0 ? uniqueTimeline[i-1] : 0;
      const dt = currentTime - prevTime;

      if (Math.abs(currentTime - Math.round(currentTime)) <= 0.001 && currentTime >= 1 - 0.001) {
        const discountRate = currentTime < firstReman - 0.001 ? realZinsNeu : realZinsReman;
        tcoReman += pv(betriebskosten, discountRate, currentTime);
        tcoNeu += pv(betriebskosten, realZinsNeu, currentTime);
      }

      const isRemanEvent = remanTimes.some(rt => Math.abs(rt - currentTime) <= 0.001);
      if (isRemanEvent) {
        const k = remanTimes.findIndex(rt => Math.abs(rt - currentTime) <= 0.001) + 1;
        const multiplier = 1 + (k - 1) * (remanSteigerung / 100);
        const co2Cost = (2 * distanzReman * 490 / 1000000) * 
                       (co2KostenReman * Math.pow(1 + co2Steigerung / 100, currentTime));
        tcoReman += pv(remanKosten * multiplier + co2Cost, realZinsReman, currentTime);
      }

      const isNeukaufEvent = neukaufTimes.some(nt => Math.abs(nt - currentTime) <= 0.001);
      if (isNeukaufEvent) {
        const co2Cost = (2 * distanzNeu * 490 / 1000000) * 
                       (co2KostenNeu * Math.pow(1 + co2Steigerung / 100, currentTime));
        tcoNeu += pv(entsorgungNeu, realZinsNeu, currentTime);
        tcoNeu += pv(herstellkosten + inbetriebnahme + co2Cost, realZinsNeu, currentTime);
      }

      const hoursPerYear = stundenProJahr;
      const qualityFactor = qualitaetsYield / 100;
      const performanceFactor = performanceYield / 100;

      let remanRate = hubeProStundeNeu;
      if (remanTimes.length > 0 && currentTime >= remanTimes[0]) {
        remanRate = hubeProStundeReman;
      }
      outputReman += dt * hoursPerYear * remanRate * qualityFactor * performanceFactor;
      outputNeu += dt * hoursPerYear * hubeProStundeNeu * qualityFactor * performanceFactor;

      tcoData.push({
        time: parseFloat(currentTime.toFixed(3)),
        tcoReman: Math.round(tcoReman),
        tcoNeu: Math.round(tcoNeu),
        outputReman: Math.round(outputReman),
        outputNeu: Math.round(outputNeu),
        costPerOutputReman: outputReman > 0 ? parseFloat(((tcoReman / outputReman) * 100).toFixed(4)) : 0,
        costPerOutputNeu: outputNeu > 0 ? parseFloat(((tcoNeu / outputNeu) * 100).toFixed(4)) : 0,
        isRemanEvent,
        isNeukaufEvent
      });
    }

    if (uniqueTimeline.length > 0) {
      const endTime = analysehorizont;
      const lastIndex = tcoData.length - 1;
      if (lastIndex >= 0 && Math.abs(tcoData[lastIndex].time - endTime) <= 0.001) {
        tcoData[lastIndex].tcoReman += pv(entsorgungReman, realZinsReman, endTime);
        tcoData[lastIndex].tcoNeu += pv(entsorgungNeu, realZinsNeu, endTime);
      }
    }

    const finalData = tcoData[tcoData.length - 1] || {};
    const savings = (finalData.tcoNeu || 0) - (finalData.tcoReman || 0);

    return {
      tcoData,
      finalTcoReman: finalData.tcoReman || 0,
      finalTcoNeu: finalData.tcoNeu || 0,
      savings,
      leadTimeComparison: {
        neu: leadTimeNeu,
        reman: leadTimeReman,
        delta: leadTimeNeu - leadTimeReman
      },
      co2Comparison: {
        neu: co2KostenNeu,
        reman: co2KostenReman
      },
      recyclingComparison: {
        neu: entsorgungNeu,
        reman: entsorgungReman
      },
      singleCostComparison: {
        neu: herstellkosten + inbetriebnahme + betriebskosten + entsorgungNeu + co2KostenNeu,
        reman: remanKosten + entsorgungReman + co2KostenReman
      }
    };
  }, [params]);

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value, decimals = 0) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <Calculator className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">TCO-Analyse: REMAN vs. Neuteil</h1>
          </div>
          <p className="text-gray-600">
            Professionelle Total Cost of Ownership Analyse für Remanufacturing-Strategien
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Factory className="h-5 w-5 text-blue-600 mr-2" />
              Kosten Neuteil
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Herstellkosten (€)</label>
                <input
                  type="number"
                  value={params.herstellkosten}
                  onChange={(e) => updateParam('herstellkosten', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inbetriebnahme (€)</label>
                <input
                  type="number"
                  value={params.inbetriebnahme}
                  onChange={(e) => updateParam('inbetriebnahme', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Betriebskosten/Jahr (€)</label>
                <input
                  type="number"
                  value={params.betriebskosten}
                  onChange={(e) => updateParam('betriebskosten', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entsorgung (€)</label>
                <input
                  type="number"
                  value={params.entsorgungNeu}
                  onChange={(e) => updateParam('entsorgungNeu', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Recycle className="h-5 w-5 text-green-600 mr-2" />
              Kosten REMAN
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">REMAN-Kosten (€)</label>
                <input
                  type="number"
                  value={params.remanKosten}
                  onChange={(e) => updateParam('remanKosten', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entsorgung (€)</label>
                <input
                  type="number"
                  value={params.entsorgungReman}
                  onChange={(e) => updateParam('entsorgungReman', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kostensteigerung (%/Jahr)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.remanSteigerung}
                  onChange={(e) => updateParam('remanSteigerung', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="h-5 w-5 text-purple-600 mr-2" />
              Zeitparameter
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Analysehorizont (Jahre)</label>
                <input
                  type="number"
                  value={params.analysehorizont}
                  onChange={(e) => updateParam('analysehorizont', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standzeit Neuteil (Tage)</label>
                <input
                  type="number"
                  value={params.standzeitNeu}
                  onChange={(e) => updateParam('standzeitNeu', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standzeit REMAN (Tage)</label>
                <input
                  type="number"
                  value={params.standzeitReman}
                  onChange={(e) => updateParam('standzeitReman', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inflation (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.inflation}
                  onChange={(e) => updateParam('inflation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">TCO REMAN</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(calculations.finalTcoReman)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">TCO Neuteil</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(calculations.finalTcoNeu)}
                </p>
              </div>
              <Factory className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Einsparung</p>
                <p className={`text-2xl font-bold ${calculations.savings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(calculations.savings)}
                </p>
              </div>
              <Leaf className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Einsparung %</p>
                <p className={`text-2xl font-bold ${calculations.savings > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber((calculations.savings / calculations.finalTcoNeu) * 100, 1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">TCO-Verlauf über Zeit</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={calculations.tcoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: 'Jahre', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'TCO (€)', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => formatNumber(value/1000) + 'k'}
                />
                <Tooltip 
                  formatter={(value, name) => [formatCurrency(value), name]}
                  labelFormatter={(value) => `Jahr ${formatNumber(value, 1)}`}
                />
                <Legend />
                <Line 
                  type="stepAfter" 
                  dataKey="tcoReman" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  name="Mit REMAN"
                />
                <Line 
                  type="stepAfter" 
                  dataKey="tcoNeu" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  name="Ohne REMAN"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kosten je Nutzleistung (Cent/Hub)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={calculations.tcoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: 'Jahre', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Cent/Hub', angle: -90, position: 'insideLeft' }}
                  tickFormatter={(value) => formatNumber(value, 2)}
                />
                <Tooltip 
                  formatter={(value, name) => [formatNumber(value, 2) + ' Cent', name]}
                  labelFormatter={(value) => `Jahr ${formatNumber(value, 1)}`}
                />
                <Legend />
                <Line 
                  type="stepAfter" 
                  dataKey="costPerOutputReman" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  name="Mit REMAN"
                />
                <Line 
                  type="stepAfter" 
                  dataKey="costPerOutputNeu" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  name="Ohne REMAN"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">CO2-Kosten Vergleich</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.co2Comparison.neu },
                { name: 'REMAN', value: calculations.co2Comparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatNumber(value)} />
                <Tooltip formatter={(value) => [formatCurrency(value), 'CO2-Kosten']} />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Wiederbeschaffungszeit
              <span className="block text-sm text-gray-600 font-normal">
                Delta: {calculations.leadTimeComparison.delta} Tage
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.leadTimeComparison.neu },
                { name: 'REMAN', value: calculations.leadTimeComparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatNumber(value)} />
                <Tooltip formatter={(value) => [formatNumber(value) + ' Tage', 'Wiederbeschaffungszeit']} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recycling/Entsorgung</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.recyclingComparison.neu },
                { name: 'REMAN', value: calculations.recyclingComparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatNumber(value)} />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Entsorgungskosten']} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Neuteil vs. REMAN</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: 'Neuteil', value: calculations.singleCostComparison.neu },
                { name: 'REMAN', value: calculations.singleCostComparison.reman }
              ]}>
                <XAxis dataKey="name" />
                <YAxis tick
