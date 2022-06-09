# Example Connector & Apps Deployment

# Data sources

These example connector use data from the [BitBroker test suite](https://github.com/bit-broker/bit-broker/tree/main/tests/data), or data format-converted from it.

All the deployments have a single connector hosting 'country' data, and two 'heritage' connectors, hosting natural & cultural heritage data respectively.

## Deployment

### docker-compose

First, clone the https://github.com/bit-broker/bit-broker repo.

The docker-compose BitBroker / BitBroker demo deployment assumes a set of host names for the various BitBroker services (consistent with those in the BitBroker .env,example file), you should ensure that these resolve to the actual host, for example by adding them to your /etc/hosts as follows:

```
# BBK hosts...
10.0.2.15	bbk-coordinator
10.0.2.15	bbk-contributor
10.0.2.15	bbk-consumer
10.0.2.15	bbk-database
10.0.2.15	bbk-policy-cache
10.0.2.15	bbk-auth-service
10.0.2.15	bbk-rate-limit
10.0.2.15	bbk-auth-service-cache
10.0.2.15	bbk-rate-limit-cache
10.0.2.15	bbkt-webhook
10.0.2.15	bbk-con-db
```

Next, create a .env file from the .env.example file in the root of the repo.

Then, deploy a BBK instance using the [BitBroker docker-compose file](https://github.com/bit-broker/bit-broker/blob/main/development/docker-compose/docker-compose.yml)

i.e. from the ./development/docker-compose directory, run:

```
docker-compose up --build -d
```

Next, from this directory, check the config vars at the top of the bbk-demo-config.sh (they should be consistent with the BitBroker deployment .env file, and HELM_DEPLOY=0) - the defaults here should be OK)

Then, source the following script:

```
. ./bbk-demo-config.sh

```

This script makes a series of BitBroker API calls to:

- register entity types 'country' & 'heritage'
- register connectors for these entity types
- take the connectors live
- create a set of policies
- create a user for each of these policies
- issue an access token to each user for their associated policy

all of the necessary config to bring up the connectors and example apps are exported to a series of environment variables prefixed 'BBK\_'

You can then choose whether to run the file, or RDBMS example connectors in the demo deployment.

To run the file based connectors, run

```
docker-compose -f ./docker-compose-nodejs-file.yml up --build -d
```

Alternatively, to run the rdbms connectors, run

```
docker-compose -f ./docker-compose-nodejs-rdbms.yml up --build -d
```

This will bring up the example connectors and any dependencies, and bring up the two example apps.

You should be able to access the apps on ports 8008 & 8009 respectively in your browser, and explore explore policy-based access to data in the apps (which use the BitBroker consumer API)

### Helm

First, deploy a BBK instance using the [k8s repo instructions](https://github.com/bit-broker/bit-broker/blob/main/development/docker-compose/docker-compose.yml), but targetting a namespace 'bbk-demo' (the rest of these steps assume this!)

Next, check the config vars at the top of the [bbk-demo-config.sh](./bbk-demo-config.sh) script. in particular, make sure the WEBHOOK_BASE & COORD_BASE values reflect the BBK deployment, that the BOOTSTRAP_KEY is set correctly, and that HELM_DEPLOY=1

Then, source the following script:

```
. ./bbk-demo-config.sh

```

create a namespace for the demo apps:

```

kubectl create namespace bbk-demo-apps

```

and then deploy the demo app chart (charts/bit-broker-demo), making sure the global.bbkBaseUrl reflects the BBK deployment.

Then from the ./charts/bit-broker-demo folder in this repo, run:

```

helm install bbk-demo-apps . \
--set global.bbkBaseUrl=https://demo.bit-broker.io \
--set bbk-demo-con-country.connectorId=$BBK_ID_country \
--set bbk-demo-con-country.token=$BBK_TOKEN_country \
--set bbk-demo-con-heritage-nat.connectorId=$BBK_ID_heritagenatural \
--set bbk-demo-con-heritage-nat.token=$BBK_TOKEN_heritagenatural \
--set bbk-demo-con-heritage-cult.connectorId=$BBK_ID_heritagecultural \
--set bbk-demo-con-heritage-cult.token=$BBK_TOKEN_heritagecultural \
--set bbk-demo-app-explorer.token0=$BBK_POLICY_TOKEN_access_all_areas \
--set bbk-demo-app-explorer.token1=$BBK_POLICY_TOKEN_geo_british_isles \
--set bbk-demo-app-explorer.token2=$BBK_POLICY_TOKEN_heritage_natural \
--set bbk-demo-app-map.token0=$BBK_POLICY_TOKEN_access_all_areas \
--set bbk-demo-app-map.token1=$BBK_POLICY_TOKEN_geo_british_isles \
--set bbk-demo-app-map.token2=$BBK_POLICY_TOKEN_heritage_natural \
-n bbk-demo-apps

```

lastly, access to the apps is enabled by running:

```

kubectl apply -f ../bbk-demo-ingress.yaml -n bbk-demo-apps

```

## To use the file based connector with xlsx data

- search & replace docker-compose-nodejs-file.yml 'json' -> 'xlsx'
- redeploy

## Split heritage site data by category

If necessary, use [jq](https://stedolan.github.io/jq/) to split the JSON heritage data set:

```
cat heritage-site.json | jq '. | map(select(.entity.category == "cultural"))' > heritage-site-cultural.json
cat heritage-site.json | jq '. | map(select(.entity.category == "natural"))' > heritage-site-natural.json
```
