/**
 * Copyright 2022 Cisco and its affiliates
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// Global Vars

let urlHistory = [];
let fowardHistory = [];
let myToken = null;
let myPolicy = null;
const default_limit = 10;
const baseURL = document.getElementById("baseurl").value;
console.log("base!", baseURL)

const policies = [
  {
    name: "access-all-areas",
    token: "4e04e60d-b88b-4212-a50f-2414c8c870a6.70414dbe-ac0e-44d5-9303-3add93b5a666.a967616e-d97b-4d91-9c0f-c84f2d205184",
    description: "Global access to every record",
  },
  {
    name: "geo-british-isles",
    token: "a460b968-4f90-4fc8-b11b-f890e0e31161.d850b6d3-7a15-4af1-9a96-6bdf407db416.8175ed75-28e3-4988-a26a-3c7c32c925cc",
    description: "Everything within the geography of the British Isles",
  },
  {
    name: "heritage-natural",
    token: "e73510c3-8934-4a53-947c-a7d0e6994366.285a4caf-f1fe-4a3a-9452-b6177b007f81.5bfd064c-feda-4817-bd9f-faa6821b06f1",
    description: "Natural landmarks or areas with legal protection by an international convention as defined by UNESCO",
  },
];

const queries = [
  {
    name: "type country",
    query: '{"type":"country"}',
  },
  {
    name: "type heritage",
    query: '{"type":"heritage"}',
  },
  {
    name: "country named 'United Kingdom",
    query: '{"type":"country","name":"United Kingdom"}',
  },

  {
    name: "The world except 'United Kingdom' 'india' 'Atlantis",
    query:
      '{"type":"country","name":{"$nin":["United Kingdom","Atlantis","India","France"]"}"}',
  },
  {
    name: "The world except 'United Kingdom",
    query: '{"type":"country","$not":{"name":"United Kingdom"}"}',
  },
  {
    name: "countries named 'United Kingdom', 'United States', 'Canada'",
    query:
      '{"type":"country","entity.calling_code":{"$in":"["CALLING_CODE.US","CALLING_CODE.GB"]"}}',
  },
];

/* Convert http(s) urls to clickable links inline
 */

const clickLink = (jsonString) => {
  const urlRegex = /(\"https?:\/\/[^\s]+\")/g;

  return jsonString.replace(urlRegex, function (url) {
    let unQuotedUrl = url.substring(1, url.length - 1);
    return `<a href="${unQuotedUrl}">${unQuotedUrl}</a>`;
  });
};

/* create Clickable links for bit-broker urls
 */

const bbkUrl = (url) => {
  const link = document.createElement("a");
  link.textContent = url;
  link.setAttribute("href", "#");
  link.addEventListener("click", function (e) {
    console.log("target", e.target.innerHTML);
    consumerAPIFetch(e.target.innerHTML);
  });
  return link;
};

/* Render bit-broker Timeseries
 */

const renderTS = (ts) => {
  const row = document.createElement("div");
  row.classList.add("row");
  const propName = document.createElement("div");
  propName.classList.add("col-md-2", "fw-bold");
  const propValue = document.createElement("div");
  propValue.classList.add("col-md-10");

  propName.textContent = "timeseries";
  row.appendChild(propName);
  Object.entries(ts).forEach(([key, value]) => {
    propValue.innerHTML += `${key}`;
    propValue.appendChild(bbkUrl(value.url));
    console.log(key, value);
  });
  row.appendChild(propValue);
  return row;
};

/* Render Json
 */

const renderJson = (prop, jsonString) => {
  const row = document.createElement("div");
  row.classList.add("row");
  const propName = document.createElement("div");
  propName.classList.add("col-md-2", "fw-bold");
  const propValue = document.createElement("div");
  propValue.classList.add("col-md-10");

  const json_pre = document.createElement("pre");

  propName.textContent = prop;
  row.appendChild(propName);
  if (prop == "url") {
    propValue.appendChild(bbkUrl(jsonString));
  } else {
    json_pre.innerHTML = jsonString;
    propValue.appendChild(json_pre);
  }
  row.appendChild(propValue);
  return row;
};

/* format bit-broker API response data
 */

const formatResponse = (response) => {
  const dl = document.createElement("div");
  dl.classList.add(
    "container",
    "border",
    "py-2",
    "my-2",
    "bg-white",
    "rounded"
  );

  for (let prop in response) {
    let str = response[prop];
    if (typeof response[prop] === "object") {
      str = JSON.stringify(response[prop], null, 2);
      str = clickLink(str);
    }
    switch (prop) {
      case "timeseries":
        dl.appendChild(renderTS(response[prop]));
        break;
      default:
        dl.appendChild(renderJson(prop, str));
        break;
    }
  }
  return dl;
};

/* fetch bit-broker consumer API
 */

function consumerAPIFetch(url) {
  urlHistory.push(url);
  console.log("history", urlHistory);
  const results = document.getElementById("results");
  results.innerHTML = "";

  const requestOptions = {
    method: "GET",
    headers: {
      "x-bbk-auth-token": myToken,
      "x-bbk-audience": myPolicy
    },
  };
  let searchParam = new URLSearchParams(url.split("?")[1]);
  if (searchParam.has("limit") == false) {
    searchParam.set("limit", default_limit);
    url = url.split("?")[0] + "?";
    searchParam.forEach((value, key) => {
      url += key + "=" + value + "&";
    });
  }
  console.log(url, requestOptions);
  fetch(url, requestOptions)
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data) => {
      console.log(JSON.stringify(data));

      results.innerHTML = "";

      if (Array.isArray(data)) {
        data.forEach((item) => {
          results.append(formatResponse(item));
        });
      } else {
        results.append(formatResponse(data));
      }
    })

    .catch(console.error);
}

/* support bit-broker response pagination
 */

const nextPage = () => {
  if (urlHistory.length > 0) {
    url = urlHistory[urlHistory.length - 1];

    let searchParam = new URLSearchParams(url.split("?")[1]);
    let newOffset = 0;
    let newLimit = default_limit;
    if (searchParam.has("offset")) {
      newOffset = parseInt(searchParam.get("offset"));
    }
    if (searchParam.has("limit")) {
      newLimit = parseInt(searchParam.get("limit"));
    }

    newOffset += newLimit;
    searchParam.set("offset", newOffset);
    searchParam.set("limit", newLimit);
    let newURL = url.split("?")[0] + "?";
    searchParam.forEach((value, key) => {
      newURL += key + "=" + value + "&";
    });

    consumerAPIFetch(newURL);
  }
};

/* populate Policy Dropdown
 */

const policyDropdownValue = () => {
  const ul = document.getElementById("policyDropDown");
  policies.forEach((policy) => { 
    const item = document.createElement("a");
    item.setAttribute("class", "dropdown-item");
    item.href = "#";
    item.innerHTML = policy.name;
    const li = document.createElement("li");
    li.appendChild(item);
    ul.appendChild(li);
  });
};

/* populate Queries Dropdown
 */

const queryDropdownValue = () => {
  const ul = document.getElementById("queryDropDown");
  queries.forEach((query) => {  
      const item = document.createElement("a");
      item.setAttribute("class", "dropdown-item");
      item.href = "#";
      item.innerHTML = query.name;
      const li = document.createElement("li");
      li.appendChild(item);
      ul.appendChild(li);
  });
};

/* event handlers
 */

const next = document.getElementById("next");
next.addEventListener("click", (event) => nextPage());

const go = document.getElementById("go");

go.addEventListener("click", (event) => {
  const queryCatalog = document.getElementById("queryCatalog");
  let query = encodeURIComponent(queryCatalog.value);
  consumerAPIFetch(`${baseURL}/catalog?q=${query}`);
});

const token = document.getElementById("token");

token.addEventListener("change", (event) => myToken = event.target.value);

const back = document.getElementById("go-back");

back.addEventListener("click", (event) => {
  if (urlHistory == 0) {
    document.getElementById("go-back").disabled = true;
  } else {
    fowardHistory.push(urlHistory.pop());
    let url = urlHistory.pop();
    consumerAPIFetch(url);
  }
});

const forward = document.getElementById("go-forward");

forward.addEventListener("click", (event) => {
  if (fowardHistory == 0) {
    document.getElementById("go-forward").disabled = true;
  } else {
    let url = fowardHistory[fowardHistory.length - 1];
    urlHistory.push(url);
    fowardHistory.pop();
    consumerAPIFetch(url);
  }
});

/* on DOM fully loaded and parsed...
 */

window.addEventListener('DOMContentLoaded', (event) => {

  // ToDo: fetch policy & query defaults from seperate json file...

  policyDropdownValue();

  let policyOpts = document.querySelectorAll('#policyDropDown .dropdown-item')
  policyOpts.forEach(element => element.addEventListener("click", function () {
      let text = element.innerText;
      console.log (`text: ${text}`);
      let policy = policies.find(e => e.name === text);
      const token = document.getElementById("token");
      token.value = policy.token;
      const policyName = document.getElementById("policyName");
      policyName.value = policy.name;
      const policydescription = document.getElementById("policydescription");
      policydescription.value = policy.description;
      policydescription.readOnly = true;
      myToken = policy.token;
      myPolicy = policy.name;

  }))

  queryDropdownValue();

  let queryOpts = document.querySelectorAll('#queryDropDown .dropdown-item')
  queryOpts.forEach(element => element.addEventListener("click", function () {
      let text = element.innerText;
      console.log (`text: ${text}`);
      let query = queries.find(e => e.name === text);
      const queryCatalog = document.getElementById("queryCatalog");
      queryCatalog.value = query.query;
  }))
});