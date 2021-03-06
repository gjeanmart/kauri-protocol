'use strict';
(async () => {

  let ContentSpaceRegistry = artifacts.require('ContentSpaceRegistry.sol');
  let catchRevert = require('./exceptions.js').catchRevert;
  let EthUtil = require('ethereumjs-util');
  let registryInstance;

  contract('ContentSpaceRegistry', function(accounts) {

    beforeEach(async () => {
        registryInstance = await ContentSpaceRegistry.new()
    })


    /*******************
     * HAPPY PATH
     ********************/
    it('should create a space', async () => {
        const spaceId = 'HelloWorld';
        const owner = accounts[0];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);
    });

    it('should publish a revision', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx1';
        const owner = accounts[0];
        const author = accounts[0];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision = await pushRevision(spaceId, revisionHash, null, {'from': author});
        assert.equal(revision.hash, revisionHash);
        assert.equal(revision.author, author);
        assert.equal(revision.state, 'PUBLISHED');
    });

    it('should be pending', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx2';
        const owner = accounts[0];
        const author = accounts[1];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision = await pushRevision(spaceId, revisionHash, null,{'from': author});
        assert.equal(revision.hash, revisionHash);
        assert.equal(revision.author, author);
        assert.equal(revision.state, 'PENDING');
    });

    it('should be published after approval', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx3';
        const owner = accounts[0];
        const author = accounts[1];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision1 = await pushRevision(spaceId, revisionHash, null,{'from': author});
        assert.equal(revision1.hash, revisionHash);
        assert.equal(revision1.author, author);
        assert.equal(revision1.state, 'PENDING');

        const revision2 = await approveRevision(spaceId, revisionHash, {'from': owner});
        assert.equal(revision2.hash, revisionHash);
        assert.equal(revision2.author, author);
        assert.equal(revision2.state, 'PUBLISHED');
    });

    it('should be rejected after rejection', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx4';
        const owner = accounts[0];
        const author = accounts[1];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision1 = await pushRevision(spaceId, revisionHash, null,{'from': author});
        assert.equal(revision1.hash, revisionHash);
        assert.equal(revision1.author, author);
        assert.equal(revision1.state, 'PENDING');

        const revision2 = await rejectRevision(spaceId, revisionHash, {'from': owner});
        assert.equal(revision2.hash, revisionHash);
        assert.equal(revision2.author, author);
        assert.equal(revision2.state, 'PUBLISHED');
    });

    it('should have two revisions', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash1 = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx4';
        const revisionHash2 = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx5';
        const owner = accounts[0];
        const author = accounts[0];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision1 = await pushRevision(spaceId, revisionHash1, null,{'from': author});
        assert.equal(revision1.hash, revisionHash1);
        assert.equal(revision1.parent, '');
        assert.equal(revision1.author, author);
        assert.equal(revision1.state, 'PUBLISHED');

        const revision2 = await pushRevision(spaceId, revisionHash2, revisionHash1,{'from': author});
        assert.equal(revision2.hash, revisionHash2);
        assert.equal(revision2.parent, revisionHash1);
        assert.equal(revision2.author, author);
        assert.equal(revision2.state, 'PUBLISHED');
    });

    it('should have a lastRevision', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx1';
        const owner = accounts[0];
        const author = accounts[0];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision = await pushRevision(spaceId, revisionHash, null, {'from': author});
        assert.equal(revision.hash, revisionHash);
        assert.equal(revision.author, author);
        assert.equal(revision.state, 'PUBLISHED');

        const testSpace = await getSpace(spaceId);
        assert.equal(testSpace.id, spaceId);
        assert.equal(testSpace.owner, owner);
        assert.equal(testSpace.lastRevision, revisionHash);
    });



    /*******************
     * META TRANSACTION
     ********************/
    it('should create a space with metatransaction', async () => {
        const etherless = {
          "privatekey": "43f2ee33c522046e80b67e96ceb84a05b60b9434b0ee2e3ae4b1311b9f5dcc46",
          "account": "0xBd2e9CaF03B81e96eE27AD354c579E1310415F39"
        }

        const spaceId = 'HelloWorld Meta';
        const owner = etherless.account;
        const relayer = accounts[1];

        const nonce = await getNonce(owner);
        const hash = await metaCreateSpaceHash(spaceId, owner, nonce);
        const signature = await sign(etherless.privatekey, hash);

        const space = await metaCreateSpace(spaceId, owner, nonce, signature, {'from': relayer});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);
    })

    /*******************
     * EXCEPTION
     ********************/
    it('should throw an exception because space already exists', async () => {
      const spaceId = 'HelloWorld';
      const owner = accounts[0];

      const space = await createSpace(spaceId, owner, {'from': owner});
      assert.equal(space.id, spaceId);
      assert.equal(space.owner, owner);

      await catchRevert(createSpace(spaceId, owner, {'from': owner}));
    });

    it('should throw an exception because space doesn\'t exist', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx5';
        const owner = accounts[0];
        const author = accounts[0];

        await catchRevert(pushRevision(spaceId, revisionHash, null, {'from': author}));
    });

    it('should throw an exception because revision already exist', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx7';
        const owner = accounts[0];
        const author = accounts[0];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision = await pushRevision(spaceId, revisionHash, null, {'from': author});
        assert.equal(revision.hash, revisionHash);
        assert.equal(revision.author, author);
        assert.equal(revision.state, 'PUBLISHED');

        await catchRevert(pushRevision(spaceId, revisionHash, null, {'from': author}));
    });

    it('should throw an exception because author can\'t approve revision', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx8';
        const owner = accounts[0];
        const author = accounts[1];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision = await pushRevision(spaceId, revisionHash, null, {'from': author});
        assert.equal(revision.hash, revisionHash);
        assert.equal(revision.author, author);
        assert.equal(revision.state, 'PENDING');

        await catchRevert(approveRevision(spaceId, revisionHash, {'from': author}));
    });

    it('should throw an exception because author can\'t approve revision', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx9';
        const owner = accounts[0];
        const author = accounts[1];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision = await pushRevision(spaceId, revisionHash, null, {'from': author});
        assert.equal(revision.hash, revisionHash);
        assert.equal(revision.author, author);
        assert.equal(revision.state, 'PENDING');

        await catchRevert(approveRevision(spaceId, revisionHash, {'from': author}));
    });

    it('should throw an exception because author revision doesn\'t exist', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx10';
        const owner = accounts[0];
        const author = accounts[1];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        await catchRevert(approveRevision(spaceId, revisionHash, {'from': owner}));
    });

    it('should throw an exception because author revision not pending', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx11';
        const owner = accounts[0];
        const author = accounts[0];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision = await pushRevision(spaceId, revisionHash, null, {'from': author});
        assert.equal(revision.hash, revisionHash);
        assert.equal(revision.author, author);
        assert.equal(revision.state, 'PUBLISHED');

        await catchRevert(approveRevision(spaceId, revisionHash, {'from': author}));
    });


    it('should not accept a second revision without parent', async () => {
        const spaceId = 'HelloWorld';
        const revisionHash1 = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx4';
        const revisionHash2 = 'zdpuAsTWohStBokD3tDRuFDSpveBTtQrZbfHZKjjBoLYRrvx5';
        const owner = accounts[0];
        const author = accounts[0];

        const space = await createSpace(spaceId, owner, {'from': owner});
        assert.equal(space.id, spaceId);
        assert.equal(space.owner, owner);

        const revision1 = await pushRevision(spaceId, revisionHash1, null, {'from': author});
        assert.equal(revision1.hash, revisionHash1);
        assert.equal(revision1.parent, '');
        assert.equal(revision1.author, author);
        assert.equal(revision1.state, 'PUBLISHED');

        await catchRevert(pushRevision(spaceId, revisionHash2, null, {'from': author}));
    });

  });



  async function createSpace(spaceId, owner, args) {
    await registryInstance.createSpace(web3.utils.fromAscii(spaceId), owner, args);
    return await getSpace(spaceId);
  };

  async function getSpace(spaceId) {
    let result = await registryInstance.getContentSpace(web3.utils.fromAscii(spaceId));

    return {
      'id': web3.utils.toAscii(result[0]).replace(/\u0000/g, ''),
      'owner': result[1],
      'lastRevision': result[2]
    };
  };

  async function pushRevision(spaceId, revisionHash, parentRevisionHash, args) {
    await registryInstance.pushRevision(web3.utils.fromAscii(spaceId), revisionHash, parentRevisionHash || '', args);
    return await getRevision(spaceId, revisionHash);
  };

  async function approveRevision(spaceId, revisionHash, args) {
    await registryInstance.approveRevision(web3.utils.fromAscii(spaceId), revisionHash, args);
    return getRevision(spaceId, revisionHash);
  };

  async function rejectRevision(spaceId, revisionHash, args) {
    await registryInstance.rejectRevision(web3.utils.fromAscii(spaceId), revisionHash, args);
    return await getRevision(spaceId, revisionHash);
  };

  async function getRevision(spaceId, revisionHash) {
    let result = await registryInstance.getRevision(web3.utils.fromAscii(spaceId), revisionHash);

    return {
      'hash': result[0],
      'parent': result[1],
      'author': result[2],
      'state': convertState(result[3].toNumber())
    };
  };


  async function metaCreateSpace(spaceId, owner, nonce, signature, args) {
    await registryInstance.metaCreateSpace(web3.utils.fromAscii(spaceId), owner, signature, nonce, args);
    return await getSpace(spaceId);
  };

  async function metaCreateSpaceHash(spaceId, owner, nonce) {
    return await registryInstance.metaCreateSpaceHash(web3.utils.fromAscii(spaceId), owner, nonce);
  };

  async function getNonce(address) {
    return await registryInstance.getNonce(address);
  };

  async function sign(pk, message) {
    var msgHash = EthUtil.hashPersonalMessage(new Buffer(message));
    var signature = EthUtil.ecsign(msgHash, new Buffer(pk, 'hex'));
    var signatureRPC = EthUtil.toRpcSig(signature.v, signature.r, signature.s)

    return signatureRPC;
  };

  function convertState(id) {
    switch(id) {
      case 0:
          return 'PENDING';
      case 1:
          return 'REJECTED';
      case 2:
          return 'PUBLISHED';
      default:
          throw 'Bad id'
    }
  };

})();
