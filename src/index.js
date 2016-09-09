// Load modules

import {
    assign as _assign,
    forEach as _forEach,
    has as _has,
    includes as _includes,
    isEmpty as _isEmpty,
    isArray as _isArray,
    isObject as _isObject,
    isObjectLike as _isObjectLike,
    keys as _keys,
    map as _map,
    zipObject as _zipObject
} from 'lodash';

import Paginator from 'bookshelf-page';

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
    const fetchJsonApi = function (opts, isCollection = true, type) {

        opts = opts || {};

        const internals = {};
        const { include, fields, sort, page = {}, filter } = opts;
        const filterTypes = ['like', 'not', 'lt', 'gt', 'lte', 'gte'];

        // Get a reference to the field being used as the id
        internals.idAttribute = this.constructor.prototype.idAttribute ?
            this.constructor.prototype.idAttribute : 'id';

        // Get a reference to the current model name. Note that if no type is
        // explcitly passed, the tableName will be used
        internals.modelName = type ? type : this.constructor.prototype.tableName;

        // Initialize an instance of the current model and clone the initial query
        internals.model =
            this.constructor.forge().query((qb) => _assign(qb, this.query().clone()));

        /**
         * Build a query based on the `fields` parameter.
         * @param  fieldNames {object}
         */
        internals.buildFields = (fieldNames = {}) => {

            if (_isObject(fieldNames) && !_isEmpty(fieldNames)) {

                // Format column names
                fieldNames = internals.formatColumnNames(fieldNames);

                // Process fields for each type/relation
                _forEach(fieldNames, (fieldValue, fieldKey) => {

                    // Add qualifying table name to avoid ambiguous columns
                    fieldNames[fieldKey] = _map(fieldNames[fieldKey], (value) => {

                        return `${fieldKey}.${value}`;
                    });

                    // Only process the field if it's not a relation. Fields
                    // for relations are processed in `buildIncludes()`
                    if (!_includes(include, fieldKey)) {

                        // Add column to query
                        internals.model.query((qb) => {

                            qb.column.apply(qb, [fieldValue]);

                            // JSON API considers relationships as fields, so we
                            // need to make sure the id of the relation is selected
                            _forEach(include, (relation) => {

                                const relationId = `${relation}_id`;

                                if (!internals.isManyRelation(relation) &&
                                    !_includes(fieldNames[relation], relationId)) {

                                    qb.column.apply(qb, [relationId]);
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
                filterValues = this.format(filterValues);

                // build the filter query
                internals.model.query((qb) => {

                    _forEach(filterValues, (value, key) => {

                        // If the value is a filter type
                        if (_isObjectLike(value)){
                            // Format column names of filter types
                            const filterTypeValues = this.format(value);

                            // Check if filter type is valid
                            if (_includes(filterTypes, key)){
                                // Loop through each value for the valid filter type
                                _forEach(filterTypeValues, (typeValue, typeKey) => {

                                    // Determine if there are multiple filters to be applied
                                    const valueArray = typeValue.toString().indexOf(',') !== -1 ? typeValue.split(',') : typeValue;

                                    // Attach different query for each type
                                    if (key === 'like'){
                                        if (_isArray(valueArray)){
                                            qb.where((qbWhere) => {

                                                _forEach(valueArray, (val, index) => {

                                                    val = `%${val}%`;
                                                    if (index === 0){
                                                        qbWhere.where(
                                                            Bookshelf.knex.raw(`LOWER(${typeKey}) like LOWER(?)`, [val])
                                                        );
                                                    }
                                                    else {
                                                        qbWhere.orWhere(
                                                            Bookshelf.knex.raw(`LOWER(${typeKey}) like LOWER(?)`, [val])
                                                        );
                                                    }
                                                });
                                            });
                                        }
                                        else {
                                            qb.where(
                                                Bookshelf.knex.raw(`LOWER(${typeKey}) like LOWER(?)`, [`%${typeValue}%`])
                                            );
                                        }
                                    }
                                    else if (key === 'not'){
                                        qb.whereNotIn.apply(qb, [typeKey, valueArray]);
                                    }
                                    else if (key === 'lt'){
                                        qb.where(typeKey, '<', typeValue);
                                    }
                                    else if (key === 'gt'){
                                        qb.where(typeKey, '>', typeValue);
                                    }
                                    else if (key === 'lte'){
                                        qb.where(typeKey, '<=', typeValue);
                                    }
                                    else if (key === 'gte'){
                                        qb.where(typeKey, '>=', typeValue);
                                    }
                                });
                            }
                        }
                        // If the value is an equality filter
                        else {
                            // Determine if there are multiple filters to be applied
                            value = value.toString().indexOf(',') !== -1 ? value.split(',') : value;

                            qb.whereIn.apply(qb, [key, value]);
                        }
                    });
                });
            }
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

                        const fieldNames = internals.formatColumnNames(fields);

                        relations.push({
                            [relation]: (qb) => {

                                const relationId = `${internals.modelName}_id`;

                                if (!internals.isBelongsToRelation(relation) &&
                                    !_includes(fieldNames[relation], relationId)) {

                                    qb.column.apply(qb, [relationId]);
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
                sortDesc = internals.formatColumnNames(sortDesc);
                sortValues = internals.formatColumnNames(sortValues);

                _forEach(sortValues, (sortBy) => {

                    internals.model.orderBy(sortBy, sortDesc.indexOf(sortBy) === -1 ? 'asc' : 'desc');
                });
            }
        };

        /**
         * Processes incoming parameters that represent columns names and
         * formats them using the internal {@link Model#format} function.
         * @param  columnNames {array}
         * @return {array{}
         */
        internals.formatColumnNames = (columnNames = []) => {

            _forEach(columnNames, (value, key) => {

                let columns;

                // Convert column names to an object so it can
                // be passed to Model#format
                if (_isArray(columnNames[key])) {
                    columns = _zipObject(columnNames[key], null);
                }
                else {
                    columns = _zipObject(columnNames, null);
                }

                // Format column names using Model#format
                if (_isArray(columnNames[key])) {
                    columnNames[key] = _keys(this.format(columns));
                }
                else {
                    columnNames = _keys(this.format(columns));
                }
            });

            return columnNames;
        };

        /**
         * Determines if the specified relation is a `belongsTo` type.
         * @param  relationName {string}
         * @return {boolean}
         */
        internals.isBelongsToRelation = (relationName) => {

            const relationType = this.related(relationName).relatedData.type.toLowerCase();

            if (relationType !== undefined &&
                relationType === 'belongsto') {

                return true;
            }

            return false;
        };

        /**
         * Determines if the specified relation is a `many` type.
         * @param  relationName {string}
         * @return {boolean}
         */
        internals.isManyRelation = (relationName) => {

            const relationType = this.related(relationName).relatedData.type.toLowerCase();

            if (relationType !== undefined &&
                relationType.indexOf('many') > 0) {

                return true;
            }

            return false;
        };

        ////////////////////////////////
        /// Process parameters
        ////////////////////////////////

        // Apply filters
        internals.buildFilters(filter);

        // Apply sorting
        internals.buildSort(sort);

        // Apply relations
        internals.buildIncludes(include);


        // Apply sparse fieldsets
        internals.buildFields(fields);

        // Assign default paging options if they were passed to the plugin
        // and no pagination parameters were passed directly to the method.
        if (isCollection &&
            _isEmpty(page) &&
            _has(options, 'pagination')) {

            _assign(page, options.pagination);
        }

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
