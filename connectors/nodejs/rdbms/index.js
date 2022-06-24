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

It provides data from a database (PostGreSQL) data source.
On starting the connector, it loads the dataset, upserts the data to the catalog, and makes a webhook available.
It can also subsitute a specified connector id into bbk:// urls for a specified entity property

The webhook conditionally fetches some extra entity data dynamically (from wikidata), and merges 
it in the response.

Th webhook also supports timeseries data for country / population data.

If you do not know what a data connector is, please contact the controller
of your bbk instance.

*/

'use strict'; // also code assumes ECMAScript 6

// --- dependencies

require('dotenv').config();
const fetch = require('node-fetch');
const moment = require('moment');
const _ = require('lodash');

// --- local bbk libaries

var BBKCatalog = require('./bbk-catalog.js');
var BBKWebhook = require('./bbk-webhook.js');

// --- global constants

const CATALOG_HOST = process.env.CATALOG_HOST;
const CONNECTOR_ID = process.env.CONNECTOR_ID;
const AUTHORIZE_KEY = process.env.AUTHORIZE_KEY;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT;
const ENTITY_TYPE = process.env.ENTITY_TYPE;
const FILTER = process.env.FILTER;
const ENTITY_REF_CID = process.env.ENTITY_REF_CID;
const ENTITY_REF_PROP = process.env.ENTITY_REF_PROP;

// --- DB connection (pool setting to allow retry if DB service initially unavailable)

const pool = {
    "min": 2,
    "max": 6,
    "createTimeoutMillis": 3000,
    "acquireTimeoutMillis": 30000,
    "idleTimeoutMillis": 30000,
    "reapIntervalMillis": 1000,
    "createRetryIntervalMillis": 100,
    "propagateCreateError": false
};

const db = require('knex')({ client: 'pg', connection: process.env.CONNECTOR_DATABASE, pool: pool });

// --- converts a record to BBK entity structure

function recordToBBKData(record) {
    record.properties.id = record.id.toString();

    // replace referenced entity connector id in bbk:// url property if specified
    if (ENTITY_REF_CID && ENTITY_REF_PROP) {
        let prop = _.get(record.properties, ENTITY_REF_PROP);
        if (prop && prop.indexOf('bbk://') == 0) {
            let newProp = prop.replace('{cid}', ENTITY_REF_CID)
            _.set(record.properties, ENTITY_REF_PROP,newProp );
        }
    }

    const {
        ['_wikidata']: deletedKey, ...otherKeys
    } = record.properties;
    return otherKeys
}

// --- example catalog updater class

class MyCatalog extends BBKCatalog {
    // --- constructs the catalog object

    constructor() {
        super(CATALOG_HOST, CONNECTOR_ID, AUTHORIZE_KEY);
    }

    // --- fetch and upsert data into BBK catalog

    upsert() {
        console.log(`loading data from db (table ${ENTITY_TYPE})`);

        db.select('id', 'properties').table(ENTITY_TYPE)
        .then(json => {
            let dataSet = json.map((response) => recordToBBKData(response));
            if (FILTER == "CATEGORY_EQ_NATURAL") {
                dataSet = dataSet.filter((i => i.entity.category == "natural"))
            } else if (FILTER == "CATEGORY_EQ_CULTURAL") {
                dataSet = dataSet.filter((i => i.entity.category == "cultural"))
            }
            return dataSet
        })
        .then(items => {
            console.log(`loaded ${items.length} items from db...`);
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
      requested entity from the database. We also conditionally 
      fetch some extra entity data dynamically (from wikidata), and merge it in the response.

    */

    entity(eid, cb) // provides us back with our own entity key
    {
        db.select('id', 'properties').where('id', eid).table(ENTITY_TYPE)
        .then(items => {
            if (items.length > 0) {
                if (items[0]?.properties?._wikidata !== undefined) {
                    // A full list is here: https://www.wikidata.org/wiki/Q142
                    let query_str = `SELECT ?country ?flag WHERE { ?country wdt:P41 ?flag VALUES ?country { wd:${items[0].properties._wikidata} } }`;
                    let url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query_str)}&format=json`;
                    return fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            return response.text().then(text => { throw new Error(text) })
                        }
                        return response;
                    })
                    .then(res => res.json())
                    .then(json => {
                        let entity = recordToBBKData(items[0])
                        if (json?.results?.bindings[0]?.flag?.value !== undefined) {
                            entity.entity.flag = json.results.bindings[0].flag.value;
                        }
                        cb(entity);
                    })
                } else {
                    cb(recordToBBKData(items[0]));
                    return;
                }
            } else {
                cb(null); // will HTTP/404
                return;
            }
        })
        .catch(function(err) {
            const reason = new Error(`webhook entity error`);
            reason.stack += `\nCaused By:\n` + err.stack;
            console.error(reason);
            cb(null); // will HTTP/404
        });
    }

    /*
      >>> IMPLEMENTATION NOTE <<<

      In this example timeseries webhook, we provide timeseries information about the requested entity 
      We only handle a specific timeseries ('population'), which is queried from a specific db table.
    */

    timeseries(eid, tsid, start, end, limit, cb) // provides us back with our own entity and timeseries key
    {
        if (tsid === 'population') {
            db.select('ts_from as from', 'ts_value as value').where('entity_id', eid).orderBy('ts_from', 'asc').table('annual_pop_ts')
            .modify(function(queryBuilder) {

                if (start) {
                    queryBuilder.where('ts_from', '>=', moment(start).year());
                }

                if (end) {
                    queryBuilder.where('ts_from', '<', moment(end).year());
                }

                if (limit) {
                    queryBuilder.limit(limit);
                }
            })
            .then(json => cb(json))
            .catch(function(err) {
                const reason = new Error(`webhook timeseries error`);
                reason.stack += `\nCaused By:\n` + err.stack;
                console.error(reason);
                cb([]); // will HTTP/404
            });
        } else {
            cb([]); // no timeseries match
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

new MyWebhook({ name: "BBK RDBMS Example Connector", entity: ENTITY_TYPE, connectorId: CONNECTOR_ID }).listen(WEBHOOK_PORT, () => {
    console.log(`Webhook is listening on port ${ WEBHOOK_PORT }`);
});
