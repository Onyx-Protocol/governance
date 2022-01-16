# chn-gorvernance

1. Install package 
    ```
    yarn
    ``` 
    
2. Create .env file from .env.example
3. Fill value in .env:
   1. `ETHERSCAN_API_KEY`: Etherscan api key to verify contract
   2. `RPC_URL`: rpc for deployment
   3. `ACC_PRIVATE_KEY`: account which deploy all contract. This account will be set `admin` in `CHNTimelock` and `guardian` in `CHNGovernance`. Need deposit ETH to deploy contract
   4. `CHN_STAKING_ADDRESS`: address staking contract.
   5. `POOl_ID_STAKING`: pool id in staking contract. Weight vote of user will be calculate by amount staking in this pool of `CHN_STAKING_ADDRESS`.
   6. `QUORUM_VOTES`: The required minimum number of votes in support of a proposal for it to succeed.
   7. `PROPOSAL_THRESHOLD`: The minimum number of votes required for an account to create a proposal.
   8. `PROPOSAL_MAXOPERATIONS`: The maximum number of actions that can be included in a proposal. Actions are functions calls that will be made when a proposal succeeds and executes
   9. `VOTING_DELAY`: The number of Ethereum blocks to wait before voting on a proposal may begin. This value is added to the current block number when a proposal is created.
   10. `VOTING_PERIOD`: The duration of voting on a proposal, in Ethereum blocks.
   11. `TIMELOCK_DELAY`: Time delay to queue transaction in timelock. The unit is in seconds.
4. Compile
    ```
    yarn hardhat compile
    ```
5. Deploy + verify:
    ```
    yarn hardhat deploy --reset --tags deploy-verify  --network rinkeby
    ```
    This script will deploy + verify both timelock contract and governance contract. After that, this will queue transaction which set chn governance address as a pending admin for time lock. After `TIMELOCK_DELAY` + 1000 seconds, you need excute it in queue + confirm it in chn governance contract.