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

/*

This is an example BitBroker data connector.

This code is intended to help people implementing a data connector for their own entity types.

It provides data from a file-based data sources, loaded over REST at start up.
It supports JSON formatted data, or, spreadsheet data (xlsx, csv et al) through the XLSX node module.
On loading the dataset, it upserts the data to the catalog, and makes a webhook available.

If you do not know what a data connector is, please contact the controller
of your bbk instance.

*/

'use strict'; // also code assumes ECMAScript 6

// --- dependencies

require('dotenv').config();
const fetch = require('node-fetch');
const XLSX = require("xlsx");

// --- local bbk libaries

var BBKCatalog = require('./bbk-catalog.js');
var BBKWebhook = require('./bbk-webhook.js');

// --- global constants

const CATALOG_HOST = process.env.CATALOG_HOST;
const CONNECTOR_ID = process.env.CONNECTOR_ID;
const AUTHORIZE_KEY = process.env.AUTHORIZE_KEY;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT;
const DATA_URL = process.env.DATA_URL;
const DATA_FORMAT = process.env.DATA_FORMAT;

let data = [];

// --- example catalog updater class

class MyCatalog extends BBKCatalog {
    // --- constructs the catalog object

    constructor() {
        super(CATALOG_HOST, CONNECTOR_ID, AUTHORIZE_KEY);
    }

    // --- converts a 'flat' spreadsheet row to BBK entity structure

    rowToBBKData(entity) {
        let entityKeys = Object.keys(entity);
        entity.entity = {}
        entity.instance = {}
        entityKeys.forEach((key, index) => {
            if ((key !== 'id') && (key !== 'name')) {
                let modKey = key
                const entityPrefix = 'entity/'
                const instancePrefix = 'instance/'
                if (key.indexOf(entityPrefix) == 0) {
                    modKey = key.substring(entityPrefix.length);
                    entity.entity[modKey] = entity[key]
                } else if (key.indexOf(instancePrefix) == 0) {
                    modKey = key.substring(instancePrefix.length);
                    entity.instance[modKey] = entity[key]
                } else { // fallback for anything unprefixed; assume its entity data
                    entity.entity[modKey] = entity[key]
                }
                delete entity[key]
            }
        });
        if ((entity.entity.hasOwnProperty("longitude")) && (entity.entity.hasOwnProperty("latitude"))) {
            entity.entity.location = {
                "type": "Point",
                "coordinates": [
                    entity.entity.longitude,
                    entity.entity.latitude
                ]
            }
            delete entity.entity.longitude;
            delete entity.entity.latitude;;

        }
    }

    // --- fetch and upsert data into BBK catalog

    upsert() {
        console.log(`fetching ${DATA_FORMAT} format data from ${DATA_URL}`);
        fetch(DATA_URL)
        .then(this.handleFetchErrors.bind(this))
        .then(res => {
            if (DATA_FORMAT == 'json') {
                return res.json()
            } else {
                return res.arrayBuffer()
                .then(buf => {
                    const workbook = XLSX.read(buf);
                    // read first sheet only...
                    console.log("parsing sheet: " + workbook.SheetNames[0])
                    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    // marshall data into BBK compatible structure
                    console.log(sheetData.length + " items...");
                    sheetData.forEach(entity => this.rowToBBKData(entity))
                    return sheetData
                })
            }
        })
        .then(json => {
            return json.map(({ _population, _wikidata, ...item }) => item);
        })
        .then(items => {
            data = items; // make json data available to webhook callbacks...
            return this.session(BBKCatalog.SESSION_STREAM, BBKCatalog.ACTION_UPSERT, items)

        })
        .catch(function(err) {
            const reason = new Error(`session error`);
            reason.stack += `\nCaused By:\n` + err.stack;
            console.error(reason);
            return reason;
        });
    }
}

// --- example webhook listener class

class MyWebhook extends BBKWebhook {
    /*
      >>> IMPLEMENTATION NOTE <<<

      In this example entity webhook, we provide basic information about the
      requested entity. In this example code we just return the base data, but
      you can load and merge data from your downstream data source.

    */

    entity(eid, cb) // provides us back with our own entity key
    {
        var record = data.find(x => x.id === eid)
        if (record !== undefined) {
            cb(record);
        } else {
            cb(null); // will HTTP/404
        }
    }

    /*
      >>> IMPLEMENTATION NOTE <<<

      In this example entity webhook, we provide timeseries information about
      the requested country. In this example code we just return random data,
      but you can load from your downstream data source.
    */

    timeseries(eid, tsid, limit, from, to, cb) // provides us back with our own entity and timeseries key
    {
        cb(null); // will HTTP/404
    }
}

new MyCatalog().upsert();

/*
  >>> IMPLEMENTATION NOTE <<<

  Here we start a webhook to listen for data requests from bbk. In your
  implementation, you may decide not to have a webhook, if you choose to push
  all your data into the bbk catalog instead.
*/

new MyWebhook().listen(WEBHOOK_PORT, () => {
    console.log(`Webhook is listening on port ${ WEBHOOK_PORT }`);
});
