# bookshelf-jsonapi-params
[![Build Status](https://travis-ci.org/scoutforpets/bookshelf-jsonapi-params.svg?branch=master)](https://travis-ci.org/scoutforpets/bookshelf-jsonapi-params) [![npm version](https://badge.fury.io/js/bookshelf-jsonapi-params.svg)](https://badge.fury.io/js/bookshelf-jsonapi-params) [![npm version](https://david-dm.org/scoutforpets/bookshelf-jsonapi-params.svg)](https://david-dm.org/scoutforpets/bookshelf-jsonapi-params)

The [JSON API spec](https://jsonapi.org/format) defines standard parameters to be used when refining result sets via filtering, sparse fieldsets, paging, etc. This [Bookshelf.js](https://github.com/tgriesser/bookshelf) plugin adds a method to your models that can be called to automatically refine the results of your queries based on the aforementioned parameters.

## Installation

Install the package via `npm`:

```sh
$ npm i --save bookshelf-jsonapi-params
```

## Usage

Require and register the `bookshelf-jsonapi-params` plugin:

```js
const bookshelf = require('bookshelf')(knex);
const jsonApiParams = require('bookshelf-jsonapi-params');

bookshelf.plugin(jsonApiParams);
```

After the plugin has been registered, the `fetchJsonApi` method can be called on your model or collection. Here's an example:

```js

// Please see the API for more information
// on available options
const options = {
    fields: {
        person: ['firstName', 'lastName']
    },
    page: {
        limit: 10
    },
    sort: ['-lastName']
};

// Returns a list of people
Person
    .forge()
    .fetchJsonApi(options)
    .then((result) => {
        return result;
    });
```

The above example would yield something like the following when transformed to JSON API:

```js
"data": [
    {
      "type": "person",
      "id": "1",
      "attributes": {
        "firstName": "Cookie",
        "lastName": "Monster"
    },
    {
      "type": "person",
      "id": "1",
      "attributes": {
        "firstName": "Baby",
        "lastName": "Bop"
    }
      ...
      [8 more results]
]
```

Note that only the `firstName` and `lastName` attributes are returned, the results are ordered by `lastName` descending, and only 10 results were returned.

### A Note on Returning a Collection vs Resource
If you're returning a single resource from a call such as `GET /customers/1`, make sure to pass `false` as the second parameter to `fetchJsonApi`. See [this issue](https://github.com/scoutforpets/bookshelf-jsonapi-params/issues/4) for more information/reasoning.

## API

`fetchJsonApi(options, isCollection, type, additionalQuery)` - calling `fetchJsonApi` with no options is just like a plain call to `Model#fetch` or `Model#fetchAll`. Note that in addition to the options below, you may also pass anything you can pass to `Model#fetch` or `Model#fetchAll`.

---

The first parameter `options`, is passed in as an object that can have the following properties.
```
{
    filter: {
        // Available filter objects
        or: <filter>[],
        and: <filter>[],
        gt: {},
        gte: {},
        lt: {},
        lte: {},
        not: {},
        like: {},
        'person.age': 25
    },
    fields: {
        person: ['name'],
        pet: ['name']
    },
    include: ['pet'],
    sort: ['name'],
}
```

#### filter
Filter is passed in as an object and filters a result set based specific field. Example: `/pets?filter[name]=max` would only return pets named max. Keywords can be added to filters to give more control over the results. Example: `/pets?filterType[like][pet]=ax` would only return pets that have "ax" in their name. The supported types are "like", "not", "lt", "lte", "gt", and "gte". Both "like" and "not" support multiple values by comma separation. Also, if your data has a string with a comma, you can filter for that comma by escaping the character with two backslashes. NOTE: This is not supported by JSON API spec.

You can combine multiple filter by passing "or" filter key with array of filter objects. For example:
```
    filter: {
        or: [
            {
                like: {
                    'pet.toy.type': 'skat'
                }
            },
            {
                type: 'monster'
            }
        ]
    },
```
will return all objects with "type" equal to "monster" or "type" property of relation pet.toy similar to "skat".

If you need to use more than one or filter, such as (a || b) && (c || d), you can use the "and" field and provide multiple filter objects that contain "or".
```
    filter: {
        and: [
            {
                or: [
                    {
                        like: {
                            'pet.toy.type': 'skat'
                        }
                    },
                    {
                        type: 'monster'
                    }
                ]
            },
            {
                or: [
                    {
                        age: 70
                    },
                    {
                        gender: 'f'
                    }
                ]
            }
        ] 
    },
```
This can also be useful in conjunction the "like" filter, since by default if you provide multiple values for a field, it will "or" them together.
```
    filter: {
        and: [
            {
                like: {
                   name: 'ba'
                }
            },
            {
                like: {
                    name: 'ey'
                }
            }
        ] 
    },
```

#### fields
Fields is passed in as an object and selects desired columns from your base table and also relationships.
 Example: `/pets?fields[pets]=name` would return pet records with only the name field rather than every field. If there is an included relationship such as `/pets?include=owner`, fields can be provided to return only desired columns from that relationship `/pets?include=owner&fields[owner]=firstName`.  _Note:_ you may use aggregate functions such as `/pets?fields[pets]=count(id)`. Aggregated functions are not supported for relationship fields or json fields. Supported aggregate functions are "count", "sum", "avg", "max", "min".

#### include
Passed in as an array of strings, and gets passed through to Bookshelf as `withRelated`. Returns relationships as part of the payload. Example: `/pets?include=owner` would return the pet record in addition to the full record of its owner. _Note:_ you may override an `include` parameter with your own Knex function rather than just a string representing the relationship name.

#### page
Page can be an object or `false`. This  paginates the result set. Example: `/pets?page[limit]=25&page[offset]=0` would return the first 25 records. `page` and `pageSize` are also supported. If you've passed default pagination parameters to the plugin, but would like to disable paging on a specific call, just set `page` to `false`.

#### sort
Passed in as an array of strings. Sorts the result set by specific fields. Example: `/pets?sort=-weight,birthDate` would return the records sorted by `weight` descending, then `birthDate` ascending. You can also sort your list by a field on a relationship, `/pet?sort=owner.firstName`

#### group
Passed in as an array string. Use it with `fields` param to group your results. Example: `/pets?fields[pets]=avg(age),gender&group=gender` would return return the average age of pets per gender. NOTE: This is not supported by JSON API spec.

---

`isCollection` - by default, internal calls will be made to `fetchAll`. If you're returning a single resource, set `isCollection` to `false`.

---

`type` - by default, the JSON API resource type will be set using the `tableName` defined in your Bookshelf model. If your resource type is different, you can pass the resource type into `fetchJsonApi` directly.

---

`additionalQuery` - allows you to modify the query builder prior to to execution of the query. This must be a function that takes in the knex Query Builder object. For example:
```
fetchJsonApi(options, isCollection, type, (qb) => {
    qb.whereRaw('extract(year from date)=2018');
});
```

---

### Postgres JSONB Column Support
JSONB columns can be filtered, sorted, and selected. The API is mostly the same, an additional character will be used to specify where a json column is, this will be a colon `:`

To create an equality filter on a json column:
```
filter: {
    'metaData:prop1': value
}
```

Relational filtering is also supported with JSONB columns:
```
filter: {
    'relation.metaData:prop1': value
}
```

Filter multiple nested objects in the json field with a contains filter:
```
filter: {
    like: {
        'relation.metaData:obj1.prop1': value
    }
}
```

You must also specify the type of a property split by a second `:`, if filtering by gt, lt, gte, or lte

Available types are `numeric`, `date`, and `timestamp`. Leaving the type out will default to a string.
```
filter: {
    gt: {
        'rel.metaData:obj1.prop2:numeric': 60
    }
}

filter: {
    gt: {
        'rel.metaData:obj1.prop3:date': 01-01-2019
    }
}

filter: {
    gt: {
        'rel.metaData:obj1.prop4:timestamp': 01-01-2019:00:00:00
    }
}
```

JSONB syntax can be used in `filter`, `fields`, and `sort`. It currently does not support aggregate functions and `group`


### Pagination and Sorting
Under the hood, this plugin uses the excellent [bookshelf-page](https://github.com/anyong/bookshelf-page) plugin. Please see the available options that can be passed in via the `page` parameter.

#### Default Pagination Parameters
If you'd like your result sets to be paginated by default without having to add pagination options to each call, you can set the default pagination parameters when registering the plugin:

```js
bookshelf.plugin(jsonApiParams, {
    pagination: { limit: 25 }
});
```
_Note:_ pagination options passed into the `fetchJsonApi` will override the defaults.

#### Default null string
If provided with the string `'null'` as a filter value, it will be interpretted as the value `null` when determining what to filter. This is because in a URL, you can not give the value `null`, it is represented as a string, since a url is a string.
This null string can be overrided to a string of your chosing if you need to filter by the literal string `'null'`.
```js
bookshelf.plugin(jsonApiParams, {
    nullString: '_null'
});
```


### Parsing URL Parameters
You can obviously parse all of the URL parameters yourself, but I would highly recommend using the fantastic [node-jsonapi-query-parser](https://github.com/kideh88/node-jsonapi-query-parser) module to handle this for you. The object produced by this module can be passed directly to this plugin without modification.

### Transforming Bookshelf Models to JSON API
Once you have your Bookshelf model, how do you transform it to a JSON API payload? I'd recommend checking out our [json-api-serializer](https://www.npmjs.com/package/json-api-serializer) module, which will allow you automatically transform your Bookshelf model to a JSON API-compliant payload.

## License

MIT
