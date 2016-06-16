import _ from 'lodash';
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

        // Converts snake_case attributes to camelCase
        parse: function (attrs) {

            return _.reduce(attrs, (result, val, key) => {

                result[_.camelCase(key)] = val;
                return result;
            }, {});
        },

        // Converts camelCase attributes to snake_case.
        format: function (attrs) {

            return _.reduce(attrs, (result, val, key) => {
                // Handle case when key is 'table.column'
                key = _.reduce(_.split(key, '.'), (new_key, name) => {
                    if (!new_key) {
                        new_key = _.snakeCase(name);
                    } else {
                        new_key = new_key + '.' + _.snakeCase(name);
                    }
                    return new_key;
                }, null);
                result[key] = val;
                return result;
            }, {});
        },

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
                    table.string('first_name');
                    table.string('gender');
                    table.string('type');
                }),
                repository.knex.schema.createTable('pet', (table) => {

                    table.increments('id').primary();
                    table.string('name');
                    table.integer('person_id')
                        .references('id')
                        .inTable('person');
                })
            );
        })
        .then(() => {

            return Promise.join(
                PersonModel.forge().save({
                    id: 1,
                    firstName: 'Barney',
                    gender: 'm',
                    type: 't-rex'
                }),
                PersonModel.forge().save({
                    id: 2,
                    firstName: 'Baby Bop',
                    gender: 'f',
                    type: 'triceratops'

                }),
                PersonModel.forge().save({
                    id: 3,
                    firstName: 'Cookie Monster',
                    gender: 'm',
                    type: 'monster'
                }),
                PetModel.forge().save({
                    id: 1,
                    name: 'Big Bird',
                    person_id: 1
                }),
                PetModel.forge().save({
                    id: 2,
                    name: 'Tweety Bird',
                    person_id: 2
                }),
                PetModel.forge().save({
                    id: 3,
                    name: 'Road Runner',
                    person_id: 3
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

                    expect(person.get('firstName')).to.equal('Barney');
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
                        person: ['firstName']
                    }
                }, false)
                .then((person) => {

                    expect(person.get('firstName')).to.equal('Baby Bop');
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
                        type: 't-rex,triceratops'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    done();
                });
        });
    });

    describe('passing a `sort` parameter', () => {

        it('should return records sorted by type ascending (single word param name)', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    sort: ['type']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('type')).to.equal('monster');
                    done();
                });
        });

        it('should return records sorted by type descending (single word param name)', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    sort: ['-type']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('type')).to.equal('triceratops');
                    done();
                });
        });

        it('should return records sorted by pet.name ascending (table.column param name)', (done) => {
            PersonModel
                .forge()
                .query((qb) => {
                    qb.innerJoin('pet as pets','person.id','pets.person_id');
                })
                .fetchJsonApi({
                    sort: ['pets.name']
                })
                .then((result) => {
                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    done();
                });
        });

        it('should return records sorted by pet.name descending (table.column param name)', (done) => {

            PersonModel
                .forge()
                .query((qb) => {
                    qb.innerJoin('pet as pets','person.id','pets.person_id');
                })
                .fetchJsonApi({
                    sort: ['-pets.name']
                })
                .then((result) => {
                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                    done();
                });
        });

        it('should return records sorted by name ascending (multi-word param name)', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    sort: ['firstName']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                    done();
                });
        });

        it('should return records sorted by name descending (multi-word param name)', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    sort: ['-firstName']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('firstName')).to.equal('Cookie Monster');
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

        it('should include the pets relationship when `include` is a Knex function', (done) => {

            PersonModel
                .where({ id: 1 })
                .fetchJsonApi({
                    include: [{
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
