import _ from 'lodash';
import Bookshelf from 'bookshelf';
import Knex from 'knex';
import Sqlite3 from 'sqlite3';
import Promise from 'bluebird';

// Use Chai.expect
import Chai from 'chai';
const expect = Chai.expect;
Chai.use(expect);

describe('bookshelf-jsonapi-params with postgresql', () => {

    // Connect Bookshelf to the database
    const dbConfig = {
        client: 'pg',
        connection: {
            host: 'localhost',
            user: 'bookshelf_jsonapi_test',
            database: 'bookshelf_jsonapi_test',
            charset: 'utf8',
            port: 5432
        }
    };
    const repository = Bookshelf(Knex(dbConfig));

    require('./test-helpers/common')(repository, dbConfig.client);

    // Add postgres specific unit tests
    // TODO: expose models to this file????
    describe('passing in jsonb filtering', () => {

        it('should return results for json equality filter', (done) => {

            PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:species': 'dog'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    done();
                });
        });

        it('should return results for comma separated json equality filter', (done) => {

            PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:color': 'black,yellow'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    done();
                });
        });

        it('should return results for json equality filter in nested objects', (done) => {});

        it('should return results for json contains filter', (done) => {});
        it('should return results for comma separated json contains filter', (done) => {});
        it('should return results for json less than filter on integer', (done) => {});
        it('should return results for json less than or equal filter on integer', (done) => {});
        it('should return results for json greater than filter on integer', (done) => {});
        it('should return results for json greater than or equal filter on integer', (done) => {});

        it('should return results for json less than filter on timestamp', (done) => {});
        it('should return results for json less than or equal filter on timestamp', (done) => {});
        it('should return results for json greater than filter on timestamp', (done) => {});
        it('should return results for json greater than or equal filter on timestamp', (done) => {});


        it('should return results for json null filter', (done) => {});
        it('should return results for json not null filter', (done) => {});
        it('should return results for json not equal filter', (done) => {});


        it('should return results for json equality filter through a relationship', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'pet.style:color': 'black,yellow'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    done();
                });
        });
    });
});
