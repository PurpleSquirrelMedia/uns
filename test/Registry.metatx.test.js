const { ethers } = require('hardhat');
const { expect } = require('chai');

const { signTypedData } = require('./helpers/metatx');
const { EMPTY_SIGNATURE } = require('./helpers/constants');

const { utils, BigNumber } = ethers;

describe('Registry (metatx)', () => {
  let Registry;
  let registry, root;
  let signers, coinbase, owner, nonOwner, receiver, accessControl, operator, spender;

  before(async () => {
    signers = await ethers.getSigners();
    [coinbase, owner, nonOwner, receiver, accessControl, operator, spender] = signers;

    Registry = await ethers.getContractFactory('contracts/Registry.sol:Registry');

    root = BigNumber.from('0x0f4a10a4f46c288cea365fcf45cccf0e9d901b945b9829ccdb54c10dc3cb7a6f');

    registry = await Registry.deploy();
    await registry.initialize(coinbase.address);
    await registry.mint('0xdead000000000000000000000000000000000000', root, 'crypto');
    await registry.setTokenURIPrefix('/');
  });

  describe('General', () => {
    const receiverAddress = '0x1234567890123456789012345678901234567890';

    it('should transfer using meta-setOwner', async () => {
      const owner = signers[1];
      const receiver = signers[2];
      const tok = await registry.childIdOf(root, 'res_label_113a');
      await registry.mint(owner.address, tok, 'res_label_113a');

      const req = {
        from: owner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(owner.address)),
        data: registry.interface.encodeFunctionData('setOwner', [receiver.address, tok]),
      };
      const sig = await signTypedData(registry.address, owner, req);
      await registry.execute(req, sig);

      assert.equal(receiver.address, await registry.ownerOf(tok));
    });

    it('should revert transfer using meta-setOwner when nonce invalidated', async () => {
      const owner = signers[1];
      const receiver = signers[2];
      const tok = await registry.childIdOf(root, 'res_label_0896');
      await registry.mint(owner.address, tok, 'res_label_0896');

      const req = {
        from: owner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(owner.address)),
        data: registry.interface.encodeFunctionData('setOwner', [receiver.address, tok]),
      };
      const sig = await signTypedData(registry.address, owner, req);

      await registry.connect(owner).set('key', 'value', tok);

      await expect(registry.execute(req, sig)).to.be
        .revertedWith('RegistryForwarder: SIGNATURE_INVALID');
    });

    it('should setApprovalForAll using meta-setApprovalForAll', async () => {
      const req = {
        from: owner.address,
        gas: '100000',
        tokenId: 0,
        nonce: Number(await registry.nonceOf(owner.address)),
        data: registry.interface.encodeFunctionData('setApprovalForAll', [operator.address, true]),
      };
      const sig = await signTypedData(registry.address, owner, req);
      const [success ] = await registry.callStatic.execute(req, sig);
      expect(success).to.be.eq(true);
    });

    it('should revert meta-setApprovalForAll for non-onwer', async () => {
      const req = {
        from: owner.address,
        gas: '100000',
        tokenId: 0,
        nonce: Number(await registry.nonceOf(owner.address)),
        data: registry.interface.encodeFunctionData('setApprovalForAll', [operator.address, true]),
      };
      const sig = await signTypedData(registry.address, nonOwner, req);
      await expect(registry.execute(req, sig)).to.be
        .revertedWith('RegistryForwarder: SIGNATURE_INVALID');
    });

    it('should transfer using meta-transferFrom', async () => {
      const tok = await registry.childIdOf(root, 'meta_1591');
      await registry.mint(owner.address, tok, 'meta_1591');

      const req = {
        from: owner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(tok)),
        data: registry.interface.encodeFunctionData('transferFrom', [owner.address, receiverAddress, tok]),
      };
      const sig = await signTypedData(registry.address, owner, req);
      await registry.execute(req, sig);

      assert.equal(await registry.ownerOf(tok), receiverAddress);
    });

    it('should revert meta-transferFrom for non-onwer', async () => {
      const tok = await registry.childIdOf(root, 'meta_6458');
      await registry.mint(owner.address, tok, 'meta_6458');

      const req = {
        from: nonOwner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(tok)),
        data: registry.interface.encodeFunctionData('transferFrom', [nonOwner.address, receiverAddress, tok]),
      };
      const sig = await signTypedData(registry.address, nonOwner, req);
      const [success ] = await registry.callStatic.execute(req, sig);
      expect(success).to.be.eq(false);
    });

    it('should transfer using meta-safeTransferFrom', async () => {
      const tok = await registry.childIdOf(root, 'meta_10235');
      await registry.mint(owner.address, tok, 'meta_10235');

      const req = {
        from: owner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(tok)),
        data: registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256)',
          [owner.address, receiverAddress, tok],
        ),
      };
      const sig = await signTypedData(registry.address, owner, req);
      await registry.execute(req, sig);

      assert.equal(await registry.ownerOf(tok), receiverAddress);
    });

    it('should revert meta-safeTransferFrom for non-onwer', async () => {
      const tok = await registry.childIdOf(root, 'meta_e5iuw');
      await registry.mint(owner.address, tok, 'meta_e5iuw');

      const req = {
        from: nonOwner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(tok)),
        data: registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256)',
          [nonOwner.address, receiverAddress, tok],
        ),
      };
      const sig = await signTypedData(registry.address, nonOwner, req);
      const [success ] = await registry.callStatic.execute(req, sig);
      expect(success).to.be.eq(false);
    });

    // TODO: add tests for safeTransferFrom(address,address,uint256,bytes)

    it('should burn using meta-burn', async () => {
      const tok = await registry.childIdOf(root, 'meta_ar093');
      await registry.mint(owner.address, tok, 'meta_ar093');

      const req = {
        from: owner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(tok)),
        data: registry.interface.encodeFunctionData('burn', [tok]),
      };
      const sig = await signTypedData(registry.address, owner, req);
      await registry.execute(req, sig);

      await expect(registry.ownerOf(tok)).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it('should revert meta-burn for non-onwer', async () => {
      const tok = await registry.childIdOf(root, 'meta_53dg3');
      await registry.mint(owner.address, tok, 'meta_53dg3');

      const req = {
        from: nonOwner.address,
        gas: '100000',
        tokenId: tok,
        nonce: Number(await registry.nonceOf(tok)),
        data: registry.interface.encodeFunctionData('burn', [tok]),
      };
      const sig = await signTypedData(registry.address, nonOwner, req);
      const [success ] = await registry.callStatic.execute(req, sig);
      expect(success).to.be.eq(false);
    });
  });

  describe('ABI-based', () => {
    const getReason = (returnData) => {
      let reason;
      if (returnData && returnData.slice(2, 10).toString('hex') === '08c379a0') {
        const abiCoder = new utils.AbiCoder();
        reason = abiCoder.decode(['string'], '0x' + returnData.slice(10))[0];
      }
      return reason;
    };

    const registryFuncs = () => {
      return Registry.interface.fragments
        .filter(x => x.type === 'function' && !['view', 'pure'].includes(x.stateMutability));
    };

    const buidRequest = async (fragment, from, tokenId, paramsMap) => {
      const funcSig = funcFragmentToSig(fragment);

      const req = {
        from,
        gas: '200000',
        tokenId,
        nonce: Number(await registry.nonceOf(tokenId)),
        data: registry.interface.encodeFunctionData(funcSig, fragment.inputs.map(x => paramsMap[x.name])),
      };
      return req;
    };

    const funcFragmentToSig = (fragment) => {
      return `${fragment.name}(${fragment.inputs.map(x => `${x.type} ${x.name}`).join(',')})`;
    };

    describe('Token-based functions (token should not be minted)', () => {
      const paramValueMap = {
        uri: 'label',
        data: '0x',
        keys: ['key1'],
        values: ['value1'],
      };

      const included = [
        'mint',
        'safeMint',
        'mintWithRecords',
        'safeMintWithRecords',
      ];

      const getFuncs = () => {
        return registryFuncs()
          .filter(x => x.inputs.filter(i => i.name === 'tokenId').length)
          .filter(x => included.includes(x.name));
      };

      before(async () => {
        paramValueMap.to = receiver.address;
      });

      it('should execute all functions successfully', async () => {
        for (const func of getFuncs()) {
          const funcSigHash = utils.id(`${funcFragmentToSig(func)}_excl`);
          paramValueMap.tokenId = await registry.childIdOf(root, funcSigHash);

          const req = await buidRequest(func, coinbase.address, paramValueMap.tokenId, paramValueMap);
          const sig = await signTypedData(registry.address, coinbase, req);
          const [success, returnData] = await registry.callStatic.execute(req, sig);

          if (!success) {
            console.error(getReason(returnData));
          }
          expect(success).to.be.eq(true);
        }
      });
    });

    describe('Token-based functions (token should be minted)', () => {
      const paramValueMap = {
        label: 'label',
        data: '0x',
        key: 'key_t1',
        keys: ['key_t1'],
        keyHash: BigNumber.from(utils.id('key_t1')),
        keyHashes: [BigNumber.from(utils.id('key_t1'))],
        value: 'value',
        values: ['value1'],
      };

      const excluded = [
        'mint',
        'safeMint',
        'mintWithRecords',
        'safeMintWithRecords',
        'transferFromFor',
        'safeTransferFromFor',
        'burnFor',
        'resetFor',
        'setFor',
        'setManyFor',
        'reconfigureFor',
      ];

      const getFuncs = () => {
        return registryFuncs()
          .filter(x => x.inputs.filter(i => i.name === 'tokenId').length)
          .filter(x => !excluded.includes(x.name));
      };

      const mintToken = async (owner, tokenId, label) => {
        await registry.mint(owner.address, tokenId, label);
      };

      before(async () => {
        paramValueMap.from = owner.address;
        paramValueMap.to = receiver.address;

        await registry.addKey(paramValueMap.key);
      });

      it('should execute all functions successfully', async () => {
        for (const func of getFuncs()) {
          const funcSigHash = utils.id(`${funcFragmentToSig(func)}_ok`);
          paramValueMap.tokenId = await registry.childIdOf(root, funcSigHash);
          await mintToken(owner, paramValueMap.tokenId, funcSigHash);

          const req = await buidRequest(func, owner.address, paramValueMap.tokenId, paramValueMap);
          const sig = await signTypedData(registry.address, owner, req);
          const [success, returnData] = await registry.callStatic.execute(req, sig);

          if (!success) {
            console.error(getReason(returnData));
          }
          expect(success).to.be.eq(true);
        }
      });

      it('should revert execution of all token-based functions when used signature', async () => {
        for (const func of getFuncs()) {
          const funcSig = funcFragmentToSig(func);
          const funcSigHash = utils.id(`${funcSig}_doubleUse`);
          paramValueMap.tokenId = await registry.childIdOf(root, funcSigHash);
          await mintToken(owner, paramValueMap.tokenId, funcSigHash);

          const req = await buidRequest(func, owner.address, paramValueMap.tokenId, paramValueMap);
          const sig = await signTypedData(registry.address, owner, req);

          const [success, returnData] = await registry.callStatic.execute(req, sig);
          if (!success) {
            console.log(funcSig, func.inputs.map(x => paramValueMap[x.name]));
            console.error(getReason(returnData));
          }
          expect(success).to.be.eq(true);

          await registry.execute(req, sig);

          await expect(registry.execute(req, sig)).to.be
            .revertedWith('RegistryForwarder: SIGNATURE_INVALID');
        }
      });

      it('should revert execution of all token-based functions when nonce invalidated', async () => {
        for (const func of getFuncs()) {
          const funcSig = funcFragmentToSig(func);
          const funcSigHash = utils.id(`${funcSig}_nonceInvalidated`);
          paramValueMap.tokenId = await registry.childIdOf(root, funcSigHash);
          await mintToken(owner, paramValueMap.tokenId, funcSigHash);

          const req = await buidRequest(func, owner.address, paramValueMap.tokenId, paramValueMap);
          const sig = await signTypedData(registry.address, owner, req);

          await registry.connect(owner).set('key', 'value', paramValueMap.tokenId);

          await expect(registry.execute(req, sig)).to.be
            .revertedWith('RegistryForwarder: SIGNATURE_INVALID');
        }
      });

      it('should fail execution of all token-based functions when tokenId does not match', async () => {
        for (const func of getFuncs()) {
          const funcSig = funcFragmentToSig(func);
          const funcSigHash = utils.id(`${funcSig}_wrongToken`);

          paramValueMap.tokenId = await registry.childIdOf(root, funcSigHash);
          await mintToken(owner, paramValueMap.tokenId, funcSigHash);

          const tokenIdForwarder = await registry.childIdOf(root, utils.id(`_${funcSig}`));
          const req = await buidRequest(func, owner.address, tokenIdForwarder, paramValueMap);
          const sig = await signTypedData(registry.address, owner, req);
          const [success, returnData] = await registry.callStatic.execute(req, sig);

          expect(success).to.be.eq(false);
          expect(getReason(returnData)).to.be.eql('Registry: TOKEN_INVALID');
        }
      });

      it('should fail execution of all token-based functions when tokenId is empty', async () => {
        for (const func of getFuncs()) {
          const funcSigHash = utils.id(`${funcFragmentToSig(func)}_emptyTokenId`);
          paramValueMap.tokenId = await registry.childIdOf(root, funcSigHash);
          await mintToken(owner, paramValueMap.tokenId, funcSigHash);

          const req = await buidRequest(func, owner.address, 0, paramValueMap);
          const sig = await signTypedData(registry.address, owner, req);
          const [success, returndata] = await registry.callStatic.execute(req, sig);

          expect(success).to.be.eq(false);
          expect(getReason(returndata)).to.be.eql('Registry: TOKEN_INVALID');
        }
      });
    });

    describe('Non-Token functions', () => {
      const paramValueMap = {
        label: 'label',
        data: '0x',
        role: '0x1000000000000000000000000000000000000000000000000000000000000000',
        key: 'key_nt1',
        keys: ['key_nt1'],
        values: ['value1'],
        approved: true,
        prefix: '/',
      };

      const excluded = [
        'execute',
        'initialize',
        'transferOwnership', // might influence tests
        'renounceOwnership', // might influence tests
      ];

      before(async () => {
        paramValueMap.tld = root;
        paramValueMap.account = accessControl.address;
        paramValueMap.to = owner.address;
        paramValueMap.operator = operator.address;
      });

      const getFuncs = () => {
        return registryFuncs()
          .filter(x => !x.inputs.filter(i => i.name === 'tokenId').length)
          .filter(x => !excluded.includes(x.name));
      };

      it('should execute all functions successfully', async () => {
        for (const func of getFuncs()) {
          const funcSig = funcFragmentToSig(func);
          paramValueMap.label = utils.id(`${funcSig}_label`);

          const req = await buidRequest(func, coinbase.address, 0, paramValueMap);
          const sig = await signTypedData(registry.address, coinbase, req);
          const [success, returnData] = await registry.callStatic.execute(req, sig);

          if (!success) {
            console.log(funcSig, func.inputs.map(x => paramValueMap[x.name]));
            console.error(getReason(returnData));
          }
          expect(success).to.be.eq(true);
        }
      });

      it('should revert execution of all functions when used signature', async () => {
        for (const func of getFuncs()) {
          const funcSig = funcFragmentToSig(func);
          paramValueMap.label = utils.id(`${funcSig}_doubleUse`);
          paramValueMap.key = utils.id(`${funcSig}_doubleUse`);

          const tokenIdForwarder = await registry.childIdOf(root, utils.id(`_${funcSig}`));
          const req = await buidRequest(func, coinbase.address, tokenIdForwarder, paramValueMap);
          const sig = await signTypedData(registry.address, coinbase, req);

          const [success, returnData] = await registry.callStatic.execute(req, sig);
          if (!success) {
            console.log(funcSig, func.inputs.map(x => paramValueMap[x.name]));
            console.error(getReason(returnData));
          }
          expect(success).to.be.eq(true);

          await registry.execute(req, sig);

          await expect(registry.execute(req, sig)).to.be
            .revertedWith('RegistryForwarder: SIGNATURE_INVALID');
        }
      });

      it('should revert execution of all functions when used signature and tokenId is empty', async () => {
        for (const func of getFuncs()) {
          const funcSig = funcFragmentToSig(func);
          paramValueMap.label = utils.id(`${funcSig}_doubleUse_0`);

          const tokenId = 0;
          const nonce = await registry.nonceOf(tokenId);
          const req = await buidRequest(func, coinbase.address, tokenId, paramValueMap);
          const sig = await signTypedData(registry.address, coinbase, req);

          const [success, returnData] = await registry.callStatic.execute(req, sig);
          if (!success) {
            console.log(funcSig, func.inputs.map(x => paramValueMap[x.name]));
            console.error(getReason(returnData));
          }
          expect(success).to.be.eq(true);

          await registry.execute(req, sig);

          expect(await registry.nonceOf(tokenId)).to.be.equal(nonce.add(1));
          await expect(registry.execute(req, sig)).to.be
            .revertedWith('RegistryForwarder: SIGNATURE_INVALID');
        }
      });
    });
  });

  describe('Old metatx', () => {
    const sign = async (data, address, nonce, signer) => {
      return signer.signMessage(
        utils.arrayify(
          utils.solidityKeccak256(
            [ 'bytes32', 'address', 'uint256' ],
            [ utils.keccak256(data), address, nonce ],
          ),
        ),
      );
    };

    describe('transferFromFor', () => {
      it('should transfer', async () => {
        const tok = await registry.childIdOf(root, 'label_34fw');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'transferFrom(address,address,uint256)',
          [owner.address, receiver.address, tok],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender)
          .transferFromFor(owner.address, receiver.address, tok, signature);

        assert.equal(await registry.ownerOf(tok), receiver.address);
      });

      it('should revert transfer by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_wr');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'transferFrom(address,address,uint256)',
          [owner.address, receiver.address, tok],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender).transferFromFor(owner.address, nonOwner.address, tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_mv6rg');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'transferFrom(address,address,uint256)',
          [owner.address, receiver.address, tok],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender).transferFromFor(owner.address, nonOwner.address, tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender).transferFromFor(owner.address, nonOwner.address, tok, '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender).transferFromFor(owner.address, nonOwner.address, tok, EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });

    describe('safeTransferFromFor', () => {
      const funcSig = 'safeTransferFromFor(address,address,uint256,bytes)';

      it('should transfer', async () => {
        const tok = await registry.childIdOf(root, 'label_fc24');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256)',
          [owner.address, receiver.address, tok],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender)[funcSig](owner.address, receiver.address, tok, signature);

        assert.equal(await registry.ownerOf(tok), receiver.address);
      });

      it('should revert transfer by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_dfgb34');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256)',
          [owner.address, receiver.address, tok],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender)[funcSig](owner.address, nonOwner.address, tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_sdr654');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256)',
          [owner.address, receiver.address, tok],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender)[funcSig](owner.address, nonOwner.address, tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender)[funcSig](owner.address, nonOwner.address, tok, '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender)[funcSig](owner.address, nonOwner.address, tok, EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });

    describe('safeTransferFromFor data', () => {
      const funcSig = 'safeTransferFromFor(address,address,uint256,bytes,bytes)';

      it('should transfer', async () => {
        const tok = await registry.childIdOf(root, 'label_vnm4');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256,bytes)',
          [owner.address, receiver.address, tok, '0x'],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender)[funcSig](owner.address, receiver.address, tok, '0x', signature);

        assert.equal(await registry.ownerOf(tok), receiver.address);
      });

      it('should revert transfer by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_sv32');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256,bytes)',
          [owner.address, receiver.address, tok, '0x'],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender)[funcSig](owner.address, receiver.address, tok, '0x', signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_sdff34');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData(
          'safeTransferFrom(address,address,uint256,bytes)',
          [owner.address, receiver.address, tok, '0x'],
        );
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender)[funcSig](owner.address, nonOwner.address, tok, '0x', signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender)[funcSig](owner.address, nonOwner.address, tok, '0x', '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender)[funcSig](owner.address, nonOwner.address, tok, '0x', EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });

    describe('burnFor', () => {
      it('should burn', async () => {
        const tok = await registry.childIdOf(root, 'label_vcxw4');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('burn(uint256)', [tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender).burnFor(tok, signature);

        await expect(registry.ownerOf(tok)).to.be.revertedWith('ERC721: owner query for nonexistent token');
      });

      it('should revert burn by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_aa31v');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('burn(uint256)', [tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender).burnFor(tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_lld431');
        await registry.mint(owner.address, tok, '');

        const wrongTok = await registry.childIdOf(root, 'label_lld431_wrong');
        await registry.mint(owner.address, wrongTok, '');

        const data = registry.interface.encodeFunctionData('burn(uint256)', [tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender).burnFor(wrongTok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender).burnFor(tok, '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender).burnFor(tok, EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });

    describe('resetFor', () => {
      it('should reset', async () => {
        const tok = await registry.childIdOf(root, 'label_wfv331');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('reset(uint256)', [tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender).resetFor(tok, signature);

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert reset by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_cvs11');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('burn(uint256)', [tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender).resetFor(tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_lg212');
        await registry.mint(owner.address, tok, '');

        const wrongTok = await registry.childIdOf(root, 'label_lg212_wrong');
        await registry.mint(owner.address, wrongTok, '');

        const data = registry.interface.encodeFunctionData('burn(uint256)', [tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender).resetFor(wrongTok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender).resetFor(tok, '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender).resetFor(tok, EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });

    describe('setFor', () => {
      it('should set', async () => {
        const tok = await registry.childIdOf(root, 'label_llsk113');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('set(string,string,uint256)', ['key1', 'v1', tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender).setFor('key1', 'v1', tok, signature);

        assert.equal(await registry.ownerOf(tok), owner.address);
        assert.equal(await registry.get('key1', tok), 'v1');
      });

      it('should revert set by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_cvl8s');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('set(string,string,uint256)', ['', '', tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender).setFor('', '', tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_vldm3');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('set(string,string,uint256)', ['', '', tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender).setFor('aaa', '', tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender).setFor('', '', tok, '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender).setFor('', '', tok, EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });

    describe('setManyFor', () => {
      it('should set many', async () => {
        const tok = await registry.childIdOf(root, 'label_dwe110');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface
          .encodeFunctionData('setMany(string[],string[],uint256)', [['key1'], ['1v'], tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender).setManyFor(['key1'], ['1v'], tok, signature);

        assert.equal(await registry.ownerOf(tok), owner.address);
        assert.equal(await registry.get('key1', tok), '1v');
      });

      it('should revert setMany by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_kcmn23');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('setMany(string[],string[],uint256)', [[''], [''], tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender).setManyFor([''], [''], tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_sdn31');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface.encodeFunctionData('setMany(string[],string[],uint256)', [['key'], [''], tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender).setManyFor([''], [''], tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender).setManyFor([''], [''], tok, '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender).setManyFor([''], [''], tok, EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });

    describe('reconfigureFor', () => {
      it('should reconfigure', async () => {
        const tok = await registry.childIdOf(root, 'label_cbc24');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface
          .encodeFunctionData('reconfigure(string[],string[],uint256)', [['key2'], ['1v'], tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await registry.connect(spender).reconfigureFor(['key2'], ['1v'], tok, signature);

        assert.equal(await registry.ownerOf(tok), owner.address);
        assert.equal(await registry.get('key2', tok), '1v');
      });

      it('should revert reconfigure by non-owner', async () => {
        const tok = await registry.childIdOf(root, 'label_safv3');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface
          .encodeFunctionData('reconfigure(string[],string[],uint256)', [[''], [''], tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), nonOwner);

        await expect(
          registry.connect(spender).reconfigureFor([''], [''], tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });

      it('should revert when signature is invalid', async () => {
        const tok = await registry.childIdOf(root, 'label_sfv421');
        await registry.mint(owner.address, tok, '');

        const data = registry.interface
          .encodeFunctionData('reconfigure(string[],string[],uint256)', [['1'], [''], tok]);
        const signature = await sign(data, registry.address, await registry.nonceOf(tok), owner);

        await expect(
          registry.connect(spender).reconfigureFor([''], [''], tok, signature),
        ).to.be.revertedWith('Registry: SENDER_IS_NOT_APPROVED_OR_OWNER');

        await expect(
          registry.connect(spender).reconfigureFor([''], [''], tok, '0x'),
        ).to.be.revertedWith('ECDSA: invalid signature length');

        await expect(
          registry.connect(spender).reconfigureFor([''], [''], tok, EMPTY_SIGNATURE),
        ).to.be.revertedWith('ECDSA: invalid signature');

        assert.equal(await registry.ownerOf(tok), owner.address);
      });
    });
  });
});