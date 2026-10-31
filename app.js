(() => {
  const STOP_COUNT = 12;
  const BUS_COUNT = 8;
  const HORIZON = 120;
  const route = Array.from({length: STOP_COUNT}, (_, index) => ({name:"Stop " + String(index + 1).padStart(2,"0")}));
  const elements = {
    traffic:document.getElementById("traffic"),
    demand:document.getElementById("demand"),
    headway:document.getElementById("targetHeadway"),
    hold:document.getElementById("holdLimit"),
    chart:document.getElementById("headwayChart"),
    table:document.getElementById("stopTable"),
    strip:document.getElementById("stopStrip")
  };

  function seeded(bus, stop, salt) {
    const value = Math.sin((bus + 1) * 91.7 + (stop + 4) * 17.3 + salt * 43.1) * 43758.5453;
    return value - Math.floor(value);
  }

  function simulate(useHolding, config) {
    const departures = Array.from({length: STOP_COUNT}, () => []);
    const previousDeparture = new Array(STOP_COUNT).fill(null);
    for (let bus = 0; bus < BUS_COUNT; bus += 1) {
      let time = bus * config.target;
      for (let stop = 0; stop < STOP_COUNT; stop += 1) {
        if (stop > 0) {
          const variation = seeded(bus, stop, 1);
          const peak = 0.35 + 0.65 * ((Math.sin((time / HORIZON) * Math.PI * 2 + stop * 0.72) + 1) / 2);
          time += 2.1 + config.traffic * (0.25 + variation * 0.55) * peak;
        }
        const arrival = time;
        let hold = 0;
        const previous = previousDeparture[stop];
        if (useHolding && previous !== null) {
          const gap = arrival - previous;
          if (gap > 0 && gap < config.target) hold = Math.min(config.hold, config.target - gap);
        }
        const boardNoise = seeded(bus, stop, 2);
        const dwell = 0.35 + config.demand * (0.12 + boardNoise * 0.12);
        const departure = arrival + hold + dwell;
        departures[stop].push({bus:bus + 1, arrival:arrival, departure:departure, hold:hold});
        previousDeparture[stop] = departure;
        time = departure;
      }
    }

    const stopStats = [];
    let waitNumerator = 0;
    let passengerWeight = 0;
    let bunching = 0;
    let onTarget = 0;
    let intervals = 0;

    departures.forEach((events) => {
      const times = events.map((event) => event.departure).filter((time) => time <= HORIZON).sort((a,b) => a-b);
      const gaps = [];
      for (let index = 1; index < times.length; index += 1) {
        const gap = times[index] - times[index - 1];
        if (gap <= 0) continue;
        gaps.push(gap);
        const passengerRate = config.demand * 0.6;
        waitNumerator += passengerRate * gap * gap / 2;
        passengerWeight += passengerRate * gap;
        if (gap < config.target * 0.6) bunching += 1;
        if (gap >= config.target * 0.75 && gap <= config.target * 1.25) onTarget += 1;
        intervals += 1;
      }
      stopStats.push({
        mean:gaps.length ? gaps.reduce((sum,gap) => sum + gap,0) / gaps.length : 0,
        gaps:gaps
      });
    });

    return {
      stopStats:stopStats,
      averageWait:passengerWeight ? waitNumerator / passengerWeight : 0,
      bunching:bunching,
      onTargetPercent:intervals ? onTarget / intervals * 100 : 0,
      intervalCount:intervals
    };
  }

  function linePath(values, xFor, yFor) {
    const points = values.map((value,index) => (index === 0 ? "M" : "L") + xFor(index).toFixed(1) + " " + yFor(value).toFixed(1));
    return points.join(" ");
  }

  function renderChart(regular, holding) {
    const width = 620;
    const height = 205;
    const left = 38;
    const right = 12;
    const top = 12;
    const bottom = 28;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxValue = 30;
    const xFor = (index) => left + index * plotWidth / (STOP_COUNT - 1);
    const yFor = (value) => top + plotHeight - Math.min(maxValue, value) / maxValue * plotHeight;
    let markup = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Mean headway in minutes for each stop">';
    [0,10,20,30].forEach((value) => {
      const y = yFor(value);
      markup += '<line class="chart-grid" x1="' + left + '" y1="' + y + '" x2="' + (width-right) + '" y2="' + y + '"></line>';
      markup += '<text class="chart-axis-text" x="2" y="' + (y+3) + '">' + value + 'm</text>';
    });
    regular.forEach((_,index) => {
      const x = xFor(index);
      markup += '<text class="chart-axis-text" text-anchor="middle" x="' + x + '" y="' + (height-7) + '">' + (index+1) + '</text>';
    });
    markup += '<path class="regular-line" d="' + linePath(regular, xFor, yFor) + '"></path>';
    markup += '<path class="hold-line" d="' + linePath(holding, xFor, yFor) + '"></path>';
    regular.forEach((value,index) => {
      markup += '<circle class="regular-point" cx="' + xFor(index) + '" cy="' + yFor(value) + '" r="3"></circle>';
      markup += '<circle class="hold-point" cx="' + xFor(index) + '" cy="' + yFor(holding[index]) + '" r="3"></circle>';
    });
    markup += '</svg>';
    elements.chart.innerHTML = markup;
  }

  function deltaText(regular, controlled, suffix, lowerIsBetter) {
    const delta = controlled - regular;
    if (Math.abs(delta) < 0.05) return "No material change";
    const improvement = lowerIsBetter ? delta < 0 : delta > 0;
    return (improvement ? "↓ " : "↑ ") + Math.abs(delta).toFixed(1) + suffix + (improvement ? " better" : " higher");
  }

  function renderComparison(regular, holding) {
    const rows = [
      {label:"Average passenger wait",a:regular.averageWait.toFixed(1)+" min",b:holding.averageWait.toFixed(1)+" min",delta:deltaText(regular.averageWait,holding.averageWait," min",true),good:holding.averageWait<=regular.averageWait},
      {label:"Bunching events",a:String(regular.bunching),b:String(holding.bunching),delta:deltaText(regular.bunching,holding.bunching,"",true),good:holding.bunching<=regular.bunching},
      {label:"On-target headways",a:regular.onTargetPercent.toFixed(0)+"%",b:holding.onTargetPercent.toFixed(0)+"%",delta:deltaText(regular.onTargetPercent,holding.onTargetPercent," pp",false),good:holding.onTargetPercent>=regular.onTargetPercent}
    ];
    document.getElementById("comparison").innerHTML = rows.map((row) =>
      '<div class="compare-row"><div class="compare-side"><small>REGULAR SERVICE</small><b>' + row.a + '</b></div><div class="compare-arrow">→</div><div class="compare-side controlled"><small>HEADWAY HOLDING</small><b>' + row.b + '</b></div></div>' +
      '<div class="delta-line"><span>' + row.label + '</span><b class="delta-pill ' + (row.good ? "" : "negative") + '">' + row.delta + '</b></div>'
    ).join("");
  }

  function renderStops(regular, holding) {
    elements.strip.innerHTML = route.map((stop,index) =>
      '<span class="stop-chip"><b>' + String(index+1).padStart(2,"0") + '</b>' + stop.name.slice(0,4) + '</span>'
    ).join("");
    elements.table.innerHTML = route.map((stop,index) => {
      const first = regular.stopStats[index].mean;
      const second = holding.stopStats[index].mean;
      const change = second-first;
      const maxWidth = 100;
      const widthA = Math.min(maxWidth, first / 30 * maxWidth);
      const widthB = Math.min(maxWidth, second / 30 * maxWidth);
      const statusClass = change < -0.05 ? "change-good" : change > 0.05 ? "change-bad" : "";
      const sign = change > 0.05 ? "+" : "";
      return '<tr><td>' + stop.name + '</td><td>' + first.toFixed(1) + ' min</td><td>' + second.toFixed(1) + ' min</td><td class="' + statusClass + '">' + sign + change.toFixed(1) + ' min</td><td><div class="mini-track"><i class="mini-regular" style="width:' + widthA + 'px"></i><i class="mini-hold" style="width:' + widthB + 'px"></i></div></td></tr>';
    }).join("");
  }

  function renderMetrics(regular, holding) {
    document.getElementById("waitMetric").textContent = holding.averageWait.toFixed(1) + " min";
    document.getElementById("waitChange").textContent = deltaText(regular.averageWait,holding.averageWait," min",true) + " vs. regular service";
    document.getElementById("bunchMetric").textContent = holding.bunching;
    document.getElementById("bunchChange").textContent = deltaText(regular.bunching,holding.bunching,"",true) + " vs. regular service";
    document.getElementById("reliabilityMetric").textContent = holding.onTargetPercent.toFixed(0) + "%";
    document.getElementById("reliabilityChange").textContent = deltaText(regular.onTargetPercent,holding.onTargetPercent," pp",false) + " vs. regular service";
  }

  function run() {
    const config = {
      traffic:Number(elements.traffic.value),
      demand:Number(elements.demand.value),
      target:Number(elements.headway.value),
      hold:Number(elements.hold.value)
    };
    document.getElementById("trafficValue").textContent = config.traffic.toFixed(1);
    document.getElementById("demandValue").textContent = config.demand.toFixed(1) + "×";
    document.getElementById("holdValue").textContent = String(config.hold);
    const regular = simulate(false,config);
    const holding = simulate(true,config);
    renderChart(
      regular.stopStats.map((item) => item.mean),
      holding.stopStats.map((item) => item.mean)
    );
    renderComparison(regular,holding);
    renderStops(regular,holding);
    renderMetrics(regular,holding);
  }

  ["traffic","demand","holdLimit","targetHeadway"].forEach((id) => {
    document.getElementById(id).addEventListener("input",run);
    document.getElementById(id).addEventListener("change",run);
  });
  document.getElementById("runSimulation").addEventListener("click",run);
  run();
})();