# RToken Livepeer Experiment
Project testing integration of a Livepeer Delegator with RToken to enable minting of liquid assets for bonded LPT. 
 
## Run tests
To run the tests for an RToken with a LiveperAllocationStrategy:

1) In each of the directories:
- `livepeer-protocol`
- `rtoken-contracts`
- `rtoken-livepeer-tests`
- `rtoken-livepeer-tests-v4-contracts`   

Install dependencies by executing:
```
npm install
```

Note: when installing dependencies in the `livepeer-protocol` directory, an `npm install node-gyp` may be required first.  

2) Run a local ganache instance in a separate terminal:
```
ganache-cli
```

3) In the `rtoken-livepeer-tests-v4-contracts` directory, compile the Livepeer Solidity v0.4 contracts (which will be
 put in the `rToken-livepeer-tests` build folder) by executing:
```
truffle compile
```
Note: if it's not compiling you may have to delete the `build` folder in the `rtoken-livepeer-tests` directory if it's already present.

4) In the `rtoken-livepeer-tests` directory run:  
```
truffle compile
truffle test
```
