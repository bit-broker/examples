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
}

function entitySelectionChanged(event) {
  const selectedEntity = window.entities.find(e => e.id?.toLowerCase() === event.target.value.toLowerCase());
  if (selectedEntity != null) {
    window.selectedEntity = selectedEntity;
  } else {
    console.log('entity not found', window.entities, event.target.value);
  }
}

function policySelectionChanged(event) {
  console.log('event.target.value', event.target.value)
  const selectedPolicy = window.policies.find(p => p.id.toLowerCase() === event.target.value.toLowerCase());
  window.selectedPolicy = selectedPolicy;
  refreshEntities();
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

  const response = await fetch(`${window.config.services.consumer}/v1/entity/${selectedEntity.id}`, {
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
  console.log('dataDetails', dataDetails);
  window.data = dataDetails;

  const buildPopup = entity =>
  `<div class="popup-content">
    ${Object.entries(entity).map(([key, value]) => `<div><span>${key}: ${getValue(value)}</span></div>`).join('')}
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
  const group = L.featureGroup(window.mapData).addTo(window.map);
  clearGroup = () => group.remove();
  window.map.fitBounds(group.getBounds());
}

function initEvents() {
  document.getElementById('entity-selector').addEventListener('change', entitySelectionChanged);
  document.getElementById('policy-selector').addEventListener('change', policySelectionChanged);
  document.getElementById('get-data-button').addEventListener('click', getData);
}

async function refreshEntities() {
  const entities = await fetch(`${window.config.services.consumer}/v1/entity`, {
    headers: {
      'x-bbk-auth-token': window.selectedPolicy.token,
      'x-bbk-audience': window.selectedPolicy.id,
    },
  }).then(res => res.json());
  window.entities = entities;
  const entityList = document.getElementById('entity-selector');

  entityList.innerHTML = '';
  entities.forEach(entity => {
    const option = document.createElement('option');
    option.value = entity.id;
    option.text = entity.name;
    entityList.appendChild(option);
  });
}

async function getPoliciesFromCoordinator() {
  const policies = await fetch(`${window.config.services.coordinator}/v1/policy`).then(res => res.json());

  const { policies: configPolicies } = window.config;
  return policies.map(policy => ({
    ...policy,
    token: configPolicies.find(t => t.id === policy.id)?.token ?? null
  }));
}

async function getPolicies() {
  const config = { window };
  return config.useStaticPolicies === true
    ? Promise.resolve(config.policies)
    : getPoliciesFromCoordinator();
}

async function refreshPolicies(entity) {
  window.policies = await getPolicies();
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

async function initConfig() {
  window.config = await fetch('/config.json').then(res => res.json());
}

async function init() {
  await initConfig();
  initEvents();
  initMap();
  refreshPolicies();
}

document.addEventListener("DOMContentLoaded", init);
