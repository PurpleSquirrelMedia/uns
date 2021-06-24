const { ethers } = require('hardhat');
const { expect } = require('chai');

const { ZERO_ADDRESS } = require('./helpers/constants');

const { utils, BigNumber } = ethers;

describe('ProxyReader', () => {
  const domainName = 'test_42';
  const keys = ['test.key1', 'test.key2'];
  const values = ['test.value1', 'test.value2'];

  const cryptoRoot = BigNumber.from('0x0f4a10a4f46c288cea365fcf45cccf0e9d901b945b9829ccdb54c10dc3cb7a6f');
  const walletRoot = BigNumber.from('0x1e3f482b3363eb4710dae2cb2183128e272eafbe137f686851c1caea32502230');

  let Registry, CryptoRegistry, CryptoResolver, CryptoMintingController, ProxyReader;
  let registry, cryptoRegistry, cryptoResolver, cryptoMintingController, proxy;
  let signers, coinbase, accounts;
  let walletTokenId, cryptoTokenId;

  before(async () => {
    signers = await ethers.getSigners();
    [coinbase] = signers;
    [, ...accounts] = signers.map(s => s.address);

    Registry = await ethers.getContractFactory('contracts/Registry.sol:Registry');
    CryptoRegistry = await ethers.getContractFactory('contracts/cns/CryptoRegistry.sol:CryptoRegistry');
    CryptoResolver = await ethers.getContractFactory('contracts/cns/CryptoResolver.sol:CryptoResolver');
    CryptoMintingController =
      await ethers.getContractFactory('contracts/cns/CryptoMintingController.sol:CryptoMintingController');
    ProxyReader = await ethers.getContractFactory('contracts/ProxyReader.sol:ProxyReader');

    // deploy UNS
    registry = await Registry.deploy();
    await registry.initialize(coinbase.address);
    await registry.setTokenURIPrefix('/');

    // deploy CNS
    cryptoRegistry = await CryptoRegistry.deploy();
    cryptoMintingController = await CryptoMintingController.deploy(cryptoRegistry.address);
    await cryptoRegistry.addController(cryptoMintingController.address);
    cryptoResolver = await CryptoResolver.deploy(cryptoRegistry.address, cryptoMintingController.address);

    // mint .wallet TLD
    await registry.mint(coinbase.address, walletRoot, 'wallet');

    // mint .crypto
    walletTokenId = await registry.childIdOf(walletRoot, domainName);
    await registry.mint(coinbase.address, walletTokenId, domainName);

    // mint .wallet
    cryptoTokenId = await registry.childIdOf(cryptoRoot, domainName);
    await cryptoMintingController.mintSLDWithResolver(coinbase.address, domainName, cryptoResolver.address);

    proxy = await ProxyReader.deploy(registry.address, cryptoRegistry.address);
  });

  it('should support IERC165 interface', async () => {
    /*
     * bytes4(keccak256(abi.encodePacked('supportsInterface(bytes4)'))) == 0x01ffc9a7
     */
    const isSupport = await proxy.supportsInterface('0x01ffc9a7');
    assert.isTrue(isSupport);
  });

  describe('IRegistryReader', () => {
    it('should support IRegistryReader interface', async () => {
      /*
      * bytes4(keccak256(abi.encodePacked('tokenURI(uint256)'))) == 0xc87b56dd
      * bytes4(keccak256(abi.encodePacked('isApprovedOrOwner(address,uint256)'))) == 0x430c2081
      * bytes4(keccak256(abi.encodePacked('resolverOf(uint256)'))) == 0xb3f9e4cb
      * bytes4(keccak256(abi.encodePacked('childIdOf(uint256,string)'))) == 0x68b62d32
      * bytes4(keccak256(abi.encodePacked('balanceOf(address)'))) == 0x70a08231
      * bytes4(keccak256(abi.encodePacked('ownerOf(uint256)'))) == 0x6352211e
      * bytes4(keccak256(abi.encodePacked('getApproved(uint256)'))) == 0x081812fc
      * bytes4(keccak256(abi.encodePacked('isApprovedForAll(address,address)'))) == 0xe985e9c5
      * bytes4(keccak256(abi.encodePacked('exists(uint256)'))) == 0x4f558e79
      *
      * => 0xc87b56dd ^ 0x430c2081 ^ 0xb3f9e4cb ^ 0x68b62d32 ^
      *    0x70a08231 ^ 0x6352211e ^ 0x081812fc ^ 0xe985e9c5 ^
      *    0x4f558e79 == 0xed0269ca
      */
      const isSupport = await proxy.supportsInterface('0xed0269ca');
      assert.isTrue(isSupport);
    });

    it('should revert isApprovedForAll call', async () => {
      await expect(
        proxy.isApprovedForAll(accounts[0], accounts[1]),
      ).to.be.revertedWith('ProxyReader: UNSUPPORTED_METHOD');
    });

    describe('getApproved', () => {
      it('should return approved zero-address .wallet domain', async () => {
        const proxyResult = await proxy.getApproved(walletTokenId);
        const resolverResult = await registry.getApproved(walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, ZERO_ADDRESS);
      });

      it('should return approved zero-address .crypto domain', async () => {
        const proxyResult = await proxy.getApproved(cryptoTokenId);
        const resolverResult = await cryptoRegistry.getApproved(cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, ZERO_ADDRESS);
      });

      it('should return approved address .wallet domain', async () => {
        await registry.approve(accounts[0], walletTokenId);

        const proxyResult = await proxy.getApproved(walletTokenId);
        const resolverResult = await registry.getApproved(walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, accounts[0]);
      });

      it('should return approved address .crypto domain', async () => {
        await cryptoRegistry.approve(accounts[0], cryptoTokenId);

        const proxyResult = await proxy.getApproved(cryptoTokenId);
        const resolverResult = await cryptoRegistry.getApproved(cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, accounts[0]);
      });
    });

    describe('isApprovedOrOwner', () => {
      it('should return false for not-approved .wallet domain', async () => {
        const proxyResult = await proxy.isApprovedOrOwner(accounts[1], walletTokenId);
        const resolverResult = await registry.isApprovedOrOwner(accounts[1], walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, false);
      });

      it('should return false for not-approved .crypto domain', async () => {
        const proxyResult = await proxy.isApprovedOrOwner(accounts[1], cryptoTokenId);
        const resolverResult = await cryptoRegistry.isApprovedOrOwner(accounts[1], cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, false);
      });

      it('should return whether approved address .wallet domain', async () => {
        await registry.approve(accounts[0], walletTokenId);

        const proxyResult = await proxy.isApprovedOrOwner(accounts[0], walletTokenId);
        const resolverResult = await registry.isApprovedOrOwner(accounts[0], walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, true);
      });

      it('should return whether approved address .crypto domain', async () => {
        await cryptoRegistry.approve(accounts[0], cryptoTokenId);

        const proxyResult = await proxy.isApprovedOrOwner(accounts[0], cryptoTokenId);
        const resolverResult = await cryptoRegistry.isApprovedOrOwner(accounts[0], cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, true);
      });
    });

    describe('ownerOf', () => {
      it('should return empty owner for unknown domain', async () => {
        const unknownTokenId = await registry.childIdOf(cryptoRoot, 'unknown');
        const owners = await proxy.callStatic.ownerOf(unknownTokenId);
        assert.deepEqual(owners, ZERO_ADDRESS);
      });

      it('should return owner of .wallet domain', async () => {
        const proxyResult = await proxy.ownerOf(walletTokenId);
        const resolverResult = await registry.ownerOf(walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, coinbase.address);
      });

      it('should return owner of .crypto domain', async () => {
        const proxyResult = await proxy.ownerOf(cryptoTokenId);
        const resolverResult = await cryptoRegistry.ownerOf(cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, coinbase.address);
      });
    });

    describe('resolverOf', () => {
      it('should return resolver of .wallet domain', async () => {
        const proxyResult = await proxy.resolverOf(walletTokenId);
        const resolverResult = await registry.resolverOf(walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, registry.address);
      });

      it('should return resolver of .crypto domain', async () => {
        const proxyResult = await proxy.resolverOf(cryptoTokenId);
        const resolverResult = await cryptoRegistry.resolverOf(cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, cryptoResolver.address);
      });
    });

    describe('tokenURI', () => {
      it('should return tokenURI of .wallet domain', async () => {
        const proxyResult = await proxy.tokenURI(walletTokenId);
        const resolverResult = await registry.tokenURI(walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(
          resolverResult,
          '/40559307672254207728557027035302885851369665055277251407821151545011532191308');
      });

      it('should return tokenURI of .crypto domain', async () => {
        const proxyResult = await proxy.tokenURI(cryptoTokenId);
        const resolverResult = await cryptoRegistry.tokenURI(cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, 'test_42.crypto');
      });
    });

    describe('childIdOf', () => {
      it('should return childIdOf of .wallet domain', async () => {
        const proxyResult = await proxy.childIdOf(walletRoot, 'test');
        const resolverResult = await registry.childIdOf(walletRoot, 'test');

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(
          resolverResult.toString(),
          '50586162622368517199428676025463367639931450566950616867100918499864570754504');
      });

      it('should return childIdOf of .crypto domain', async () => {
        const proxyResult = await proxy.childIdOf(cryptoRoot, 'test');
        const resolverResult = await cryptoRegistry.childIdOf(cryptoRoot, 'test');

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(
          resolverResult.toString(),
          '82856763987730893573226808376519199326595862773989062576563108342755511775491');
      });
    });

    describe('balanceOf', () => {
      it('should aggregate balance from all registries', async () => {
        const _domainName = 'hey_hoy_23bkkcbv';
        const account = accounts[7];
        await cryptoMintingController.mintSLD(account, _domainName);
        const tokenId = await proxy.childIdOf(walletRoot, _domainName);
        await registry.mint(account, tokenId, _domainName);

        const proxyResult = await proxy.balanceOf(account);
        const resolverResult1 = await registry.balanceOf(account);
        const resolverResult2 = await cryptoRegistry.balanceOf(account);
        assert.equal(proxyResult.toString(), resolverResult1.add(resolverResult2).toString());
      });
    });

    describe('exists', () => {
      it('should return false for zero tokenId', async () => {
        assert.equal(await proxy.exists(0), false);
      });

      it('should return false for unknown .wallet domain', async () => {
        const unknownTokenId = await registry.childIdOf(walletRoot, 'unknown');

        assert.equal(await proxy.exists(unknownTokenId), false);
      });

      it('should return false for unknown .crypto domain', async () => {
        const unknownTokenId = await cryptoRegistry.childIdOf(cryptoRoot, 'unknown');

        assert.equal(await proxy.exists(unknownTokenId), false);
      });

      it('should return true for .wallet domain', async () => {
        const _domainName = 'hey_hoy_97hds';
        const walletTokenId = await registry.childIdOf(walletRoot, _domainName);
        await registry.mint(accounts[3], walletTokenId, _domainName);

        assert.equal(await proxy.exists(walletTokenId), true);
      });

      it('should return true for .crypto domain', async () => {
        const _domainName = 'hey_hoy_97hds';
        const cryptoTokenId = await cryptoRegistry.childIdOf(cryptoRoot, _domainName);
        await cryptoMintingController.mintSLD(accounts[3], _domainName);

        assert.equal(await proxy.exists(cryptoTokenId), true);
      });

      // the scenario is not possible in real setup
      it('should return true when both registries known domain', async () => {
        const _domainName = 'hey_hoy_74tbcvl';
        const tokenId = await registry.childIdOf(cryptoRoot, _domainName);
        await registry.mint(accounts[3], tokenId, _domainName);
        await cryptoMintingController.mintSLD(accounts[3], _domainName);

        assert.equal(await proxy.exists(tokenId), true);
      });

      it('should return true for .crypto TLD', async () => {
        assert.equal(await proxy.exists(cryptoRoot), true);
      });

      it('should return true for .wallet TLD', async () => {
        assert.equal(await proxy.exists(walletRoot), true);
      });
    });
  });

  describe('IRecordReader', () => {
    it('should support IRecordReader interface', async () => {
      /*
       * bytes4(keccak256(abi.encodePacked('get(string,uint256)'))) == 0x1be5e7ed
       * bytes4(keccak256(abi.encodePacked('getByHash(uint256,uint256)'))) == 0x672b9f81
       * bytes4(keccak256(abi.encodePacked('getMany(string[],uint256)'))) == 0x1bd8cc1a
       * bytes4(keccak256(abi.encodePacked('getManyByHash(uint256[],uint256)'))) == 0xb85afd28
       *
       * => 0x1be5e7ed ^ 0x672b9f81 ^ 0x1bd8cc1a ^ 0xb85afd28 == 0xdf4c495e
       */
      const isSupport = await proxy.supportsInterface('0xdf4c495e');
      assert.isTrue(isSupport);
    });

    describe('get', () => {
      it('should return value of record for .wallet domain', async () => {
        await registry.set('get_key_39', 'value1', walletTokenId);

        const proxyResult = await proxy.get('get_key_39', walletTokenId);
        const resolverResult = await registry.get('get_key_39', walletTokenId);

        assert.equal(proxyResult, resolverResult);
        assert.equal(resolverResult, 'value1');
      });

      it('should return value of record for .crypto domain', async () => {
        await cryptoResolver.set('get_key_134', 'value12', cryptoTokenId);

        const proxyResult = await proxy.get('get_key_134', cryptoTokenId);
        const resolverResult = await cryptoResolver.get('get_key_134', cryptoTokenId);

        assert.equal(proxyResult, resolverResult);
        assert.equal(resolverResult, 'value12');
      });
    });

    describe('getMany', () => {
      it('should return list with empty value for unregistered key', async () => {
        const result = await proxy.getMany([keys[0]], walletTokenId);
        assert.equal(result.length, 1);
        assert.equal(result[0], '');
      });

      it('should return list with single value for .wallet domain', async () => {
        const [key] = keys;
        const [value] = values;
        await registry.set(key, value, walletTokenId);

        const proxyResult = await proxy.getMany([key], walletTokenId);
        const resolverResult = await registry.getMany([key], walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, [value]);
      });

      it('should return list with single value for .crypto domain', async () => {
        const [key] = keys;
        const [value] = values;
        await cryptoResolver.set(key, value, cryptoTokenId);

        const proxyResult = await proxy.getMany([key], cryptoTokenId);
        const resolverResult = await cryptoResolver.getMany([key], cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, [value]);
      });

      it('should return list with multiple values for .wallet domain', async () => {
        for (let i = 0; i < keys.length; i++) {
          await registry.set(keys[i], values[i], walletTokenId);
        }

        const result = await proxy.getMany(keys, walletTokenId);
        assert.deepEqual(result, values);
      });

      it('should return list with multiple values for .crypto domain', async () => {
        for (let i = 0; i < keys.length; i++) {
          await cryptoResolver.set(keys[i], values[i], cryptoTokenId);
        }

        const result = await proxy.getMany(keys, cryptoTokenId);
        assert.deepEqual(result, values);
      });
    });

    describe('getByHash', () => {
      it('should return value of record for .wallet domain', async () => {
        const keyHash = utils.id('get_key_4235');
        await registry.set('get_key_4235', 'value1454', walletTokenId);

        const proxyResult = await proxy.getByHash(keyHash, walletTokenId);
        const resolverResult = await registry.getByHash(keyHash, walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, ['get_key_4235', 'value1454']);
      });

      it('should return value of record for .crypto domain', async () => {
        const keyHash = utils.id('get_key_0946');
        await cryptoResolver.set('get_key_0946', 'value4521', cryptoTokenId);

        const proxyResult = await proxy.getByHash(keyHash, cryptoTokenId);
        const resolverResult = await cryptoResolver.getByHash(keyHash, cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, ['get_key_0946', 'value4521']);
      });
    });

    describe('getManyByHash', () => {
      it('should return list with empty value for unregistered key', async () => {
        const keyHash = utils.id('key_aaaaaa');
        const result = await proxy.getManyByHash([keyHash], walletTokenId);
        assert.deepEqual(result[0], ['']);
      });

      it('should return list with single value for .wallet domain', async () => {
        const [key] = keys;
        const [value] = values;
        const keyHash = utils.id(key);
        await registry.set(key, value, walletTokenId);

        const proxyResult = await proxy.getManyByHash([keyHash], walletTokenId);
        const resolverResult = await registry.getManyByHash([keyHash], walletTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, [[key], [value]]);
      });

      it('should return list with single value for .crypto domain', async () => {
        const [key] = keys;
        const [value] = values;
        const keyHash = utils.id(key);
        await cryptoResolver.set(key, value, cryptoTokenId);

        const proxyResult = await proxy.getManyByHash([keyHash], cryptoTokenId);
        const resolverResult = await cryptoResolver.getManyByHash([keyHash], cryptoTokenId);

        assert.deepEqual(proxyResult, resolverResult);
        assert.deepEqual(resolverResult, [[key], [value]]);
      });
    });
  });

  describe('IDataReader', () => {
    it('should support IDataReader interface', async () => {
      /*
       * bytes4(keccak256(abi.encodePacked('getData(string[],uint256)'))) == 0x91015f6b
       * bytes4(keccak256(abi.encodePacked('getDataForMany(string[],uint256[])'))) == 0x933c051d
       * bytes4(keccak256(abi.encodePacked('getDataByHash(uint256[],uint256)'))) == 0x03280755
       * bytes4(keccak256(abi.encodePacked('getDataByHashForMany(uint256[],uint256[])'))) == 0x869b8884
       * bytes4(keccak256(abi.encodePacked('ownerOfForMany(uint256[])'))) == 0xc15ae7cf
       *
       * => 0x91015f6b ^ 0x933c051d ^ 0x03280755 ^
       *    0x869b8884 ^ 0xc15ae7cf == 0x46d43268
       */
      const isSupport = await proxy.supportsInterface('0x46d43268');
      assert.isTrue(isSupport);
    });

    describe('getData', () => {
      it('should return empty data for non-existing .wallet domain', async () => {
        // arrange
        const _domainName = 'hey_hoy_1037';
        const _tokenId = await registry.childIdOf(walletRoot, _domainName);

        // act
        const data = await proxy.callStatic.getData(keys, _tokenId);

        // asserts
        assert.deepEqual(data, [ZERO_ADDRESS, ZERO_ADDRESS, ['', '']]);
      });

      it('should return empty data for non-existing .crypto domain', async () => {
        // arrange
        const _domainName = 'hey_hoy_1037';
        const _tokenId = await cryptoRegistry.childIdOf(cryptoRoot, _domainName);

        // act
        const data = await proxy.callStatic.getData(keys, _tokenId);

        // asserts
        assert.deepEqual(data, [ZERO_ADDRESS, ZERO_ADDRESS, ['', '']]);
      });

      it('should return data for .crypto domain', async () => {
        // arrange
        const _domainName = 'hey_hoy_121';
        const _tokenId = await cryptoRegistry.childIdOf(cryptoRoot, _domainName);
        await cryptoMintingController.mintSLDWithResolver(coinbase.address, _domainName, cryptoResolver.address);

        // act
        const data = await proxy.callStatic.getData(keys, _tokenId);

        // asserts
        assert.deepEqual(data, [cryptoResolver.address, coinbase.address, ['', '']]);
      });

      it('should return data for .wallet domain', async () => {
        // arrange
        const _domainName = 'hey_hoy_121';
        const _tokenId = await registry.childIdOf(walletRoot, _domainName);
        await registry.mint(coinbase.address, _tokenId, _domainName);

        // act
        const data = await proxy.callStatic.getData(keys, _tokenId);

        // asserts
        assert.deepEqual(data, [registry.address, coinbase.address, ['', '']]);
      });
    });

    describe('getDataForMany', () => {
      it('should return empty lists for empty list of domains', async () => {
        const data = await proxy.callStatic.getDataForMany([], []);

        assert.deepEqual(data, [[], [], []]);
      });

      it('should return empty data for non-existing .crypto|.wallet domains', async () => {
        // arrange
        const _domainName = 'hey_hoy_1037';
        const _walletTokenId = await registry.childIdOf(walletRoot, _domainName);
        const _cryptoTokenId = await registry.childIdOf(cryptoRoot, _domainName);

        // act
        const data = await proxy.callStatic.getDataForMany(keys, [_walletTokenId, _cryptoTokenId]);

        // asserts
        assert.deepEqual(data, [[ZERO_ADDRESS, ZERO_ADDRESS], [ZERO_ADDRESS, ZERO_ADDRESS], [['', ''], ['', '']]]);
      });

      it('should return data for multiple .crypto|.wallet domains', async () => {
        // arrange
        const _domainName = 'test_1291';
        const _walletTokenId = await registry.childIdOf(walletRoot, _domainName);
        const _cryptoTokenId = await registry.childIdOf(cryptoRoot, _domainName);
        await registry.mint(coinbase.address, _walletTokenId, _domainName);
        await cryptoMintingController.mintSLDWithResolver(coinbase.address, _domainName, cryptoResolver.address);
        for (let i = 0; i < keys.length; i++) {
          await registry.set(keys[i], values[i], _walletTokenId);
          await cryptoResolver.set(keys[i], values[i], _cryptoTokenId);
        }

        // act
        const data = await proxy.callStatic.getDataForMany(keys, [_walletTokenId, _cryptoTokenId]);

        // assert
        assert.deepEqual(data, [
          [registry.address, cryptoResolver.address],
          [coinbase.address, coinbase.address],
          [['test.value1', 'test.value2'], ['test.value1', 'test.value2']],
        ]);
      });

      it('should return owners for multiple tokens (including unknown)', async () => {
        // arrange
        const unknownTokenId = await registry.childIdOf(cryptoRoot, 'unknown');

        // act
        const data = await proxy.callStatic.getDataForMany([], [walletTokenId, unknownTokenId]);

        // assert
        assert.deepEqual(data, [
          [registry.address, ZERO_ADDRESS],
          [coinbase.address, ZERO_ADDRESS],
          [[], []],
        ]);
      });
    });

    describe('getDataByHash', () => {
      it('should return empty data for non-existing .wallet domain', async () => {
        // arrange
        const hashes = keys.map(utils.id);
        const _domainName = 'hey_hoy_29224';
        const _tokenId = await registry.childIdOf(walletRoot, _domainName);

        // act
        const data = await proxy.callStatic.getDataByHash(hashes, _tokenId);

        // asserts
        assert.deepEqual(data, [ZERO_ADDRESS, ZERO_ADDRESS, ['', ''], ['', '']]);
      });

      it('should return empty data for non-existing .crypto domain', async () => {
        // arrange
        const hashes = keys.map(utils.id);
        const _domainName = 'hey_hoy_29228';
        const _tokenId = await cryptoRegistry.childIdOf(cryptoRoot, _domainName);

        // act
        const data = await proxy.callStatic.getDataByHash(hashes, _tokenId);

        // asserts
        assert.deepEqual(data, [ZERO_ADDRESS, ZERO_ADDRESS, ['', ''], ['', '']]);
      });

      it('should return data by hashes for .crypto domain', async () => {
        // arrange
        const hashes = keys.map(utils.id);
        const _domainName = 'hey_hoy_292';
        const _tokenId = await cryptoRegistry.childIdOf(cryptoRoot, _domainName);
        await cryptoMintingController.mintSLDWithResolver(coinbase.address, _domainName, cryptoResolver.address);
        for (let i = 0; i < keys.length; i++) {
          await cryptoResolver.set(keys[i], values[i], _tokenId);
        }

        // act
        const data = await proxy.callStatic.getDataByHash(hashes, _tokenId);

        // assert
        assert.deepEqual(data, [
          cryptoResolver.address,
          coinbase.address,
          keys,
          values,
        ]);
      });

      it('should return data by hashes for .wallet domain', async () => {
        // arrange
        const hashes = keys.map(utils.id);
        const _domainName = 'hey_hoy_292';
        const _tokenId = await registry.childIdOf(walletRoot, _domainName);
        await registry.mint(coinbase.address, _tokenId, _domainName);
        for (let i = 0; i < keys.length; i++) {
          await registry.set(keys[i], values[i], _tokenId);
        }

        // act
        const data = await proxy.callStatic.getDataByHash(hashes, _tokenId);

        // assert
        assert.deepEqual(data, [
          registry.address,
          coinbase.address,
          keys,
          values,
        ]);
      });
    });

    describe('getDataByHashForMany', () => {
      it('should return empty lists for empty list of domains', async () => {
        const data = await proxy.callStatic.getDataByHashForMany([], []);

        assert.deepEqual(data, [[], [], [], []]);
      });

      it('should return empty data for non-existing .crypto|.wallet domains', async () => {
        // arrange
        const hashes = keys.map(utils.id);
        const _domainName = 'hey_hoy_1037';
        const _walletTokenId = await registry.childIdOf(walletRoot, _domainName);
        const _cryptoTokenId = await registry.childIdOf(cryptoRoot, _domainName);

        // act
        const data = await proxy.callStatic.getDataByHashForMany(hashes, [_walletTokenId, _cryptoTokenId]);

        // asserts
        assert.deepEqual(data, [
          [ZERO_ADDRESS, ZERO_ADDRESS],
          [ZERO_ADDRESS, ZERO_ADDRESS],
          [['', ''], ['', '']],
          [['', ''], ['', '']],
        ]);
      });

      it('should return data for multiple .crypto|.wallet domains', async () => {
        // arrange
        const hashes = keys.map(utils.id);
        const _domainName = 'test_1082q';
        const _walletTokenId = await registry.childIdOf(walletRoot, _domainName);
        const _cryptoTokenId = await registry.childIdOf(cryptoRoot, _domainName);
        await registry.mint(coinbase.address, _walletTokenId, _domainName);
        await cryptoMintingController.mintSLDWithResolver(coinbase.address, _domainName, cryptoResolver.address);

        for (let i = 0; i < keys.length; i++) {
          await registry.set(keys[i], values[i], _walletTokenId);
          await cryptoResolver.set(keys[i], values[i], _cryptoTokenId);
        }

        // act
        const data = await proxy.callStatic.getDataByHashForMany(hashes, [_walletTokenId, _cryptoTokenId]);

        // assert
        assert.deepEqual(data, [
          [registry.address, cryptoResolver.address],
          [coinbase.address, coinbase.address],
          [['test.key1', 'test.key2'], ['test.key1', 'test.key2']],
          [['test.value1', 'test.value2'], ['test.value1', 'test.value2']],
        ]);
      });

      it('should return owners for multiple domains (including unknown)', async () => {
        // arrange
        const unknownTokenId = await registry.childIdOf(cryptoRoot, 'unknown');

        // act
        const data = await proxy.callStatic.getDataByHashForMany([], [walletTokenId, unknownTokenId]);

        // assert
        assert.deepEqual(data, [
          [registry.address, ZERO_ADDRESS],
          [coinbase.address, ZERO_ADDRESS],
          [[], []],
          [[], []],
        ]);
      });
    });

    describe('ownerOfForMany', () => {
      it('should return empty owner for unknown domain', async () => {
        const unknownTokenId = await registry.childIdOf(cryptoRoot, 'unknown');
        const owners = await proxy.callStatic.ownerOfForMany([unknownTokenId]);
        assert.deepEqual(owners, [ZERO_ADDRESS]);
      });

      it('should return empty list for empty list of domains', async () => {
        const owners = await proxy.callStatic.ownerOfForMany([]);
        assert.deepEqual(owners, []);
      });

      it('should return owners for multiple .crypto|.wallet domains', async () => {
        // arrange
        const _domainName = 'test_125t';
        const _walletTokenId = await registry.childIdOf(walletRoot, _domainName);
        const _cryptoTokenId = await registry.childIdOf(cryptoRoot, _domainName);
        await registry.mint(accounts[0], _walletTokenId, _domainName);
        await cryptoMintingController.mintSLDWithResolver(coinbase.address, _domainName, cryptoResolver.address);

        // act
        const owners = await proxy.callStatic.ownerOfForMany([walletTokenId, _walletTokenId, _cryptoTokenId]);

        // assert
        assert.deepEqual(owners, [coinbase.address, accounts[0], coinbase.address]);
      });

      it('should return owners for multiple domains (including unknown)', async () => {
        // arrange
        const unknownTokenId = await registry.childIdOf(cryptoRoot, 'unknown');

        // act
        const owners = await proxy.callStatic.ownerOfForMany([walletTokenId, unknownTokenId]);

        // assert
        assert.deepEqual(owners, [coinbase.address, ZERO_ADDRESS]);
      });
    });
  });

  describe('registryOf', () => {
    it('should return zero for zero tokenId', async () => {
      const address = await proxy.registryOf(0);
      assert.deepEqual(address, ZERO_ADDRESS);
    });

    it('should return error for unknown .wallet domain', async () => {
      const unknownTokenId = await registry.childIdOf(walletRoot, 'unknown');

      const address = await proxy.registryOf(unknownTokenId);
      assert.deepEqual(address, ZERO_ADDRESS);
    });

    it('should return error for unknown .crypto domain', async () => {
      const unknownTokenId = await cryptoRegistry.childIdOf(cryptoRoot, 'unknown');

      const address = await proxy.registryOf(unknownTokenId);
      assert.deepEqual(address, ZERO_ADDRESS);
    });

    it('should return value for .wallet domain', async () => {
      const _domainName = 'hey_hoy_98hds';
      const _walletTokenId = await registry.childIdOf(walletRoot, _domainName);
      await registry.mint(accounts[3], _walletTokenId, _domainName);

      const address = await proxy.registryOf(_walletTokenId);
      assert.equal(address, registry.address);
    });

    it('should return value for .crypto domain', async () => {
      const _domainName = 'hey_hoy_98hds';
      const _cryptoTokenId = await cryptoRegistry.childIdOf(cryptoRoot, _domainName);
      await cryptoMintingController.mintSLD(accounts[3], _domainName);

      const address = await proxy.registryOf(_cryptoTokenId);
      assert.equal(address, cryptoRegistry.address);
    });

    it('should return value for .crypto TLD', async () => {
      const address = await proxy.registryOf(cryptoRoot);
      assert.equal(address, cryptoRegistry.address);
    });

    it('should return value for .wallet TLD', async () => {
      const address = await proxy.registryOf(walletRoot);
      assert.equal(address, registry.address);
    });
  });
});