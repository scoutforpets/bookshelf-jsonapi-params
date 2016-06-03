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
                    table.string('type');
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
                    gender: 'm',
                    type: 't-rex'
                }),
                PersonModel.forge().save({
                    id: 2,
                    name: 'Baby Bop',
                    gender: 'f',
                    type: 'tricerotops'

                }),
                PersonModel.forge().save({
                    id: 3,
                    name: 'Cookie Monster',
                    gender: 'm',
                    type: 'monster'
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

                    expect(result.models).to.have.length(3);
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

    describe('passing a `filters` parameter with a single filter', () => {

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

    describe('passing a `filters` parameter with multiple filters', () => {

        it('should return a single record that matches both filters', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        type: 't-rex,tricerotops'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    done();
                });
        });
    });

    describe('passing a `sort` parameter', () => {

        it('should return records sorted by name ascending', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    sort: ['name']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('name')).to.equal('Baby Bop');
                    done();
                });
        });

        it('should return records sorted by name descending', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    sort: ['-name']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('name')).to.equal('Cookie Monster');
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

    describe('passing `withRelated` parameters to the plugin', () => {

        it('should override any `include` parameters passed to the plugin', (done) => {

            PersonModel
                .where({ id: 1 })
                .fetchJsonApi({
                    include: ['pets'],
                    withRelated: [{
                        'pets': (qb) => {
                            qb.where({ name: 'Barney' });
                        }
                    }]
                }, false)
                .then((result) => {

                    const relation = result.related('pets');

                    expect(result).to.be.an('object');
                    expect(relation.id).to.not.exist;
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
                    expect(result.pagination.pageCount).to.equal(3);
                    done();
                });
        });
    });
});
