/* Renders the sample lot database on /data/. */
(function () {
  const lotBody = document.getElementById('lot-rows');
  const historyBody = document.getElementById('history-rows');
  const historyLot = document.getElementById('history-lot');
  const historyDay = document.getElementById('history-day');
  const historyCaption = document.getElementById('history-caption');
  const status = document.getElementById('data-status');
  if (!lotBody || !historyBody || !historyLot || !historyDay) return;

  const state = {
    lots: [],
    cameras: [],
    observations: [],
    kind: 'all',
  };

  function showError(message) {
    if (!status) return;
    status.hidden = false;
    status.dataset.state = 'error';
    status.textContent = message;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function latestByLot(observations) {
    const latest = new Map();
    observations.forEach((row) => {
      const current = latest.get(row.lot_id);
      if (!current || row.observed_at > current.observed_at) latest.set(row.lot_id, row);
    });
    return latest;
  }

  function percent(occupied, capacity) {
    if (!capacity) return '0%';
    return Math.round((occupied / capacity) * 100) + '%';
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Denver',
    }).format(date);
  }

  function dayKey(iso) {
    return iso.slice(0, 10);
  }

  function renderLots() {
    const latest = latestByLot(state.observations);
    const rows = state.lots.filter((lot) => state.kind === 'all' || lot.kind === state.kind);
    if (!rows.length) {
      lotBody.innerHTML = '<tr><td colspan="7">No lots in this filter.</td></tr>';
      return;
    }
    lotBody.innerHTML = rows.map((lot) => {
      const snap = latest.get(lot.lot_id);
      const occupied = snap ? snap.occupied_stalls : 0;
      const open = snap ? snap.open_stalls : lot.stall_capacity;
      const full = percent(occupied, lot.stall_capacity);
      return `<tr>
        <td><strong>${lot.name}</strong><div class="muted">${lot.lot_id} · ${lot.walk_minutes} min walk</div></td>
        <td>${lot.kind}</td>
        <td>${lot.permit_type}</td>
        <td>${lot.stall_capacity}</td>
        <td>${occupied}</td>
        <td>${open}</td>
        <td>
          <div class="occ-track" aria-hidden="true"><div class="occ-fill" style="width:${full}"></div></div>
          <div class="muted">${full}</div>
        </td>
      </tr>`;
    }).join('');
  }

  function renderHistory() {
    const lotId = historyLot.value;
    const day = historyDay.value;
    const lot = state.lots.find((item) => item.lot_id === lotId);
    const rows = state.observations.filter((row) => row.lot_id === lotId && dayKey(row.observed_at) === day);
    if (historyCaption && lot) {
      historyCaption.textContent = `${lot.name} on ${day}. ${rows.length} sample rows.`;
    }
    if (!rows.length) {
      historyBody.innerHTML = '<tr><td colspan="5">No observations for this lot and day.</td></tr>';
      return;
    }
    historyBody.innerHTML = rows.map((row) => `<tr>
      <td>${formatWhen(row.observed_at)}</td>
      <td>${row.occupied_stalls}</td>
      <td>${row.open_stalls}</td>
      <td>${Number(row.confidence).toFixed(3)}</td>
      <td>${row.source}</td>
    </tr>`).join('');
  }

  function fillControls() {
    historyLot.innerHTML = state.lots.map((lot) => (
      `<option value="${lot.lot_id}">${lot.name}</option>`
    )).join('');
    const days = [...new Set(state.observations.map((row) => dayKey(row.observed_at)))];
    historyDay.innerHTML = days.map((day) => `<option value="${day}">${day}</option>`).join('');
    if (days.length) historyDay.value = days[days.length - 1];
  }

  function render(payload) {
    state.lots = payload.lots || [];
    state.cameras = payload.cameras || [];
    state.observations = payload.observations || [];
    if (!state.lots.length || !state.observations.length) {
      showError('The sample file loaded, but it has no lot or occupancy rows.');
      return;
    }
    const latest = latestByLot(state.observations);
    const open = [...latest.values()].reduce((sum, row) => sum + row.open_stalls, 0);
    setText('stat-lots', String(state.lots.length));
    setText('stat-cameras', String(state.cameras.length));
    setText('stat-observations', state.observations.length.toLocaleString('en-US'));
    setText('stat-open', open.toLocaleString('en-US'));
    const windowNode = document.getElementById('data-window');
    if (windowNode && payload.meta) {
      windowNode.textContent = `${payload.meta.window_start} through ${payload.meta.window_end}. ${payload.meta.purpose}`;
    }
    fillControls();
    renderLots();
    renderHistory();
  }

  document.querySelectorAll('.lot-filters .chip').forEach((button) => {
    button.addEventListener('click', () => {
      state.kind = button.getAttribute('data-kind') || 'all';
      document.querySelectorAll('.lot-filters .chip').forEach((chip) => {
        chip.setAttribute('aria-pressed', chip === button ? 'true' : 'false');
      });
      renderLots();
    });
  });
  historyLot.addEventListener('change', renderHistory);
  historyDay.addEventListener('change', renderHistory);

  fetch('/data/demo-db.json')
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(render)
    .catch(() => {
      showError('Sample records did not load. The SQLite and JSON downloads above are the same dataset.');
      lotBody.innerHTML = '<tr><td colspan="7">Sample records did not load.</td></tr>';
      historyBody.innerHTML = '<tr><td colspan="5">Sample records did not load.</td></tr>';
    });
})();
