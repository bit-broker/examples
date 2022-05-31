function initMap() {
  const BASE_LAYER = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  );

  const map = L.map("map", {
    center: [51.54, 0.65],
    zoom: 15
  }).locate({ setView: true, maxZoom: 16 });

  map.addLayer(BASE_LAYER);
  window.map = map;

  document.querySelector('.no-data-info').style.visibility = 'hidden';
}

function mergeQueryParam(name, value) {
  const url = new URL(window.location);
  if (!value) {
    url.searchParams.delete(name);
    return;
  }

  url.searchParams.set(name, value);
  window.history.replaceState(null, null, url.toString());
}

function entitySelectionChanged(value) {
  const selectedEntity = window.entities.find(e => e.id?.toLowerCase() === value.toLowerCase());
  window.selectedEntity = selectedEntity;
  mergeQueryParam('entity', selectedEntity?.id);
}

async function policySelectionChanged(value) {
  const selectedPolicy = window.policies.find(p => p.id.toLowerCase() === value.toLowerCase());
  window.selectedPolicy = selectedPolicy;
  mergeQueryParam('policy', selectedPolicy?.id);
  return refreshEntities();
}

function getValue(value) {
  return typeof value === 'object' ? Object.values(value) : value;
}

let clearGroup = () => {};
const notFoundIcon = 'https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png';
async function getData() {
  const { selectedPolicy, selectedEntity } = window;
  if (selectedPolicy == null || selectedEntity == null) {
    return;
  }

  const response = await fetch(`http://bbk-consumer:8003/v1/entity/${selectedEntity.id}`, {
    headers: {
      'x-bbk-audience': selectedPolicy.id,
      'x-bbk-auth-token': 'something'
    }
  });
  const data = await response.json();

  const dataDetails = await Promise.all(data.map(d => fetch(d.url, {
    headers: {
      'x-bbk-audience': selectedPolicy.id,
      'x-bbk-auth-token': 'something'
    },
  }).then(res => res.json())));
  window.data = dataDetails;

  const buildPopup = entity =>
  `<div class="popup-content">
    ${Object.entries(entity).map(([key, value]) => 
    `<div class="popup-entry"><span><strong>${key}</strong>: ${getValue(value)}</span></div>`).join('')}
  </div>`

  window.mapData = dataDetails.map(
    ({ entity, name }) => L.marker([entity.location.coordinates[1], entity.location.coordinates[0]], {
      title: name,
      icon: L.icon({
        iconUrl: (window.selectedEntity.id === 'country'
          ? `https://flagcdn.com/32x24/${entity.code?.toLowerCase()}.png`
          : entity.image) || notFoundIcon,
        iconSize: [32, 24]
      })
    }).bindPopup(buildPopup(entity))
  );

  clearGroup();

  const visibility = window.mapData.length === 0 ? 'visible' : 'hidden';
  document.querySelector('.no-data-info').style.visibility = visibility;
  if (window.mapData.length === 0) {
    return;
  }

  const group = L.featureGroup(window.mapData).addTo(window.map);
  clearGroup = () => group.remove();
  window.map.fitBounds(group.getBounds());
}

function getPolicySelector() {
  return document.getElementById('policy-selector');
}

function getEntitySelector() {
  return document.getElementById('entity-selector');
}

function initEvents() {
  const pickValue = func => event => func(event.target.value);
  getEntitySelector().addEventListener('change', pickValue(entitySelectionChanged));
  getPolicySelector().addEventListener('change', pickValue(policySelectionChanged));
  document.getElementById('get-data-button').addEventListener('click', getData);
}

async function getEntities() {
  const entities = await fetch('http://bbk-consumer:8003/v1/entity', {
    headers: {
      'x-bbk-auth-token': window.selectedPolicy.token,
      'x-bbk-audience': window.selectedPolicy.id,
    },
  }).then(res => res.json());
  window.entities = entities;
}

async function refreshEntities() {
  await getEntities();

  const entityList = document.getElementById('entity-selector');
  entityList.innerHTML = '';
  entities.forEach(entity => {
    const option = document.createElement('option');
    option.value = entity.id;
    option.text = entity.name;
    entityList.appendChild(option);
  });
  this.selectedEntity = entities[0];
}

async function refreshPolicies(entity) {
  const policies = await fetch('http://bbk-coordinator:8001/v1/policy').then(res => res.json());

  const tokens = await fetch('/tokens.json').then(res => res.json());
  const policiesWithToken = policies.map(policy => ({
    ...policy,
    token: tokens.find(t => t.policyId === policy.id)?.token ?? null
  }))
  window.policies = policiesWithToken;
  const policyList = document.getElementById('policy-selector');

  policyList.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.text = 'Select a policy';
  placeholder.disabled = true;
  policyList.appendChild(placeholder);
  policies.forEach(policy => {
    const option = document.createElement('option');
    option.value = policy.id;
    option.text = policy.name;
    policyList.appendChild(option);
  });
  policyList.selectedIndex = 0;
}

function getInitialEntitySelection() {
  const params = new URLSearchParams(window.location.search);

  const entityId = params.get('entity');
  const policyId = params.get('policy');
  return { entityId, policyId };
}

async function applyQueryParams() {
  const { entityId, policyId } = getInitialEntitySelection();

  if (policyId) {
    await policySelectionChanged(policyId);
    const selector = getPolicySelector();
    selector.value = policyId;
  }

  if (entityId) {
    entitySelectionChanged(entityId);
    const selector = getEntitySelector();
    selector.value = entityId;
  }

  if (entityId && policyId) {
    getData();
  }
}

async function init() {
  initEvents();
  initMap();
  await refreshPolicies();
  applyQueryParams();
}

document.addEventListener("DOMContentLoaded", init);
