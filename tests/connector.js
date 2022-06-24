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
The connector test harness - use command 'mocha connector'

This is a simple set of tests to vefify that deployed connectors are up and responding to webhook endpoints
*/

'use strict'; // code assumes ECMAScript 6

// -- dependancies

const Shared = require('./lib/shared.js');  // include first for dotenv

const URLs = require('./lib/urls.js');
const Crud = require('./lib/crud.js');

const chakram = require('chakram');
const expect = chakram.expect;
const fs = require('fs');

const COUNTRY_ID = 'GB';
const HERITAGE_CULT_ID = "371";
const HERITAGE_NAT_ID = "1029";

// --- the test cases

describe('Connector Tests', function() {

    // --- test data

    let country = JSON.parse(fs.readFileSync('../data/country.json')).find(i => i.id === COUNTRY_ID);

    delete country['_population'];
    delete country['_wikidata'];

    let heritage_nat = JSON.parse(fs.readFileSync('../data/heritage-site-natural.json')).find(i => i.id === HERITAGE_NAT_ID);

    let heritage_cult = JSON.parse(fs.readFileSync('../data/heritage-site-cultural.json')).find(i => i.id === HERITAGE_CULT_ID);

    describe('country connector tests', () => {

        it('the country connector is up', () => {
            return Shared.up(URLs.connector_country());
        });

        it('it responds to an announce request', () => {
            return Shared.connector_announce(URLs.connector_country(), 'country');
        });

        it('responds correctly to an entity webhook call', () => {
            return Crud.get(URLs.connector_country_webhook(COUNTRY_ID), body => {
                expect(body).to.be.an('object');
                expect(body).to.containSubset(country);
                return chakram.wait();
            });
        });

        it('responds correctly to a timeseries webhook call', () => {
            return Crud.get(URLs.connector_country_ts_webhook(COUNTRY_ID, 'population'), items => {
                expect(items).to.be.an('array');
                expect(items.length).to.be.eq(58);
                return chakram.wait();
            });
        });
    });

    before('get country connector id', () => {

        return chakram.get(URLs.connector_country())
        .then(response => {
            expect(response.body).to.be.an('object');
            expect(response.body.connectorId).to.be.a('string');
            let connectorId = response.body.connectorId;
            heritage_nat.entity.country = heritage_nat.entity.country.replace('{cid}', connectorId);
            heritage_cult.entity.country = heritage_cult.entity.country.replace('{cid}', connectorId);
            return chakram.wait();
        });

    });

    describe('heritage natural connector tests', () => {

        it('the heritage natural connector is up', () => {
            return Shared.up(URLs.connector_heritage_natural());
        });

        it('it responds to an announce request', () => {
            return Shared.connector_announce(URLs.connector_heritage_natural(), 'heritagesites');
        });

        it('responds correctly to an entity webhook call', () => {
            return Crud.get(URLs.connector_heritage_natural_webhook(HERITAGE_NAT_ID), body => {
                expect(body).to.be.an('object');
                expect(body).to.deep.equal(heritage_nat);
                return chakram.wait();
            });
        });
    });

    describe('heritage cultural connector tests', () => {

        it('the heritage cultural connector is up', () => {
            return Shared.up(URLs.connector_heritage_cultural());
        });

        it('it responds to an announce request', () => {
            return Shared.connector_announce(URLs.connector_heritage_cultural(), 'heritagesites');
        });

        it('responds correctly to an entity webhook call', () => {
            return Crud.get(URLs.connector_heritage_cultural_webhook(HERITAGE_CULT_ID), body => {
                expect(body).to.be.an('object');
                expect(body).to.deep.equal(heritage_cult);
                return chakram.wait();
            });
        });
    });

   
});
