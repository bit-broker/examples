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
 */

// Constants

const BBK_CATALOG = 1;
const BBK_ENTITY_TYPE = 2;
const BBK_ENTITY_INSTANCE = 3;
const BBK_TIMESERIES = 4;

const default_limit = 10;

const queries = [{
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
        query: '{"type":"country","name":{"$nin":["United Kingdom","Atlantis","India","France"]}}',
    },
    {
        name: "Within 250km of New York",
        query: '{ "entity.location": { "$near": { "$geometry": {"type": "Point","coordinates": [-74.0060, 40.71281] },"$min": 0, "$max": 250000 }}}',
    },
];

// Global Vars

let myToken = null;
let myPolicy = null;

let baseURL = "";
let previousUrl = "";

/* Convert http(s) urls to clickable links inline
 */

const clickLink = (jsonString) => {
    const urlRegex = /(\"https?:\/\/[^\s]+\")/g;

    return jsonString.replace(urlRegex, function(url) {
        let unQuotedUrl = url.substring(1, url.length - 1);
        return `<a href="${unQuotedUrl}">${unQuotedUrl}</a>`;
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
    copyCurl.removeAttribute('hidden');
    copyCurl.setAttribute("data-link", url);
};

/* Render bit-broker Timeseries info in entity view
 */

const renderTS = (ts) => {
    const container = document.createElement("div");
    container.classList.add("container");
    container.style.padding = '0';
    
    Object.entries(ts).forEach(([key, value]) => {

        const row = document.createElement("div");
        row.classList.add("row");
        const propName = document.createElement("div");
        propName.classList.add("col-md-2", "fw-bold");

        propName.textContent = "timeseries";
        propName.appendChild(bbkUrl(value.url, key));
        row.appendChild(propName);

        const propValue = document.createElement("div");
        propValue.classList.add("col-md-10");

        const jsonPre = document.createElement("pre");
        const code = document.createElement("code");
        code.classList.add("language-json");
        delete value.url;
        code.innerHTML = JSON.stringify(value, null, 2);
        jsonPre.appendChild(code);
        propValue.appendChild(jsonPre);
        Prism.highlightElement(code);
        row.appendChild(propValue);
       
        container.appendChild(row)
    });

    return container;
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
    propName.textContent = prop;
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
        code.innerHTML = jsonString;
        jsonPre.appendChild(code);
        propValue.appendChild(jsonPre);
        Prism.highlightElement(code);
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

    const labels = result.map(function(e) {
        return e.from;
    });

    const data = result.map(function(e) {
        return e.value;
    });

    const ctx = canvas.getContext("2d");
    const myChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Yearly Population",
                fill: true,
                lineTension: 0.1,
                backgroundColor: "rgba(0, 119, 204, 0.3)",
                borderColor: "#00008b",
                fontColor: "#00008b",
                data: data,
            }, ],
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

    const requestOptions = {
        method: "GET",
        headers: {
            "x-bbk-auth-token": myToken,
            "x-bbk-audience": myPolicy,
        },
    };

    let urlType = bbkUrlType(url);

    // put in paging defaults for non timeseries API calls that return an array
    if ((urlType == BBK_CATALOG) || (urlType == BBK_ENTITY_TYPE)) {
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

    updateBrowserUrl(url);
    previousUrl = url;

    fetch(url, requestOptions)
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data) => {
        results.innerHTML = "";
        spinner.setAttribute("hidden", "");
        const apiUrl = document.getElementById("idApiUrl");
        apiUrl.value = previousUrl;
        updateCopyCurlButton(previousUrl);
        
        paginationVisibility(((urlType == BBK_CATALOG) || (urlType == BBK_ENTITY_TYPE)) ? true : false);

        if (Array.isArray(data)) {
            if (url.indexOf("timeseries") >= 0) {
                results.append(formatTimeSeriesChart(data));
            } else {
                data.forEach((item) => {
                    results.append(formatResponse(item));
                });
            }
        } else {
            results.append(formatResponse(data));
        }
    })

    .catch(console.error);
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

/* support bit-broker response pagination
 */

const nextPage = () => {
    page(true);
};

const previousPage = () => {
    page(false);
};

const page = (up) => {
    let newUrl = new URL(previousUrl);
    let newOffset = 0;
    let newLimit = default_limit;
    if (newUrl.searchParams.has("offset")) {
        newOffset = parseInt(newUrl.searchParams.get("offset"));
    }
    if (newUrl.searchParams.has("limit")) {
        newLimit = parseInt(newUrl.searchParams.get("limit"));
    }

    if (up) {
        newOffset += newLimit;
    } else {
        newOffset -= newLimit;
    }
    newUrl.searchParams.set("offset", newOffset);
    newUrl.searchParams.set("limit", newLimit);

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
        console.error("copyCurlToClipBoard error: ", err);
    });
};


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
    appUrl.searchParams.delete('q');

    mergeQueryParam(appUrl, 'policy', myPolicy);

    if (bbkUrl.indexOf(baseURL) == 0) {
        let nonBaseUrl = bbkUrl.substring(baseURL.length);
        if (nonBaseUrl.indexOf('/') == 0) {
            nonBaseUrl = nonBaseUrl.substring(1);
        }
        let splitUrl = nonBaseUrl.split('/');
        if (splitUrl[0].indexOf('catalog') == 0) {
            let queryUrl = new URL(bbkUrl);
            if (queryUrl.searchParams.has("q")) {
                let query = queryUrl.searchParams.get("q");
                mergeQueryParam(appUrl, 'q', query);
            }
        } else if (splitUrl[0].indexOf('entity') == 0) {
            // extract entity
            let entityType = splitUrl[1];
            if (entityType.indexOf('?') >= 0) {
                entityType = entityType.substring(0, entityType.indexOf('?'));
            }
            mergeQueryParam(appUrl, 'entity', entityType);

            if (splitUrl.length > 2) {
                let entityId = splitUrl[2];
                if (entityId.indexOf('?') >= 0) {
                    entityId = entityId.substring(0, entityId.indexOf('?'));
                }
                mergeQueryParam(appUrl, 'id', entityId);

                if ((splitUrl.length > 4) && (splitUrl[3].indexOf('timeseries') == 0)) {

                    let timeseries = splitUrl[4];
                    if (timeseries.indexOf('?') >= 0) {
                        timeseries = timeseries.substring(0, timeseries.indexOf('?'));
                    }
                    mergeQueryParam(appUrl, 'timeseries', timeseries);
                }
            }
        }
    }
    return appUrl;
}

/* determine type of BBK Consumer API call from url
 */

const bbkUrlType = (bbkUrl) => {

    let bbkUrlType = null;

    if (bbkUrl.indexOf(baseURL) == 0) {
        let nonBaseUrl = bbkUrl.substring(baseURL.length);
        if (nonBaseUrl.indexOf('/') == 0) {
            nonBaseUrl = nonBaseUrl.substring(1);
        }
        let splitUrl = nonBaseUrl.split('/');
        if (splitUrl[0].indexOf('catalog') == 0) {
            bbkUrlType = BBK_CATALOG;
        } else if (splitUrl[0].indexOf('entity') == 0) {
            bbkUrlType = BBK_ENTITY_TYPE;
            if (splitUrl.length > 2) {
                bbkUrlType = BBK_ENTITY_INSTANCE;
                if ((splitUrl.length > 4) && (splitUrl[3].indexOf('timeseries') == 0)) {
                    bbkUrlType = BBK_TIMESERIES;
                }
            }
        }
    }
    return bbkUrlType;
}

/* Handle url params...
 *
 *   Policy      policy=policy-slug
 *   Catalog:    q= (i.e. exactly per the catalog api)
 *   Entity:     entity=country
 *              entity=country&id=db1cb554f3136d9b72d8d3695f9bfaef2c9c62c3
 *   Timeseries: entity=country&id=db1cb554f3136d9b72d8d3695f9bfaef2c9c62c3&timeseries=population
 */

const handleUrlParams = () => {

    const params = new URLSearchParams(window.location.search);

    const catalog = params.get('q');
    const policy = params.get('policy');
    const entityType = params.get('entity');
    const entityId = params.get('id');
    const timeseries = params.get('timeseries');

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
        document.getElementById("baseurl").value = baseURL;

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

    const go = document.getElementById("go");

    go.addEventListener("click", (event) => {
        let query = encodeURIComponent(queryCatalog.value);
        consumerAPIFetch(`${baseURL}/catalog?q=${query}`);
    });

    const token = document.getElementById("token");
    token.addEventListener("change", (event) => (myToken = event.target.value));

    const copyCurl = document.getElementById("idCopyCurlButton");
    copyCurl.addEventListener("click", function(e) {
        copyCurlToClipBoard(e.target.getAttribute("data-link"));
    });
});
