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

    const ToyModel = repository.Model.extend({
        tableName: 'toy',
        pet: function () {

            return this.belongsTo(PetModel);
        }
    });

    const PetModel = repository.Model.extend({
        tableName: 'pet',
        person: function () {

            return this.belongsTo(PersonModel);
        },
        toy: function () {

            return this.hasOne(ToyModel);
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

                const aggregateFunctions = ['count', 'sum', 'avg', 'max', 'min', 'lower', 'upper'];

                if (_.some(aggregateFunctions, (f) => _.startsWith(key, f + '('))) {
                    result[key] = val;
                }
                else {
                    result[_.snakeCase(key)] = val;
                }

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
            repository.knex.schema.dropTableIfExists('pet'),
            repository.knex.schema.dropTableIfExists('toy')
        )
            .then(() => {

                return Promise.join(
                    repository.knex.schema.createTable('person', (table) => {

                        table.increments('id').primary();
                        table.string('first_name');
                        table.integer('age');
                        table.string('gender');
                        table.string('type');
                    }),
                    repository.knex.schema.createTable('pet', (table) => {

                        table.increments('id').primary();
                        table.string('name');
                        table.integer('person_id');
                    }),
                    repository.knex.schema.createTable('toy', (table) => {

                        table.increments('id').primary();
                        table.string('type');
                        table.integer('pet_id');
                    })
                );
            })
            .then(() => {

                return Promise.join(
                    PersonModel.forge().save({
                        id: 1,
                        firstName: 'Barney',
                        age: 12,
                        gender: 'm',
                        type: 't-rex'
                    }),
                    PersonModel.forge().save({
                        id: 2,
                        firstName: 'Baby Bop',
                        age: 25,
                        gender: 'f',
                        type: 'triceratops'

                    }),
                    PersonModel.forge().save({
                        id: 3,
                        firstName: 'Cookie Monster',
                        age: 70,
                        gender: 'm',
                        type: 'monster'
                    }),
                    PersonModel.forge().save({
                        id: 4,
                        firstName: 'Boo',
                        age: 28,
                        gender: 'f',
                        type: 'nothing, here'
                    }),
                    PersonModel.forge().save({
                        id: 5,
                        firstName: 'Elmo',
                        age: 3,
                        gender: 'm',
                        type: null
                    }),
                    PetModel.forge().save({
                        id: 1,
                        name: 'Big Bird',
                        person_id: 1
                    }),
                    PetModel.forge().save({
                        id: 2,
                        name: 'Godzilla',
                        person_id: 2
                    }),
                    PetModel.forge().save({
                        id: 3,
                        name: 'Patches',
                        person_id: 3
                    }),
                    ToyModel.forge().save({
                        id: 1,
                        type: 'skate',
                        pet_id: 1
                    }),
                    ToyModel.forge().save({
                        id: 2,
                        type: 'car',
                        pet_id: 2
                    })
                );
            })
            .then(() => done());
    });

    after((done) => {

        // Drop the tables when tests are complete
        Promise.join(
            repository.knex.schema.dropTableIfExists('person'),
            repository.knex.schema.dropTableIfExists('pet'),
            repository.knex.schema.dropTableIfExists('toy')
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

                    expect(result.models).to.have.length(5);
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

        it('should return a single record with the matching type as null', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        type: null
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('firstName')).to.equal('Elmo');
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

        it('should return a single record that matches both filters with a null', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        type: 'null,t-rex'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    done();
                });
        });
    });

    describe('passing a `filter[like]` parameter with a single filter', () => {

        it('should return all records that partially matches filter[like]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            first_name: 'Ba'
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    expect(result.models[1].get('firstName')).to.equal('Baby Bop');
                    done();
                });
        });
    });

    describe('passing a `filter[like]` parameter with multiple filters', () => {

        it('should return all records that partially matches both filter[like]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            first_name: 'op,coo'
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                    expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                    done();
                });
        });
    });

    describe('passing a `filter[not]` parameter with a single filter', () => {

        it('should return all records that do not match filter[not]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            first_name: 'Barney'
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(4);
                    expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                    expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                    expect(result.models[2].get('firstName')).to.equal('Boo');
                    expect(result.models[3].get('firstName')).to.equal('Elmo');
                    done();
                });
        });

        it('should return all records that do not match filter[not] with null', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            type: null
                        }
                    }
                })
                .then((result) => {
                    expect(result.models).to.have.length(4);
                    expect(result.models[0].get('type')).to.equal('t-rex');
                    expect(result.models[1].get('type')).to.equal('triceratops');
                    expect(result.models[2].get('type')).to.equal('monster');
                    expect(result.models[3].get('type')).to.equal('nothing, here');
                    done();
                });
        });

        it('should return all records that do not match filter[not] with null as a string', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            type: 'null'
                        }
                    }
                })
                .then((result) => {
                    expect(result.models).to.have.length(4);
                    expect(result.models[0].get('type')).to.equal('t-rex');
                    expect(result.models[1].get('type')).to.equal('triceratops');
                    expect(result.models[2].get('type')).to.equal('monster');
                    expect(result.models[3].get('type')).to.equal('nothing, here');
                    done();
                });
        });
    });

    describe('passing a `filter[not]` parameter with multiple filters', () => {

        it('should return all records that do not match filter[not]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            first_name: 'Barney,Baby Bop,Boo,Elmo'
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('firstName')).to.equal('Cookie Monster');
                    done();
                });
        });

        it('should return all records that do not match filter[not] including null', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            type: 'null,t-rex'
                        }
                    }
                })
                .then((result) => {
                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('type')).to.equal('triceratops');
                    expect(result.models[1].get('type')).to.equal('monster');
                    expect(result.models[2].get('type')).to.equal('nothing, here');
                    done();
                });
        });
    });

    describe('passing a `filter[lt]` parameter', () => {

        it('should return all records that are less than filter[lt]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        lt: {
                            age: 25
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    expect(result.models[1].get('firstName')).to.equal('Elmo');
                    done();
                });
        });
    });

    describe('passing a `filter[lte]` parameter', () => {

        it('should return all records that are less than or equal to filter[lte]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        lte: {
                            age: 25
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    expect(result.models[1].get('firstName')).to.equal('Baby Bop');
                    expect(result.models[2].get('firstName')).to.equal('Elmo');
                    done();
                });
        });
    });

    describe('passing a `filter[gt]` parameter', () => {

        it('should return all records that are greater than filter[gt]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        gt: {
                            age: 25
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('firstName')).to.equal('Cookie Monster');
                    expect(result.models[1].get('firstName')).to.equal('Boo');
                    done();
                });
        });
    });

    describe('passing a `filter[gte]` parameter', () => {

        it('should return all records that are greater than or equal to filter[gte]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        gte: {
                            age: 25
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                    expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                    expect(result.models[2].get('firstName')).to.equal('Boo');
                    done();
                });
        });
    });

    describe('passing a `filter[gte]` and `filter[like]` parameter', () => {

        it('should return all records that are greater than or equal to filter[gte] and a partial match to filter[like]', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        gte: {
                            age: 25
                        },
                        like: {
                            first_name: 'a'
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                    done();
                });
        });
    });


    describe('passing a `filter` parameter for relationships', () => {

        it('should return all records that have a pet with name', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'pets.name': 'Big Bird'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    done();
                });
        });

        it('should return the person named Cookie Monster', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        firstName: 'Cookie Monster',
                        gender: 'm'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('firstName')).to.equal('Cookie Monster');
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

                    expect(result.models).to.have.length(5);
                    expect(result.models[0].get('type')).to.equal(null);
                    expect(result.models[1].get('type')).to.equal('monster');
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

                    expect(result.models).to.have.length(5);
                    expect(result.models[0].get('type')).to.equal('triceratops');
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

                    expect(result.models).to.have.length(5);
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

                    expect(result.models).to.have.length(5);
                    expect(result.models[0].get('firstName')).to.equal('Elmo');
                    done();
                });
        });

        it('should sort on deeply nested resources', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    include: ['pets', 'pets.toy'],
                    sort: ['-pets.toy.type']
                })
                .then((result) => {

                    expect(result.models[0].related('pets').related('toy').get('type')).to.equal('skate');
                    expect(result.models[1].related('pets').related('toy').get('type')).to.equal('car');
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

    describe('escape commas in filter', () => {

        it('should escape the comma and find a result', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        type: 'nothing\\, here'
                    }
                }, false)
                .then((result) => {

                    expect(result).to.be.an('object');
                    expect(result.get('firstName')).to.equal('Boo');
                    done();
                });
        });

        it('should find no results if comma is not escaped', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        type: 'nothing, here'
                    }
                }, false)
                .then((result) => {

                    expect(result).to.equal(null);
                    done();
                });
        });
    });

    describe('like filtering on non-text fields', () => {

        it('should return the should return all record that have an age that contains the digit "2"', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            age: '2'
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    expect(result.models[1].get('firstName')).to.equal('Baby Bop');
                    expect(result.models[2].get('firstName')).to.equal('Boo');
                    done();
                });
        });
    });

    describe('passing a `fields` parameter with an aggregate function', () => {

        it('should return the total count of records', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    fields: {
                        person: ['count(id)']
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('count')).to.equal(5);
                    done();
                });
        });

        it('should return the average age per gender', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    fields: {
                        person: ['avg(age)','gender']
                    },
                    group: ['gender']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('gender')).to.equal('f');
                    expect(result.models[0].get('avg')).to.equal((25 + 28) / 2);
                    expect(result.models[1].get('gender')).to.equal('m');
                    expect(result.models[1].get('avg')).to.equal((12 + 70 + 3) / 3);
                    done();
                });
        });

        it('should return the sum of the ages of persons with firstName containing \'Ba\'', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            first_name: 'Ba'
                        }
                    },
                    fields: {
                        person: ['sum(age)']
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('sum')).to.equal(37);
                    done();
                });
        });
    });

    describe('passing a `filter` parameter with a function', () => {

        it('should return the person whose lowercase name equals to \'barney\'', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'lower(first_name)': 'barney'
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    done();
                });
        });

        it('should return persons whose lowercase name is not \'barney\'', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            'lower(first_name)': 'barney'
                        }
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(4);
                    done();
                });
        });
    });

    describe('passing in an additional query', () => {

        it('should return the total count of records', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({}, undefined, undefined, (qb) => {

                    qb.count('id');
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('countId')).to.equal(5);
                    done();
                });
        });

        it('should return the average age per gender', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({}, undefined, undefined, (qb) => {

                    qb.groupBy('gender').select('gender').avg('age');
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('gender')).to.equal('f');
                    expect(result.models[0].get('avgAge')).to.equal((25 + 28) / 2);
                    expect(result.models[1].get('gender')).to.equal('m');
                    expect(result.models[1].get('avgAge')).to.equal((12 + 70 + 3) / 3);
                    done();
                });
        });

        it('should return the sum of the ages of persons with firstName containing \'Ba\'', (done) => {

            PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            first_name: 'Ba'
                        }
                    }
                }, undefined, undefined, (qb) => {

                    qb.sum('age');
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('sumAge')).to.equal(37);
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
                    expect(result.pagination.pageCount).to.equal(5);
                    done();
                });
        });
    });

});
