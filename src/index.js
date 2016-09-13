// Load modules

import {
    assign as _assign,
    forEach as _forEach,
    has as _has,
    hasIn as _hasIn,
    includes as _includes,
    isEmpty as _isEmpty,
    isArray as _isArray,
    isObject as _isObject,
    isObjectLike as _isObjectLike,
    forIn as _forIn,
    keys as _keys,
    map as _map,
    zipObject as _zipObject
} from 'lodash';

import inflection from 'inflection';

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
         * Build a query for relational dependencies of filtering and sorting
         * @param   filterValues {object}
         * @param   sortValues {object}
         */
        internals.buildDependencies = (filterValues, sortValues) => {

            const relationHash = {};
            // Find relations in fitlerValues
            if (_isObjectLike(filterValues) && !_isEmpty(filterValues)){

                // Loop through each filter value
                _forEach(filterValues, (value, key) => {

                    // If the filter is not an equality filter
                    if (_isObjectLike(value)){
                        if (!_isEmpty(value)){
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
            if (_isObjectLike(sortValues) && !_isEmpty(sortValues)){

                // Loop through each sort value
                _forEach(sortValues, (value) => {

                    // If the sort value is descending, remove the dash
                    if (value.indexOf('-') === 0){
                        value = value.substr(1);
                    }
                    // Add relations to the relationHash
                    internals.buildDependenciesHelper(value, relationHash);
                });
            }

            // Need to select model.* so all of the relations are not returned, also check if there is anything in fields object
            if (_keys(relationHash).length && !_keys(fields).length){
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
                if (relatedData.type === 'hasOne' || relatedData.type === 'hasMany'){
                    qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`,
                                     `${parentKey}.${relatedData.parentIdAttribute}`,
                                     `${relationKey}.${foreignKey}`);
                }
                else if (relatedData.type === 'belongsTo'){
                    qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`, `${parentKey}.${foreignKey}`, `${relationKey}.${relatedData.targetIdAttribute}`);
                }
                else if (relatedData.type === 'belongsToMany'){
                    const otherKey = relatedData.otherKey ? relatedData.otherKey : `${inflection.singularize(relatedData.targetTableName)}_id`;
                    const joinTableName = relatedData.joinTableName ? relatedData.joinTableName : relatedData.throughTableName;

                    qb.leftOuterJoin(`${joinTableName} as ${relationKey}_${joinTableName}`,
                                        `${parentKey}.${relatedData.parentIdAttribute}`,
                                        `${relationKey}_${joinTableName}.${foreignKey}`);
                    qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`,
                                        `${relationKey}_${joinTableName}.${otherKey}`,
                                        `${relationKey}.${relatedData.targetIdAttribute}`);
                }
                else if (_includes(relatedData.type, 'morph')){
                    // Get the morph type and id
                    const morphType = relatedData.columnNames[0] ? relatedData.columnNames[0] : `${relatedData.morphName}_type`;
                    const morphId = relatedData.columnNames[1] ? relatedData.columnNames[0] : `${relatedData.morphName}_id`;
                    if (relatedData.type === 'morphOne' || relatedData.type === 'morphMany'){

                        qb.leftOuterJoin(`${relatedData.targetTableName} as ${relationKey}`, (qbJoin) => {

                            qbJoin.on(`${relationKey}.${morphId}`, '=', `${parentKey}.${relatedData.parentIdAttribute}`);
                        }).where(`${relationKey}.${morphType}`, '=', relatedData.morphValue);
                    }
                    else if (relatedData.type === 'morphTo'){
                        // Not implemented
                    }
                }
            });

            if (!_keys(relation).length){
                return;
            }
            _forIn(relation, (value, key) => {

                return internals.queryRelations(value, key, parentModel[relationKey]().relatedData.target.forge(), relationKey);
            });
        };

        /**
         * Adds relations included in the key to the relationHash, used in buildDependencies
         * @param   key {string}
         * @param   relationHash {object}
         */
        internals.buildDependenciesHelper = (key, relationHash) => {

            if (_includes(key, '.')){
                // The last item in the chain is a column name, not a table. Do not include column name in relationHash
                key = key.substring(0, key.lastIndexOf('.'));
                if (!_has(relationHash, key)){
                    let level = relationHash;
                    const relations = key.split('.');
                    let relationModel = this.clone();

                    // Traverse the relationHash object and set new relation if it does not exist
                    _forEach(relations, (relation) => {

                        // Check if valid relationship
                        if (typeof relationModel[relation] === 'function' && relationModel[relation]().relatedData.type){
                            if (!level[relation]){
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


                        // Add columns to query
                        internals.model.query((qb) => {

                            qb.select(fieldNames[fieldKey]);

                            // JSON API considers relationships as fields, so we
                            // need to make sure the id of the relation is selected
                            _forEach(include, (relation) => {

                                if (internals.isBelongsToRelation(relation, this)) {
                                    const relatedData = this.related(relation).relatedData;
                                    const relationId = relatedData.foreignKey ? relatedData.foreignKey : `${inflection.singularize(relatedData.parentTableName)}_${relatedData.parentIdAttribute}`;
                                    qb.select(relationId);
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
                        if (_isObjectLike(value)){
                            // Format column names of filter types
                            const filterTypeValues = value;

                            // Check if filter type is valid
                            if (_includes(filterTypes, key)){
                                // Loop through each value for the valid filter type
                                _forEach(filterTypeValues, (typeValue, typeKey) => {

                                    // Remove all but the last table name, need to get number of dots
                                    typeKey = internals.formatRelation(internals.formatColumnNames([typeKey])[0]);

                                    // Determine if there are multiple filters to be applied
                                    const valueArray = typeValue.toString().indexOf(',') !== -1 ? typeValue.split(',') : typeValue;

                                    // If the column exists as an equality filter, add 'or' to 'where'
                                    let where = _hasIn(filterValues, typeKey) ? 'orWhere' : 'where';

                                    // Attach different query for each type
                                    if (key === 'like'){

                                        // Need to add double quotes for each table/column name, this is needed if there is a relationship with a capital letter
                                        typeKey = `"${typeKey.replace('.', '"."')}"`;
                                        if (_isArray(valueArray)){
                                            qb.where((qbWhere) => {

                                                _forEach(valueArray, (val) => {

                                                    val = `%${val}%`;

                                                    qbWhere[where](
                                                        Bookshelf.knex.raw(`LOWER(${typeKey}) like LOWER(?)`, [val])
                                                    );

                                                    // Change to orWhere after the first where
                                                    if (where === 'where'){
                                                        where = 'orWhere';
                                                    }
                                                });
                                            });
                                        }
                                        else {
                                            qb[where](
                                                Bookshelf.knex.raw(`LOWER(${typeKey}) like LOWER(?)`, [`%${typeValue}%`])
                                            );
                                        }
                                    }
                                    else if (key === 'not'){
                                        qb[where + 'NotIn'](typeKey, valueArray);
                                    }
                                    else if (key === 'lt'){
                                        qb[where](typeKey, '<', typeValue);
                                    }
                                    else if (key === 'gt'){
                                        qb[where](typeKey, '>', typeValue);
                                    }
                                    else if (key === 'lte'){
                                        qb[where](typeKey, '<=', typeValue);
                                    }
                                    else if (key === 'gte'){
                                        qb[where](typeKey, '>=', typeValue);
                                    }
                                });
                            }
                        }
                        // If the value is an equality filter
                        else {

                            // Remove all but the last table name, need to get number of dots
                            key = internals.formatRelation(internals.formatColumnNames([key])[0]);

                            // Determine if there are multiple filters to be applied
                            value = value.toString().indexOf(',') !== -1 ? value.split(',') : value;

                            // If the column exists as an filter type, add 'or' to 'where'
                            let where = 'where';
                            _forEach(filterTypes, (typeKey) => {

                                if (_hasIn(filterValues[typeKey], key)){
                                    where = 'orWhere';
                                }
                            });

                            qb[where + 'In'](key, value);
                        }
                    });
                });
            }
        };

        /**
         * Takes in an attribute string like a.b.c.d and returns c.d
         * @param   attribute {string}
         */
        internals.formatRelation = (attribute) => {

            if (_includes(attribute, '.')){
                const splitKey = attribute.split('.');
                attribute = `${splitKey[splitKey.length - 2]}.${splitKey[splitKey.length - 1]}`;
            }
            return attribute;
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

                                if (!internals.isBelongsToRelation(relation, this) &&
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

                let columns = {};
                if (_includes(value, '.')){
                    columns[columnNames[key].substr(columnNames[key].lastIndexOf('.') + 1)] = undefined;
                    columnNames[key] = columnNames[key].substring(0, columnNames[key].lastIndexOf('.')) + '.' + _keys(this.format(columns));
                }
                else {
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
                }
            });

            return columnNames;
        };

        /**
         * Determines if the specified relation is a `belongsTo` type.
         * @param   relationName {string}
         * @param   model {object}
         * @return  {boolean}
         */
        internals.isBelongsToRelation = (relationName, model) => {

            if (!model.related(relationName)){
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

            if (!model.related(relationName)){
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

            if (!model.related(relationName)){
                return false;
            }
            const relationType = model.related(relationName).relatedData.type.toLowerCase();

            if (relationType !== undefined &&
                relationType === 'hasone'){

                return true;
            }

            return false;
        };

        ////////////////////////////////
        /// Process parameters
        ////////////////////////////////

        // Apply relational dependencies for filters and sorting
        internals.buildDependencies(filter, sort);

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
