// Load modules
/* eslint-disable prefer-const */
import {
    assign as _assign,
    forEach as _forEach,
    forOwn as _forOwn,
    has as _has,
    hasIn as _hasIn,
    includes as _includes,
    isEmpty as _isEmpty,
    isArray as _isArray,
    isFunction as _isFunction,
    isObject as _isObject,
    isObjectLike as _isObjectLike,
    pull as _pull,
    forIn as _forIn,
    keys as _keys,
    map as _map,
    filter as _filter
} from 'lodash';

import split from 'split-string';

import inflection from 'inflection';

import Paginator from 'bookshelf-page';

import jsonFields from './json-fields';

/**
 * Exports a plugin to pass into the bookshelf instance, i.e.:
 *
 *      import config from './knexfile';
 *      import knex from 'knex';
 *      import bookshelf from 'bookshelf';
 *
 *      const Bookshelf = bookshelf(knex(config));
 *
 *      Bookshelf.plugin('bookshelf-jsonapi-params');
 *
 *      export default Bookshelf;
 *
 * The plugin attaches the `fetchJsonApi` instance method to
 * the Bookshelf Model object.
 *
 * See methods below for details.
 */
export default (Bookshelf, options = {}) => {

    // Load the pagination plugin
    Bookshelf.plugin(Paginator);

    /**
     * Similar to {@link Model#fetch} and {@link Model#fetchAll}, but specifically
     * uses parameters defined by the {@link https://jsonapi.org|JSON API spec} to
     * build a query to further refine a result set.
     *
     * @param  opts {object}
     *     Currently supports the `include`, `fields`, `sort`, `page` and `filter`
     *     parameters from the {@link https://jsonapi.org|JSON API spec}.
     * @param  type {string}
     *     An optional string that specifies the type of resource being retrieved.
     *     If not specified, type will default to the name of the table associated
     *     with the model.
     * @return {Promise<Model|Collection|null>}
     */
    const fetchJsonApi = function (opts, isCollection = true, type, additionalQuery) {

        opts = opts || {};

        const internals = {};
        const { include, fields, sort, page = {}, filter, group } = opts;
        const filterTypes = ['like', 'not', 'lt', 'gt', 'lte', 'gte'];
        const aggregateFunctionRegex = new RegExp(/(count|sum|avg|max|min)\((.+)\)/);

        // Get a reference to the field being used as the id
        internals.idAttribute = this.constructor.prototype.idAttribute ?
            this.constructor.prototype.idAttribute : 'id';

        // Get a reference to the current model name. Note that if no type is
        // explicitly passed, the tableName will be used
        internals.modelName = type ? type : this.constructor.prototype.tableName;

        // Used to determine which casting syntax is valid
        internals.client = Bookshelf.knex.client.config.client;
        internals.textType = 'text';
        if (internals.client === 'mysql' || internals.client === 'mssql') {
            internals.textType = 'char';
        }

        // Initialize an instance of the current model and clone the initial query
        internals.model =
            this.constructor.forge().query((qb) => _assign(qb, this.query().clone()));

        /**
         * Build a query for relational dependencies of filtering, grouping and sorting
         * @param   filterValues {object}
         * @param   groupValues {object}
         * @param   sortValues {object}
         */
        internals.buildDependencies = (filterValues, groupValues, sortValues) => {

            const relationHash = {};
            // Find relations in filterValues
            if (_isObjectLike(filterValues) && !_isEmpty(filterValues)) {

                // Loop through each filter value
                _forEach(filterValues, (value, key) => {

                    // If the filter is not an equality filter
                    if (_isObjectLike(value)) {
                        if (!_isEmpty(value)) {
                            _forEach(value, (typeValue, typeKey) => {

                                // Add relations to the relationHash
                                internals.buildDependenciesHelper(typeKey, relationHash);
                            });
                        }
                    }
                    // If the filter is an equality filter
                    else {
                        internals.buildDependenciesHelper(key, relationHash);
                    }
                });
            }

            // Find relations in sortValues
            if (_isObjectLike(sortValues) && !_isEmpty(sortValues)) {

                // Loop through each sort value
                _forEach(sortValues, (value) => {

                    // If the sort value is descending, remove the dash
                    if (value.indexOf('-') === 0) {
                        value = value.substr(1);
                    }
                    // Add relations to the relationHash
                    internals.buildDependenciesHelper(value, relationHash);
                });
            }

            // Find relations in groupValues
            if (_isObjectLike(groupValues) && !_isEmpty(groupValues)) {

                // Loop through each group value
                _forEach(groupValues, (value) => {

                    // Add relations to the relationHash
                    internals.buildDependenciesHelper(value, relationHash);
                });
            }

            // Need to select model.* so all of the relations are not returned, also check if there is anything in fields object
            if (_keys(relationHash).length && !_keys(fields).length) {
                internals.model.query((qb) => {

                    qb.select(`${internals.modelName}.*`);
                });
            }
            // Recurse on each of the relations in relationHash
            _forIn(relationHash, (value, key) => {

                return internals.queryRelations(value, key, this, internals.modelName);
            });
        };

        /**
         * Recursive funtion to add relationships to main query to allow filtering and sorting
         * on relationships by using left outer joins
         * @param   relation {object}
         * @param   relationKey {string}
         * @param   parent {object}
         * @param   parentKey {string}
         */
        internals.queryRelations = (relation, relationKey, parentModel, parentKey) => {

            // Add left outer joins for the relation
            const relatedData = parentModel[relationKey]().relatedData;

            internals.model.query((qb) => {

                const foreignKey = relatedData.foreignKey ? relatedData.foreignKey : `${inflection.singularize(relatedData.parentTableName)}_${relatedData.parentIdAttribute}`;
                if (relatedData.type === 'hasOne' || relatedData.type === 'hasMany') {
                    qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`,
                        `${parentKey}.${relatedData.parentIdAttribute}`,
                        `${relationKey}.${foreignKey}`);
                }
                else if (relatedData.type === 'belongsTo') {
                    if (relatedData.throughTableName) {
                        const throughTableAlias = `${relationKey}_${relatedData.throughTableName}_pivot`;
                        qb.leftOuterJoin(`${relatedData.throughTableName} as ${throughTableAlias}`,
                            `${parentKey}.${relatedData.parentIdAttribute}`,
                            `${throughTableAlias}.${relatedData.throughIdAttribute}`);
                        qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`,
                            `${throughTableAlias}.${foreignKey}`,
                            `${relationKey}.${relatedData.targetIdAttribute}`);
                    }
                    else {
                        qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`,
                            `${parentKey}.${foreignKey}`,
                            `${relationKey}.${relatedData.targetIdAttribute}`);
                    }
                }
                else if (relatedData.type === 'belongsToMany') {
                    const otherKey = relatedData.otherKey ? relatedData.otherKey : `${inflection.singularize(relatedData.targetTableName)}_id`;
                    const joinTableName = relatedData.joinTableName ? relatedData.joinTableName : relatedData.throughTableName;

                    qb.leftOuterJoin(`${joinTableName} as ${relationKey}_${joinTableName}`,
                        `${parentKey}.${relatedData.parentIdAttribute}`,
                        `${relationKey}_${joinTableName}.${foreignKey}`);
                    qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`,
                        `${relationKey}_${joinTableName}.${otherKey}`,
                        `${relationKey}.${relatedData.targetIdAttribute}`);
                }
                else if (_includes(relatedData.type, 'morph')) {
                    // Get the morph type and id
                    const morphType = relatedData.columnNames[0] ? relatedData.columnNames[0] : `${relatedData.morphName}_type`;
                    const morphId = relatedData.columnNames[1] ? relatedData.columnNames[0] : `${relatedData.morphName}_id`;
                    if (relatedData.type === 'morphOne' || relatedData.type === 'morphMany') {

                        qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`, (qbJoin) => {

                            qbJoin.on(`${relationKey}.${morphId}`, '=', `${parentKey}.${relatedData.parentIdAttribute}`);
                        }).where(`${relationKey}.${morphType}`, '=', relatedData.morphValue);
                    }
                    else if (relatedData.type === 'morphTo') {
                        // Not implemented
                    }
                }
            });

            if (!_keys(relation).length) {
                return;
            }
            _forIn(relation, (value, key) => {

                return internals.queryRelations(value, key, parentModel[relationKey]().relatedData.target.forge(), relationKey);
            });
        };

        /**
         * Adds relations included in the column to the relationHash, used in buildDependencies
         * @param   column {string}
         * @param   relationHash {object}
         */
        internals.buildDependenciesHelper = (column, relationHash) => {
            // Split column on colons, example of column: 'relation.column:jsonbColumn.property:dataType'
            let [key] = column.split(':');
            if (_includes(key, '.')) {
                // The last item in the chain is a column name, not a table. Do not include column name in relationHash
                key = key.substring(0, key.lastIndexOf('.'));
                if (!_has(relationHash, key)) {
                    let level = relationHash;
                    const relations = key.split('.');
                    let relationModel = this.clone();

                    // Traverse the relationHash object and set new relation if it does not exist
                    _forEach(relations, (relation) => {

                        // Check if valid relationship
                        if (typeof relationModel[relation] === 'function' && relationModel[relation]().relatedData.type) {
                            if (!level[relation]) {
                                level[relation] = {};
                            }
                            level = level[relation];

                            // Set relation model to the next item in the chain
                            relationModel = relationModel.related(relation).relatedData.target.forge();
                        }
                        else {
                            return false;
                        }
                    });
                }
            }
        };

        /**
         * Build a query based on the `fields` parameter.
         * @param  fieldNames {object}
         */
        internals.buildFields = (fieldNames = {}) => {

            if (_isObject(fieldNames) && !_isEmpty(fieldNames)) {

                // Format column names
                fieldNames = internals.formatFieldNames(fieldNames);

                // Process fields for each type/relation
                _forEach(fieldNames, (fieldValue, fieldKey) => {

                    // Add qualifying table name to avoid ambiguous columns
                    fieldNames[fieldKey] = _map(fieldNames[fieldKey], (value) => {

                        // Extract any aggregate function around the column name
                        let [column, jsonColumn, dataType] = value.split(':');
                        let aggregateFunction = null;
                        const match = value.match(aggregateFunctionRegex);

                        if (match) {
                            aggregateFunction = match[1];
                            column = match[2];
                        }

                        if (!fieldKey) {
                            if (!_includes(column, '.')) {
                                column = `${internals.modelName}.${column}`;
                            }
                        }
                        else {
                            column = `${fieldKey}.${column}`;
                        }

                        column = _filter([column, jsonColumn, dataType]).join(':');

                        return aggregateFunction ? { aggregateFunction, column } : column;
                    });

                    // Only process the field if it's not a relation. Fields
                    // for relations are processed in `buildIncludes()`
                    if (!_includes(include, fieldKey)) {

                        // Add columns to query
                        internals.model.query((qb) => {

                            if (!fieldKey) {
                                qb.distinct();
                            }

                            _forEach(fieldNames[fieldKey], (column) => {

                                if (column.aggregateFunction) {
                                    qb[column.aggregateFunction](`${column.column} as ${column.aggregateFunction}`);
                                }
                                else {
                                    let [columnToSelect, jsonColumn, dataType] = column.split(':');
                                    if (jsonColumn) {
                                        jsonFields.buildSelect(qb, Bookshelf.knex, columnToSelect, jsonColumn, dataType);
                                    }
                                    else {
                                        qb.select([columnToSelect]);
                                    }
                                }
                            });

                            // JSON API considers relationships as fields, so we
                            // need to make sure the id of the relation is selected
                            _forEach(include, (relation) => {

                                if (internals.isBelongsToRelation(relation, this)) {
                                    const relatedData = this.related(relation).relatedData;
                                    let relationId;
                                    if (relatedData.throughForeignKey) {
                                        relationId = relatedData.throughForeignKey;
                                    }
                                    else {
                                        relationId = relatedData.foreignKey ? relatedData.foreignKey : `${inflection.singularize(relatedData.parentTableName)}_${relatedData.parentIdAttribute}`;
                                    }
                                    qb.select(`${internals.modelName}.${relationId}`);
                                }
                            });
                        });
                    }
                });


            }
        };

        /**
         * Build a query based on the `filters` parameter.
         * @param  filterValues {object|array}
         */
        internals.buildFilters = (filterValues) => {

            if (_isObjectLike(filterValues) && !_isEmpty(filterValues)) {
                // format the column names of the filters
                //filterValues = this.format(filterValues);

                // build the filter query
                internals.model.query((qb) => {

                    _forEach(filterValues, (value, key) => {

                        // If the value is a filter type
                        if (_isObjectLike(value)) {
                            // Format column names of filter types
                            const filterTypeValues = value;

                            // Check if filter type is valid
                            if (_includes(filterTypes, key)) {
                                // Loop through each value for the valid filter type
                                _forEach(filterTypeValues, (typeValue, typeKey) => {

                                    let [column, jsonColumn, dataType] = typeKey.split(':');
                                    // Remove all but the last table name, need to get number of dots
                                    column = internals.formatRelation(internals.formatFieldNames([column])[0]);

                                    // Determine if there are multiple filters to be applied
                                    let valueArray = split(String(typeValue), { keepQuotes: true, sep: ',' });

                                    if (jsonColumn) {
                                        // Pass in the an equality filter for the same column name as last parameter for OR filtering with `like` and `equals`
                                        let extraEqualityFilter = filterValues[typeKey];
                                        if (extraEqualityFilter) {
                                            extraEqualityFilter = split(String(extraEqualityFilter), { keepQuotes: true, sep: ',' });
                                        }
                                        jsonFields.buildFilterWithType(qb, Bookshelf.knex, key, valueArray, column, jsonColumn, dataType, extraEqualityFilter);
                                    }
                                    else {
                                        // Attach different query for each type
                                        if (key === 'like') {
                                            qb.where((qbWhere) => {

                                                let where = 'where';
                                                _forEach(valueArray, (val) => {

                                                    qbWhere[where](
                                                        Bookshelf.knex.raw(`LOWER(CAST(:column: AS ${internals.textType})) like LOWER(:value)`, {
                                                            value: `%${val}%`,
                                                            column
                                                        })
                                                    );

                                                    // Change to orWhere after the first where
                                                    if (where === 'where') {
                                                        where = 'orWhere';
                                                    }
                                                });

                                                // If the key is in the top level filter, filter on orWhereIn
                                                if (_hasIn(filterValues, typeKey)) {
                                                    // Determine if there are multiple filters to be applied
                                                    let equalityValue = filterValues[typeKey];
                                                    if (!_isArray(equalityValue)) {
                                                        equalityValue = split(String(equalityValue), { keepQuotes: true, sep: ',' });
                                                    }

                                                    internals.equalityFilter(qbWhere, column, equalityValue, 'orWhere');
                                                }
                                            });
                                        }
                                        else if (key === 'not') {
                                            const hasNull = valueArray.length !== _pull(valueArray, null, 'null').length;
                                            if (hasNull) {
                                                qb.whereNotNull(column);
                                            }
                                            if (!_isEmpty(valueArray)) {
                                                qb.whereNotIn(column, valueArray);
                                            }
                                        }
                                        else if (key === 'lt') {
                                            qb.where(column, '<', typeValue);
                                        }
                                        else if (key === 'gt') {
                                            qb.where(column, '>', typeValue);
                                        }
                                        else if (key === 'lte') {
                                            qb.where(column, '<=', typeValue);
                                        }
                                        else if (key === 'gte') {
                                            qb.where(column, '>=', typeValue);
                                        }
                                    }
                                });
                            }
                        }
                        // If the value is an equality filter
                        else {
                            // If the key is in the like filter, ignore the filter
                            if (!_hasIn(filterValues.like, key)) {
                                let [column, jsonColumn, dataType] = key.split(':');
                                // Remove all but the last table name, need to get number of dots
                                column = internals.formatRelation(internals.formatFieldNames([column])[0]);

                                if (!_isArray(value)) {
                                    value = split(String(value), { keepQuotes: true, sep: ',' });
                                }

                                if (jsonColumn) {
                                    jsonFields.buildFilterWithType(qb, Bookshelf.knex, 'equal', value, column, jsonColumn, dataType);
                                }
                                else {
                                    internals.equalityFilter(qb, column, value);
                                }
                            }
                        }
                    });
                });
            }
        };

        /**
         * Takes in value, query builder, and column name for creating an equality filter
         * @param value {array}
         * @param qb {object} The query builder
         * @param column
         */
        internals.equalityFilter = (qb, column, value, whereType = 'where') => {

            const hasNull = value.length !== _pull(value, null, 'null').length;
            if (hasNull) {
                qb[whereType]((qbWhere) => {

                    qbWhere.whereNull(column);
                    if (!_isEmpty(value)) {
                        qbWhere.orWhereIn(column, value);
                    }
                });
            }
            else {
                qb[`${whereType}In`](column, value);
            }
        };

        /**
         * Takes in an attribute string like a.b.c.d and returns c.d, also if attribute
         * looks like 'a', it will return tableName.a where tableName is the top layer table name
         * @param   attribute {string}
         * @return  {string}
         */
        internals.formatRelation = (attribute) => {

            let [column, jsonColumn, dataType] = attribute.split(':');
            if (_includes(column, '.')) {
                const splitKey = column.split('.');
                column = `${splitKey[splitKey.length - 2]}.${splitKey[splitKey.length - 1]}`;
            }
            // Add table name to before column name if no relation to avoid ambiguous columns
            else {
                column = `${internals.modelName}.${column}`;
            }
            return _filter([column, jsonColumn, dataType]).join(':');
        };

        /**
         * Takes an array from attributes and returns the only the columns and removes the table names
         * @param   attributes {array}
         * @return  {array}
         */
        internals.getColumnNames = (attributes) => {

            return _map(attributes, (attribute) => {

                return attribute.substr(attribute.lastIndexOf('.') + 1);
            });
        };

        /**
         * Build a query based on the `include` parameter.
         * @param  includeValues {array}
         */
        internals.buildIncludes = (includeValues) => {

            if (_isArray(includeValues) && !_isEmpty(includeValues)) {

                const relations = [];

                _forEach(includeValues, (relation) => {

                    if (_has(fields, relation)) {

                        const fieldNames = internals.formatFieldNames(fields);

                        relations.push({
                            [relation]: (qb) => {

                                if (!internals.isBelongsToRelation(relation, this)) {
                                    const relatedData = this[relation]().relatedData;
                                    const foreignKey = relatedData.foreignKey ? relatedData.foreignKey : `${inflection.singularize(relatedData.parentTableName)}_${relatedData.parentIdAttribute}`;

                                    if (!_includes(fieldNames[relation], foreignKey)) {
                                        qb.column.apply(qb, [foreignKey]);
                                    }
                                }
                                fieldNames[relation] = internals.getColumnNames(fieldNames[relation]);
                                if (!_includes(fieldNames[relation], 'id')) {
                                    qb.column.apply(qb, ['id']);
                                }
                                qb.column.apply(qb, [fieldNames[relation]]);
                            }
                        });
                    }
                    else {
                        relations.push(relation);
                    }
                });

                // Assign the relations to the options passed to fetch/All
                _assign(opts, { withRelated: relations });
            }
        };

        /**
         * Build a query based on the `sort` parameter.
         * @param  sortValues {array}
         */
        internals.buildSort = (sortValues = []) => {


            if (_isArray(sortValues) && !_isEmpty(sortValues)) {

                let sortDesc = [];

                for (let i = 0; i < sortValues.length; ++i) {

                    // Determine if the sort should be descending
                    if (typeof sortValues[i] === 'string' && sortValues[i][0] === '-') {
                        sortValues[i] = sortValues[i].substring(1);
                        sortDesc.push(sortValues[i]);
                    }
                }

                // Format column names according to Model settings
                sortDesc = internals.formatFieldNames(sortDesc);
                sortValues = internals.formatFieldNames(sortValues);

                _forEach(sortValues, (sortBy) => {

                    const sortType = sortDesc.indexOf(sortBy) === -1 ? 'asc' : 'desc';
                    if (sortBy) {
                        let [column, jsonColumn, dataType] = sortBy.split(':');
                        column = internals.formatRelation(column);
                        if (jsonColumn) {
                            internals.model.query((qb) => {

                                jsonFields.buildSort(qb, sortType, column, jsonColumn, dataType);
                            });
                        }
                        else {
                            internals.model.orderBy(column, sortType);
                        }
                    }
                });
            }
        };

        /**
         * Build a query based on the `group` parameter.
         * @param  groupValues {array}
         */
        internals.buildGroup = (groupValues = []) => {

            if (_isArray(groupValues) && !_isEmpty(groupValues)) {

                groupValues = internals.formatFieldNames(groupValues);

                internals.model.query((qb) => {

                    _forEach(groupValues, (groupBy) => {

                        qb.groupBy(groupBy);
                    });
                });
            }
        };

        /**
         * Turn a column into its {@link Model#format} format
         * leaving specified table names untouched.
         * A helper function to formatFieldNames that does the work of formatting strictly on an array
         * @param fieldNames {array}
         * @returns formattedColumnNames {array}
         */

        internals.formatFieldCollection = (fieldNames = []) => {

            return _map(fieldNames, (fieldName) => {

                const [field, jsonField, dataType] = fieldName.split(':');
                const fieldComponents = field.split('.');
                const lastIndex = fieldComponents.length - 1;
                const aggregateFunctionMatch = fieldComponents[lastIndex].match(aggregateFunctionRegex);
                const [source, aggregateFunction, tableAttribute] = aggregateFunctionMatch || [null, false, fieldComponents[lastIndex]];

                const formattedFieldAttribute = _keys(this.format({ [tableAttribute]: undefined }))[0];

                fieldComponents[lastIndex] = aggregateFunction ?
                    `${aggregateFunction}(${formattedFieldAttribute})`
                    : formattedFieldAttribute;

                return _filter([fieldComponents.join('.'), jsonField, dataType]).join(':');
            });
        };

        /**
         * Processes incoming parameters that represent columns names and
         * formats them using the internal {@link Model#format} function.
         * @param fieldNames {array|object}
         * @returns formattedColumnNames {array|object}
         */
        internals.formatFieldNames = (fieldNames = []) => {

            if (_isArray(fieldNames)) {
                return internals.formatFieldCollection(fieldNames);
            }

            // process an object for which each value is a collection of columns to be formatted
            _forOwn(fieldNames, (fieldCollection, fieldNameKey) => {

                fieldNames[fieldNameKey] = internals.formatFieldCollection(fieldCollection);
            });

            return fieldNames;
        };

        /**
         * Determines if the specified relation is a `belongsTo` type.
         * @param   relationName {string}
         * @param   model {object}
         * @return  {boolean}
         */
        internals.isBelongsToRelation = (relationName, model) => {

            if (!model.related(relationName)) {
                return false;
            }
            const relationType = model.related(relationName).relatedData.type.toLowerCase();

            if (relationType !== undefined &&
                relationType === 'belongsto') {

                return true;
            }

            return false;
        };

        /**
         * Determines if the specified relation is a `many` type.
         * @param   relationName {string}
         * @param   model {object}
         * @return  {boolean}
         */
        internals.isManyRelation = (relationName, model) => {

            if (!model.related(relationName)) {
                return false;
            }
            const relationType = model.related(relationName).relatedData.type.toLowerCase();

            if (relationType !== undefined &&
                relationType.indexOf('many') > 0) {

                return true;
            }

            return false;
        };

        /**
         * Determines if the specified relation is a `hasone` type.
         * @param   relationName {string}
         * @param   model {object}
         * @return  {boolean}
         */
        internals.ishasOneRelation = (relationName, model) => {

            if (!model.related(relationName)) {
                return false;
            }
            const relationType = model.related(relationName).relatedData.type.toLowerCase();

            if (relationType !== undefined &&
                relationType === 'hasone') {

                return true;
            }

            return false;
        };

        ////////////////////////////////
        /// Process parameters
        ////////////////////////////////

        // Apply relational dependencies for filters, grouping and sorting
        internals.buildDependencies(filter, group, sort);

        // Apply filters
        internals.buildFilters(filter);

        // Apply grouping
        internals.buildGroup(group);

        // Apply sorting
        internals.buildSort(sort);

        // Apply relations
        internals.buildIncludes(include);

        // Apply sparse fieldsets
        internals.buildFields(fields);

        // Apply extra query which was passed in as a parameter
        if (_isFunction(additionalQuery)) {
            internals.model.query(additionalQuery);
        }

        // Assign default paging options if they were passed to the plugin
        // and no pagination parameters were passed directly to the method.
        if (isCollection &&
            _isEmpty(page) &&
            _has(options, 'pagination')) {

            _assign(page, options.pagination);
        }
        // internals.model.query(qb => {

        //     console.log(qb.toQuery());

        // });

        // Apply paging
        if (isCollection &&
            _isObject(page) &&
            !_isEmpty(page)) {

            const pageOptions = _assign(opts, page);

            return internals.model.fetchPage(pageOptions);
        }

        // Determine whether to return a Collection or Model
        // Call `fetchAll` to return Collection
        if (isCollection) {
            return internals.model.fetchAll(opts);
        }

        // Otherwise, call `fetch` to return Model
        return internals.model.fetch(opts);
    };

    // Add `fetchJsonApi()` method to Bookshelf Model/Collection prototypes
    Bookshelf.Model.prototype.fetchJsonApi = fetchJsonApi;

    Bookshelf.Model.fetchJsonApi = function (...args) {

        return this.forge().fetchJsonApi(...args);
    };

    Bookshelf.Collection.prototype.fetchJsonApi = function (...args) {

        return fetchJsonApi.apply(this.model.forge(), ...args);
    };
};
