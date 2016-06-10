# Changelog

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
