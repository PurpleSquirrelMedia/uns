// @author Unstoppable Domains, Inc.
// @date August 12th, 2021

pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol';

import './IForwarder.sol';

abstract contract BaseForwarder is IForwarder {
    using ECDSAUpgradeable for bytes32;

    function _verify(
        ForwardRequest calldata req,
        address target,
        bytes calldata signature
    ) internal view returns (bool) {
        uint256 nonce = this.nonceOf(req.tokenId);
        address signer = keccak256(abi.encodePacked(keccak256(req.data), target, nonce))
            .toEthSignedMessageHash()
            .recover(signature);
        return nonce == req.nonce && signer == req.from;
    }

    function _verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            // Look for revert reason and bubble it up if present
            if (returndata.length > 0) {
                // The easiest way to bubble the revert reason is using memory via assembly

                //solhint-disable-next-line no-inline-assembly
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}
