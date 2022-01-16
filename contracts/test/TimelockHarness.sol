pragma solidity ^0.5.16;

import "../CHNTimelock.sol";

interface Administered {
    function _acceptAdmin() external returns (uint);
}

contract TimelockHarness is CHNTimelock {
    constructor(address admin_, uint delay_)
        CHNTimelock(admin_, delay_) public {
    }

    function harnessSetPendingAdmin(address pendingAdmin_) public {
        pendingAdmin = pendingAdmin_;
    }

    function harnessSetAdmin(address admin_) public {
        admin = admin_;
    }

    function harnessExecuteTransactionWithID(uint256 id) public payable returns (bytes memory) {
        TransactionData memory queueData = txQueues[id];
        bytes32 txHash = queueData.txHash;
        queuedTransactions[txHash] = false;

        bytes memory callData;

        if (bytes(queueData.signature).length == 0) {
            callData = queueData.data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(queueData.signature))), queueData.data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = queueData.target.call.value(queueData.value)(callData);
        require(success, "Timelock::executeTransaction: Transaction execution reverted.");

        return returnData;

    }
}
