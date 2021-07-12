import Chai from 'chai';
const expect = Chai.expect;
Chai.use(expect);
import _ from 'lodash';
import JsonApiParams from '../../src/index';
import Promise from 'bluebird';
export default function (repository, dbClient) {

    describe('common tests', () => {

        repository.Models = {};

        repository.Models.MovieModel = repository.Model.extend({
            tableName: 'movie',
        
            format: function (attrs) {
                // This recreates the format behavior for those working with knex
                return _.reduce(attrs, (result, val, key) => {

                    const columnComponentParts = key.split('.').map(_.snakeCase);
                    result[columnComponentParts.join('.')] = val;
                    return result;
                }, {});
            }
        });

        repository.Models.HouseModel = repository.Model.extend({
            tableName: 'house',
            people: function () {

                return this.belongsToMany(repository.Models.PersonModel, 'person_house', 'house_id', 'person_id');
            },

            format: function (attrs) {
                // This recreates the format behavior for those working with knex
                return _.reduce(attrs, (result, val, key) => {

                    const columnComponentParts = key.split('.').map(_.snakeCase);
                    result[columnComponentParts.join('.')] = val;
                    return result;
                }, {});
            }
        });

        repository.Models.ToyModel = repository.Model.extend({
            tableName: 'toy',
            pet: function () {

                return this.belongsTo(repository.Models.PetModel, 'pet_id');
            },
            owner: function () {

                return this.belongsTo(repository.Models.PersonModel, 'pet_owner_id').through(repository.Models.PetModel, 'pet_id');
            },

            format: function (attrs) {
                // This recreates the format behavior for those working with knex
                return _.reduce(attrs, (result, val, key) => {

                    const columnComponentParts = key.split('.').map(_.snakeCase);
                    result[columnComponentParts.join('.')] = val;
                    return result;
                }, {});
            }
        });

        repository.Models.PetModel = repository.Model.extend({
            tableName: 'pet',
            petOwner: function () {

                return this.belongsTo(repository.Models.PersonModel, 'pet_owner_id');
            },
            toy: function () {

                return this.hasOne(repository.Models.ToyModel);
            },
            format: function (attrs) {
                // This recreates the format behavior for those working with knex
                return _.reduce(attrs, (result, val, key) => {

                    const columnComponentParts = key.split('.').map(_.snakeCase);
                    result[columnComponentParts.join('.')] = val;
                    return result;
                }, {});
            }
        });

        repository.Models.PersonModel = repository.Model.extend({
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

                    const aggregateFunctions = ['count', 'sum', 'avg', 'max', 'min'];

                    if (_.some(aggregateFunctions, (f) => _.startsWith(key, f + '('))) {
                        result[key] = val;
                    }
                    else {
                        result[_.snakeCase(key)] = val;
                    }

                    return result;
                }, {});
            },

            pet: function () {

                return this.hasOne(repository.Models.PetModel, 'pet_owner_id');
            },

            houses: function () {

                return this.belongsToMany(repository.Models.HouseModel, 'person_house', 'person_id', 'house_id');
            }
        });


        before((done) => {

            // Register the plugin with Bookshelf
            repository.plugin(JsonApiParams);

            // Build the schema and add some data
            Promise.join(
                repository.knex.schema.dropTableIfExists('person_house'),
                repository.knex.schema.dropTableIfExists('movie'),
                repository.knex.schema.dropTableIfExists('house'),
                repository.knex.schema.dropTableIfExists('person'),
                repository.knex.schema.dropTableIfExists('pet'),
                repository.knex.schema.dropTableIfExists('toy')
            ).then(() => {

                return Promise.join(
                    repository.knex.schema.createTable('house', (table) => {

                        table.increments('id').primary();
                        table.string('color');
                        table.string('year_built');
                        table.integer('bedrooms');
                        table.integer('bathrooms');
                    }),
                    repository.knex.schema.createTable('movie', (table) => {

                        table.increments('id').primary();
                        table.string('name');
                        table.string('type');
                    }),
                    repository.knex.schema.createTable('person', (table) => {

                        table.increments('id').primary();
                        table.string('first_name');
                        table.integer('age');
                        table.string('gender');
                        table.string('type');
                    }),
                    repository.knex.schema.createTable('person_house', (table) => {

                        table.increments('id').primary();
                        table.integer('person_id');
                        table.integer('house_id');
                    }),
                    repository.knex.schema.createTable('pet', (table) => {

                        table.increments('id').primary();
                        table.string('name');
                        table.integer('pet_owner_id');
                        table.jsonb('style');
                    }),
                    repository.knex.schema.createTable('toy', (table) => {

                        table.increments('id').primary();
                        table.string('type');
                        table.string('color');
                        table.integer('pet_id');

                    })
                );
            }).then(() => {

                return Promise.join(
                    repository.Models.HouseModel.forge().save({
                        id: 1,
                        color: 'yellow',
                        year_built: '1957',
                        bedrooms: 3,
                        bathrooms: 4
                    }),
                    repository.Models.PersonModel.forge().save({
                        id: 1,
                        firstName: 'Barney',
                        age: 12,
                        gender: 'm',
                        type: 't-rex'
                    }),
                    repository.Models.PersonModel.forge().save({
                        id: 2,
                        firstName: 'Baby Bop',
                        age: 25,
                        gender: 'f',
                        type: 'triceratops'

                    }),
                    repository.Models.PersonModel.forge().save({
                        id: 3,
                        firstName: 'Cookie Monster',
                        age: 70,
                        gender: 'm',
                        type: 'monster'
                    }),
                    repository.Models.PersonModel.forge().save({
                        id: 4,
                        firstName: 'Boo',
                        age: 28,
                        gender: 'f',
                        type: 'nothing, here'
                    }),
                    repository.Models.PersonModel.forge().save({
                        id: 5,
                        firstName: 'Elmo',
                        age: 3,
                        gender: 'm',
                        type: null
                    }),
                    repository.knex('person_house').insert({
                        house_id: 1,
                        person_id: 1
                    }),
                    repository.knex('person_house').insert({
                        house_id: 1,
                        person_id: 3
                    }),
                    repository.Models.PetModel.forge().save({
                        id: 1,
                        name: 'Big Bird',
                        pet_owner_id: 1,
                        style: {
                            species: 'bird',
                            age: 42,
                            birthday: new Date('March 20, 1969  03:24:00'),
                            looks: {
                                color: 'yellow',
                                height: 'tall',
                                tail: 'small'
                            }
                        }
                    }),
                    repository.Models.PetModel.forge().save({
                        id: 2,
                        name: 'Godzilla',
                        pet_owner_id: 2,
                        style: {
                            species: 'reptile',
                            age: 62394,
                            birthday: new Date('January 1, 1979 01:00:00'),
                            looks: {
                                color: 'black',
                                height: 'monsterous',
                                tail: 'enourmous'
                            }
                        }
                    }),
                    repository.Models.PetModel.forge().save({
                        id: 3,
                        name: 'Patches',
                        pet_owner_id: 3,
                        style: {
                            species: 'dog',
                            age: 4,
                            birthday: new Date('July 1, 2016 17:00:41'),
                            looks: {
                                color: 'brown',
                                height: 'short',
                                tail: null
                            }
                        }
                    }),
                    repository.Models.PetModel.forge().save({
                        id: 4,
                        name: 'Grover',
                        pet_owner_id: 1,
                        style: {
                            species: 'dog',
                            age: 12,
                            birthday: new Date('July 24, 2016 06:42:48'),
                            looks: {
                                color: 'brown',
                                height: 'short',
                                tail: 'long'
                            }
                        }
                    }),
                    repository.Models.PetModel.forge().save({
                        id: 5,
                        name: 'Benny "The Terror" Terrier',
                        pet_owner_id: 2,
                        style: {
                            species: 'dog',
                            age: 8,
                            birthday: new Date('July 8, 2015 13:53:21'),
                            looks: {
                                color: 'brown/white',
                                height: 'short',
                                tail: 'short'
                            }
                        }
                    }),
                    repository.Models.ToyModel.forge().save({
                        id: 1,
                        type: 'skate',
                        color: 'red',
                        pet_id: 1
                    }),
                    repository.Models.ToyModel.forge().save({
                        id: 2,
                        type: 'car',
                        color: 'black',
                        pet_id: 2
                    }),
                    repository.Models.MovieModel.forge().save({
                        id: 1,
                        name: 'Gone',
                        type: 'null'
                    }),
                    repository.Models.MovieModel.forge().save({
                        id: 2,
                        name: 'Spider',
                        type: null
                    }),
                    repository.Models.MovieModel.forge().save({
                        id: 3,
                        name: 'Go',
                        type: '_null_'
                    })
                );
            }).then(() => done());
        });

        describe('passing null values and strings', () => {

            before((done) => {

                repository.plugin(JsonApiParams, {
                    nullString: '_null_'
                });
                done();
            });

            it('should return value null while passing _null_', (done) => {

                repository.Models.MovieModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            'type': '_null_'
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(result.models[0].get('name')).to.equal('Spider');
                        done();
                    });
            });

            it('should return value null while passing value', (done) => {

                repository.Models.MovieModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            'type': null
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(result.models[0].get('name')).to.equal('Spider');
                        done();
                    });
            });

            it('should return string null while passing null', (done) => {

                repository.Models.MovieModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            'type': 'null'
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(result.models[0].get('name')).to.equal('Gone');
                        done();
                    });
            });

            after((done) => {

                repository.plugin(JsonApiParams, {});
                done();
            });
        });

        describe('passing no parameters', () => {

            it('should return a single record', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi(null, false)
                    .then((person) => {

                        expect(person.get('firstName')).to.equal('Barney');
                        expect(person.get('gender')).to.equal('m');
                        done();
                    });
            });

            it('should return multiple records', (done) => {

                repository.Models.PersonModel
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

                repository.Models.PersonModel
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

            it('should only return the specified field for the record with a type specified', (done) => {

                repository.Models.PersonModel
                    .where({ id: 2 })
                    .fetchJsonApi({
                        fields: {
                            peoples: ['firstName']
                        }
                    }, false, 'peoples')
                    .then((person) => {

                        expect(person.get('firstName')).to.equal('Baby Bop');
                        expect(person.get('gender')).to.be.undefined;
                        done();
                    });
            });

            it('should only return the specified field for the included relationship', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: [{
                            pet(qb) {

                                qb.select('name');
                            }
                        }]
                    }, false)
                    .then((person) => {

                        expect(person.get('firstName')).to.equal('Barney');
                        expect(person.related('pet').get('name')).to.equal('Big Bird');
                        expect(person.related('pet').get('style')).to.be.undefined;
                        done();
                    });
            });

            it('should return all fields when adding where clause to included query', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: [{
                            pet(qb) {

                                qb.where('name', 'Big Bird');
                            }
                        }]
                    }, false)
                    .then((person) => {

                        expect(person.get('firstName')).to.equal('Barney');
                        expect(person.related('pet').get('name')).to.equal('Big Bird');
                        expect(person.related('pet').get('style')).to.not.be.undefined;
                        done();
                    });
            });

            it('should only return the specified field for the included relationship combined with fields parameter', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: [{
                            pet(qb) {

                                qb.select('name');
                            }
                        }],
                        fields: {
                            pet: ['style']
                        }
                    }, false)
                    .then((person) => {

                        expect(person.get('firstName')).to.equal('Barney');
                        expect(person.related('pet').get('name')).to.equal('Big Bird');
                        expect(person.related('pet').get('style')).to.not.be.undefined;
                        done();
                    });
            });

            it('should only return the specified field for the included relationship', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: ['pet'],
                        fields: {
                            pet: ['name']
                        }
                    }, false)
                    .then((person) => {

                        expect(person.get('firstName')).to.equal('Barney');

                        expect(person.related('pet').get('name')).to.equal('Big Bird');
                        expect(person.related('pet').get('style')).to.be.undefined;
                        done();
                    });
            });

            it('should only return the specified field for the included relationship and base model', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: ['pet.toy'],
                        fields: {
                            person: ['firstName'],
                            pet: ['name'],
                            'pet.toy': ['type']
                        }
                    }, false)
                    .then((person) => {

                        expect(person.get('firstName')).to.equal('Barney');
                        expect(person.get('gender')).to.be.undefined;

                        expect(person.related('pet').get('name')).to.equal('Big Bird');
                        expect(person.related('pet').get('style')).to.be.undefined;

                        expect(person.related('pet').related('toy').get('type')).to.equal('skate');
                        expect(person.related('pet').related('toy').get('color')).to.be.undefined;
                        done();
                    });
            });

            it('should only return the specified field for the included relationship and base model using belongsToMany', (done) => {

                repository.Models.HouseModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: ['people'],
                        fields: {
                            house: ['id'],
                            people: ['firstName']
                        }
                    }, false)
                    .then((house) => {

                        expect(house.id).to.not.be.undefined;
                        expect(house.get('color')).to.be.undefined;
                        const people = house.related('people');
                        people.forEach((person) => {

                            expect(person.get('firstName')).to.not.be.undefined;
                            expect(person.get('gender')).to.be.undefined;
                        });
                        done();
                    });
            });

            it('should only return the specified field for the included relationship and base model using belongsTo.through', (done) => {

                repository.Models.ToyModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: ['owner'],
                        fields: {
                            toy: ['id'],
                            owner: ['firstName']
                        }
                    }, false)
                    .then((toy) => {

                        expect(toy.get('id')).to.equal(1);
                        expect(toy.get('color')).to.be.undefined;

                        expect(toy.related('owner').get('firstName')).to.equal('Barney');
                        expect(toy.related('owner').get('gender')).to.be.undefined;

                        done();
                    });
            });
        });

        describe('passing a `filters` parameter with a single filter', () => {

            it('should return a single record with the matching id', (done) => {

                repository.Models.PersonModel
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

                repository.Models.PersonModel
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

        describe('passing a `sort` parameter', () => {

            it('should return records sorted by type ascending (single word param name)', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        sort: ['type']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(5);
                        let nullIndex = 0;
                        let monsterIndex = 1;
                        // postgres returns nulls last
                        if (dbClient === 'pg') {
                            nullIndex = 4;
                            monsterIndex = 0;
                        }
                        expect(result.models[nullIndex].get('type')).to.equal(null);
                        expect(result.models[monsterIndex].get('type')).to.equal('monster');
                        done();
                    });
            });

            it('should return records sorted by type descending (single word param name)', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        sort: ['-type']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(5);
                        // postgres returns nulls first
                        let nullIndex = 4;
                        let triIndex = 0;
                        if (dbClient === 'pg') {
                            nullIndex = 0;
                            triIndex = 1;
                        }
                        expect(result.models[triIndex].get('type')).to.equal('triceratops');
                        expect(result.models[nullIndex].get('type')).to.equal(null);
                        done();
                    });
            });

            it('should return records sorted by name ascending (multi-word param name)', (done) => {

                repository.Models.PersonModel
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

                repository.Models.PersonModel
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

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        include: ['pet.toy'],
                        sort: ['-pet.toy.type'],
                        filter: {
                            not: {
                                'pet.toy.type': null
                            }
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(2);
                        expect(result.models[0].related('pet').related('toy').get('type')).to.equal('skate');
                        expect(result.models[1].related('pet').related('toy').get('type')).to.equal('car');
                        done();
                    });
            });
        });

        describe('passing a `filters` parameter with multiple filters', () => {

            it('should return a single record that matches both filters when passing in a comma separated string', (done) => {

                repository.Models.PersonModel
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

            it('should return a single record that matches both filters when passing in an array', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            type: ['t-rex', 'triceratops']
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(2);
                        done();
                    });
            });

            it('should return a single record that matches both filters with a null', (done) => {

                repository.Models.PersonModel
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

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Barney');
                        expect(result.models[1].get('firstName')).to.equal('Baby Bop');
                        done();
                    });
            });
        });

        describe('passing a `filter[like]` parameter with multiple filters', () => {

            it('should return all records that partially matches both filter[like]', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                        expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                        done();
                    });
            });
        });

        describe('passing a `filter[like]` parameter with an equality filter of the same column', () => {

            it('should return all records that partially matches both filter[like] and equality filters', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            like: {
                                first_name: 'op'
                            },
                            first_name: 'Cookie Monster'
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(2);
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                        expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                        done();
                    });
            });
        });

        describe('passing a `filter[not]` parameter with a single filter', () => {

            it('should return all records that do not match filter[not]', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                        expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                        expect(result.models[2].get('firstName')).to.equal('Boo');
                        expect(result.models[3].get('firstName')).to.equal('Elmo');
                        done();
                    });
            });

            it('should return all records that do not match filter[not] with null', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('type')).to.equal('t-rex');
                        expect(result.models[1].get('type')).to.equal('triceratops');
                        expect(result.models[2].get('type')).to.equal('monster');
                        expect(result.models[3].get('type')).to.equal('nothing, here');
                        done();
                    });
            });

            it('should return all records that do not match filter[not] with null as a string', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('type')).to.equal('t-rex');
                        expect(result.models[1].get('type')).to.equal('triceratops');
                        expect(result.models[2].get('type')).to.equal('monster');
                        expect(result.models[3].get('type')).to.equal('nothing, here');
                        done();
                    });
            });
        });

        describe('passing a `filter[not]` parameter with multiple filters', () => {

            it('should return all records that do not match filter[not] as comma separated string', (done) => {

                repository.Models.PersonModel
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

            it('should return all records that do not match filter[not] as array of strings', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            not: {
                                first_name: ['Barney', 'Baby Bop', 'Boo', 'Elmo']
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

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('type')).to.equal('triceratops');
                        expect(result.models[1].get('type')).to.equal('monster');
                        expect(result.models[2].get('type')).to.equal('nothing, here');
                        done();
                    });
            });
        });

        describe('passing a `filter[lt]` parameter', () => {

            it('should return all records that are less than filter[lt]', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Barney');
                        expect(result.models[1].get('firstName')).to.equal('Elmo');
                        done();
                    });
            });
        });

        describe('passing a `filter[lte]` parameter', () => {

            it('should return all records that are less than or equal to filter[lte]', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Barney');
                        expect(result.models[1].get('firstName')).to.equal('Baby Bop');
                        expect(result.models[2].get('firstName')).to.equal('Elmo');
                        done();
                    });
            });
        });

        describe('passing a `filter[gt]` parameter', () => {

            it('should return all records that are greater than filter[gt]', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Cookie Monster');
                        expect(result.models[1].get('firstName')).to.equal('Boo');
                        done();
                    });
            });
        });

        describe('passing a `filter[gte]` parameter', () => {

            it('should return all records that are greater than or equal to filter[gte]', (done) => {

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Baby Bop');
                        expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                        expect(result.models[2].get('firstName')).to.equal('Boo');
                        done();
                    });
            });
        });

        describe('passing a `filter[gte]` and `filter[like]` parameter', () => {

            it('should return all records that are greater than or equal to filter[gte] and a partial match to filter[like]', (done) => {

                repository.Models.PersonModel
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

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            'pet.name': 'Big Bird'
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(result.models[0].get('firstName')).to.equal('Barney');
                        done();
                    });
            });

            it('should return the person named Cookie Monster', (done) => {

                repository.Models.PersonModel
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

        describe('passing in "or" filtering', () => {

            it('should return results for "or" filters combination', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            or: [
                                { type: 'monster' },
                                { type: 't-rex' }
                            ]
                        },
                        sort: ['id']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(2);
                        expect(result.models[0].get('firstName')).to.equal('Barney');
                        expect(result.models[1].get('firstName')).to.equal('Cookie Monster');
                        done();
                    });
            });

            it('should return results for "or" filters for nested objects', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        include: ['pet.toy'],
                        filter: {
                            or: [
                                {
                                    like: {
                                        'pet.toy.type': 'skat'
                                    }
                                },
                                { type: 'monster' }
                            ]
                        },
                        sort: ['id']
                    })
                    .then((result) => {

                        expect(result.models[0].related('pet').related('toy').get('type')).to.equal('skate');
                        expect(result.models[1].get('type')).to.equal('monster');
                        done();
                    });
            });


            it('should return results for nested "or" filters for nested objects', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        include: ['pet.toy'],
                        filter: {
                            or: [
                                {
                                    or: [
                                        {
                                            like: {
                                                'pet.toy.type': 'skat'
                                            }
                                        },
                                        { type: 'monster' }
                                    ]
                                }
                            ]
                        },
                        sort: ['id']
                    })
                    .then((result) => {

                        expect(result.models[0].related('pet').related('toy').get('type')).to.equal('skate');
                        expect(result.models[1].get('type')).to.equal('monster');
                        done();
                    });
            });


            it('should return results for "or" filters combined with equality filter', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            or: [
                                { like: { type: 'rex' } },
                                { firstName: 'Cookie Monster', type: 'monster' }
                            ],
                            age: 70
                        },
                        sort: ['id']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(result.models[0].get('firstName')).to.equal('Cookie Monster');
                        done();
                    });
            });

            it('should return results for "or" filters combined with filter objects', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            or: [
                                { like: { firstName: 'abyr' } },
                                { firstName: 'Cookie Monster,Boo' }
                            ],
                            lt: { age: 30 },
                            not: { age: 70 }
                        },
                        sort: ['id']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(result.models[0].get('firstName')).to.equal('Boo');
                        done();
                    });
            });
        });

        describe('passing an `include` parameter', () => {

            it('should include the pet relationship', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: ['pet']
                    }, false)
                    .then((result) => {

                        const relation = result.related('pet');

                        expect(result).to.be.an('object');
                        expect(relation).to.exist;
                        expect(relation.get('name')).to.equal('Big Bird');
                        done();
                    });
            });

            it('should include the pet relationship when `include` is a Knex function', (done) => {

                repository.Models.PersonModel
                    .where({ id: 1 })
                    .fetchJsonApi({
                        include: [{
                            'pet': (qb) => {

                                qb.where({ name: 'Barney' });
                            }
                        }]
                    }, false)
                    .then((result) => {

                        const relation = result.related('pet');

                        expect(result).to.be.an('object');
                        expect(relation.id).to.not.exist;
                        done();
                    });
            });
        });

        describe('escape commas in filter', () => {

            it('should escape the comma and find a result', (done) => {

                repository.Models.PersonModel
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

                repository.Models.PersonModel
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

                repository.Models.PersonModel
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
                        result.models = _.sortBy(result.models, ['id']);
                        expect(result.models[0].get('firstName')).to.equal('Barney');
                        expect(result.models[1].get('firstName')).to.equal('Baby Bop');
                        expect(result.models[2].get('firstName')).to.equal('Boo');
                        done();
                    });
            });
        });

        describe('passing a `fields` parameter with an aggregate function', () => {

            it('should return the total count of records', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        fields: {
                            person: ['count(id)']
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(parseInt(result.models[0].get('count'))).to.equal(5);
                        done();
                    });
            });

            it('should return the average age per gender', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        fields: {
                            person: ['avg(age)','gender']
                        },
                        group: ['gender'],
                        sort: ['gender']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(2);
                        expect(result.models[0].get('gender')).to.equal('f');
                        expect(parseFloat(result.models[0].get('avg'))).to.equal((25 + 28) / 2);
                        expect(result.models[1].get('gender')).to.equal('m');
                        expect(parseFloat(result.models[1].get('avg'))).to.equal((12 + 70 + 3) / 3);
                        done();
                    });
            });

            it('should return the average age per gender when group is a string', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        fields: {
                            person: ['avg(age)','gender']
                        },
                        group: 'gender',
                        sort: ['gender']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(2);
                        expect(result.models[0].get('gender')).to.equal('f');
                        expect(parseFloat(result.models[0].get('avg'))).to.equal((25 + 28) / 2);
                        expect(result.models[1].get('gender')).to.equal('m');
                        expect(parseFloat(result.models[1].get('avg'))).to.equal((12 + 70 + 3) / 3);
                        done();
                    });
            });

            it('should return the sum of the ages of persons with firstName containing \'Ba\'', (done) => {

                repository.Models.PersonModel
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
                        expect(parseInt(result.models[0].get('sum'))).to.equal(37);
                        done();
                    });
            });
        });

        describe('passing in an additional query', () => {

            it('should return the total count of records', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({}, undefined, undefined, (qb) => {

                        qb.count('id as countId');
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(parseInt(result.models[0].get('countId'))).to.equal(5);
                        done();
                    });
            });

            it('should return the average age per gender', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({}, undefined, undefined, (qb) => {

                        qb.groupBy('gender').select('gender').avg('age as avgAge').orderBy('gender');
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(2);
                        expect(result.models[0].get('gender')).to.equal('f');
                        expect(parseFloat(result.models[0].get('avgAge'))).to.equal((25 + 28) / 2);
                        expect(result.models[1].get('gender')).to.equal('m');
                        expect(parseFloat(result.models[1].get('avgAge'))).to.equal((12 + 70 + 3) / 3);
                        done();
                    });
            });

            it('should return the sum of the ages of persons with firstName containing \'Ba\'', (done) => {

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            like: {
                                first_name: 'Ba'
                            }
                        }
                    }, undefined, undefined, (qb) => {

                        qb.sum('age as sumAge');
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(parseInt(result.models[0].get('sumAge'))).to.equal(37);
                        done();
                    });
            });
        });

        describe('Filtering by string values which contain quotes', () => {

            it('should maintain quotes when it builds the filter', (done) => {

                repository.Models.PetModel
                    .forge()
                    .fetchJsonApi({
                        filter: {
                            name: 'Benny "The Terror" Terrier'
                        }
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        done();
                    });
            });
        });

        it('should return the oldest house', (done) => {

            repository.Models.HouseModel
                .forge()
                .fetchJsonApi({
                    fields: {
                        house: ['min(year_built)']
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(parseInt(result.models[0].get('min'))).to.equal(1957);
                    done();
                });
        });

        describe('Sorting by multiple columns with a mix of camelCase values', () => {

            it('should generate valid SQL', (done) => {

                repository.Models.PetModel
                    .forge()
                    .fetchJsonApi({
                        sort: ['-petOwner.age', 'name']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(5);
                        expect(result.models[3].get('name')).to.equal('Big Bird');
                        expect(result.models[4].get('name')).to.equal('Grover');
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

                repository.Models.PersonModel
                    .forge()
                    .fetchJsonApi({
                        sort: ['id']
                    })
                    .then((result) => {

                        expect(result.models).to.have.length(1);
                        expect(result.models[0].get('id')).to.equal(1);
                        expect(result.pagination.pageCount).to.equal(5);
                        done();
                    });
            });

            after((done) => {

                repository.plugin(JsonApiParams, {});
                done();
            });
        });
    });
};
