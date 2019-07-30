import _ from 'lodash';
import Bookshelf from 'bookshelf';
import Knex from 'knex';
import Sqlite3 from 'sqlite3';
import Promise from 'bluebird';

// Use Chai.expect
import Chai from 'chai';
const expect = Chai.expect;
Chai.use(expect);

describe('bookshelf-jsonapi-params with sqlite3', () => {

    // Create the database
    new Sqlite3.Database('./test/test.sqlite');

    // Connect Bookshelf to the database
    const dbConfig = {
        client: 'sqlite3',
        connection: {
            filename: './test/test.sqlite'
        }
    };
    const repository = Bookshelf(Knex(dbConfig));

    // Create models

    require('./test-helpers/common')(repository, dbConfig.client);
});
