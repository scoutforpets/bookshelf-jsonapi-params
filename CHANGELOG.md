# Changelog

### 1.4.4 (January 23, 2020)
- Fixed issue with belongsTo().through() where the foreign key is not set and a default key needs to be created

### 1.4.3 (January 23, 2020)
- Fixed issue where `type` parameter was not being used
- Fixed issue with selection columns on a relationship of type belongsTo().through()

### 1.4.2 (January 22, 2020)
- Ensure the original options parameter does not get modified by deep cloning before processing

### 1.4.1 (January 21, 2020)
- Updated README

### 1.4.0 (January 20, 2020)
- Added ability to select fields on an included relationship n-levels deep by use of the `fields` parameter
- Updated jsonb `like` filtering to support gin indexing

### 1.3.0 (December 23, 2019)
- Changed 'like' queries to use ilike, for gin indexing support

### 1.2.0 (August 6, 2019)
- Added support for JSONB filtering/sorting/selecting (Postgres only)
- Extended tests to support postgres

### 1.1.3 (June 19, 2018)
- Fixed issue with filtering by strings that contain quotes

### 1.1.2 (May 30, 2018)
- Fixed bugs with formatting columns for database

### 1.1.1 (April 24, 2018)
- Fixed bugs with "null or" filtering

### 1.1.0 (April 23, 2018)
- Added filtering for null and not null values
- Fixed relation filtering query bugs

### 1.0.0 (December 8, 2017)
- Support for filtering on n-level deep relationships
- Support for sorting on n-level deep relationships
- Support for filtering operators (like, gt, gte, lt, lte, not)

### 0.6.2 (June 13, 2016)
- Resolves an issue where sorting on a multi-word column name (ex: startsAt) doesn't work properly.

### 0.6.1 (June 13, 2016)
- Botched NPM publish. Use 0.6.2.

### 0.6.0 (June 10, 2016)
- Reverted previous ability to pass in your own `withRelated` options as it was stupid and more complicated than it needed to be. Instead, you can just override the `include` parameter to be a Knex function with the relationship name as the key.

### 0.5.0 (June 2, 2016)
- Added the ability to pass in your own `withRelated` options to Bookshelf and have it override a relation with the same name that was passed via `include`. This is useful when you may need to do something with a relation that is out of the realm of Bookshelf's defaults.
- Dependency updates

### 0.4.0 (May 10, 2016)
- Merged PR [#10](https://github.com/scoutforpets/bookshelf-jsonapi-params/pull/10) to fix [#9](https://github.com/scoutforpets/bookshelf-jsonapi-params/issues/9)
- Dependency updates
- Added badges

### 0.3.3 (April 28, 2016)
- Fixed an issue where multiple filters were not applied properly

### 0.3.3 (April 28, 2016)
- Fixed an issue where multiple filters were not applied properly

### 0.3.2 (April 28, 2016)
- Botched release! Upgrade to 0.3.3 immediately!

### 0.3.1 (April 27, 2016)
- Fixed an issue where ambiguous columns could cause an error

### 0.3.0 (April 16, 2016)
- Added tests/documentation on disabling paging for a specific call.

### 0.2.0 (April 14, 2016)

- [#4](https://github.com/scoutforpets/bookshelf-jsonapi-params/pull/5) [BUGFIX/ENHANCEMENT] Removes unreliable, automatic detection of collections.
