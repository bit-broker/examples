/**
 * Copyright 2021 Cisco and its affiliates
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
Shared methods used by all test scripts
*/

'use strict'; // code assumes ECMAScript 6

// --- load configuration - do this first

require('dotenv').config({ path: '../.env' });
process.env.APP_DATABASE = process.env.APP_DATABASE.replace('CREDENTIALS', process.env.TESTS_USER);

// --- dependancies

const HTTP = require('http-status-codes');
const DATA = require('./data.js');
const URLs = require('./urls.js');
const chakram = require('chakram');
const expect = chakram.expect;

// --- shared class

class Shared {

    // --- class constructor

    constructor() {
        this.db = null;
    }

    // --- tests a server is up

    up(server) {
        return chakram.get(server)
        .then(response => {
            expect(response).to.have.status(HTTP.OK);
            return chakram.wait();
        });
    }

    // --- tests a server announce message

    announce(server, name, status = DATA.STATUS.DEV) {
        return chakram.get(server)
        .then(response => {
            expect(response.body).to.be.an('object');
            expect(response.body.now).to.be.a('string');
            expect(response.body.now).to.match(new RegExp(DATA.DATE.REGEX));
            expect(response.body.name).to.be.a('string');
            expect(response.body.name).to.contain(name);
            expect(response.body.status).to.be.equal(status);
            return chakram.wait();
        });
    }

    // --- tests a connector announce message

    connector_announce(server, entity) {
        return chakram.get(server)
        .then(response => {
            expect(response.body).to.be.an('object');
            expect(response.body.now).to.be.a('string');
            expect(response.body.now).to.match(new RegExp(DATA.DATE.REGEX));
            expect(response.body.name).to.be.a('string');
            expect(response.body.connectorId).to.be.a('string');
            expect(response.body.entity).to.be.equal(entity);
            return chakram.wait();
        });
    }

    // --- checks there is nothing present at the rest resource point

    nowt(url, count = 0) {
        return chakram.get(url)
        .then(response => {
            expect(response.body).to.be.an('array');
            expect(response.body.length).to.be.eq(count);
            expect(response).to.have.status(HTTP.OK);
            return chakram.wait();
        });
    }

    // --- ensures that the database is empty

    empty() {
        return this.nowt(URLs.entity())
        .then(() => this.nowt(URLs.user(), 1))
        .then(() => this.nowt(URLs.policy()));
    }

    // --- blocking sleep for the given milliseconds - USE WITH CAUTION

    sleep(ms) {
        if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    }

    // --- returns a policy header item

    policy_header(slug) {
        return { 'x-bbk-audience': slug };
    }
}

// --- exported classes

module.exports = new Shared();
