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
let baseURL = "";

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
    name: "The world except 'United Kingdom', 'Atlantis', 'India', 'France'",
    query:
      '{"type":"country","name":{"$nin":["United Kingdom","Atlantis","India","France"]}}',
  },
  {
    name: "Within 250km of New York",
    query:
      '{ "entity.location": { "$near": { "$geometry": {"type": "Point","coordinates": [-74.0060, 40.71281] },"$min": 0, "$max": 250000 }}}',    
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
    consumerAPIFetch(e.target.innerHTML);
  });
  return link;
};

/* Render Copy to Curl button
 */

const RenderCopyCurlButton = (url) => {
  const curlButton = document.createElement("button");
  curlButton.innerText = "copy Curl";
  curlButton.type = "button";
  curlButton.setAttribute("data-link", url);
  curlButton.classList.add("btn", "btn-primary");
  curlButton.addEventListener("click", function (e) {
    copyCurlToClipBoard(e.target.getAttribute("data-link"));
  });
  return curlButton;
};

/* Render bit-broker Timeseries in entity view
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
    propValue.appendChild(RenderCopyCurlButton(value.url));
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
  const code = document.createElement("code");
  code.classList.add("language-json");

  propName.textContent = prop;
  row.appendChild(propName);
  if (prop == "url") {
    propValue.appendChild(bbkUrl(jsonString));
    propValue.appendChild(RenderCopyCurlButton(jsonString));
  } else {
    code.innerHTML = jsonString;
    json_pre.appendChild(code);
    propValue.appendChild(json_pre);
  }
  row.appendChild(propValue);
  return row;
};

/* Render TimeSeries Data as Chart
 */

const formatTimeSeriesChart = (result) => {
  const dl = document.createElement("div");
  const canvas = document.createElement("canvas");
  canvas.id = "canvas";

  const labels = result.map(function (e) {
    return e.from;
  });

  const data = result.map(function (e) {
    return e.value;
  });

  const ctx = canvas.getContext("2d");
  const myChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Yearly Population",
          fill: true,
          lineTension: 0.1,
          backgroundColor: "rgba(0, 119, 204, 0.3)",
          borderColor: "#00008b",
          fontColor: "#00008b",
          data: data,
        },
      ],
    },
    options: {
      responsive: "true",
      scales: {
        x: {
          title: {
            display: true,
            text: "Year",
            color: "#00008b",
            font: {
              fontFamily: "Arial",
              margin: 25,
              padding: 4,
              borderThickness: 2,
              size: 15,
            },
          },
        },

        y: {
          title: {
            display: true,
            text: "Population",
            color: "#00008b",
            font: {
              fontFamily: "Arial",
              margin: 25,
              padding: 4,
              borderThickness: 2,
              size: 15,
            },
          },
        },
      },
    },
  });

  dl.appendChild(canvas);

  return dl;
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
  const results = document.getElementById("results");
  results.innerHTML = "";
  spinner.removeAttribute("hidden");
  paginationVisibility(false);

  const requestOptions = {
    method: "GET",
    headers: {
      "x-bbk-auth-token": myToken,
      "x-bbk-audience": myPolicy,
    },
  };

  /* handle timeseries display differently
   */  

  if (url.indexOf("timeseries") >= 0) {
  } else {
    let searchParam = new URLSearchParams(url.split("?")[1]);
    if (searchParam.has("limit") == false) {
      searchParam.set("limit", default_limit);
    }

    if (searchParam.has("offset") == false) {
      searchParam.set("offset", 0);
    }

    url = url.split("?")[0] + "?";
    searchParam.forEach((value, key) => {
      url += key + "=" + value + "&";
    });

    if (searchParam.has("offset")) {
      let newOffset = parseInt(searchParam.get("offset"));
      if (newOffset == 0) {
        // diable previous button
        previous.forEach((element) => (element.disabled = true));
      } else {
        // enable previous button
        previous.forEach((element) => (element.disabled = false));
      }
    }
  }

  fetch(url, requestOptions)
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data) => {
      results.innerHTML = "";
      spinner.setAttribute("hidden", "");

      if (Array.isArray(data)) {
        if (url.indexOf("timeseries") >= 0) {
          paginationVisibility(false);
          results.append(formatTimeSeriesChart(data));
        } else {
          paginationVisibility(true);
          data.forEach((item) => {
            results.append(formatResponse(item));
          });
        }
      } else {
        paginationVisibility(false);
        results.append(formatResponse(data));
      }
    })

    .catch(console.error);
}

/* hide and show pagination
 */

const paginationVisibility = (visible) => {
  if (visible == true) {
    next.forEach((element) => element.removeAttribute("hidden"));
    previous.forEach((element) => element.removeAttribute("hidden"));
  } else {
    next.forEach((element) => element.setAttribute("hidden", ""));
    previous.forEach((element) => element.setAttribute("hidden", ""));
  }
};

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

const previousPage = () => {
  if (urlHistory.length > 0) {
    url = urlHistory[urlHistory.length - 1];

    let searchParam = new URLSearchParams(url.split("?")[1]);
    let newOffset = 10;
    let newLimit = default_limit;
    if (searchParam.has("offset")) {
      newOffset = parseInt(searchParam.get("offset"));
    }
    if (searchParam.has("limit")) {
      newLimit = parseInt(searchParam.get("limit"));
    }

    newOffset -= newLimit;
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

const policyDropdownValue = (policies) => {
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

const queryDropdownValue = (queries) => {
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

/* copy baseurl as curl
 */

const copyCurlToClipBoard = (url) => {
  const curlUrl =
    "curl" +
    " " +
    "--location" +
    " " +
    "--request" +
    " " +
    "GET" +
    " " +
    url +
    " " +
    "-H" +
    " " +
    "x-bbk-auth-token:" +
    myToken +
    " " +
    "-H" +
    " " +
    "x-bbk-audience:" +
    myPolicy;
  navigator.clipboard.writeText(curlUrl).catch((err) => {
    console.error("Something went wrong", err);
  });
};

/* event handlers
 */

const spinner = document.getElementById("spinner");

const next = document.querySelectorAll("button.next");
next.forEach((element) =>
  element.addEventListener("click", (event) => nextPage())
);

const previous = document.querySelectorAll("button.previous");
previous.forEach((element) =>
  element.addEventListener("click", (event) => previousPage())
);

const go = document.getElementById("go");

go.addEventListener("click", (event) => {
  const queryCatalog = document.getElementById("queryCatalog");
  let query = encodeURIComponent(queryCatalog.value);
  consumerAPIFetch(`${baseURL}/catalog?q=${query}`);
});

const token = document.getElementById("token");

token.addEventListener("change", (event) => (myToken = event.target.value));

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

window.addEventListener("DOMContentLoaded", (event) => {
  fetch("./config/config.json")
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((config) => {
      baseURL = config.baseUrl;
      document.getElementById("baseurl").value = baseURL;

      policyDropdownValue(config.policies);

      let policyOpts = document.querySelectorAll(
        "#policyDropDown .dropdown-item"
      );
      policyOpts.forEach((element) =>
        element.addEventListener("click", function () {
          let text = element.innerText;
          let policy = config.policies.find((e) => e.name === text);
          const token = document.getElementById("token");
          token.value = policy.token;
          const policyId = document.getElementById("policyId");
          policyId.value = policy.id;
          const policydescription =
            document.getElementById("policydescription");
          policydescription.value = policy.description;
          policydescription.readOnly = true;
          myToken = policy.token;
          myPolicy = policy.id;
        })
      );
    })
    .catch(console.error);

  queryDropdownValue(queries);

  let queryOpts = document.querySelectorAll("#queryDropDown .dropdown-item");
  queryOpts.forEach((element) =>
    element.addEventListener("click", function () {
      let text = element.innerText;
      let query = queries.find((e) => e.name === text);
      const queryCatalog = document.getElementById("queryCatalog");
      queryCatalog.value = query.query;
    })
  );
});
