# ev-charging-federated-graphql

## Solution

### Problem identification:

-   [Open Charge Map API] is unpaginated.

    -   There are a few important keys that it takes as query parameter:

        -   **key** (_string_) - An API key is a token that you provide when making API calls.
        -   **camelcase** (_boolean_) - Set to true to get a property names in camelCase format. Default `false`.
        -   **maxresults** (_integer_) - Limit on max number of results returned. Default `100`.
        -   **distanceunit** (_string_) - `miles` or `km` distance unit. Default `miles`.
        -   **countrycode** (_string_) - 2-character ISO Country code to filter to one specific country.
        -   **polygon** (_string_) - Filter results within a given Polygon. Specify an encoded polyline for the polygon shape. Polygon will be automatically closed from the last point to the first point.
        -   **boundingbox** (_array_) - Filter results to a given bounding box. Specify top left and bottom right box corners as: (lat,lng),(lat2,lng2)

    -   So now there are two ways to fetch data and populate our own database.

        1.  Whenever a user makes a request to our application to fetch sockets near their location, we query the [Open Charge Map API], fetch data, populate/update our database, and return the response back to user.

            -   Limitations:

                -   We only populate data near the locations of our active customers.
                -   We're making a network request to [Open Charge Map API] every time we get a request to our app. It may be possible that a new user requests data from a new location, and [Open Charge Map API] is down at that moment, so we serve no data to our user.
                -   Our application still has the overhead of updating its own database for any changes in [Open Charge Map API] database.

        1.  We implement a custom solution to pre-fetch all the data from the [Open Charge Map API] by diving the whole world into smaller areas.

            -   Based on the input parameters of the application, there are three ways to fetch smaller data sets:

                1.  Based on **countrycode**

                    -   As per [Countries Now API](https://countriesnow.space/api/v0.1/countries/iso) for fetching countries, there are about 220 countries. So we have a smaller data set, but not small enough.

                1.  Based on **polygon**

                    -   We can further divide each country into cities, get hold of the boundary coordinates (a polygon) of these cities and use these to fetch for data inside these coordinates polygon. It might work, **_but_** where are we going to get accurate boundaries of each city.

                1.  Based on **boundingbox**

                    -   We can think of the (spherical) earth as a 2-D map with latitude as horizontal axis and longitude as vertical axis, and now it is a matter of diving a cartesian plane in as many smaller areas as we like.

                    -   So now we need the boundary coordinates of each country, that is the farthest longitudes and latitudes. So I came across this [stack exchange answer](https://gis.stackexchange.com/a/260612/225830), which had this [Countries of the World] data.

                    -   I created a [POC for getting top left and bottom right coordinates of each country](./src/subgraphs/socket/src/util/generateCountriesJson.ts) from the [cow.txt](./src/subgraphs/socket/src/config/cow.txt) file.

                    -   I created another [POC for getting sub areas](./src/subgraphs/socket/src/util/generateSubBoundingBoxesOfCountry.ts) from a bigger area.

                        -   This function takes in the top left and bottom right coordinates (of a country), and an area. Divides the rectangle formed by the top left and bottom right coordinates to smaller rectangles of area less than or equal to given area, and returns the top left and bottom right coordinates of each sub-area. For now I've set the given area to 10 sq. km thinking that even if there are charging stations at every half km, we would have a maximum of 400 charging stations per network call to [Open Charge Map API].

                        -   This can be then used to make requests for each sub-area, and pre-populate our database.

            -   Limitations:

                -   If there is an update at [Open Charge Map API] in any charging station data, the user will keep receiving an outdated data from our API, till next sync of our application with [Open Charge Map API].

### Implementation

-   There are two main services, i.e. Gateway, and Subgraph(s).
-   Gateway - It is going to stich the schema from different subgraph(s) and provide a single GraphQL url.
-   Subgraph(s) - In the current implementation, we only have one subgraph, i.e. Socket Subgraph.
-   The application runs in a docker container which can be started using a single command.

    -   There is a docker-compose.yml which serves as an entry point of application.
    -   MongoDB is initialized first.
    -   Subgraph(s) start only after MongoDB is ready to accept connections.
    -   Gateway starts only after all the Subgraph(s) have started successfully. It stitches the schema from different subgraph(s) and provide a single GraphQL url.

-   There is one entity - Socket. It represents a charging station in our database.
-   There are two graphql queries - Socket and Sockets.
-   Socket query

    -   Fetch a particular socket using ID.

-   Sockets query

    -   Fetch a list of sockets from in a relay-style pagination.

-   When the app starts/restarts, the `pullSocket` method starts polling from the [Open Charge Map API] immediately.
-   A cron-job is also set to call the `pullSocket` method regularly at midnight for fetching new data or updating the existing ones.

    -   Changes in existing data are updated in our database based on the comparison of the `dateLastStatusUpdate` key.

-   `pullSocket` method in Socket Subgraph

    -   Reads the countries data from a json file which is generated at run time by `generateCountriesJson` method by reading and parsing the [cow.txt](./src/subgraphs/socket/src/config/cow.txt).
    -   Polls data only for the enabled countries, i.e. `IISOCode` interface.

        -   Only Germany and India are enabled for now.

    -   Calls the `generateSubBoundingBoxesOfCountry` method for each enabled country to generate square areas of 1 sq. km or less.
    -   Polling happens with respect to each generated sub box.
    -   A cron job is set to run the `pullSocket` method once every day to fetch new charging stations and update the existing ones.

### See in action

1.  Read and follow steps from [Initial Setup](./README.md#initial-setup).

1.  Execute the command from the root directory to run the tests.

    ```bash
    npm test
    ```

1.  Execute the command from the root directory to start the application.

    ```bash
    npm start
    ```

1.  Import Postman collection and environment variable

    -   Import Collection from [here](https://www.postman.com/descent-module-operator-65787222/workspace/public/collection/649289bd3516b12300f37753).
    -   Import Environment Variables from [here](https://www.postman.com/descent-module-operator-65787222/workspace/public/environment/15813424-cdf6a24c-f88e-4315-87ae-665d692a46ce).

1.  Queries List:

    1.  Socket

        ```bash
        query Socket($identifier: String!) {
            socket(identifier: $identifier) {
                identifier
                serial
                uuid
                dateCreated
                dateLastVerified
                dateLastStatusUpdate
                statusType {
                    isOperational
                    isUserSelectable
                    id
                    title
                }
                operatorInfo {
                    websiteURL
                    comments
                    phonePrimaryContact
                    phoneSecondaryContact
                    isPrivateIndividual
                    addressInfo {
                        id
                        title
                        addressLine1
                        addressLine2
                        town
                        stateOrProvince
                        postcode
                        countryID
                        country {
                            isoCode
                            continentCode
                            id
                            title
                        }
                        latitude
                        longitude
                        contactTelephone1
                        contactTelephone2
                        contactEmail
                        accessComments
                        relatedURL
                    }
                    bookingURL
                    contactEmail
                    faultReportEmail
                    isRestrictedEdit
                    id
                    title
                }
                dataProvider {
                    websiteURL
                    comments
                    dataProviderStatusType {
                        isProviderEnabled
                        id
                        title
                    }
                    isRestrictedEdit
                    isOpenDataLicensed
                    isApprovedImport
                    license
                    dateLastImported
                    id
                    title
                }
                connections {
                    id
                    connectionTypeID
                    connectionType {
                        formalName
                        isDiscontinued
                        isObsolete
                        id
                        title
                    }
                    reference
                    statusTypeID
                    statusType {
                        isOperational
                        isUserSelectable
                        id
                        title
                    }
                    levelID
                    level {
                        comments
                        isFastChargeCapable
                        id
                        title
                    }
                    amps
                    voltage
                    powerKW
                    currentTypeID
                    currentType {
                        description
                        id
                        title
                    }
                    quantity
                    comments
                }
                addressInfo {
                    id
                    title
                    addressLine1
                    addressLine2
                    town
                    stateOrProvince
                    postcode
                    countryID
                    country {
                        isoCode
                        continentCode
                        id
                        title
                    }
                    latitude
                    longitude
                    contactTelephone1
                    contactTelephone2
                    contactEmail
                    accessComments
                    relatedURL
                }
            }
            DataProviderStatusTypeTitle: __type(name: "DataProviderStatusTypeTitle") {
                enumValues {
                    description
                    name
                }
            }
            DataProviderTitle: __type(name: "DataProviderTitle") {
                enumValues {
                    description
                    name
                }
            }
            FormalName: __type(name: "FormalName") {
                enumValues {
                    description
                    name
                }
            }
            Comments: __type(name: "Comments") {
                enumValues {
                    description
                    name
                }
            }
            LevelTitle: __type(name: "LevelTitle") {
                enumValues {
                    description
                    name
                }
            }
            Description: __type(name: "Description") {
                enumValues {
                    description
                    name
                }
            }
            CurrentTypeTitle: __type(name: "CurrentTypeTitle") {
                enumValues {
                    description
                    name
                }
            }
        }
        ```

    1.  Sockets

        ```bash
        query Sockets {
            sockets {
                totalCount
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                }
                edges {
                    cursor
                    node {
                        identifier
                        serial
                        uuid
                        dateCreated
                        dateLastVerified
                        dateLastStatusUpdate
                        statusType {
                            isOperational
                            isUserSelectable
                            id
                            title
                        }
                        operatorInfo {
                            websiteURL
                            comments
                            phonePrimaryContact
                            phoneSecondaryContact
                            isPrivateIndividual
                            addressInfo {
                                id
                                title
                                addressLine1
                                addressLine2
                                town
                                stateOrProvince
                                postcode
                                countryID
                                country {
                                    isoCode
                                    continentCode
                                    id
                                    title
                                }
                                latitude
                                longitude
                                contactTelephone1
                                contactTelephone2
                                contactEmail
                                accessComments
                                relatedURL
                            }
                            bookingURL
                            contactEmail
                            faultReportEmail
                            isRestrictedEdit
                            id
                            title
                        }
                        dataProvider {
                            websiteURL
                            comments
                            dataProviderStatusType {
                                isProviderEnabled
                                id
                                title
                            }
                            isRestrictedEdit
                            isOpenDataLicensed
                            isApprovedImport
                            license
                            dateLastImported
                            id
                            title
                        }
                        connections {
                            id
                            connectionTypeID
                            connectionType {
                                formalName
                                isDiscontinued
                                isObsolete
                                id
                                title
                            }
                            reference
                            statusTypeID
                            statusType {
                                isOperational
                                isUserSelectable
                                id
                                title
                            }
                            levelID
                            level {
                                comments
                                isFastChargeCapable
                                id
                                title
                            }
                            amps
                            voltage
                            powerKW
                            currentTypeID
                            currentType {
                                description
                                id
                                title
                            }
                            quantity
                            comments
                        }
                        addressInfo {
                            id
                            title
                            addressLine1
                            addressLine2
                            town
                            stateOrProvince
                            postcode
                            countryID
                            country {
                                isoCode
                                continentCode
                                id
                                title
                            }
                            latitude
                            longitude
                            contactTelephone1
                            contactTelephone2
                            contactEmail
                            accessComments
                            relatedURL
                        }
                    }
                }
            }
            DataProviderStatusTypeTitle: __type(name: "DataProviderStatusTypeTitle") {
                enumValues {
                    description
                    name
                }
            }
            DataProviderTitle: __type(name: "DataProviderTitle") {
                enumValues {
                    description
                    name
                }
            }
            FormalName: __type(name: "FormalName") {
                enumValues {
                    description
                    name
                }
            }
            Comments: __type(name: "Comments") {
                enumValues {
                    description
                    name
                }
            }
            LevelTitle: __type(name: "LevelTitle") {
                enumValues {
                    description
                    name
                }
            }
            Description: __type(name: "Description") {
                enumValues {
                    description
                    name
                }
            }
            CurrentTypeTitle: __type(name: "CurrentTypeTitle") {
                enumValues {
                    description
                    name
                }
            }
            StatusTypeTitle: __type(name: "StatusTypeTitle") {
                enumValues {
                    description
                    name
                }
            }
        }
        ```

### Steps to enable more countries

1.  Lets say we want to enable for the `Netherlands`. Its `ISOCode` is `NL`.
1.  Go to [schema.graphql](./src/subgraphs/socket/src/app/node-server/schema.graphql)

    -   Add `NL` to `ISOCode` enum

        ```bash
        enum ISOCode {
            DE
            IN
            NL
        }
        ```

    -   Add `Netherlands` to `CountryTitle` enum

        ```bash 
        enum CountryTitle {
            Germany
            India
            Netherlands
        }
        ```

    -   Since it falls in Europe continent, we do not need to add anything in `ContinentCode` enum

        ```bash
        enum ContinentCode {
            AS
            EU
        }
        ```

1.  Go to [socket](./src/subgraphs/socket/src/type/model/socket.ts) type

    -   Add `NL` to `IISOCode` enum

        ```bash
        export enum IISOCode {
            DE = 'DE',
            IN = 'IN',
            NL = 'NL',
        }
        ```

    -   Add `NETHERLANDS = 'Netherlands',` to `ICountryTitle` enum

        ```bash
        export enum ICountryTitle {
            GERMANY = 'Germany',
            INDIA = 'India',
            NETHERLANDS = 'Netherlands',
        }
        ```

    -   Since it falls in Europe continent, we do not need to add anything in `IContinentCode` enum

        ```bash
        export enum IContinentCode {
            AS = 'AS',
            EU = 'EU',
        }
        ```

1.  Go to [socket](./src/subgraphs/socket/src/model/socket.ts) model

    -   Add `Nl: 'NL',` to `ISOCode` enum

        ```bash
        export const ISOCode = Enum({
            De: 'DE',
            In: 'IN',
            Nl: 'NL',
        });
        ```

    -   Add `Netherlands: 'Netherlands',` to `CountryTitle` enum

        ```bash
        export const CountryTitle = Enum({
            Germany: 'Germany',
            India: 'India',
            Netherlands: 'Netherlands',
        });
        ```

    -   Since it falls in Europe continent, we do not need to add anything in `ContinentCode` enum

        ```bash
        export const ContinentCode = Enum({
            As: 'AS',
            Eu: 'EU',
        });
        ```

1.  Restart the application and you have successfully enabled data polling for another country.

## Problem Statement

-   Create an application that pulls current charging station data from [Open Charge Map API] and then persists the data in [MongoDB].

    -   Following fields are to be imported from [Open Charge Map API]:

        -   operatorInfo
        -   statusType
        -   addressInfo
        -   connections

-   The service pulls the data and updates the own database. It shall update the database only in case of changes in the pulled data.

    [Read more...](./PROBLEM.md)

### Ambiguity in the problem statement

-   Usgae of UUIDs internally

    -   It is understable to use UUIDs to as client-facing IDs because they're platform-agnostic and are designed to be unique across all systems and time, whereas ObjectIds are generally unique within a single MongoDB instance.
    -   But using it internally makes less sense for following reasons:

        1.  Increased storage size: UUIDs are typically 128 bits (16 bytes) long, whereas ObjectIds are 96 bits (12 bytes).
        1.  Index performance: UUIDs, being longer and less sequential, can impact index performance compared to ObjectIds.

-   [Open Charge Map API] Documentation

    -   It is not accurate. Some keys which are there in the schema are not present in actual response. Some keys present in response are not present in the schema.
    -   Example:

        1.  Socket.DataProvider.DataProviderStatusType.description - there is no such key in actual response.
        1.  Socket.DataProvider.DataProviderStatusType.title - there is no mention of this key in the documentation.

### Limitations of current solution

-   Currently we are polling a maximum of 1000 sockets per sub area of about 1 sq. km.
-   If there are more than 1000 sockets present in the sub area, then are not polling them.

    -   We can shorten the maximum area of while calculating a sub area.


[MongoDB]: https://mongodb.com/
[Open Charge Map API]: https://openchargemap.org/site/develop/api#/operations/get-poi
[Countries of the World]: https://web.archive.org/web/20150319012353/http://opengeocode.org/cude/download.php?file=/home/fashions/public_html/opengeocode.org/download/cow.txt