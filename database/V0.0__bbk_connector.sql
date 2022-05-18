-- Copyright 2021 Cisco and its affiliates
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--      http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

/*
The bit-broker connector database intialisation script.
*/

\connect postgres

-- clean up any previous assets - for development only

DROP DATABASE IF EXISTS bbk_connector_data;

DROP USER IF EXISTS bbk_connector;

DROP ROLE IF EXISTS bbk_connector_reader;
DROP ROLE IF EXISTS bbk_connector_writer;

-- create the user and role assets

CREATE ROLE bbk_connector_reader;
CREATE ROLE bbk_connector_writer;

CREATE USER bbk_connector WITH ENCRYPTED PASSWORD 'bbk_connector_pwd';

GRANT bbk_connector_reader TO bbk_connector;
GRANT bbk_connector_writer TO bbk_connector;

-- create the database

CREATE DATABASE bbk_connector_data WITH ENCODING = 'UTF8' OWNER = bbk_connector;

-- create extensions

\connect bbk_connector_data

CREATE EXTENSION postgis;
