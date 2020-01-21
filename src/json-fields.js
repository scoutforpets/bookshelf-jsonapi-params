import {
    forEach as _forEach,
    isEmpty as _isEmpty,
    pull as _pull
} from 'lodash';

// Output postgres compliant query stub that accesses a property of a jsonb column
const pgAttributeChain = function (column, jsonColumn, dataType, { includeAs = false } = {}) {

    const propertyChain = jsonColumn.split('.');
    const bindings = [column, ...propertyChain];
    let sanitizedDataType = null;
    if (dataType === 'numeric') {
        sanitizedDataType = 'numeric';
    }
    else if (dataType === 'date') {
        sanitizedDataType = 'date';
    }
    else if (dataType === 'timestamp') {
        sanitizedDataType = 'timestamp';
    }
    let jsonSQL = `??#>>'{${propertyChain.map(() => '??').join(',')}}'`;
    if (sanitizedDataType) {
        jsonSQL = `(${jsonSQL})::${sanitizedDataType}`;
    }
    if (includeAs) {
        jsonSQL = `${jsonSQL} as ??`;
        // for JSONB, the leaf attribute of the object access is the column name
        bindings.push(propertyChain[propertyChain.length - 1]);
    }

    return { jsonSQL, bindings };
};

const equalityJsonFilter = function (jsonSQL, values, hasNull, qb, bindings, knex, whereType = 'where') {

    const rawQueryStringWithBindings = `${jsonSQL} in (${values.map(() => '?').join(',')})`;
    if (hasNull) {
        qb[whereType]((qbWhere) => {
            // Clone the bindings array to avoid sharing the same array with the orWhere below
            qbWhere.whereRaw(`${jsonSQL} is null`, [...bindings]);
            if (!_isEmpty(values)) {
                qbWhere.orWhere(knex.raw(rawQueryStringWithBindings, [...bindings, ...values]));
            }
        });
    }
    else {
        qb[`${whereType}Raw`](rawQueryStringWithBindings, [...bindings, ...values]);
    }
};

module.exports.buildFilterWithType = function (qb, knex, filterType, values, column, jsonColumn, dataType, extraEqualityFilterValues) {

    const { jsonSQL, bindings } = pgAttributeChain(column, jsonColumn, dataType);

    // Remove all null and 'null' from the values array. If the length is different after removal, there were nulls
    const hasNull = values.length !== _pull(values, null, 'null').length;

    if (filterType === 'equal') {
        equalityJsonFilter(jsonSQL, values, hasNull, qb, bindings, knex);
    }
    else if (filterType === 'like') {
        qb.where((qbWhere) => {

            let where = 'where';
            _forEach(values, (value) => {

                const subBindings = [...bindings, `%${value}%`];
                qbWhere[where](knex.raw(`(${jsonSQL})::text ilike ?`, subBindings));

                // Change to orWhere after the first where
                if (where === 'where'){
                    where = 'orWhere';
                }
            });

            /// Handle if key is also in equality filter
            if (extraEqualityFilterValues) {
                const extraHasNull = extraEqualityFilterValues.length !== _pull(extraEqualityFilterValues, null, 'null').length;
                equalityJsonFilter(jsonSQL, extraEqualityFilterValues, extraHasNull, qbWhere, bindings, knex, 'orWhere');
            }
        });
    }
    else if (filterType === 'not') {
        if (hasNull) {
            qb.whereRaw(`${jsonSQL} is not null`, bindings);
        }
        if (!_isEmpty(values)) {
            bindings.push(...values);
            qb.whereRaw(`${jsonSQL} not in (${values.map(() => '?').join(',')})`, bindings);
        }
    }
    // All other filter types, the values is expected to NOT be an array. This follows the logic in the main index file.
    else if (filterType === 'gt') {
        bindings.push(...values);
        qb.whereRaw(`${jsonSQL} > ?`, bindings);
    }
    else if (filterType === 'gte') {
        bindings.push(...values);
        qb.whereRaw(`${jsonSQL} >= ?`, bindings);
    }
    else if (filterType === 'lt') {
        bindings.push(...values);
        qb.whereRaw(`${jsonSQL} < ?`, bindings);
    }
    else if (filterType === 'lte') {
        bindings.push(...values);
        qb.whereRaw(`${jsonSQL} <= ?`, bindings);
    }
};

module.exports.buildSelect = function (qb, knex, column, jsonColumn, dataType) {
    // TODO: aggregate functions count, sum, avg, max, min
    const { jsonSQL, bindings } = pgAttributeChain(column, jsonColumn, dataType, { includeAs: true });
    qb.select(knex.raw(jsonSQL, bindings));
};

module.exports.buildSort = function (qb, sortType, column, jsonColumn, dataType) {

    // Ensure that the sort direction can not be injected
    let sanitizedSortType = 'asc';
    if (sortType === 'desc'){
        sanitizedSortType = 'desc';
    }
    const { jsonSQL, bindings } = pgAttributeChain(column, jsonColumn, dataType);
    qb.orderByRaw(`${jsonSQL} ${sanitizedSortType}`, bindings);
};
