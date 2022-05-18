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

This file is an example implementation of a data connector webhook servicing
requests from a bbk catalog. Data connector authors can derive from this
class to provide webhook services to their designated catalog. Derived
classes need only provide overridden implementation of the following methods:

* entity (eid, cb)
* timeseries (eid, tsid, limit, from, to, cb)

If you do not know what such a webhook is for, please contact the controller
of your bbk instance.

*/

'use strict'; // also code assumes ECMAScript 6

// --- dependancies

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');

// --- bbk webhook class (exported)

module.exports = class BBKWebhook {
    // --- standard HTTP responses

    static _http_std_response(res, code, msg) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(code);
        res.send(`${ code }: ${ msg }`);
    }

    // --- we only list responses that are actually used

    static _http_bad_request(res) { BBKWebhook._http_std_response(res, 400, 'Bad Request'); };
    static _http_not_found(res) { BBKWebhook._http_std_response(res, 404, 'Not Found'); };
    static _http_server_error(res) { BBKWebhook._http_std_response(res, 500, 'Internal Server Error'); };

    // --- entity retrieval method - should be overridden in derived class

    entity(eid, cb) {
        cb(null); // we just HTTP/404 here in the base class
    }

    // --- timeseries retrieval method - should be overridden in derived class

    timeseries(eid, tsid, limit, from, to, cb) {
        cb(null); // we just HTTP/404 here in the base class
    }

    // --- constructs a bbk webhook object

    constructor() {
        this.app = express();
        this.router = express.Router();

        this.app.use(bodyParser.json());
        this.app.use(cors()); // remove this if you don't want cors support
        this.app.use('/', this.router); // add a version prefix here, if needed

        this.app.options('*', cors()); // remove this if you don't want cors support
        this.app.disable('x-powered-by'); // removes the 'express advert' header value
        this.app.enable('etag') // use strong etags

        // --- catch all HTTP/404 for unhandled routes and HTTP/500 for uncaught exceptions

        this.app.use(function(req, res, next) { BBKWebhook._http_not_found(res); });
        this.app.use(function(err, req, res, next) {
            console.error(err.message);

            if (err instanceof SyntaxError) {
                BBKWebhook._http_bad_request(res);
            } else {
                BBKWebhook._http_server_error(res);
            }
        });

        // --- handler /entity route

        this.router.get('/entity/:et/:eid', (req, res) => {
            console.log(`heard request for entity type '${ req.params.et }' id '${ req.params.eid }'`);

            this.entity(req.params.eid, (entity) => {
                entity ? res.json(entity) : BBKWebhook._http_not_found(res);
            });
        });

        // --- handler /timeseries route

        this.router.get('/timeseries/:et/:eid/:tsid?', (req, res) => {
            console.log(`heard request for entity: '${ req.params.eid }', timeseries: '${ req.params.tsid }', start: '${ req.query.start }', end: '${ req.query.end }', limit: '${ req.query.limit }'`);

            // when present, we can assume parameters are valid integers here

            let start = req.query.start;
            let end = req.query.end;
            let limit = req.query.limit;

            this.timeseries(req.params.eid, req.params.tsid, start, end, limit, (timeseries) => {
                timeseries ? res.json(timeseries) : BBKWebhook._http_not_found(res);
            });
        });
    }

    // --- starts webhook server

    listen(port, cb) {
        this.app.listen(port, cb);
    }
}
