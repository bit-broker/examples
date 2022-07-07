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
It can also subsitute a specified connector id into bbk:// urls for a specified entity property.

The webhook conditionally fetches some extra entity data dynamically (from wikidata), and merges 
it in the response.

The webhook also supports timeseries data where available on an entity (JSON source data only)

If you do not know what a data connector is, please contact the controller
of your bbk instance.

*/

'use strict'; // also code assumes ECMAScript 6

// --- dependencies

require('dotenv').config();
const fetch = require('node-fetch');
const moment = require('moment');
const _ = require('lodash');
const XLSX = require("xlsx");

// --- local bbk libaries

var BBKCatalog = require('./bbk-catalog.js');
var BBKWebhook = require('./bbk-webhook.js');

// --- global constants

const CATALOG_HOST = process.env.CATALOG_HOST;
const CONNECTOR_ID = process.env.CONNECTOR_ID;
const AUTHORIZE_KEY = process.env.AUTHORIZE_KEY;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT;
const ENTITY_TYPE = process.env.ENTITY_TYPE;
const DATA_URL = process.env.DATA_URL;
const DATA_FORMAT = process.env.DATA_FORMAT;
const ENTITY_REF_CID = process.env.ENTITY_REF_CID;
const ENTITY_REF_PROP = process.env.ENTITY_REF_PROP;

let data = [];

// --- example catalog updater class

class MyCatalog extends BBKCatalog {
    // --- constructs the catalog object

    constructor() {
        super(CATALOG_HOST, CONNECTOR_ID, AUTHORIZE_KEY);
    }

    // --- converts a 'flat' spreadsheet row to BBK entity structure

    rowToBBKData(record) {
        let recordKeys = Object.keys(record);
        record.entity = {}
        record.instance = {}
        recordKeys.forEach((key, index) => {
            if ((key !== 'id') && (key !== 'name') && key.indexOf('_') != 0) {
                let modKey = key
                const entityPrefix = 'entity/'
                const instancePrefix = 'instance/'
                if (key.indexOf(entityPrefix) == 0) {
                    modKey = key.substring(entityPrefix.length);
                    record.entity[modKey] = record[key]
                } else if (key.indexOf(instancePrefix) == 0) {
                    modKey = key.substring(instancePrefix.length);
                    record.instance[modKey] = record[key]
                } else { // fallback for anything unprefixed; assume it is entity data
                    record.entity[modKey] = record[key]
                }
                delete record[key]
            }
        });
        if ((record.entity.hasOwnProperty("longitude")) && (record.entity.hasOwnProperty("latitude"))) {
            record.entity.location = {
                "type": "Point",
                "coordinates": [
                    record.entity.longitude,
                    record.entity.latitude
                ]
            }
            delete record.entity.longitude;
            delete record.entity.latitude;;
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

            // replace referenced entity connector id in bbk:// url property if specified
            if (ENTITY_REF_CID && ENTITY_REF_PROP) {
                json.forEach(record => {
                    let prop = _.get(record, ENTITY_REF_PROP);
                    if (prop && prop.indexOf('bbk://') == 0) {
                        let newProp = prop.replace('{cid}', ENTITY_REF_CID)
                        _.set(record, ENTITY_REF_PROP, newProp );
                    }
                });
            }
          
            data = _.cloneDeep(json); ; // make raw json data available to webhook callbacks...
            
            json.forEach(record => {
                let removeList  = Object.keys(record).filter(v => v.startsWith("_"));
                removeList.forEach(key => delete record[key]);
            });
            return json
        })
        .then(items => {
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
      requested entity from cached data loaded from the file at startup. We also conditionally 
      fetch some extra entity data dynamically (from wikidata), and merge it in the response.

    */

    entity(eid, cb) // provides us back with our own entity key
    {
        var record = data.find(x => x.id === eid)
        if (record) {
            if (record.hasOwnProperty('_wikidata')) {
                // A full list is here: https://www.wikidata.org/wiki/Q142
                let query_str = `SELECT ?country ?flag WHERE { ?country wdt:P41 ?flag VALUES ?country { wd:${record._wikidata} } }`;
                let url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query_str)}&format=json`;
                fetch(url)
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(text => { throw new Error(text) })
                    }
                    return response;
                })
                .then(res => res.json())
                .then(json => {
                    let clean_record = _.cloneDeep(record)
                    let removeList  = Object.keys(clean_record).filter(v => v.startsWith("_"));
                    removeList.forEach(key => delete clean_record[key]);
                    if (json?.results?.bindings[0]?.flag?.value !== undefined) {
                        clean_record.entity.flag = json.results.bindings[0].flag.value;
                    }
                    cb(clean_record); 
                })
                .catch(function(err) {
                    const reason = new Error(`webhook error`);
                    reason.stack += `\nCaused By:\n` + err.stack;
                    console.error(reason);
                    cb(null); // will HTTP/404
                });
            } else {
                let clean_record = _.cloneDeep(record)
                let removeList  = Object.keys(clean_record).filter(v => v.startsWith("_"));
                removeList.forEach(key => delete clean_record[key]);
                cb(clean_record); 
            }
        } else {
            cb(null); // will HTTP/404
        }
    }

    /*
      >>> IMPLEMENTATION NOTE <<<

      In this example timeseries webhook, we provide timeseries information about the requested entity 
      (the timeseris data is stored in our data set prefixed with an '_'). 
    */

    timeseries(eid, tsid, start, end, limit, cb) // provides us back with our own entity and timeseries key
    {
        var record = data.find(x => x.id === eid)
        if (record) {
            let ts_prop = `_${ tsid }`; // stored in test data with a leading underscore
            if (record.hasOwnProperty(ts_prop)) {

                let timeseries = record[ts_prop] || [];

                if (start) {
                    timeseries = timeseries.filter(i => moment(i.from.toString()).isSameOrAfter(start));
                }

                if (end) {
                    timeseries = timeseries.filter(i => moment(i.from.toString()).isBefore(end));
                }

                if (limit) {
                    timeseries = timeseries.slice(0, limit);
                }

                cb(timeseries);
            } else {
                console.warn(`timeseries property ${ts_prop} not found`);
                cb([]); // no timeseries match
            }
        } else {
            console.warn(`entity ${eid} not found`);
            cb([]); // no entity match
        }
    }
}

new MyCatalog().upsert();

/*
  >>> IMPLEMENTATION NOTE <<<

  Here we start a webhook to listen for data requests from bbk. In your
  implementation, you may decide not to have a webhook, if you choose to push
  all your data into the bbk catalog instead.
*/

new MyWebhook({ name: "BBK File Example Connector", entity: ENTITY_TYPE, connectorId: CONNECTOR_ID }).listen(WEBHOOK_PORT, () => {
    console.log(`Webhook is listening on port ${ WEBHOOK_PORT }`);
});
