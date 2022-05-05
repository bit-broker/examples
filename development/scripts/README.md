# Sample connector Deployment scripts

# Data sources

These examples connector use data form the [BitBroker test suite](https://github.com/bit-broker/bit-broker/tree/main/tests/data), or data format-converted from it.

## Split heritage site data by category

If necessary, use [jq](https://stedolan.github.io/jq/) to split the JSON heritage data set:

```
cat heritage-site.json | jq '. | map(select(.entity.category == "cultural"))' > heritage-site-cultural.json
cat heritage-site.json | jq '. | map(select(.entity.category == "natural"))' > heritage-site-natural.json
```

## Deployment

### docker-compose

First, deploy a BBK instance using the [BitBroker docker-compose file](https://github.com/bit-broker/bit-broker/blob/main/development/docker-compose/docker-compose.yml)

Then, run the following commands to register the entities and their associated connectors:

```
. ./register-connector.sh country country
. ./register-connector.sh heritage heritagecultural
. ./register-connector.sh heritage heritagenatural

```

And run the following docker-compose command to deploy the connector instances:

```
docker-compose -f ./docker-compose-nodejs-file.yml up --build
```

optionally, run

```
./add_policy_and_consumer_access.sh
```

to add an 'access all areas' policy, register a consumer and get a token to access the connector-originated data via the consumer API.

### Helm

ToDo

## To use the connector with xlsx data

- search & replace docker-compose-nodejs-file.yml 'json' -> 'xlsx'
- redeploy
