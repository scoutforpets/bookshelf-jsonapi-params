import Bookshelf from 'bookshelf';
import Knex from 'knex';
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
            user: 'postgres',
            database: 'bookshelf_jsonapi_test',
            charset: 'utf8',
            port: 5432
        }
    };
    const repository = Bookshelf(Knex(dbConfig));

    require('./test-helpers/common')(repository, dbConfig.client);

    // Add postgres specific unit tests
    describe('passing in jsonb filtering', () => {

        it('should return results for json equality filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:species': 'dog'
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('name')).to.equal('Patches');
                    expect(result.models[1].get('name')).to.equal('Grover');
                    expect(result.models[2].get('name')).to.equal('Benny "The Terror" Terrier');
                    done();
                });
        });

        it('should return results for comma separated json equality filter, sorted reverse alphabetically', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:species': 'bird,reptile'
                    },
                    sort: ['-style:species']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Godzilla');
                    expect(result.models[1].get('name')).to.equal('Big Bird');
                    done();
                });
        });

        it('should return results for comma separated json equality filter, sorted alphabetically', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:species': 'bird,reptile'
                    },
                    sort: ['style:species']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Godzilla');
                    done();
                });
        });

        it('should return results for comma separated json equality filter, sorted reverse alphabetically, with only the desired fields', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:species': 'bird,reptile'
                    },
                    sort: ['-style:species'],
                    fields: {
                        pet: ['style:species', 'name']
                    }
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].attributes).to.have.all.keys('name', 'species');
                    expect(result.models[0].attributes).to.not.have.all.keys('id', 'pet_owner_id', 'style');
                    expect(result.models[0].attributes).to.eql({
                        name: 'Godzilla',
                        species: 'reptile'
                    });
                    expect(result.models[1].attributes).to.eql({
                        name: 'Big Bird',
                        species: 'bird'
                    });
                    done();
                });
        });

        it('should return results for json equality filter in nested objects', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:looks.height': 'short'
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('name')).to.equal('Patches');
                    expect(result.models[1].get('name')).to.equal('Grover');
                    expect(result.models[2].get('name')).to.equal('Benny "The Terror" Terrier');
                    done();
                });
        });

        it('should return fields selected from nested json column', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:looks.height': 'short'
                    },
                    fields: {
                        pet: ['style:looks.tail']
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('tail')).to.equal(null);
                    expect(result.models[1].get('tail')).to.equal('long');
                    expect(result.models[2].get('tail')).to.equal('short');
                    done();
                });
        });

        it('should return fields selected from json column in nested objects', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    fields: {
                        pet: ['style:looks.color', 'id']
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(5);
                    expect(result.models[0].attributes).to.have.all.keys('color', 'id');
                    expect(result.models[0].attributes).to.not.have.all.keys('name', 'pet_owner_id', 'style');
                    expect(result.models[0].get('color')).to.equal('yellow');
                    expect(result.models[4].get('color')).to.equal('brown/white');
                    done();
                });
        });

        it('should return single distinct field for json equality filter in nested objects', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    fields: {
                        '': ['style:looks.color']
                    },
                    sort: ['style:looks.color']
                })
                .then((result) => {

                    expect(result.models).to.have.length(4);
                    expect(result.models[0].attributes).to.have.all.keys('color');
                    expect(result.models[0].attributes).to.not.have.all.keys('id', 'name', 'pet_owner_id', 'style');
                    expect(result.models[0].get('color')).to.equal('black');
                    expect(result.models[1].get('color')).to.equal('brown');
                    expect(result.models[2].get('color')).to.equal('brown/white');
                    expect(result.models[3].get('color')).to.equal('yellow');
                    done();
                });
        });

        it('should return results for json contains filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            'style:looks.color': 'brown'
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('name')).to.equal('Patches');
                    expect(result.models[1].get('name')).to.equal('Grover');
                    expect(result.models[2].get('name')).to.equal('Benny "The Terror" Terrier');
                    done();
                });
        });

        it('should return results for comma separated json contains filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            'style:looks.color': 'yel,bl'
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Godzilla');
                    done();
                });
        });


        it('should return results for comma separated json equality filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:looks.color': 'brown,yellow'
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(3);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Patches');
                    expect(result.models[2].get('name')).to.equal('Grover');
                    done();
                });
        });

        it('should return results for json less than filter on integer', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        lt: {
                            'style:age:numeric': 8
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('name')).to.equal('Patches');
                    done();
                });
        });

        it('should return results for json less than or equal filter on integer', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        lte: {
                            'style:age:numeric': 8
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Patches');
                    expect(result.models[1].get('name')).to.equal('Benny "The Terror" Terrier');
                    done();
                });
        });

        it('should return results for json greater than filter on integer', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        gt: {
                            'style:age:numeric': 42
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('name')).to.equal('Godzilla');
                    done();
                });
        });

        it('should return results for json greater than or equal filter on integer', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        gte: {
                            'style:age:numeric': 42
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Godzilla');
                    done();
                });
        });

        it('should return results for json less than filter on timestamp', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        lt: {
                            'style:birthday:timestamp': (new Date('January 1, 1979 01:00:00')).toISOString()
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    done();
                });
        });

        it('should return results for json less than or equal filter on timestamp', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        lte: {
                            'style:birthday:timestamp': (new Date('January 1, 1979 01:00:00')).toISOString()
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Godzilla');
                    done();
                });
        });

        it('should return results for json greater than filter on timestamp', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        gt: {
                            'style:birthday:timestamp': (new Date('July 1, 2016 17:00:41')).toISOString()
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('name')).to.equal('Grover');
                    done();
                });
        });

        it('should return results for json greater than or equal filter on timestamp', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        gte: {
                            'style:birthday:timestamp': (new Date('July 1, 2016 17:00:41')).toISOString()
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Patches');
                    expect(result.models[1].get('name')).to.equal('Grover');
                    done();
                });
        });


        it('should return results for json null filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:looks.tail': null
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(1);
                    expect(result.models[0].get('name')).to.equal('Patches');
                    done();
                });
        });

        it('should return results for json null and equality filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'style:looks.tail': 'null,enourmous'
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Godzilla');
                    expect(result.models[1].get('name')).to.equal('Patches');
                    done();
                });
        });

        it('should return results for json not null filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            'style:looks.tail': null
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(4);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Godzilla');
                    expect(result.models[2].get('name')).to.equal('Grover');
                    expect(result.models[3].get('name')).to.equal('Benny "The Terror" Terrier');
                    done();
                });
        });

        it('should return results for json not equal filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        not: {
                            'style:looks.height': 'short'
                        }
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Godzilla');
                    done();
                });
        });

        it('should return results for json equality filter through a relationship', (done) => {

            repository.Models.PersonModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        'pet.style:looks.color': 'black,yellow'
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('firstName')).to.equal('Barney');
                    expect(result.models[1].get('firstName')).to.equal('Baby Bop');
                    done();
                });
        });

        it('should return results for combined json contains and equality filter', (done) => {

            repository.Models.PetModel
                .forge()
                .fetchJsonApi({
                    filter: {
                        like: {
                            'style:looks.color': 'yel'
                        },
                        'style:looks.color': 'brown/white'
                    },
                    sort: ['id']
                })
                .then((result) => {

                    expect(result.models).to.have.length(2);
                    expect(result.models[0].get('name')).to.equal('Big Bird');
                    expect(result.models[1].get('name')).to.equal('Benny "The Terror" Terrier');
                    done();
                });
        });
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
});
