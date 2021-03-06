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

/**
 * BitBroker example app: Policy Based Data Explorer
 *
 * An example app to show how the BitBroker Consumer API supports policy-based data sharing.
 *
 * This app allows the user to explore the BitBroker [Consumer API](https://www.bit-broker.io/docs/consumer/),
 * using a set of policies provided via a config file, and loaded at startup. Users can explore data by
 * searching using the [Catalog API](https://www.bit-broker.io/docs/consumer/catalog/), and inspect
 * returned entity instance data, including timeseries data where available, by clicking on bitbroker url links.
 * Users can also 'copy' curl commands for BitBroker URLs from the app so they can access the consumer APIs directly.
 *
 * The app supports 'deep linking' by using a set of query params, which can be converted to / from the bitbroker APIs
 * used by app.
 * 
 * Uses prism.js for JSON color highlighting, configuration per:
 * https://prismjs.com/download.html#themes=prism&languages=json&plugins=autolinker+keep-markup
 */

// Constants

const BBK_CATALOG = 1;
const BBK_ENTITY_TYPE = 2;
const BBK_ENTITY_INSTANCE = 3;
const BBK_TIMESERIES = 4;

const QUERY_PARAM_TIMESERIES = "ts";
const QUERY_PARAM_CATALOG = "q";
const QUERY_PARAM_POLICY = "policy";
const QUERY_PARAM_ENTITY_TYPE = "entity";
const QUERY_PARAM_ENTITY_ID = "id";

const queries = [{
        name: "All countries",
        query: '{"type":"country"}',
    },
    {
        name: "Cultural heritage sites inscribed since 2000",
        query: '{"$and":[{"type":"heritage"},{"entity.category":"cultural"},{"entity.inscribed":{"$gte":2000}}]}',
    },
    {
        name: "Country named 'United Kingdom'",
        query: '{"type":"country","name":"United Kingdom"}',
    },
    {
        name: "All countries except 'United Kingdom', 'Atlantis', 'India', 'France'",
        query: '{"type":"country","name":{"$nin":["United Kingdom","Atlantis","India","France"]}}',
    },
    {
        name: "Asian countries with a population under half a million",
        query: '{"$and": [{"type":"country"},{"entity.continent":"Asia"},{"entity.population":{"$lt":500000}}]}'
    },
    {
        name: "Entities with a population timeseries",
        query: '{"timeseries.population.value":{ "$eq":"people"}}'
    },
    {
        name: "Countries that speak Danish",
        query: '{"entity.languages":["Danish"]}'
    },
    {
        name: "contains 'volcano' in description",
        query: '{"entity.description":{"$regex":"volcano","$options":"i"}}',
    },
    {
        name: "Within 250km of New York",
        query: '{"entity.location":{"$near":{"$geometry":{"type":"Point","coordinates":[-74.0060,40.71281]},"$min":0,"$max":250000}}}',
    },
    {
        name: "Within a geo-spatial polygon covering Australia",
        query: '{"entity.location":{"$within":{"$geometry": {"type": "Polygon","coordinates":[[' +
            '[129.8583984375,-10.876464994816283],' +
            '[111.8408203125,-22.593726063929296],' +
            '[114.2578125,-34.813803317113134],' +
            '[147.91992187499997,-44.43377984606823],' +
            '[155.302734375,-26.667095801104804],' +
            '[142.3828125,-9.752370139173285],' +
            '[129.8583984375,-10.876464994816283]' +
            ']]}}}}'
    },
];

// Global Vars

let myToken = null;
let myPolicy = null;

let baseURL = "";
let previousUrl = "";
let devShimMode = false;
let default_limit = 10;
let timeseries_limit = 20;
let latestTimeseries = 0;
let earliestTimeseries = 0;
let timeseriesChartState = true;

/* Convert http(s) urls to clickable links inline
 */

const clickLink = (jsonString) => {

    // regex to capture BBK consumer API urls...
    let urlRegex = new RegExp(baseURL + '([-a-zA-Z0-9@:%_\+.~#?&//=]*)', 'g');

    return jsonString.replace(urlRegex, function(url) {
        return bbkUrltoAppUrl(url).toString();
    });
};


/* Render Clickable links for bit-broker urls
 */

const bbkUrl = (url, linkText) => {
    const link = document.createElement("a");
    link.textContent = linkText ? linkText : url;
    link.setAttribute("href", bbkUrltoAppUrl(url).toString());
    return link;
};

/* Update Copy to Curl button
 */

const updateCopyCurlButton = (url) => {
    const copyCurl = document.getElementById("idCopyCurlButton");
    copyCurl.removeAttribute("hidden");
    copyCurl.setAttribute("data-link", url);
};

/* Render bit-broker Timeseries info in entity view
 */

const renderTS = (ts) => {
    const container = document.createElement("div");
    container.classList.add("container");
    container.style.padding = "0";

    Object.entries(ts).forEach(([key, value]) => {
        const row = document.createElement("div");
        row.classList.add("row");
        const propName = document.createElement("div");
        propName.classList.add("col-md-2", "fw-bold", "pt-4");

        propName.innerHTML = `<p class="text-end">timeseries: ${key}</p>`;
        row.appendChild(propName);

        const propValue = document.createElement("div");
        propValue.classList.add("col-md-10");

        const jsonPre = document.createElement("pre");
        const code = document.createElement("code");
        code.classList.add("language-json");

        code.innerHTML = clickLink(JSON.stringify(value, null, 2));
        jsonPre.appendChild(code);
        propValue.appendChild(jsonPre);
        Prism.highlightElement(code);
        row.appendChild(propValue);

        container.appendChild(row);
    });

    return container;
};

/* Render Json
 */

const renderJson = (prop, jsonString) => {
    const row = document.createElement("div");
    row.classList.add("row");
    const propName = document.createElement("div");
    propName.classList.add("col-md-2", "fw-bold", "pt-4");
    const propValue = document.createElement("div");
    propValue.classList.add("col-md-10");
    propName.innerHTML = `<p class="text-end">${prop}</p>`;
    row.appendChild(propName);
    if (prop == "url") {
        const jsonPre = document.createElement("pre");
        jsonPre.classList.add("bbkurl");
        jsonPre.appendChild(bbkUrl(jsonString));
        propValue.appendChild(jsonPre);
    } else {
        const jsonPre = document.createElement("pre");
        const code = document.createElement("code");
        code.classList.add("language-json");
        code.innerHTML = clickLink(jsonString);
        jsonPre.appendChild(code);
        propValue.appendChild(jsonPre);
        Prism.highlightElement(code);
    }
    row.appendChild(propValue);
    return row;
};

const extractTimeSeriesName = (url) => {

    let tmp = url.split('/');
    let ts_name = tmp[tmp.length - 1];
    ts_name = ts_name.substring(0, ts_name.indexOf("?"));
    return ts_name
}


/* Render TimeSeries Data as Table
 */

const formatTimeSeriesTable = (result) => {
    const table = document.createElement("table");
    table.setAttribute("class", "table");
    table.classList.add("table-bordered");
    table.style.width = "60%";
    table.setAttribute("border", "1");
    const tbody = document.createElement("tbody");
    const thead = document.createElement("thead");
    thead.setAttribute("class", "thead-dark");

    table.appendChild(thead);

    let ts_name = "";
    if (bbkUrlType(previousUrl) == BBK_TIMESERIES) {
        ts_name = extractTimeSeriesName(previousUrl);
    }

    const titles = Object.keys(result[0])
    const xTitle = titles[0];
    const yTitle = ts_name;

    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.appendChild(document.createTextNode(xTitle));
    tr.appendChild(th);
    const th2 = document.createElement("th");
    th2.appendChild(document.createTextNode(yTitle));
    tr.appendChild(th2);
    thead.appendChild(tr);
    const year = result.map(function(e) {
        return e.from;
    });
    const values = result.map(function(e) {
        return e.value;
    });

    for (let i = 0; i < result.length; i++) {
        const tr2 = document.createElement("tr");
        const td = document.createElement("td");
        td.appendChild(document.createTextNode(year[i]));
        tr2.appendChild(td);

        const td2 = document.createElement("td");
        td2.appendChild(document.createTextNode(values[i]));
        tr2.appendChild(td2);

        tbody.appendChild(tr2);
    }

    table.appendChild(tbody);
    return table;
};

/* Render TimeSeries Data as Chart
 */

const formatTimeSeriesChart = (result) => {
    const dl = document.createElement("div");
    const canvas = document.createElement("canvas");
    canvas.id = "canvas";

    let ts_name = "";
    if (bbkUrlType(previousUrl) == BBK_TIMESERIES) {
        ts_name = extractTimeSeriesName(previousUrl);
    }

    const titles = Object.keys(result[0])
    const xTitle = titles[0];
    const yTitle = ts_name;

    const data = result.map(function(e) {
        return { x: new moment.utc(e.from.toString()), y: e.value }
    });

    const ctx = canvas.getContext("2d");
    const myChart = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [{
                label: ts_name,
                fill: true,
                lineTension: 0.1,
                backgroundColor: "rgba(0, 119, 204, 0.3)",
                borderColor: "#00008b",
                fontColor: "#00008b",
                data: data,
            }, ],
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xTitle,
                        color: "#00008b",
                        font: {
                            fontFamily: "Arial",
                            margin: 25,
                            padding: 4,
                            borderThickness: 2,
                            size: 15,
                        },
                    },
                    type: 'time',
                },

                y: {
                    title: {
                        display: true,
                        text: yTitle,
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


/* format timeseries response data
 */

const formatTimeSeries = (response) => {
    timeSeriesButtonsVisibility(true);
    const dl = document.createElement("div");
    const dl1 = document.createElement("div");
    dl1.classList.add("timeseriesTable");
    const dl2 = document.createElement("div");
    dl2.classList.add("timeseriesChart");

    if (timeseriesChartState === true) {
        dl1.style.display = "none";
        dl2.style.display = "block";

    } else {
        dl2.style.display = "none";
        dl1.style.display = "block";
    }

    dl1.appendChild(formatTimeSeriesTable(response));
    dl.appendChild(dl1);
    dl2.appendChild(formatTimeSeriesChart(response));
    dl.appendChild(dl2);
    return dl;
};

/* format bit-broker API JSON response data
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
    const results = document.getElementById("results");
    results.innerHTML = "";
    const spinner = document.getElementById("spinner");
    spinner.removeAttribute("hidden");
    paginationVisibility(false);
    timeSeriesButtonsVisibility(false);

    let requestOptions = {
        method: "GET",
        headers: {
            "x-bbk-auth-token": myToken
        }
    };

    if (devShimMode) {
        requestOptions.headers["x-bbk-audience"] = myPolicy;
    }

    let urlType = bbkUrlType(url);

    // put in paging defaults for non timeseries API calls that return an array
    if (urlType == BBK_CATALOG || urlType == BBK_ENTITY_TYPE) {
        let newUrl = new URL(url);
        if (newUrl.searchParams.has("limit") == false) {
            newUrl.searchParams.set("limit", default_limit);
        }

        if (newUrl.searchParams.has("offset") == false) {
            newUrl.searchParams.set("offset", 0);
        }

        url = newUrl.toString();

        if (newUrl.searchParams.has("offset")) {
            let newOffset = parseInt(newUrl.searchParams.get("offset"));
            const previous = document.querySelectorAll("button.previous");
            if (newOffset == 0) {
                // disable previous button
                previous.forEach((element) => (element.disabled = true));
            } else {
                // enable previous button
                previous.forEach((element) => (element.disabled = false));
            }
        }
    }

    if (urlType == BBK_TIMESERIES) {
        let newUrl = new URL(url);
        if (newUrl.searchParams.has("limit") == false) {
            newUrl.searchParams.set("limit", timeseries_limit);

        }
        url = newUrl.toString();
    }


    updateBrowserUrl(url);
    previousUrl = url;

    fetch(url, requestOptions)
    .then((res) => {
        if (!res.ok) {
            return res.text().then(text => { throw new Error(text) })
        }
        return res;
    })
    .then(res => res.json())
    .then((data) => {
        results.innerHTML = "";
        spinner.setAttribute("hidden", "");
        const apiUrl = document.getElementById("idApiUrl");
        const next = document.querySelectorAll("button.next");
        apiUrl.value = previousUrl;
        updateCopyCurlButton(previousUrl);

        paginationVisibility(
            urlType == BBK_CATALOG || urlType == BBK_ENTITY_TYPE || urlType == BBK_TIMESERIES ? true : false
        );

        if (Array.isArray(data)) {
            if (urlType == BBK_TIMESERIES) {
                if (data.length === 0) {
                    latestTimeseries = 0;
                    paginationVisibility(true);
                    return (results.innerHTML = "No Results Found");
                }
            }

            if (data.length === 0) {
                paginationVisibility(false);
                return (results.innerHTML = "No Results Found");
            }
            if (urlType == BBK_TIMESERIES) {

                latestTimeseries = data[data.length - 1].from;
                earliestTimeseries = data[0].from;
                results.append(formatTimeSeries(data));
            } else {
                if (data.length < default_limit) {
                    next.forEach((element) => (element.disabled = true));
                }
                data.forEach((item) => {
                    results.append(formatResponse(item));
                });
            }
        } else {
            results.append(formatResponse(data));
        }
    })

    .catch((error) => {
        results.appendChild(renderJson("API Error", error.toString()))
        console.error(error);
        spinner.setAttribute("hidden", "");
    });
}

/* hide and show pagination
 */

const paginationVisibility = (visible) => {
    const next = document.querySelectorAll("button.next");
    const previous = document.querySelectorAll("button.previous");
    if (visible == true) {
        next.forEach((element) => element.removeAttribute("hidden"));
        previous.forEach((element) => element.removeAttribute("hidden"));
    } else {
        next.forEach((element) => element.setAttribute("hidden", ""));
        previous.forEach((element) => element.setAttribute("hidden", ""));
    }
};

/* hide and show timeseries chart or table selection buttons
 */

const timeSeriesButtonsVisibility = (visible) => {
    const timeseries = document.querySelectorAll("button.timeseries");
    if (visible == true) {
        timeseries.forEach((element) => element.removeAttribute("hidden"));
    } else {
        timeseries.forEach((element) => element.setAttribute("hidden", ""));
    }
};

/* support bit-broker response pagination
 */

const nextPage = () => {
    page(true);
};

const previousPage = () => {
    page(false);
};

const page = (up) => {
    let newUrl = new URL(previousUrl)
    let urlType = bbkUrlType(previousUrl);
    if (urlType == BBK_CATALOG || urlType == BBK_ENTITY_TYPE) {

        let newOffset = 0;
        let newLimit = default_limit;
        if (newUrl.searchParams.has("offset")) {
            newOffset = parseInt(newUrl.searchParams.get("offset"));
        }

        if (up) {
            newOffset += newLimit;
        } else {
            newOffset -= newLimit;
            if (newOffset < 0) {
                newOffset = 0;
            }
        }
        newUrl.searchParams.set("offset", newOffset);
        newUrl.searchParams.set("limit", newLimit);

    } else if (urlType == BBK_TIMESERIES) {

        /* Timeseries paging is different to regular API paging in one key respect; whilst we still have a limit, there is no offset, so we have to use start & duration
            instead. Here we try to determine a default duration by looking at the interval across the data points in the initial timeseries data page.
            This approach has limitations in the presence of timeseries data with gaps. This implementation has some issues when handling time periods which arent a constant multiple of seconds / 
+            milliseonds (e.g. months / years) - i.e. it doesnt always calculate an exact number of years.
        */

        let durationSecs = 0;
        if (latestTimeseries != 0) { // we have a non-empty results set we can use to determine a duration...
            let totalInterval = moment.duration(moment(latestTimeseries.toString()).diff(moment(earliestTimeseries.toString())));
            durationSecs = totalInterval.asSeconds();
        }

        newUrl.searchParams.set("limit", timeseries_limit);
        if (newUrl.searchParams.has("duration")) {
            durationSecs = parseInt(newUrl.searchParams.get("duration"));
        } else {
            newUrl.searchParams.set("duration", durationSecs);
        }

        if (up) {
            let newStart = moment(earliestTimeseries.toString()).add(durationSecs, 's');
            if (latestTimeseries == 0) { // last results set empty
                newStart = moment(earliestTimeseries.toString());
            }
            newUrl.searchParams.set("start", newStart.toISOString());

        } else {
            let newStart = moment(earliestTimeseries.toString()).subtract(durationSecs, 's');
            if (latestTimeseries == 0) { // last results set empty
                newStart = moment(earliestTimeseries.toString());
            }

            newUrl.searchParams.set("start", newStart.toISOString());
        }

    }
    consumerAPIFetch(newUrl.toString());
};

/* populate Policy Dropdown
 */

const policyDropdownValue = (policies) => {
    const ul = document.getElementById("policyDropDown");
    policies.forEach((policy) => {
        const item = document.createElement("a");
        item.setAttribute("class", "dropdown-item");
        item.setAttribute("id", "dropdown-" + policy.id);
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
        item.innerHTML = query.name;
        const li = document.createElement("li");
        li.appendChild(item);
        ul.appendChild(li);
    });
};

/* copy baseurl as curl
 */

const copyCurlToClipBoard = (url) => {
    let curlUrl =
        "curl" +
        " \"" +
        url +
        "\" " +
        "-X" +
        " " +
        "GET" +
        " " +
        "-H" +
        " " +
        "x-bbk-auth-token:" +
        myToken;

    if (devShimMode) {
        curlUrl +=
            " " +
            "-H" +
            " " +
            "x-bbk-audience:" +
            myPolicy;
    }
    navigator.clipboard.writeText(curlUrl).catch((err) => {
        console.error("copyCurlToClipBoard error: ", err);
    })
}

/* update the browser url to reflect a BBK Url
 */

const updateBrowserUrl = (bbkUrl) => {
    let newUrl = bbkUrltoAppUrl(bbkUrl);
    window.history.replaceState(null, null, newUrl.toString());
};

function mergeQueryParam(url, name, value) {
    if (!value) {
        url.searchParams.delete(name);
        return;
    }
    url.searchParams.set(name, value);
}

/* generate an app URL (with equivalent url params) from a BBK url
 */

const bbkUrltoAppUrl = (bbkUrl) => {
    let appUrl = new URL(window.location);

    appUrl.searchParams.forEach(function(value, key) {
        appUrl.searchParams.delete(key);
    });
    // seem to need to explicitly delete this query param?!
    appUrl.searchParams.delete(QUERY_PARAM_CATALOG);

    mergeQueryParam(appUrl, QUERY_PARAM_POLICY, myPolicy);

    if (bbkUrl.indexOf(baseURL) == 0) {
        let nonBaseUrl = bbkUrl.substring(baseURL.length);
        if (nonBaseUrl.indexOf("/") == 0) {
            nonBaseUrl = nonBaseUrl.substring(1);

        }
        let splitUrl = nonBaseUrl.split("/");
        if (splitUrl[0].indexOf("catalog") == 0) {
            let queryUrl = new URL(bbkUrl);
            if (queryUrl.searchParams.has(QUERY_PARAM_CATALOG)) {
                let query = queryUrl.searchParams.get(QUERY_PARAM_CATALOG);
                mergeQueryParam(appUrl, QUERY_PARAM_CATALOG, query);
            }
        } else if (splitUrl[0].indexOf(QUERY_PARAM_ENTITY_TYPE) == 0) {
            // extract entity
            let entityType = splitUrl[1];
            if (entityType.indexOf("?") >= 0) {
                entityType = entityType.substring(0, entityType.indexOf("?"));
            }
            mergeQueryParam(appUrl, QUERY_PARAM_ENTITY_TYPE, entityType);

            if (splitUrl.length > 2) {
                let entityId = splitUrl[2];
                if (entityId.indexOf("?") >= 0) {
                    entityId = entityId.substring(0, entityId.indexOf("?"));
                }
                mergeQueryParam(appUrl, QUERY_PARAM_ENTITY_ID, entityId);

                if (splitUrl.length > 4 && splitUrl[3].indexOf("timeseries") == 0) {
                    let timeseries = splitUrl[4];
                    if (timeseries.indexOf("?") >= 0) {
                        timeseries = timeseries.substring(0, timeseries.indexOf("?"));
                    }
                    mergeQueryParam(appUrl, QUERY_PARAM_TIMESERIES, timeseries);
                }
            }
        }
    }
    return appUrl;
};

/* determine type of BBK Consumer API call from url (bbkUrl is typeof string)
 */

const bbkUrlType = (bbkUrl) => {
    let bbkUrlType = null;

    if (bbkUrl.indexOf(baseURL) == 0) {
        let nonBaseUrl = bbkUrl.substring(baseURL.length);
        if (nonBaseUrl.indexOf("/") == 0) {
            nonBaseUrl = nonBaseUrl.substring(1);
        }
        let splitUrl = nonBaseUrl.split("/");
        if (splitUrl[0].indexOf("catalog") == 0) {
            bbkUrlType = BBK_CATALOG;
        } else if (splitUrl[0].indexOf(QUERY_PARAM_ENTITY_TYPE) == 0) {
            bbkUrlType = BBK_ENTITY_TYPE;
            if (splitUrl.length > 2) {
                bbkUrlType = BBK_ENTITY_INSTANCE;
                if (splitUrl.length > 4 && splitUrl[3].indexOf("timeseries") == 0) {
                    bbkUrlType = BBK_TIMESERIES;
                }
            }
        }
    }
    return bbkUrlType;
};

/* Handle url params...
 *
 *   Policy      policy=policy-slug
 *   Catalog:    q= (i.e. exactly per the catalog api)
 *   Entity:     entity=country
 *              entity=country&id=db1cb554f3136d9b72d8d3695f9bfaef2c9c62c3
 *   Timeseries: entity=country&id=db1cb554f3136d9b72d8d3695f9bfaef2c9c62c3&ts=population
 */

const handleUrlParams = () => {
    const params = new URLSearchParams(window.location.search);

    const catalog = params.get(QUERY_PARAM_CATALOG);
    const policy = params.get(QUERY_PARAM_POLICY);
    const entityType = params.get(QUERY_PARAM_ENTITY_TYPE);
    const entityId = params.get(QUERY_PARAM_ENTITY_ID);
    const timeseries = params.get(QUERY_PARAM_TIMESERIES);

    if (catalog) {
        queryCatalog.value = catalog;
    }
    if (policy) {
        // NB we need a valid policy to be able to make the API call...
        const policyOpt = document.getElementById("dropdown-" + policy);
        if (policyOpt) {
            policyOpt.click();
        }
        let url = null;
        if (catalog) {
            let query = encodeURIComponent(catalog);
            url = `${baseURL}/catalog?q=${query}`;
        } else if (entityType) {
            url = `${baseURL}/entity/${entityType}`;
            if (entityId) {
                url = `${baseURL}/entity/${entityType}/${entityId}`;
                if (timeseries) {
                    url = `${baseURL}/entity/${entityType}/${entityId}/timeseries/${timeseries}`;
                }
            }
        }
        if (url) {
            consumerAPIFetch(url);
        } else {
            console.warn("Couldn't parse actionable bitbroker url from app url");
        }
    }
};

// /* toggle timeseries button
//  */

const toggleTimeseries = () => {
    const timeseries = document.querySelectorAll("button.timeseries");
    const timeseriesTable = document.querySelector(".timeseriesTable");
    const timeseriesChart = document.querySelector(".timeseriesChart");
    if (timeseriesTable && timeseriesChart) {
        if (timeseriesChartState === true) {
            timeseriesChartState = false
            timeseriesTable.style.display = "block";
            timeseriesChart.style.display = "none";
            timeseries.forEach(
                (element) => (element.innerText = "View Timeseries Chart")
            );
        } else {
            timeseriesChartState = true
            timeseriesChart.style.display = "block";
            timeseriesTable.style.display = "none";
            timeseries.forEach(
                (element) => (element.innerText = "View Timeseries Table")
            );
        }
    }
};

/* on DOM fully loaded and parsed...
 */

window.addEventListener("DOMContentLoaded", (event) => {
    fetch("./config/config.json")
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((config) => {
        baseURL = config.baseUrl;
        devShimMode = config.devShimMode;
        document.getElementById("baseurl").value = baseURL;
        document.getElementById("devModeCheckBox").checked = devShimMode;


        policyDropdownValue(config.policies);

        let policyOpts = document.querySelectorAll(
            "#policyDropDown .dropdown-item"
        );
        policyOpts.forEach((element) =>
            element.addEventListener("click", function() {
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
        handleUrlParams();
    })
    .catch(console.error);

    queryDropdownValue(queries);

    let queryOpts = document.querySelectorAll("#queryDropDown .dropdown-item");
    queryOpts.forEach((element) =>
        element.addEventListener("click", function() {
            let text = element.innerText;
            let query = queries.find((e) => e.name === text);
            const queryCatalog = document.getElementById("queryCatalog");
            queryCatalog.value = query.query;
        })
    );

    const next = document.querySelectorAll("button.next");
    next.forEach((element) =>
        element.addEventListener("click", (event) => nextPage())
    );


    const previous = document.querySelectorAll("button.previous");
    previous.forEach((element) =>
        element.addEventListener("click", (event) => previousPage())
    );



    const timeseries = document.querySelectorAll("button.timeseries");
    timeseries.forEach((element) =>
        element.addEventListener("click", (event) => toggleTimeseries())
    );



    const go = document.getElementById("go");

    go.addEventListener("click", (event) => {
        let query = encodeURIComponent(queryCatalog.value);
        consumerAPIFetch(`${baseURL}/catalog?q=${query}`);
    });

    const token = document.getElementById("token");
    token.addEventListener("change", (event) => (myToken = event.target.value));

    const limit = document.getElementById("limit");
    limit.addEventListener("change", (event) => {
        if (limit.value > 250 || limit.value < 1) {
            alert('Limit value must be greater than 1 and less than 250');
        }
        if (!isNaN(parseFloat(limit.value))) {
            default_limit = Math.round(event.target.value)
        } else {
            default_limit = event.target.value
        }
    })

    const devModeCheckBox = document.getElementById("devModeCheckBox");
    devModeCheckBox.addEventListener("change", (event) => {
        devShimMode = devModeCheckBox.checked;
    });

    const baseurlInput = document.getElementById("baseurl");
    baseurlInput.addEventListener("change", (event) => (baseURL = event.target.value));

    const copyCurl = document.getElementById("idCopyCurlButton");
    copyCurl.addEventListener("click", function(e) {
        copyCurlToClipBoard(e.target.getAttribute("data-link"));
    });
});
