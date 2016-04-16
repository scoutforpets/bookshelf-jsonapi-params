import Bookshelf from 'bookshelf';
import JsonApiParams from '../src/index';
import Knex from 'knex';
import Sqlite3 from 'sqlite3';
import Promise from 'bluebird';

// Use Chai.expect
import Chai from 'chai';
const expect = Chai.expect;
Chai.use(expect);

describe('bookshelf-jsonapi-params', () => {

    // Create the database
    new Sqlite3.Database('./test/test.sqlite');

    // Connect Bookshelf to the database
    const repository = Bookshelf(Knex({
        client: 'sqlite3',
        connection: {
            filename: './test/test.sqlite'
        }
    }));

    // Create models
    const PetModel = repository.Model.extend({
        tableName: 'pet',
        person: function () {

            return this.belongsTo(PersonModel);
        }
    });

    const PersonModel = repository.Model.extend({
        tableName: 'person',
        pets: function () {

            return this.hasOne(PetModel);
        }
    });


    before((done) => {

        // Register the plugin with Bookshelf
        repository.plugin(JsonApiParams);

        // Build the schema and add some data
        Promise.join(
            repository.knex.schema.dropTableIfExists('person'),
            repository.knex.schema.dropTableIfExists('pet')
        )
        .then(() => {

            return Promise.join(
                repository.knex.schema.createTable('person', (table) => {

                    table.increments('id').primary();
                    table.string('name');
                    table.string('gender');
                }),
                repository.knex.schema.createTable('pet', (table) => {

                    table.increments('id').primary();
                    table.string('name');
                    table.integer('person_id');
                })
            );
        })
        .then(() => {

            return Promise.join(
                PersonModel.forge().save({
                    id: 1,
                    name: 'Barney',
                    gender: 'm'
                }),
                PersonModel.forge().save({
                    id: 2,
                    name: 'Baby Bop',
                    gender: 'f'
                }),
                PetModel.forge().save({
                    id: 1,
                    name: 'Big Bird',
                    person_id: 1
                })
            );
        })
        .then(() => done());
    });

    after((done) => {

        // Drop the tables when tests are complete
        Promise.join(
          repository.knex.schema.dropTableIfExists('person'),
          repository.knex.schema.dropTableIfExists('pet')
        )
        .then(() => done());
    });

    describe('passing no parameters', () => {

        it('should return a single record', (done) => {

            return PersonModel
                .where({ id: 1 })
                .fetchJsonApi(null, false)
                .then((person) => {

                    expect(person.get('name')).to.equal('Barney');
                    expect(person.get('gender')).to.equal('m');
                    done();
                });
        });

        it('should return multiple records', (done) => {

            return PersonModel
                .forge()
                .fetchJsonApi()
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    done();
                });
        });
    });

    describe('passing a `fields` parameter', () => {

        it('should only return the specified field for the record', (done) => {

            PersonModel
                .where({ id: 2 })
                .fetchJsonApi({
                    fields: {
                        person: ['name']
                    }
                }, false)
                .then((person) => {

                    expect(person.get('name')).to.equal('Baby Bop');
                    expect(person.get('gender')).to.be.undefined;
                    done();
                });
        });
    });

    describe('passing a `filters` parameter', () => {

        it('should return a single record with the matching id', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        id: 1
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    done();
                });
        });
    });

    describe('passing a `sort` parameter', () => {

        it('should return records sorted by id descending', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    sort: ['-id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('id')).to.equal(2);
                    done();
                });
        });
    });

    describe('passing an `include` parameter', () => {

        it('should include the pets relationship', (done) => {

            PersonModel
                .where({ id: 1 })
                .fetchJsonApi({
                    include: ['pets']
                }, false)
                .then((result) => {

                    const relation = result.related('pets');

                    expect(result).to.be.an('object');
                    expect(relation).to.exist;
                    expect(relation.get('name')).to.equal('Big Bird');
                    done();
                });
        });
    });

    describe('passing a `page` parameter', () => {

        it('should properly paginate records', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    page: {
                        limit: 1,
                        offset: 0
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('id')).to.equal(1);

                    return PersonModel
                        .forge()
                        .fetchJsonApi({
                            page: {
                                limit: 1,
                                offset: 1
                            }
                        });
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('id')).to.equal(2);
                    expect(result.pagination.pageCount).to.equal(2);
                    done();
                });
        });

        it('should override any default pagination settings passed to the plugin', (done) => {

            repository.plugin(JsonApiParams, {
                pagination: { limit: 2 }
            });

            PersonModel
                .forge()
                .fetchJsonApi({
                    page: {
                        limit: 1,
                        offset: 0
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('id')).to.equal(1);

                    return PersonModel
                        .forge()
                        .fetchJsonApi({
                            page: {
                                limit: 1,
                                offset: 1
                            }
                        });
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('id')).to.equal(2);
                    expect(result.pagination.pageCount).to.equal(2);
                    done();
                });
        });

        it('should disable paging regardless of defaults passed to the plugin', (done) => {

            repository.plugin(JsonApiParams, {
                pagination: { limit: 1 }
            });

            PersonModel
                .forge()
                .fetchJsonApi({
                    page: false
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.pagination).to.not.exist;
                    done();
                });
        });
    });

    describe('passing default paging parameters to the plugin', () => {

        before((done) => {

            repository.plugin(JsonApiParams, {
                pagination: { limit: 1, offset: 0 }
            });
            done();
        });

        it('should properly paginate records', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi()
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('id')).to.equal(1);
                    expect(result.pagination.pageCount).to.equal(2);
                    done();
                });
        });
    });
});
